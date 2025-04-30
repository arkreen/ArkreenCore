import { Fixture } from 'ethereum-waffle'
import { BigNumber, constants, Contract, ContractTransaction, Wallet, utils } from 'ethers'
import { waffle, ethers, upgrades } from 'hardhat'
import { IWETH9, MockTimeNonfungiblePositionManager, MockTimeSwapRouter, TestERC20, GreenBTCLucky } from '../../typechain'
import completeFixture from '../utils/completeFixture'
import { mine } from "@nomicfoundation/hardhat-network-helpers";
import { FeeAmount, TICK_SPACINGS } from '../utils/constants'
import { encodePriceSqrt } from '../utils/encodePriceSqrt'
import { expandTo18Decimals, getLuckyDrawRedeemHash, expandTo6Decimals } from "../utils/utilities"
import { expect } from '../utils/expect'
import { encodePath } from '../utils/path'
import { getMaxTick, getMinTick } from '../utils/ticks'
import { abi as IUniswapV3PoolABI } from '@uniswap/v3-core/artifacts/contracts/interfaces/IUniswapV3Pool.sol/IUniswapV3Pool.json'
import { computePoolAddress } from '../utils/computePoolAddress'
import { anyValue } from "@nomicfoundation/hardhat-chai-matchers/withArgs";
import { ecsign } from 'ethereumjs-util'

import { IUniswapV3Pool } from '../../typechain'

interface LuckyConfig {
  times:      number
  ratio:      number
}

interface BaseValue {
  base:       number
  exp:        number
}

interface LotteryInfo {
  tokenId:      number
  baseValue:    BaseValue
  routerId:     number
  swapPathId:   number
  prize:        LuckyConfig[]
}

// lotteryInfo:  tokenId (1B) || baseValue (3B) || routerId (1B) || swapPathId (1B) || free (1B) || level (1B) || [ratio, times](8)  
export function convertLotteryInfo(lotteryInfo: LotteryInfo): BigNumber {
  let lotteryInfoBN: BigNumber = BigNumber.from(0)
  lotteryInfoBN = lotteryInfoBN.add(BigNumber.from(lotteryInfo.tokenId).shl(248))
  lotteryInfoBN = lotteryInfoBN.add(BigNumber.from(lotteryInfo.baseValue.base).shl(8).add(lotteryInfo.baseValue.exp).shl(224))
  lotteryInfoBN = lotteryInfoBN.add(BigNumber.from(lotteryInfo.routerId).shl(216))
  lotteryInfoBN = lotteryInfoBN.add(BigNumber.from(lotteryInfo.swapPathId).shl(208))
  lotteryInfoBN = lotteryInfoBN.add(BigNumber.from(lotteryInfo.prize.length).shl(192))

  for (let index = 0; index < lotteryInfo.prize.length; index++) {
    let config = BigNumber.from(lotteryInfo.prize[index].times).shl(12).add(BigNumber.from(lotteryInfo.prize[index].ratio))
    lotteryInfoBN = lotteryInfoBN.add(config.shl(index * 24))
  }
  return lotteryInfoBN  
}

describe('GreenBTCLucky', function () {
  this.timeout(2000000)
  let wallet: Wallet
  let trader: Wallet
  let luckMananger: Wallet

  let privateKeyRegister:     string

  const swapRouterFixture: Fixture<{
    weth9: IWETH9
    factory: Contract
    router: MockTimeSwapRouter
    nft: MockTimeNonfungiblePositionManager
    tokens: [TestERC20, TestERC20, TestERC20]
  }> = async (wallets, provider) => {
    const { weth9, factory, router, tokens, nft } = await completeFixture(wallets, provider)

    // approve & fund wallets
    for (const token of tokens) {
      await token.approve(router.address, constants.MaxUint256)
      await token.approve(nft.address, constants.MaxUint256)
      await token.connect(trader).approve(router.address, constants.MaxUint256)
      await token.transfer(trader.address, expandTo18Decimals(1_000_000))
    }

    return {
      weth9,
      factory,
      router,
      tokens,
      nft,
    }
  }

  let factory: Contract
  let weth9: IWETH9
  let router: MockTimeSwapRouter
  let nft: MockTimeNonfungiblePositionManager
  let tokens: [TestERC20, TestERC20, TestERC20]
  let USDT: TestERC20
  let USDC: TestERC20
  let WBTC: TestERC20
  let kWhToken: TestERC20
  let TEST: TestERC20
  let poolUSDTUSDC: IUniswapV3Pool 
  let poolUSDCWBTC: IUniswapV3Pool
  let greenBTCLucky: GreenBTCLucky

  let getBalances: (
    who: string
  ) => Promise<{
    weth9: BigNumber
    USDT: BigNumber
    USDC: BigNumber
    WBTC: BigNumber
  }>

  let loadFixture: ReturnType<typeof waffle.createFixtureLoader>

  before('create fixture loader', async () => {
    ;[wallet, trader, luckMananger] = await (ethers as any).getSigners()
    loadFixture = waffle.createFixtureLoader([wallet, trader, luckMananger])

    ;({ router, weth9, factory, tokens, nft } = await loadFixture(swapRouterFixture))

    privateKeyRegister = process.env.REGISTER_TEST_PRIVATE_KEY as string

    async function createPool(tokenAddressA: string, tokenAddressB: string, feeLevel: FeeAmount, priceSqrt: BigNumber) {
      if (tokenAddressA.toLowerCase() > tokenAddressB.toLowerCase())
        [tokenAddressA, tokenAddressB] = [tokenAddressB, tokenAddressA]

      await nft.createAndInitializePoolIfNecessary(
        tokenAddressA,
        tokenAddressB,
        feeLevel,
        priceSqrt
      )

      const liquidityParams = {
        token0: tokenAddressA,
        token1: tokenAddressB,
        fee: feeLevel,
        tickLower: getMinTick(TICK_SPACINGS[feeLevel]),
        tickUpper: getMaxTick(TICK_SPACINGS[feeLevel]),
        recipient: wallet.address,
        amount0Desired: 100000000 * (10**6),
        amount1Desired: 100000000 * (10**6),
        amount0Min: 0,
        amount1Min: 0,
        deadline: 1,
      }
      return nft.mint(liquidityParams)
    }

    const tokenFactory = await ethers.getContractFactory('TestERC20')
    kWhToken = (await tokenFactory.deploy(constants.MaxUint256.div(2), 18, "Test kWh", "kWh")) as TestERC20
    TEST = (await tokenFactory.deploy(constants.MaxUint256.div(2), 18, "Test Token", "TEST")) as TestERC20

    for ( let index=0; index <3; index++) {
      const symbol = await tokens[index].symbol();
      if (symbol == "WBTC") WBTC = tokens[index];
      if (symbol == "USDT") USDT = tokens[index];
      if (symbol == "USDC") USDC = tokens[index];
    }
    
    const GreenBTCLuckyFactory = await ethers.getContractFactory("GreenBTCLucky")
    greenBTCLucky = await upgrades.deployProxy(GreenBTCLuckyFactory, [WBTC.address, kWhToken.address, router.address]) as GreenBTCLucky
    await greenBTCLucky.deployed()

    await createPool(USDT.address, USDC.address, FeeAmount.LOW, encodePriceSqrt(1, 1))      // USDT/USDC
    const poolUSDTUSDCAddress = await factory.getPool(USDT.address, USDC.address, FeeAmount.LOW)
    poolUSDTUSDC = new ethers.Contract(poolUSDTUSDCAddress, IUniswapV3PoolABI, wallet) as IUniswapV3Pool

    let priceSqrt
    if (USDC.address < WBTC.address) priceSqrt = encodePriceSqrt(10**8, 100000 * (10**6))      // 1 BTC = 100000 UST
    else priceSqrt = encodePriceSqrt( 100000 * (10**6), 10**8)
    
    await createPool(USDC.address, WBTC.address, FeeAmount.MEDIUM, priceSqrt)                // USDC /WBTC
    const poolUSDCWBTCAddress = await factory.getPool(USDC.address, WBTC.address, FeeAmount.MEDIUM)
    poolUSDCWBTC = new ethers.Contract(poolUSDCWBTCAddress, IUniswapV3PoolABI, wallet) as IUniswapV3Pool

    await greenBTCLucky.managePayTokens(0, WBTC.address)
    await greenBTCLucky.managePayTokens(1, USDT.address)
    await greenBTCLucky.managePayTokens(2, USDC.address)
    await greenBTCLucky.managePayTokens(3, TEST.address)

    // lotteryInfo:  tokenId (1B) || baseValue (3B) || routerId (1B) || swapPathId (1B) || free (1B) || level (1B) || [ratio, times](8)  
    // 0x00 0004b0 00 00 00 03 000000 000000 000000 000000 000000 140012  020142 640fff 
    const lotteryInfoWBTC: LotteryInfo = {
        tokenId:        0,                      // 1 Byte
        baseValue:      {base: 1200, exp: 0},   // 2 Byte
        routerId:       0,                      // 1 Byte
        swapPathId:     0,                      // 1 Byte
        prize:   [
          { ratio: 255 * 16 + 15 , times: 100 * 16 + 0 },      // Relative ,  10% of the pool 
          { ratio:   1 * 16 +  2 , times:  20 * 16 + 0},       //       1% ,  20 Times 
          { ratio:  20 * 16 +  2 , times:   2 * 16 + 0 },      //      20% ,  2 Times
        ]
    }

    // 0x01 03e803 00 00 00 03 000000 000000 000000 000000 000000 0a0022 020142 0a0fff 
    const lotteryInfoUSDT: LotteryInfo = {
      tokenId:        1,                      // 1 Byte
      baseValue:      {base: 1000, exp: 3},   // 2 Byte, 1 USDT
      routerId:       0,                      // 1 Byte
      swapPathId:     0,                      // 1 Byte
      prize:   [
        { ratio: 255 * 16 + 15 , times:  10 * 16 + 0 },      // Relative ,  1% of the pool 
        { ratio:   2 * 16 +  2 , times:  10 * 16 + 0},       //       2% ,  10 Times 
        { ratio:  20 * 16 +  2 , times:   2 * 16 + 0 },      //      20% ,  2 Times
      ]
    }

    // lotteryInfo: tokenId (1B) || baseValue (3B) || routerId (1B) || swapPathId (1B) || free (1B) || level (1B) || [times, ratio](8)
    // 0x02 271002 00 00 00 03 000000 000000 000000 000000 000000 140012 020142 320fff
    const lotteryInfoUSDC: LotteryInfo = {
      tokenId:        2,                      // 1 Byte
      baseValue:      {base: 10000, exp: 2},  // 2 Byte
      routerId:       0,                      // 1 Byte
      swapPathId:     0,                      // 1 Byte
      prize:   [
        { ratio: 255 * 16 + 15 , times:  50 * 16 + 0 },      // Relative ,  5% of the pool 
        { ratio:   1 * 16 +  2 , times:  20 * 16 + 0},       //       1% ,  20 Times 
        { ratio:  20 * 16 +  2 , times:   2 * 16 + 0 },      //      20% ,  2 Times
      ]
    }

    // 0x03 271012 00 00 00 03 000000 000000 000000 000000 000000 140012 020142 320fff
    const lotteryInfoTEST: LotteryInfo = {
      tokenId:        3,                      // 1 Byte
      baseValue:      {base: 10000, exp: 18}, // 10000 TEST, 2 bytes
      routerId:       0,                      // 1 Byte
      swapPathId:     0,                      // 1 Byte
      prize:   [
        { ratio: 255 * 16 + 15 , times:  50 * 16 + 0 },      // Relative ,  5% of the pool 
        { ratio:   1 * 16 +  2 , times:  20 * 16 + 0},       //       1% ,  20 Times 
        { ratio:  20 * 16 +  2 , times:   2 * 16 + 0 },      //      20% ,  2 Times
      ]
    }

    const lotteryIdWBTC = 1
    await greenBTCLucky.addLottery(lotteryIdWBTC, convertLotteryInfo(lotteryInfoWBTC))

    const lotteryIdUSDT = 2
    await greenBTCLucky.addLottery(lotteryIdUSDT, convertLotteryInfo(lotteryInfoUSDT))

    const lotteryIdUSDC = 3
    await greenBTCLucky.addLottery(lotteryIdUSDC, convertLotteryInfo(lotteryInfoUSDC))

    const lotteryIdTEST = 4
    await greenBTCLucky.addLottery(lotteryIdTEST, convertLotteryInfo(lotteryInfoTEST))

    const maxTickets = 100    
    const gapBlockRefund = 100
    const minPoolReserve = 10 ** 8
    await greenBTCLucky.manageSetting(maxTickets, gapBlockRefund, minPoolReserve)

    await WBTC.approve(greenBTCLucky.address, constants.MaxUint256)
    await USDT.approve(greenBTCLucky.address, constants.MaxUint256)
    await USDC.approve(greenBTCLucky.address, constants.MaxUint256)
    await TEST.approve(greenBTCLucky.address, constants.MaxUint256)

    await greenBTCLucky.fundLucky(2* (10**8))     // Fund 2 BTC
    await greenBTCLucky.approveRouter([USDT.address, USDC.address], constants.AddressZero)

    getBalances = async (who: string) => {
      const balances = await Promise.all([
        weth9.balanceOf(who),
        USDT.balanceOf(who),
        USDC.balanceOf(who),
        WBTC.balanceOf(who),
      ])
      return {
        weth9: balances[0],
        USDT: balances[1],
        USDC: balances[2],
        WBTC: balances[3],
      }
    }
  })

  it("GreenBTCLucky addLottery test", async function () {
    // Abnormal testing            

    let lotteryInfoTEST: LotteryInfo = {
      tokenId:        3,                      // 1 Byte
      baseValue:      {base: 10000, exp: 18}, // 10000 TEST, 2 bytes
      routerId:       0,                      // 1 Byte
      swapPathId:     0,                      // 1 Byte
      prize:   [
        { ratio: 255 * 16 + 15 , times:  50 * 16 + 0 },      // Relative ,  5% of the pool 
        { ratio:   1 * 16 +  2 , times:  20 * 16 + 0},       //       1% ,  20 Times 
        { ratio:  20 * 16 +  2 , times:   2 * 16 + 0 },      //      20% ,  2 Times
      ]
    }

    const lotteryIdTEST = 4
    await expect(greenBTCLucky.connect(trader).addLottery(lotteryIdTEST, convertLotteryInfo(lotteryInfoTEST)))
            .to.be.revertedWith("Ownable: caller is not the owner") 

    await expect(greenBTCLucky.addLottery(lotteryIdTEST, convertLotteryInfo(lotteryInfoTEST)))
            .to.be.revertedWith("YBTC: Already Added") 

    lotteryInfoTEST.tokenId = 6
    await expect(greenBTCLucky.addLottery(10, convertLotteryInfo(lotteryInfoTEST)))
            .to.be.revertedWith("YBTC: Token Not Defined") 

    lotteryInfoTEST.tokenId = 3
    lotteryInfoTEST.routerId = 6
    await expect(greenBTCLucky.addLottery(10, convertLotteryInfo(lotteryInfoTEST)))
            .to.be.revertedWith("YBTC: Wrong Router ID") 

    let path = utils.solidityPack(['address', 'uint24', 'address'], [USDC.address, FeeAmount.MEDIUM, WBTC.address])
    await greenBTCLucky.manageSwapPath(3, path.slice(0,40)) 
        
    lotteryInfoTEST.routerId = 0
    lotteryInfoTEST.swapPathId = 3
    await expect(greenBTCLucky.addLottery(10, convertLotteryInfo(lotteryInfoTEST)))
            .to.be.revertedWith("YBTC: Wrong Path ID") 

    await greenBTCLucky.manageSwapPath(3, path) 
    await greenBTCLucky.addLottery(10, convertLotteryInfo(lotteryInfoTEST))

    expect(await greenBTCLucky.lotteryList(10)).to.eq(convertLotteryInfo(lotteryInfoTEST))
  })

  
  it("GreenBTCLucky fundLucky test", async function () {
    // Abnormal testing            
    await expect(greenBTCLucky.fundLucky(0)).to.be.revertedWith("YBTC: Zero Value")

    // Nomal test
    const poolReserveBefore = await greenBTCLucky.poolReserve()
    const lbtcBalanceBefore = await greenBTCLucky.balanceOf(wallet.address)
    const wbTCBalanceBefore = await WBTC.balanceOf(greenBTCLucky.address)

    await greenBTCLucky.fundLucky(1 * (10**8))     // Fund 1 BTC, Total 3 BTC 

    const poolReserveAfter = await greenBTCLucky.poolReserve()
    const lbtcBalanceAfter = await greenBTCLucky.balanceOf(wallet.address)
    const wbTCBalanceAfter = await WBTC.balanceOf(greenBTCLucky.address)

    expect(poolReserveAfter).to.deep.equal(poolReserveBefore.add(100 * (10**8)))      //Reserve is stored in 100X. 
    expect(lbtcBalanceAfter).to.deep.equal(lbtcBalanceBefore.add(1 * (10**8)))
    expect(wbTCBalanceAfter).to.deep.equal(wbTCBalanceBefore.add(1 * (10**8)))

    // Event test
    await expect(greenBTCLucky.fundLucky(2 * (10**8)))    // Fund 2 BTC, Total 5 BTC 
            .to.emit(WBTC, 'Transfer')
            .withArgs(wallet.address, greenBTCLucky.address, 2 * (10**8))
            .to.emit(greenBTCLucky, 'Transfer')
            .withArgs(constants.AddressZero, wallet.address, 2 * (10**8))
            .to.emit(greenBTCLucky, 'LuckyFund')
            .withArgs(wallet.address, 2 * (10**8), 2 * (10**8))

  })

  it("GreenBTCLucky gainLucky test", async function () {

    await greenBTCLucky.playLucky(3, 50, 0)          //  USDC, 50U

    // Nomal test
    const poolReserveBefore = await greenBTCLucky.poolReserve()
    const projectReserveBefore = await greenBTCLucky.projectReserve()
    const luckyReserveBefore = await greenBTCLucky.luckyReserve()
    const lbtcBalanceBefore = await greenBTCLucky.balanceOf(wallet.address)
    const wbTCBalanceBefore = await WBTC.balanceOf(greenBTCLucky.address)

    // Abnormal testing            
    await expect(greenBTCLucky.gainLucky(0)).to.be.revertedWith("YBTC: Zero Value")
    await expect(greenBTCLucky.gainLucky(6 * (10**8))).to.be.revertedWith("YBTC: Take More")

    await mine(5);
    const amountWithdraw = 1 * (10**8)
    await expect(greenBTCLucky.gainLucky(amountWithdraw)).to.be.revertedWith("YBTC: Need to Wait")

    await mine(100);                    // Need to wait the gap 

    // Normal test 
    await greenBTCLucky.gainLucky(amountWithdraw)         // Withdraw 1 BTC, Total 4 BTC 

    const poolReserveAfter = await greenBTCLucky.poolReserve()
    const projectReserveAfter = await greenBTCLucky.projectReserve()
    const luckyReserveAfter = await greenBTCLucky.luckyReserve()
    const lbtcBalanceAfter = await greenBTCLucky.balanceOf(wallet.address)
    const wbTCBalanceAfter = await WBTC.balanceOf(greenBTCLucky.address)

    const amountAllOut1 = poolReserveBefore.sub(luckyReserveBefore).mul(amountWithdraw).div(lbtcBalanceBefore).div(100)
    const amountFee1 = amountAllOut1.div(1000)
    const amountReceived1 = amountAllOut1.sub(amountFee1)

    expect(poolReserveAfter).to.deep.equal(poolReserveBefore.sub(amountAllOut1.mul(100)))      //Reserve is stored in 100X. 
    expect(projectReserveAfter).to.deep.equal(projectReserveBefore.add(amountFee1.mul(100)))      //Reserve is stored in 100X. 
    expect(luckyReserveAfter).to.deep.equal(luckyReserveBefore)
    expect(lbtcBalanceAfter).to.deep.equal(lbtcBalanceBefore.sub(amountWithdraw))
    expect(wbTCBalanceAfter).to.deep.equal(wbTCBalanceBefore.sub(amountReceived1))

    const amountAllOut2 = poolReserveAfter.sub(luckyReserveBefore).mul(amountWithdraw).div(lbtcBalanceAfter).div(100)
    const amountFee2 = amountAllOut2.div(1000)
    const amountReceived2 = amountAllOut2.sub(amountFee2)

    // Event test
    let gainLuckyTx 
    await expect(gainLuckyTx = await greenBTCLucky.gainLucky(1 * (10**8)))      // Withdraw 1 BTC, Total 3 BTC 
            .to.emit(greenBTCLucky, 'Transfer')
            .withArgs(wallet.address, constants.AddressZero, 1 * (10**8))
            .to.emit(WBTC, 'Transfer')
            .withArgs(greenBTCLucky.address, wallet.address, amountReceived2)
            .to.emit(greenBTCLucky, 'LuckyGain')
            .withArgs(wallet.address, 1 * (10**8), amountReceived2)

    const receiptGainLucky = await gainLuckyTx.wait()
    console.log('gainLucky gas usage:', receiptGainLucky.gasUsed )

  })

  it("GreenBTCLucky playLucky test: Normal and Abnormal", async function () {

    // Case1: Abnormal testing  
    let minPoolReserve = 10 * (10 ** 8) 
    await greenBTCLucky.manageSetting(0, 0, minPoolReserve)
    await expect(greenBTCLucky.playLucky(3, 50, 0)).to.be.revertedWith("LowReserve()")
    minPoolReserve = 1 * (10 ** 8) 
    await greenBTCLucky.manageSetting(0, 0, minPoolReserve)

    await expect(greenBTCLucky.playLucky(3, 500, 0)).to.be.revertedWith("TooMoreTickets(100)")
    await expect(greenBTCLucky.playLucky(30, 50, 0)).to.be.revertedWith("WrongLotteryId(30)")

    await greenBTCLucky.toggleLottery(3)
    await expect(greenBTCLucky.playLucky(3, 50, 0)).to.be.revertedWith("LotteryDisabled(3)")
    await greenBTCLucky.toggleLottery(3)

    await expect(greenBTCLucky.playLucky(4, 50, 0)).to.be.revertedWith("TokenRejected(3)")

    // Case 2:  Normal test 
    let drawId = await greenBTCLucky.drawId()

    let grossIncomeBefore = await greenBTCLucky.grossIncome()
    let poolReserveBefore = await greenBTCLucky.poolReserve()
    let luckyReserveBefore = await greenBTCLucky.luckyReserve()
    let projectReserveBefore = await greenBTCLucky.projectReserve()
    let publicGoodsReserveBefore = await greenBTCLucky.publicGoodsReserve()
    let greenBTCReserveBefore = await greenBTCLucky.greenBTCReserve()
    let lbtcBalanceBefore = await greenBTCLucky.balanceOf(wallet.address)
    let wbTCBalanceBefore = await WBTC.balanceOf(greenBTCLucky.address)

    drawId += 1
    await expect(greenBTCLucky.playLucky(3, 10, 0))
              .to.emit(USDC, 'Transfer')
              .withArgs(wallet.address, greenBTCLucky.address, 10 * (10**6))      // 10 USDC
              .to.emit(greenBTCLucky, 'LuckyDraw')
              .withArgs(wallet.address, drawId, 3, 10 * (10**6), anyValue, 10)

    let grossIncomeAfter = await greenBTCLucky.grossIncome()
    let poolReserveAfter = await greenBTCLucky.poolReserve()
    let luckyReserveAfter = await greenBTCLucky.luckyReserve()
    let projectReserveAfter = await greenBTCLucky.projectReserve()
    let publicGoodsReserveAfter = await greenBTCLucky.publicGoodsReserve()
    let greenBTCReserveAfter = await greenBTCLucky.greenBTCReserve()
    let lbtcBalanceAfter = await greenBTCLucky.balanceOf(wallet.address)
    let wbTCBalanceAfter = await WBTC.balanceOf(greenBTCLucky.address)

    const amountWBTC = wbTCBalanceAfter.sub(wbTCBalanceBefore)
    expect(grossIncomeAfter).to.deep.equal(grossIncomeBefore.add(amountWBTC.mul(100)))
    expect(poolReserveAfter).to.deep.equal(poolReserveBefore.add(amountWBTC.mul(93)))
    expect(luckyReserveAfter).to.deep.equal(luckyReserveBefore.add(amountWBTC.mul(10)))
    expect(projectReserveAfter).to.deep.equal(projectReserveBefore.add(amountWBTC.mul(2)))
    expect(publicGoodsReserveAfter).to.deep.equal(publicGoodsReserveBefore.add(amountWBTC.mul(3)))
    expect(greenBTCReserveAfter).to.deep.equal(greenBTCReserveBefore.add(amountWBTC.mul(2)))
    expect(lbtcBalanceAfter).to.deep.equal(lbtcBalanceBefore)

    let drawIndex = BigNumber.from(drawId).shl(160).add(BigNumber.from(wallet.address))
    let lastBlock = await ethers.provider.getBlock('latest')
    let drawInfo = BigNumber.from(lastBlock.number).shl(224)
                    .add(amountWBTC.shl(192))
                    .add(BigNumber.from(10).shl(176))
                    .add(BigNumber.from(3).shl(160))
                    .add(poolReserveAfter)
    expect(await greenBTCLucky.drawInfo(drawIndex)).to.deep.equal(drawInfo)
    expect(await greenBTCLucky.lastDrawHeight()).to.deep.equal(lastBlock.number)

    // Case 3: USDT Test
    drawId += 1
    await expect(greenBTCLucky.playLucky(2, 20, 0))
              .to.emit(USDT, 'Transfer')
              .withArgs(wallet.address, greenBTCLucky.address, 20 * (10**6))      // 20 USDT
              .to.emit(greenBTCLucky, 'LuckyDraw')
              .withArgs(wallet.address, drawId, 2, 20 * (10**6), anyValue, 20)

    let grossIncomeAfterUSDT = await greenBTCLucky.grossIncome()
    let poolReserveAfterUSDT = await greenBTCLucky.poolReserve()
    let luckyReserveAfterUSDT = await greenBTCLucky.luckyReserve()
    let projectReserveAfterUSDT = await greenBTCLucky.projectReserve()
    let publicGoodsReserveAfterUSDT = await greenBTCLucky.publicGoodsReserve()
    let greenBTCReserveAfterUSDT = await greenBTCLucky.greenBTCReserve()
    let lbtcBalanceAfterUSDT = await greenBTCLucky.balanceOf(wallet.address)
    let wbTCBalanceAfterUSDT = await WBTC.balanceOf(greenBTCLucky.address)

    const amountWBTCUSDT = wbTCBalanceAfterUSDT.sub(wbTCBalanceAfter)
    expect(grossIncomeAfterUSDT).to.deep.equal(grossIncomeAfter.add(amountWBTCUSDT.mul(100)))
    expect(poolReserveAfterUSDT).to.deep.equal(poolReserveAfter.add(amountWBTCUSDT.mul(93)))
    expect(luckyReserveAfterUSDT).to.deep.equal(luckyReserveAfter.add(amountWBTCUSDT.mul(10)))
    expect(projectReserveAfterUSDT).to.deep.equal(projectReserveAfter.add(amountWBTCUSDT.mul(2)))
    expect(publicGoodsReserveAfterUSDT).to.deep.equal(publicGoodsReserveAfter.add(amountWBTCUSDT.mul(3)))
    expect(greenBTCReserveAfterUSDT).to.deep.equal(greenBTCReserveAfter.add(amountWBTCUSDT.mul(2)))
    expect(lbtcBalanceAfterUSDT).to.deep.equal(lbtcBalanceAfter)

    const drawIndexUSDT = BigNumber.from(drawId).shl(160).add(BigNumber.from(wallet.address))
    const lastBlockUSDT = await ethers.provider.getBlock('latest')
    const drawInfoUSDT = BigNumber.from(lastBlockUSDT.number).shl(224)
                    .add(amountWBTCUSDT.shl(192))
                    .add(BigNumber.from(20).shl(176))       // tickets
                    .add(BigNumber.from(2).shl(160))        // lotteryId
                    .add(poolReserveAfterUSDT)
    expect(await greenBTCLucky.drawInfo(drawIndexUSDT)).to.deep.equal(drawInfoUSDT)
    expect(await greenBTCLucky.lastDrawHeight()).to.deep.equal(lastBlockUSDT.number)

    // Case 4: WBTC Test
    drawId += 1
    await expect(greenBTCLucky.playLucky(1, 30, 0))
              .to.emit(WBTC, 'Transfer')
              .withArgs(wallet.address, greenBTCLucky.address, 30 * 1200)        // 30 * 1000 Sats
              .to.emit(greenBTCLucky, 'LuckyDraw')
              .withArgs(wallet.address, drawId, 1, 30 * 1200, anyValue, 30)

    let grossIncomeAfterWBTC = await greenBTCLucky.grossIncome()
    let poolReserveAfterWBTC = await greenBTCLucky.poolReserve()
    let luckyReserveAfterWBTC = await greenBTCLucky.luckyReserve()
    let projectReserveAfterWBTC = await greenBTCLucky.projectReserve()
    let publicGoodsReserveAfterWBTC = await greenBTCLucky.publicGoodsReserve()
    let greenBTCReserveAfterWBTC = await greenBTCLucky.greenBTCReserve()
    let lbtcBalanceAfterWBTC = await greenBTCLucky.balanceOf(wallet.address)
    let wbTCBalanceAfterWBTC = await WBTC.balanceOf(greenBTCLucky.address)

    const amountWBTCWBTC = wbTCBalanceAfterWBTC.sub(wbTCBalanceAfterUSDT)
    expect(grossIncomeAfterWBTC).to.deep.equal(grossIncomeAfterUSDT.add(amountWBTCWBTC.mul(100)))
    expect(poolReserveAfterWBTC).to.deep.equal(poolReserveAfterUSDT.add(amountWBTCWBTC.mul(93)))
    expect(luckyReserveAfterWBTC).to.deep.equal(luckyReserveAfterUSDT.add(amountWBTCWBTC.mul(10)))
    expect(projectReserveAfterWBTC).to.deep.equal(projectReserveAfterUSDT.add(amountWBTCWBTC.mul(2)))
    expect(publicGoodsReserveAfterWBTC).to.deep.equal(publicGoodsReserveAfterUSDT.add(amountWBTCWBTC.mul(3)))
    expect(greenBTCReserveAfterWBTC).to.deep.equal(greenBTCReserveAfterUSDT.add(amountWBTCWBTC.mul(2)))
    expect(lbtcBalanceAfterWBTC).to.deep.equal(lbtcBalanceAfter)

    const drawIndexWBTC = BigNumber.from(drawId).shl(160).add(BigNumber.from(wallet.address))
    const lastBlockWBTC = await ethers.provider.getBlock('latest')
    const drawInfoWBTC = BigNumber.from(lastBlockWBTC.number).shl(224)
                    .add(amountWBTCWBTC.shl(192))
                    .add(BigNumber.from(30).shl(176))
                    .add(BigNumber.from(1).shl(160))
                    .add(poolReserveAfterWBTC)
    expect(await greenBTCLucky.drawInfo(drawIndexWBTC)).to.deep.equal(drawInfoWBTC)
    expect(await greenBTCLucky.lastDrawHeight()).to.deep.equal(lastBlockWBTC.number)
    
    // Case 5: Gas usage
    drawId += 1
    let playLuckyUSDC = await greenBTCLucky.playLucky(3, 50, 0)          //  USDC, 50U
    const receiptUSDC = await playLuckyUSDC.wait()
    console.log('PlayLucky with USDC gas usage:', receiptUSDC.gasUsed )

    drawId += 1
    let playLuckyUSDT = await greenBTCLucky.playLucky(2, 50, 0)          //  USDT, 50U
    const receiptUSDT = await playLuckyUSDT.wait()
    console.log('PlayLucky with USDT gas usage:', receiptUSDT.gasUsed )

    drawId += 1
    let playLuckyWBTC = await greenBTCLucky.playLucky(1, 50, 0)          //  WBTC, 50 draw
    const receiptWBTC = await playLuckyWBTC.wait()
    console.log('PlayLucky with WBTC gas usage:', receiptWBTC.gasUsed )

    // Case 6: USDC single draw mode 
    drawId += 1
    await greenBTCLucky.playLucky(3, 50, 1) 
    drawIndex = BigNumber.from(drawId).shl(160).add(BigNumber.from(wallet.address))
    drawInfo = await greenBTCLucky.drawInfo(drawIndex)
    expect(drawInfo.shr(176).and(0xFFFF)).to.deep.equal(1)

    // Case 7: USDT single draw mode 
    drawId += 1
    await greenBTCLucky.playLucky(2, 60, 1)  
    drawIndex = BigNumber.from(drawId).shl(160).add(BigNumber.from(wallet.address))
    drawInfo = await greenBTCLucky.drawInfo(drawIndex)
    expect(drawInfo.shr(176).and(0xFFFF)).to.deep.equal(1)

    // Case 8: WBTC single draw mode 
    drawId += 1
    await greenBTCLucky.playLucky(1, 70, 1)
    drawIndex = BigNumber.from(drawId).shl(160).add(BigNumber.from(wallet.address))
    drawInfo = await greenBTCLucky.drawInfo(drawIndex)
    expect(drawInfo.shr(176).and(0xFFFF)).to.deep.equal(1)

    // Case 9: Non default Router
    await greenBTCLucky.manageSwapRouter(1, router.address)

    // 0x02 271002 01 00 00 03 000000 000000 000000 000000 000000 140012 020142 320fff
    let lotteryInfoUSDC: LotteryInfo = {
      tokenId:        2,                      // 1 Byte
      baseValue:      {base: 10000, exp: 2},  // 2 Byte
      routerId:       1,                      // 1 Byte
      swapPathId:     0,                      // 1 Byte
      prize:   [
        { ratio: 255 * 16 + 15 , times:  50 * 16 + 0 },      // Relative ,  5% of the pool 
        { ratio:   1 * 16 +  2 , times:  20 * 16 + 0},       //       1% ,  20 Times 
        { ratio:  20 * 16 +  2 , times:   2 * 16 + 0 },      //      20% ,  2 Times
      ]
    }

    await greenBTCLucky.addLottery(5, convertLotteryInfo(lotteryInfoUSDC))
    await greenBTCLucky.playLucky(5, 50, 0) 

    // Case 9: Non default swap path
    let path = utils.solidityPack(['address', 'uint24', 'address'], [USDC.address, FeeAmount.MEDIUM, WBTC.address])
    await greenBTCLucky.manageSwapPath(1, path) 

    // 0x02 271002 01 00 00 03 000000 000000 000000 000000 000000 140012 020142 320fff
    lotteryInfoUSDC = {
      tokenId:        2,                      // 1 Byte
      baseValue:      {base: 10000, exp: 2},  // 2 Byte
      routerId:       1,                      // 1 Byte
      swapPathId:     1,                      // 1 Byte
      prize:   [
        { ratio: 255 * 16 + 15 , times:  50 * 16 + 0 },      // Relative ,  5% of the pool 
        { ratio:   1 * 16 +  2 , times:  20 * 16 + 0},       //       1% ,  20 Times 
        { ratio:  20 * 16 +  2 , times:   2 * 16 + 0 },      //      20% ,  2 Times
      ]
    }

    await greenBTCLucky.addLottery(6, convertLotteryInfo(lotteryInfoUSDC))
    await greenBTCLucky.playLucky(6, 50, 0)                 // Should success

    // Check Promotion
    lastBlock = await ethers.provider.getBlock('latest')

    const startTime = lastBlock.timestamp
    const endTime = startTime + 12345678
    const tokenId = 255
    const basevalue = 20
    const exp = 6
    const promotion = BigNumber.from(startTime).shl(64)
                      .add(BigNumber.from(endTime).shl(32))
                      .add(BigNumber.from(tokenId).shl(24))
                      .add(BigNumber.from(basevalue).shl(8))
                      .add(BigNumber.from(exp))

    await greenBTCLucky.managePromotion(promotion)       // 50 draw

    await kWhToken.transfer(greenBTCLucky.address, expandTo6Decimals(1_000_000))

    drawId += 1
    let playLuckyTx
    await expect(playLuckyTx = await greenBTCLucky.playLucky(3, 50, 0))       // 50 draw
      .to.emit(kWhToken, 'Transfer')
      .withArgs(greenBTCLucky.address, wallet.address, expandTo6Decimals(20).mul(50))        

    let playLuckyTxReceipt = await playLuckyTx.wait()
    console.log ("playLucky with promotion gas usage: ", playLuckyTxReceipt.gasUsed)         // 50 draws

    await greenBTCLucky.managePromotion(promotion.or(0x80))       // 50 draw

  })

  it("GreenBTCLucky redeemLucky test: Normal and Abnormal", async function () {

    // Case1: Abnormal testing: Wrong drawId 
    let drawId = await greenBTCLucky.drawId()     // drawId = 12

    await expect(greenBTCLucky.redeemLucky(drawId+1)).to.be.revertedWith(`WrongLuckyIdOwner(${drawId+1})`)
    await expect(greenBTCLucky.connect(trader).redeemLucky(drawId)).to.be.revertedWith(`WrongLuckyIdOwner(${drawId})`)

    // Case2: Abnormal testing: RedeemTooEarly 
    drawId += 1
    await greenBTCLucky.playLucky(3, 10, 0)       // 10 USDC, drawId = 13
    let lastBlock = await ethers.provider.getBlock('latest')

    await mine(1);
    await expect(greenBTCLucky.redeemLucky(drawId)).to.be.revertedWith(`RedeemTooEarly(${lastBlock.number})`)

    // Case3: Abnormal testing: AlreadyRedeemed 
    await mine(10);
    await greenBTCLucky.redeemLucky(drawId);
    await expect(greenBTCLucky.redeemLucky(drawId)).to.be.revertedWith(`AlreadyRedeemed(${drawId})`)

    // Case4: Abnormal testing: RedeemTooLate 
    drawId += 1
    await greenBTCLucky.playLucky(2, 30, 0)       // 30 USDT, drawId = 14
    lastBlock = await ethers.provider.getBlock('latest')

    await mine(257);
    await expect(greenBTCLucky.redeemLucky(drawId)).to.be.revertedWith(`RedeemTooLate(${lastBlock.number})`)

    // Case5: Normal test
    let amountWBTCBefore = await WBTC.balanceOf(greenBTCLucky.address)
    let poolReserveBefore = await greenBTCLucky.poolReserve()
    
    drawId += 1
    await greenBTCLucky.playLucky(3, 50, 0)       // 30 USDT, drawId = 15

    let amountWBTCAfter = await WBTC.balanceOf(greenBTCLucky.address)
    const amountWBTCIn = amountWBTCAfter.sub(amountWBTCBefore)
    let poolReserveAfterWBTC = poolReserveBefore.add(amountWBTCIn.mul(93))    // 93% is used for draw prize

    let drawIndex = BigNumber.from(drawId).shl(160).add(BigNumber.from(wallet.address))
    lastBlock = await ethers.provider.getBlock('latest')
    const drawInfoWBTC = BigNumber.from(lastBlock.number).shl(224)
                    .add(amountWBTCIn.shl(192))
                    .add(BigNumber.from(50).shl(176))
                    .add(BigNumber.from(3).shl(160))
                    .add(poolReserveAfterWBTC)

    expect(await greenBTCLucky.drawInfo(drawIndex)).to.deep.equal(drawInfoWBTC)
    expect(await greenBTCLucky.lastDrawHeight()).to.deep.equal(lastBlock.number)

    const luckyReserve = await greenBTCLucky.luckyReserve()
    const drawInfo = await greenBTCLucky.drawInfo(drawIndex)
    const lotteryInfo = await greenBTCLucky.lotteryList(3)
    const hash = lastBlock.hash

    const {wonAmount, jackpot, luckyLevels} = checkPrize(wallet.address, drawId, drawInfo, lotteryInfo, hash) 
    await mine(10);

    let redeemLuckyTx
    await expect(redeemLuckyTx = await greenBTCLucky.redeemLucky(drawId))
              .to.emit(WBTC, 'Transfer')
              .withArgs(greenBTCLucky.address, wallet.address, wonAmount)        
              .to.emit(greenBTCLucky, 'LuckyRedeem')
              .withArgs(wallet.address, drawId, wonAmount, utils.hexlify(utils.toUtf8Bytes(luckyLevels)))
              
    expect(await greenBTCLucky.poolReserve()).to.deep.equal(poolReserveAfterWBTC.sub(wonAmount))
    expect(await greenBTCLucky.drawInfo(drawIndex)).to.deep.equal(drawInfoWBTC.add(wonAmount.shl(64)).add(BigNumber.from(1).shl(152)))

    if(!jackpot.eq(0)) {
      let luckyReserveNew = BigNumber.from(0) 
      if (luckyReserve.gt(wonAmount)) {
        luckyReserveNew = luckyReserve.sub(jackpot)
      } 
      expect(await greenBTCLucky.luckyReserve()).to.deep.equal(luckyReserveNew)
    }

    drawId += 1
    await greenBTCLucky.playLucky(3, 1, 0)       // 1 draw
    await mine(10);
    redeemLuckyTx = await greenBTCLucky.redeemLucky(drawId)
    let redeemLuckyReceipt = await redeemLuckyTx.wait()
    console.log ("redeemLucky gas usage: ", 1, redeemLuckyReceipt.gasUsed)       // 1 draws

    drawId += 1
    await greenBTCLucky.playLucky(3, 5, 0)       // 5 draw
    await mine(10);
    redeemLuckyTx = await greenBTCLucky.redeemLucky(drawId)
    redeemLuckyReceipt = await redeemLuckyTx.wait()
    console.log ("redeemLucky gas usage: ", 5, redeemLuckyReceipt.gasUsed)       // 5 draws

    drawId += 1
    await greenBTCLucky.playLucky(3, 10, 0)       // 10 draw
    await mine(10);
    redeemLuckyTx = await greenBTCLucky.redeemLucky(drawId)
    redeemLuckyReceipt = await redeemLuckyTx.wait()
    console.log ("redeemLucky gas usage: ", 10, redeemLuckyReceipt.gasUsed)       // 10 draws

    drawId += 1
    await greenBTCLucky.playLucky(3, 50, 0)       // 50 draw
    await mine(10);
    redeemLuckyTx = await greenBTCLucky.redeemLucky(drawId)
    redeemLuckyReceipt = await redeemLuckyTx.wait()
    console.log ("redeemLucky gas usage: ", 50, redeemLuckyReceipt.gasUsed)       // 50 draws

  })
  
  it("GreenBTCLucky managePromotion test: Normal and Abnormal", async function () {
    let lastBlock = await ethers.provider.getBlock('latest')

    let startTime = lastBlock.timestamp
    let endTime = startTime + 12345678
    let tokenId = 255
    let basevalue = 20
    let exp = 6
    let promotion = BigNumber.from(startTime).shl(64)
                      .add(BigNumber.from(endTime).shl(32))
                      .add(BigNumber.from(tokenId).shl(24))
                      .add(BigNumber.from(basevalue).shl(8))
                      .add(BigNumber.from(exp))

    await expect(greenBTCLucky.connect(trader).managePromotion(promotion)).to.be.revertedWith("Ownable: caller is not the owner")
    await greenBTCLucky.managePromotion(promotion)       // 50 draw

    await kWhToken.transfer(greenBTCLucky.address, expandTo6Decimals(1_000_000))
    await expect(greenBTCLucky.playLucky(3, 10, 0))       // 10 draw
              .to.emit(kWhToken, 'Transfer')
              .withArgs(greenBTCLucky.address, wallet.address, expandTo6Decimals(20).mul(10))        

    // Promotion: 0.1 USDT              
    tokenId = 1               // 0.1 USDT
    basevalue = 10
    exp = 4
    promotion = BigNumber.from(startTime).shl(64)
                        .add(BigNumber.from(endTime).shl(32))
                        .add(BigNumber.from(tokenId).shl(24))
                        .add(BigNumber.from(basevalue).shl(8))
                        .add(BigNumber.from(exp))

    await greenBTCLucky.managePromotion(promotion)       // 50 draw
    await USDT.transfer(greenBTCLucky.address, expandTo6Decimals(1_000_000))
  
    await expect(greenBTCLucky.playLucky(3, 50, 0))       // 10 draw
            .to.emit(USDT, 'Transfer')
            .withArgs(greenBTCLucky.address, wallet.address, expandTo6Decimals(1).div(10).mul(50))   
           
    // Disable promotion         
    await greenBTCLucky.managePromotion(promotion.or(0x80))       // 50 draw
            
  })

  it("GreenBTCLucky redeemLuckyWithHash test: Normal and Abnormal", async function () {

    await expect(greenBTCLucky.connect(trader).setLuckyManager(luckMananger.address)).to.be.revertedWith("Ownable: caller is not the owner")
    await greenBTCLucky.setLuckyManager(luckMananger.address)

    // Case 1: Abnormal testing: Wrong drawId 
    let drawId = await greenBTCLucky.drawId()     // drawId = 12

    drawId += 1
    await greenBTCLucky.playLucky(3, 10, 0)       // 10 draw
    let lastBlock = await ethers.provider.getBlock('latest')
    await mine(10);

    let register_digest = getLuckyDrawRedeemHash(
      'GreenBTC Lucky',
      greenBTCLucky.address,
      wallet.address,
      drawId,
      lastBlock.number,
      lastBlock.hash,
    )

    let {v,r,s} = ecsign( Buffer.from(register_digest.slice(2), 'hex'), 
                                Buffer.from(privateKeyRegister.slice(2), 'hex'))   

    await expect(greenBTCLucky.redeemLuckyWithHash(drawId+1, lastBlock.number, lastBlock.hash, {v,r,s}))
            .to.be.revertedWith(`WrongLuckyIdOwner(${drawId+1})`)
    
    await expect(greenBTCLucky.connect(trader).redeemLuckyWithHash(drawId, lastBlock.number, lastBlock.hash, {v,r,s}))
            .to.be.revertedWith(`WrongLuckyIdOwner(${drawId})`)

    await expect(greenBTCLucky.redeemLuckyWithHash(drawId, lastBlock.number-1, lastBlock.hash, {v,r,s}))
            .to.be.revertedWith(`WrongBlockHeight(${lastBlock.number-1})`)

    // Case 2: Abnormal testing: AlreadyRedeemed 
    await mine(10);
    await greenBTCLucky.redeemLuckyWithHash(drawId, lastBlock.number, lastBlock.hash, {v,r,s})
    await expect(greenBTCLucky.redeemLuckyWithHash(drawId, lastBlock.number, lastBlock.hash, {v,r,s}))
            .to.be.revertedWith(`AlreadyRedeemed(${drawId})`)

    // Case 3: Normal test
    let amountWBTCBefore = await WBTC.balanceOf(greenBTCLucky.address)
    let poolReserveBefore = await greenBTCLucky.poolReserve()
    
    drawId += 1
    await greenBTCLucky.playLucky(3, 50, 0)       // 50 USDT

    let amountWBTCAfter = await WBTC.balanceOf(greenBTCLucky.address)
    const amountWBTCIn = amountWBTCAfter.sub(amountWBTCBefore)
    let poolReserveAfterWBTC = poolReserveBefore.add(amountWBTCIn.mul(93))    // 93% is used for draw prize

    let drawIndex = BigNumber.from(drawId).shl(160).add(BigNumber.from(wallet.address))
    lastBlock = await ethers.provider.getBlock('latest')

    const drawInfoWBTC = BigNumber.from(lastBlock.number).shl(224)
                    .add(amountWBTCIn.shl(192))
                    .add(BigNumber.from(50).shl(176))
                    .add(BigNumber.from(3).shl(160))
                    .add(poolReserveAfterWBTC)

    expect(await greenBTCLucky.drawInfo(drawIndex)).to.deep.equal(drawInfoWBTC)
    expect(await greenBTCLucky.lastDrawHeight()).to.deep.equal(lastBlock.number)

    const luckyReserve = await greenBTCLucky.luckyReserve()
    const drawInfo = await greenBTCLucky.drawInfo(drawIndex)
    const lotteryInfo = await greenBTCLucky.lotteryList(3)
    const hash = lastBlock.hash

    const {wonAmount, jackpot, luckyLevels} = checkPrize(wallet.address, drawId, drawInfo, lotteryInfo, hash) 
    await mine(10);

    register_digest = getLuckyDrawRedeemHash(
      'GreenBTC Lucky',
      greenBTCLucky.address,
      wallet.address,
      drawId,
      lastBlock.number,
      lastBlock.hash,
    )

    let {v: v1, r:r1, s:s1} = ecsign( Buffer.from(register_digest.slice(2), 'hex'), 
                                Buffer.from(privateKeyRegister.slice(2), 'hex'))   

    let redeemLuckyTx
    await expect(redeemLuckyTx = await greenBTCLucky.redeemLuckyWithHash(drawId, lastBlock.number, lastBlock.hash, {v: v1, r:r1, s:s1}))
              .to.emit(WBTC, 'Transfer')
              .withArgs(greenBTCLucky.address, wallet.address, wonAmount)        
              .to.emit(greenBTCLucky, 'LuckyRedeemWithHash')
              .withArgs(wallet.address, drawId, wonAmount, utils.hexlify(utils.toUtf8Bytes(luckyLevels)))
              
    expect(await greenBTCLucky.poolReserve()).to.deep.equal(poolReserveAfterWBTC.sub(wonAmount))
    expect(await greenBTCLucky.drawInfo(drawIndex)).to.deep.equal(drawInfoWBTC.add(wonAmount.shl(64)).add(BigNumber.from(1).shl(152)))

    if(!jackpot.eq(0)) {
      let luckyReserveNew = BigNumber.from(0) 
      if (luckyReserve.gt(wonAmount)) {
        luckyReserveNew = luckyReserve.sub(jackpot)
      } 
      expect(await greenBTCLucky.luckyReserve()).to.deep.equal(luckyReserveNew)
    }

    let redeemLuckyReceipt = await redeemLuckyTx.wait()
    console.log ("redeemLuckyWithHash gas usage: ", 50, redeemLuckyReceipt.gasUsed)       // 50 draws
  })

  it("GreenBTCLucky checkIfLucky test: Normal and Abnormal", async function () {
    
    let drawId = await greenBTCLucky.drawId()   

    for (let roll = 0; roll < 10; roll++) {
      drawId += 1
      await greenBTCLucky.playLucky(3, 50, 0)       // 50 USDC
      let lastBlock = await ethers.provider.getBlock('latest')
      
      //await expect(greenBTCLucky.checkIfLucky(wallet.address, drawId+1, lastBlock.hash)).to.be.revertedWith(`WrongLuckyIdOwner(${drawId})`)
      //await expect(greenBTCLucky.checkIfLucky(trader.address, drawId, lastBlock.hash)).to.be.revertedWith(`WrongLuckyIdOwner(${drawId})`)
      
      const {wonAmount, amountJackpot, luckyLevels} = await greenBTCLucky.checkIfLucky(wallet.address, drawId, lastBlock.hash)

      const drawIndex = BigNumber.from(drawId).shl(160).add(BigNumber.from(wallet.address))
      const drawInfo = await greenBTCLucky.drawInfo(drawIndex)
      const lotteryInfo = await greenBTCLucky.lotteryList(3)
      const hash = lastBlock.hash
      
      const {wonAmount: wonAmountCheck, jackpot: jackpotCheck, luckyLevels: luckyLevelsCheck} = checkPrize(wallet.address, drawId, drawInfo, lotteryInfo, hash) 
      
      expect(wonAmount).to.deep.equal(wonAmountCheck)
      expect(amountJackpot).to.deep.equal(jackpotCheck)
      expect(ethers.utils.toUtf8String(luckyLevels)).to.deep.equal(luckyLevelsCheck)

      console.log("Roll: ", roll, luckyLevelsCheck)
    }
  })

  it("GreenBTCLucky distributeLucky test", async function () {

    const projectReserve = await greenBTCLucky.projectReserve()
    const publicGoodsReserve = await greenBTCLucky.publicGoodsReserve()
    const greenBTCReserve = await greenBTCLucky.greenBTCReserve()

    await greenBTCLucky.distributeLucky(1, wallet.address, projectReserve.div(2).div(100))
    expect(await greenBTCLucky.projectReserve()).to.eq(projectReserve.sub(projectReserve.div(2).div(100).mul(100)))

    await greenBTCLucky.distributeLucky(2, wallet.address, publicGoodsReserve.div(2).div(100))
    expect(await greenBTCLucky.publicGoodsReserve()).to.eq(publicGoodsReserve.sub(publicGoodsReserve.div(2).div(100).mul(100)))

    await greenBTCLucky.distributeLucky(3, wallet.address, greenBTCReserve.div(2).div(100))
    expect(await greenBTCLucky.greenBTCReserve()).to.eq(greenBTCReserve.sub(greenBTCReserve.div(2).div(100).mul(100)))

    await expect(greenBTCLucky.distributeLucky(4, wallet.address, greenBTCReserve.div(2).div(100)))
            .to.be.revertedWith("YBTC: Wrong Usage")
  })

  it("GreenBTCLucky redeemLucky stress test", async function () {

    let drawId = await greenBTCLucky.drawId()       // drawId = 12
    let poolReserve0 = await greenBTCLucky.poolReserve()
    let luckyReserve0 = await greenBTCLucky.luckyReserve()

    let total1 = 0
    let total2 = 0
    let total3 = 0

    console.log("drawId: poolReserve, luckyReserve", drawId, poolReserve0.toString(), luckyReserve0.toString())
    
    for (let index =0; index < 100; index++) {
      drawId += 1
      await greenBTCLucky.playLucky(3, 50, 0)       
      let lastBlock = await ethers.provider.getBlock('latest')
      let {wonAmount, amountJackpot, luckyLevels} = await greenBTCLucky.checkIfLucky(wallet.address, drawId, lastBlock.hash)

      await mine(20);
      await greenBTCLucky.redeemLucky(drawId)
    
      let poolReserve1 = await greenBTCLucky.poolReserve()
      let luckyReserve1 = await greenBTCLucky.luckyReserve()

      let local1 = 0
      let local2 = 0
      let local3 = 0
  
      luckyLevels = ethers.utils.toUtf8String(luckyLevels)
      for (let i =0 ; i<luckyLevels.length; i++) {
        if (luckyLevels.charAt(i) == '1') local1++
        else if (luckyLevels.charAt(i) == '2') local2++
        else if (luckyLevels.charAt(i) == '3') local3++
      }

      total1 += local1
      total2 += local2
      total3 += local3

      console.log("drawId: ", drawId, 
        poolReserve1.toString(), luckyReserve1.toString(), 
        poolReserve1.sub(poolReserve0).toString(), luckyReserve1.sub(luckyReserve0).toString(),
        wonAmount.toString(), amountJackpot.toString(), 
        local1, local2, local3, total1, total2, total3, luckyLevels.length, luckyLevels
      )
      
      poolReserve0 = poolReserve1
      luckyReserve0 = luckyReserve1
    }
  })

})

// drawInfo: Block height(4B) || WBTC Amount (4B) || tickets (2B) || loterryId (2B) || Redeemed(1B) ||free(3B) || wonAmount (8B) || poolReserve (8B)
// lotteryInfo:  tokenId (1B) || baseValue (3B) || routerId (1B) || swapPathId (1B) || free (1B) || level (1B) || [times, ratio](8)  
export function checkPrize(user: string, drawId: number, drawInfo: BigNumber, lotteryInfo: BigNumber, hash: string ) {

  let digest: BigNumber = BigNumber.from(drawId).shl(224)
                            .add(BigNumber.from(user).and(BigNumber.from(1).shl(96).sub(1)).shl(128))
                            .add(drawInfo.shr(160).and(BigNumber.from(1).shl(64).sub(1)).shl(64))
                            .add(drawInfo.and(BigNumber.from(1).shl(64).sub(1))) 

  let luckyNumber = BigNumber.from(utils.keccak256(
                        utils.defaultAbiCoder.encode(
                        ['bytes32', 'uint256'],
                        [hash, digest]
                      )))

  let tickets = drawInfo.shr(176).and(0xFFFF).toNumber()
  let amountWBTC = drawInfo.shr(192).and(0xFFFFFFFF).mul(1000).div(tickets)

  let level = lotteryInfo.shr(192).and(0xFF).toNumber()
  let luckyLevels: string = ''

  let jackpot = BigNumber.from(0)
  let wonAmount = BigNumber.from(0)

  for (let ticketIndex = 0; ticketIndex < tickets; ticketIndex++) {
    let luckyRange = BigNumber.from(0)
    let levelInfo = lotteryInfo;
    let levelIndex = 0 

    for(; levelIndex < level; (levelInfo = levelInfo.shr(24), levelIndex++)) {
      let times = levelInfo.shr(12).and(0xFFF).toNumber()
      if (levelInfo.and(0xFFF).eq(0xFFF)) {
        luckyRange = BigNumber.from(1).shl(128)
                      .mul(amountWBTC)
                      .div(drawInfo.and("0xFFFFFFFFFFFFFFFF"))
                      .div(times >> 4)
                      .add(luckyRange)
        if (luckyNumber.and(BigNumber.from(1).shl(128).sub(1)).lt(luckyRange)) {
          if (!jackpot.eq(0)) continue
          jackpot = drawInfo.and("0xFFFFFFFFFFFFFFFF").mul(times>>4)
          luckyLevels = luckyLevels + (levelIndex+1)
          break
        }
      } else {
        luckyRange = BigNumber.from(1).shl(128)
                      .mul(levelInfo.and(0xFFF).toNumber() >> 4)
                      .div(BigNumber.from(10).pow(levelInfo.and("0x0F")))
                      .add(luckyRange)
        if (luckyNumber.and(BigNumber.from(1).shl(128).sub(1)).lt(luckyRange)) {
          wonAmount = amountWBTC.mul(BigNumber.from(times >> 4).mul(BigNumber.from(10).pow(times&0x0F))).add(wonAmount)
          luckyLevels = luckyLevels + (levelIndex+1)
          break
        }
      }
    }
    if (levelIndex == level) luckyLevels = luckyLevels + "X"
    luckyNumber = BigNumber.from(utils.keccak256(utils.defaultAbiCoder.encode(['uint256'], [luckyNumber])))
  }

  return { wonAmount: wonAmount.add(jackpot).div(1000), jackpot: jackpot.div(1000),  luckyLevels}
}
