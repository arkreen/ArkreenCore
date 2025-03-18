import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import { expect } from "chai";
import { constants, BigNumber, Contract, utils, providers } from 'ethers'

import { ethers, network, upgrades } from "hardhat";
//import { waffle } from "hardhat"

import {
    ArkreenToken,
    ArkreenMiner,
    ArkreenRECIssuance,
    ArkreenRegistry,
    ArkreenRECToken,
    ArkreenBadge,
    ArkreenBuilder,
    HashKeyESGBTC,
    ArkreenRECBank,
} from "../../typechain";

import { time, loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { getApprovalDigest, expandTo18Decimals, randomAddresses, RECStatus, MinerType, 
          BigNumberPercent, expandTo9Decimals } from "../utils/utilities";
import { ecsign, fromRpcSig, ecrecover, zeroAddress } from 'ethereumjs-util'
import { RECRequestStruct, SignatureStruct, RECDataStruct } from "../../typechain/contracts/ArkreenRECIssuance";
import { OffsetActionStruct }  from "../../typechain/contracts/ArkreenBadge";
import FeSwapPair from '../../artifacts/contracts/Test/AMMV2/FeSwapPair.sol/FeSwapPair.json'

//const { provider, createFixtureLoader } = waffle;

const MASK_OFFSET = BigNumber.from('0x8000000000000000')
const MASK_DETAILS = BigNumber.from('0xC000000000000000')
const initPoolPrice = expandTo18Decimals(1).div(5)
//const BidStartTime: number = 1687190400   // 2023/06/20 00/00/00
//const BidStartTime: number = Math.floor(Date.now()/1000) + (3+14) *24 * 3600 + 2400
const OPEN_BID_DURATION: number =  (3600 * 24 * 14)
const rateTriggerArbitrage: number = 10

const overrides = {
  gasLimit: 30000000
}

describe("HashKeyESGBTC", () => {
    let deployer: SignerWithAddress;
    let manager: SignerWithAddress;
    let register_authority: SignerWithAddress;
    let fund_receiver: SignerWithAddress;

    let owner1: SignerWithAddress;
    let owner2: SignerWithAddress;
    let miner1: SignerWithAddress;
    let miner2: SignerWithAddress;
    let maker1: SignerWithAddress;
    let maker2: SignerWithAddress;

    let wallet:     SignerWithAddress;
    let feeTo:      SignerWithAddress;
    let pairOwner:  SignerWithAddress;

    let privateKeyManager:      string
    let privateKeyRegister:     string
    let privateKeyOwner:        string
    let privateKeyMaker:        string

    let AKREToken:                    ArkreenToken
    let arkreenMiner:                 ArkreenMiner
    let arkreenRegistry:             ArkreenRegistry
    let arkreenRECIssuance:           ArkreenRECIssuance
    let arkreenRECToken:              ArkreenRECToken
    let arkreenRetirement:            ArkreenBadge

    const Miner_Manager       = 0       

    let tokenA: Contract
    let tokenB: Contract
    let WETH: Contract
    let WETHPartner: Contract
    let router: Contract
    let pairAAB: Contract
    let pairABB: Contract
    let WETHPairTTE: Contract
    let WETHPairTEE: Contract    
    let routerEventEmitter: Contract

    let pairTTArt: Contract
    let pairTAArt: Contract
    let pairEEArt: Contract
    let pairEAArt: Contract
    let arkreenBuilder: Contract
    let hashKeyESGBTC: Contract
    let arkreenRECBank:     ArkreenRECBank    
      
    async function deployFixture() {

      const bytecode = `${FeSwapPair.bytecode}`

      console.log("utils.keccak256(bytecode): ", utils.keccak256(bytecode)) 

      // deploy FeSwap Token contract, sending the total supply to the deployer
      let lastBlock = await ethers.provider.getBlock('latest')
      console.log("HashKeyESGBTC", lastBlock.timestamp)

      // const Feswa = await deployContract(wallet, FeswapTokenCode, [wallet.address, wallet.address, lastBlock.timestamp + 60 * 60])
      const FeswFactory = await ethers.getContractFactory("Fesw");
      const Feswa = await FeswFactory.deploy(wallet.address, wallet.address, lastBlock.timestamp + 60 * 60,'FESW');
      await Feswa.deployed();

      // Get Factory address
      const nonce = await ethers.provider.getTransactionCount(wallet.address)  
      const FeswFactoryAddress = Contract.getContractAddress({ from: wallet.address, nonce: nonce + 1 })
      const FeswRouterAddress = Contract.getContractAddress({ from: wallet.address, nonce: nonce + 4 })

      const BidStartTime: number = lastBlock.timestamp + 1200

      // deploy FeSwap NFT contract
      // const FeswaNFT = await deployContract(wallet, FeswaNFTCode, [Feswa.address, FeswFactoryAddress, BidStartTime], overrides)
      const FeswaNFTFactory = await ethers.getContractFactory("FeswaNFT");
      const FeswaNFT = await FeswaNFTFactory.deploy(Feswa.address, FeswFactoryAddress, BidStartTime);
      await FeswaNFT.deployed();

      // deploy FeSwap factory
      // const factoryFeswa = await deployContract(wallet, FeSwapFactory, [wallet.address, FeswRouterAddress, FeswaNFT.address], overrides)
      const FeSwapFactory = await ethers.getContractFactory("FeSwapFactory");
      const factoryFeswa = await FeSwapFactory.deploy(wallet.address, FeswRouterAddress, FeswaNFT.address);
      await factoryFeswa.deployed();

      // const WETH = await deployContract(wallet, WETH9)
      const WETH9Factory = await ethers.getContractFactory("WETH9");
      const WETH = await WETH9Factory.deploy();
      await WETH.deployed();

      // const WETHPartner = await deployContract(wallet, ERC20, [expandTo18Decimals(10000),"WETH Partner"], overrides)
      const ERC20Factory = await ethers.getContractFactory("ERC20F");
      const WETHPartner = await ERC20Factory.deploy(expandTo18Decimals(3000000),"WETH Partner");
      await WETHPartner.deployed();

      // deploy FeSwap routers
      // const routerFeswa = await deployContract(wallet, FeSwapRouter, [factoryFeswa.address, WETH.address], overrides)
      const FeSwapRouterFactory = await ethers.getContractFactory("FeSwapRouter");
      const routerFeswa = await FeSwapRouterFactory.deploy(factoryFeswa.address, WETH.address);
      await routerFeswa.deployed();

      // deploy tokens
      // const tokenA = await deployContract(wallet, ERC20, [expandTo18Decimals(10000),"Token A"])
      const tokenA = await ERC20Factory.deploy(expandTo18Decimals(10000),"Token A");
      await tokenA.deployed();

      // const tokenB = await deployContract(wallet, ERC20, [expandTo18Decimals(10000),"Token B"])
      const tokenB = await ERC20Factory.deploy(expandTo18Decimals(10000),"Token B");
      await tokenB.deployed();

      await Feswa.transfer(FeswaNFT.address, expandTo18Decimals(1000_000))

      // event emitter for testing
      // const routerEventEmitter = await deployContract(wallet, RouterEventEmitter, [])
      const RouterEventEmitterFactory = await ethers.getContractFactory("RouterEventEmitter");
      const routerEventEmitter = await RouterEventEmitterFactory.deploy();
      await routerEventEmitter.deployed();

      // initialize FeSwap
      await factoryFeswa.setFeeTo(feeTo.address)
      await factoryFeswa.setRouterFeSwap(routerFeswa.address)
      // await factoryFeswa.createUpdatePair(tokenA.address, tokenB.address, pairOwner.address, rateTriggerArbitrage, overrides)

      await time.increaseTo(BidStartTime + 1)
      const tokenIDMatch = utils.keccak256( 
      utils.solidityPack( ['address', 'address', 'address'],
      (tokenA.address.toLowerCase() <= tokenB.address.toLowerCase())
      ? [FeswaNFT.address, tokenA.address, tokenB.address] 
      : [FeswaNFT.address, tokenB.address, tokenA.address] ) )

      await FeswaNFT.connect(pairOwner).BidFeswaPair(tokenA.address, tokenB.address, pairOwner.address,
      { ...overrides, value: initPoolPrice } )

      // BidDelaying time out
      lastBlock = await ethers.provider.getBlock('latest')
      await time.increaseTo(lastBlock.timestamp + OPEN_BID_DURATION + 1)

      await FeswaNFT.connect(pairOwner).ManageFeswaPair(tokenIDMatch, pairOwner.address, rateTriggerArbitrage, 0 )

      await factoryFeswa.createUpdatePair(tokenB.address, WETHPartner.address, pairOwner.address, rateTriggerArbitrage, 0, overrides)  
      const [pairAddressAAB, pairAddressABB] = await factoryFeswa.getPair(tokenA.address, tokenB.address)

      // const pairAddressABB = await factoryFeswa.getPair(tokenB.address, tokenA.address)
      const pairAAB = new Contract(pairAddressAAB, JSON.stringify(FeSwapPair.abi), ethers.provider).connect(wallet)
      const pairABB = new Contract(pairAddressABB, JSON.stringify(FeSwapPair.abi), ethers.provider).connect(wallet)

      await factoryFeswa.createUpdatePair(WETH.address, WETHPartner.address, pairOwner.address, rateTriggerArbitrage, 0, overrides)
      const [WETHPairAddressETHIn, WETHPairAddressETHOut] = await factoryFeswa.getPair(WETH.address, WETHPartner.address)
      const WETHPairTEE = new Contract(WETHPairAddressETHIn, JSON.stringify(FeSwapPair.abi), ethers.provider).connect(wallet)

      // const WETHPairAddressETHOut = await factoryFeswa.getPair(WETHPartner.address, WETH.address)
      const WETHPairTTE = new Contract(WETHPairAddressETHOut, JSON.stringify(FeSwapPair.abi), ethers.provider).connect(wallet)

      ////////////////////////////////////////////////////////////////////////////////////////

      const AKRETokenFactory = await ethers.getContractFactory("ArkreenToken");
      const AKREToken = await upgrades.deployProxy(AKRETokenFactory, [10_000_000_000, deployer.address,'','']) as ArkreenToken
      await AKREToken.deployed();

      const ArkreenMinerFactory = await ethers.getContractFactory("ArkreenMiner")
      const arkreenMiner = await upgrades.deployProxy(ArkreenMinerFactory,
                                        [AKREToken.address, AKREToken.address, manager.address, register_authority.address]) as ArkreenMiner
      await arkreenMiner.deployed()
 
      const ArkreenRegistryFactory = await ethers.getContractFactory("ArkreenRegistry")
      const arkreenRegistry = await upgrades.deployProxy(ArkreenRegistryFactory,[]) as ArkreenRegistry
      await arkreenRegistry.deployed()

      const ArkreenRECIssuanceFactory = await ethers.getContractFactory("ArkreenRECIssuance")
      const arkreenRECIssuance = await upgrades.deployProxy(ArkreenRECIssuanceFactory, 
                                  [AKREToken.address, arkreenRegistry.address]) as ArkreenRECIssuance
      await arkreenRECIssuance.deployed()

      const ArkreenRECTokenFactory = await ethers.getContractFactory("ArkreenRECToken")
      arkreenRECToken = await upgrades.deployProxy(ArkreenRECTokenFactory,[arkreenRegistry.address, manager.address,'', '']) as ArkreenRECToken
      await arkreenRECToken.deployed()
      
      const ArkreenRetirementFactory = await ethers.getContractFactory("ArkreenBadge")
      arkreenRetirement = await upgrades.deployProxy(ArkreenRetirementFactory,[arkreenRegistry.address]) as ArkreenBadge
      await arkreenRetirement.deployed()     
      
      await factoryFeswa.createUpdatePair(WETHPartner.address, arkreenRECToken.address, pairOwner.address, rateTriggerArbitrage, 0, overrides)
      const [pairAddressTTArt, pairAddressTAArt] = await factoryFeswa.getPair(WETHPartner.address, arkreenRECToken.address)
      const pairTTArt = new Contract(pairAddressTTArt, JSON.stringify(FeSwapPair.abi), ethers.provider).connect(wallet)
      const pairTAArt = new Contract(pairAddressTAArt, JSON.stringify(FeSwapPair.abi), ethers.provider).connect(wallet)

      await factoryFeswa.createUpdatePair(WETH.address, arkreenRECToken.address, pairOwner.address, rateTriggerArbitrage, 0, overrides)
      const [pairAddressEEArt, pairAddressEAArt] = await factoryFeswa.getPair(WETH.address, arkreenRECToken.address)
      const pairEEArt = new Contract(pairAddressEEArt, JSON.stringify(FeSwapPair.abi), ethers.provider).connect(wallet)
      const pairEAArt = new Contract(pairAddressEAArt, JSON.stringify(FeSwapPair.abi), ethers.provider).connect(wallet)
  
      await AKREToken.transfer(owner1.address, expandTo18Decimals(100000000))
      await AKREToken.connect(owner1).approve(arkreenRECIssuance.address, expandTo18Decimals(100000000))

      await AKREToken.transfer(maker1.address, expandTo18Decimals(100000000))
      await AKREToken.connect(maker1).approve(arkreenRECIssuance.address, expandTo18Decimals(100000000))
      
      await AKREToken.connect(owner1).approve(arkreenMiner.address, expandTo18Decimals(100000000))
      await AKREToken.connect(maker1).approve(arkreenMiner.address, expandTo18Decimals(100000000))
      
      await WETHPartner.transfer(maker1.address, expandTo18Decimals(1000000))
      await WETHPartner.transfer(owner1.address, expandTo18Decimals(1000000))

      const miners = randomAddresses(2)
      await arkreenMiner.connect(manager).RemoteMinerOnboardInBatch([owner1.address, maker1.address], miners)

      const payer = maker1.address
      await arkreenMiner.setManager(Miner_Manager, manager.address)
      await arkreenMiner.ManageManufactures([payer], true)     

      await arkreenRegistry.addRECIssuer(manager.address, arkreenRECToken.address, "Arkreen Issuer")
      await arkreenRegistry.setRECIssuance(arkreenRECIssuance.address)
      await arkreenRegistry.setArkreenRetirement(arkreenRetirement.address)

      const ArkreenRECBankFactory = await ethers.getContractFactory("ArkreenRECBank")
      const arkreenRECBank = await upgrades.deployProxy(ArkreenRECBankFactory,[WETH.address]) as ArkreenRECBank
      await arkreenRECBank.deployed()        

      const ArkreenBuilderFactory = await ethers.getContractFactory("ArkreenBuilder");
      arkreenBuilder = await upgrades.deployProxy(ArkreenBuilderFactory,[routerFeswa.address, arkreenRECBank.address, WETH.address]) as ArkreenBuilder
      await arkreenBuilder.deployed();
      await arkreenBuilder.approveRouter([WETHPartner.address, WETH.address])

      const HashKeyESGBTCFactory = await ethers.getContractFactory("HashKeyESGBTC");
      hashKeyESGBTC = await upgrades.deployProxy(HashKeyESGBTCFactory,
                              [arkreenBuilder.address, arkreenRECToken.address, WETH.address, 2000]) as HashKeyESGBTC
      await hashKeyESGBTC.deployed();
      await hashKeyESGBTC.approveBuilder([WETHPartner.address, WETH.address, arkreenRECToken.address])

      const limit= BigNumber.from('0x0a141428283c3c64')
      await hashKeyESGBTC.UpdateESGBadgeLimit(limit, 0)

//      await arkreenBuilder.mangeTrustedForwarder(hashKeyESGBTC.address, true)

      return {  tokenA,
        tokenB, WETH, WETHPartner, factoryFeswa,
        routerFeswa, routerEventEmitter, pairAAB, pairABB,
        WETHPairTTE, WETHPairTEE, Feswa, FeswaNFT,
        tokenIDMatch,  
        pairTTArt, pairTAArt,  pairEEArt, pairEAArt,
        AKREToken, arkreenMiner, arkreenRegistry, arkreenRECIssuance, 
        arkreenRECToken, arkreenRetirement, arkreenBuilder }
    }

    beforeEach(async () => {
        [deployer, manager, register_authority, fund_receiver, owner1, owner2, miner1, miner2, maker1, maker2] = await ethers.getSigners();
        wallet = deployer
        feeTo = manager
        pairOwner = register_authority

        privateKeyManager = process.env.MANAGER_TEST_PRIVATE_KEY as string
        privateKeyRegister = process.env.REGISTER_TEST_PRIVATE_KEY as string
        privateKeyOwner = process.env.OWNER_TEST_PRIVATE_KEY as string
        privateKeyMaker = process.env.MAKER_TEST_PRIVATE_KEY as string
    
        const fixture = await loadFixture(deployFixture)
        AKREToken = fixture.AKREToken
        arkreenMiner = fixture.arkreenMiner        
        arkreenRegistry = fixture.arkreenRegistry
        arkreenRECIssuance = fixture.arkreenRECIssuance
        arkreenRetirement = fixture.arkreenRetirement

        tokenA = fixture.tokenA
        tokenB = fixture.tokenB
        WETH = fixture.WETH
        WETHPartner = fixture.WETHPartner
        router = fixture.routerFeswa
        pairAAB = fixture.pairAAB
        pairABB = fixture.pairABB      
        WETHPairTTE = fixture.WETHPairTTE
        WETHPairTEE = fixture.WETHPairTEE    
        routerEventEmitter = fixture.routerEventEmitter
        pairTTArt = fixture.pairTTArt  
        pairTAArt = fixture.pairTAArt  
        pairEEArt = fixture.pairEEArt  
        pairEAArt = fixture.pairEAArt  
        arkreenBuilder = fixture.arkreenBuilder  
        
        const startTime = 1564888526
        const endTime   = 1654888526

        let recMintRequest: RECRequestStruct = { 
          issuer: manager.address, region: 'Beijing', startTime, endTime,
          amountREC: expandTo9Decimals(1000), 
          cID: "bafybeihepmxz4ytc4ht67j73nzurkvsiuxhsmxk27utnopzptpo7wuigte", 
          url:"", memo:""
        } 
  
        const mintFee = expandTo18Decimals(1000).mul(50)
        const nonce1 = await AKREToken.nonces(owner1.address)
        const digest1 = await getApprovalDigest(
                                AKREToken,
                                { owner: owner1.address, spender: arkreenRECIssuance.address, value: mintFee },
                                nonce1,
                                constants.MaxUint256
                              )
        const { v,r,s } = ecsign(Buffer.from(digest1.slice(2), 'hex'), Buffer.from(privateKeyOwner.slice(2), 'hex'))
        const signature: SignatureStruct = { v, r, s, token: AKREToken.address, value:mintFee, deadline: constants.MaxUint256 } 
        
        // Mint
        await arkreenRegistry.setArkreenMiner(arkreenMiner.address)
//      await arkreenRECIssuance.managePaymentToken(AKREToken.address, true)
        const price0:BigNumber = expandTo18Decimals(50).div(expandTo9Decimals(1))
        await arkreenRECIssuance.updateARECMintPrice(AKREToken.address, price0)
        await arkreenRECIssuance.connect(owner1).mintRECRequest(recMintRequest, signature)
  
        const tokenID = await arkreenRECIssuance.totalSupply()
        await arkreenRECIssuance.connect(manager).certifyRECRequest(tokenID, "Serial12345678")
        await arkreenRECIssuance.connect(owner1).liquidizeREC(tokenID)
    });

    describe( "Arkreen Builder Test: Buying ART with token", () => {

      let tokenID: BigNumber

      async function mintAREC(amountREC: number) {
        const startTime = 1564888526
        const endTime   = 1654888526
  
        let recMintRequest: RECRequestStruct = { 
          issuer: manager.address, startTime, endTime,
          amountREC: expandTo9Decimals(amountREC), 
          cID: "bafybeihepmxz4ytc4ht67j73nzurkvsiuxhsmxk27utnopzptpo7wuigte",
          region: 'Beijing',
          url:"", memo:""
        } 
  
        const mintFee = expandTo18Decimals(amountREC).mul(50)
        const nonce1 = await AKREToken.nonces(owner1.address)
        const digest1 = await getApprovalDigest(
                                AKREToken,
                                { owner: owner1.address, spender: arkreenRECIssuance.address, value: mintFee },
                                nonce1,
                                constants.MaxUint256
                              )
        const { v,r,s } = ecsign(Buffer.from(digest1.slice(2), 'hex'), Buffer.from(privateKeyOwner.slice(2), 'hex'))
        const signature: SignatureStruct = { v, r, s, token: AKREToken.address, value:mintFee, deadline: constants.MaxUint256 } 
        
        await arkreenRECIssuance.connect(owner1).mintRECRequest(recMintRequest, signature)
        tokenID = await arkreenRECIssuance.totalSupply()
  
        await arkreenRECIssuance.connect(manager).certifyRECRequest(tokenID, "Serial12345678")
        await arkreenRECIssuance.connect(owner1).liquidizeREC(tokenID)
      }

      async function mintARECMaker(amountREC: number) {
        const startTime = 1564888526
        const endTime   = 1654888526
        
        let recMintRequest: RECRequestStruct = { 
          issuer: manager.address, startTime, endTime,
          amountREC: expandTo9Decimals(amountREC), 
          cID: "bafybeihepmxz4ytc4ht67j73nzurkvsiuxhsmxk27utnopzptpo7wuigte",
          region: 'Beijing',
          url:"", memo:""
        } 
  
        const mintFee = expandTo18Decimals(amountREC).mul(50)
        const nonce1 = await AKREToken.nonces(maker1.address)
        const digest1 = await getApprovalDigest(
                                AKREToken,
                                { owner: maker1.address, spender: arkreenRECIssuance.address, value: mintFee },
                                nonce1,
                                constants.MaxUint256
                              )
        const { v,r,s } = ecsign(Buffer.from(digest1.slice(2), 'hex'), Buffer.from(privateKeyMaker.slice(2), 'hex'))
        const signature: SignatureStruct = { v, r, s, token: AKREToken.address, value:mintFee, deadline: constants.MaxUint256 } 
        
        await arkreenRECIssuance.connect(maker1).mintRECRequest(recMintRequest, signature)
        const tokenID = await arkreenRECIssuance.totalSupply()
  
        await arkreenRECIssuance.connect(manager).certifyRECRequest(tokenID, "Serial12345678")
        await arkreenRECIssuance.connect(maker1).liquidizeREC(tokenID)
      }

      async function addLiquidityTTA(tokenTTAmount: BigNumber, tokenArtAmount: BigNumber, ratio: Number) {
        await WETHPartner.connect(maker1).approve(router.address, constants.MaxUint256)
        await arkreenRECToken.connect(maker1).approve(router.address, constants.MaxUint256)
        await router.connect(maker1).addLiquidity(
            {
              tokenA:         WETHPartner.address,
              tokenB:         arkreenRECToken.address,
              amountADesired: tokenTTAmount,
              amountBDesired: tokenArtAmount,
              amountAMin:     0,
              amountBMin:     0,
              ratio:          ratio,
            },
            wallet.address,
            constants.MaxUint256,
            overrides
          )
      }

      async function addLiquidityEEA(ETHAmount: BigNumber, tokenArtAmount: BigNumber, ratio: Number) {
        await arkreenRECToken.connect(maker1).approve(router.address, constants.MaxUint256)
        await router.connect(maker1).addLiquidityETH(
            {
              token:              arkreenRECToken.address,
              amountTokenDesired: tokenArtAmount,
              amountTokenMin:     0,
              amountETHMin:       0,
              ratio:              ratio,
            },
            maker1.address,
            constants.MaxUint256,
            { ...overrides, value: ETHAmount }
          )
      }

      beforeEach(async () => {
        // Mint
        await arkreenRegistry.setArkreenMiner(arkreenMiner.address)
        const price0:BigNumber = expandTo18Decimals(50).div(expandTo9Decimals(1))
        await arkreenRECIssuance.updateARECMintPrice(AKREToken.address, price0)
        await mintAREC(5000)        // 2 :  45      // 1:1000
        await mintAREC(600)         // 3:   51
        await mintAREC(8000)        // 4:  131
        await mintAREC(900)         // 5
        await mintAREC(1000)        // 6
        await mintAREC(2000)        // 7
        await mintAREC(9000)        // 8
        await mintAREC(800)         // 9
        await mintAREC(3000)        // 10:  298
  
        await mintAREC(5000)        // 11
        await mintAREC(600)         // 12
        await mintAREC(8000)        // 13
        await mintAREC(500)         // 14
        await mintAREC(1000)        // 15
        await mintAREC(2000)        // 16:  469
        await mintAREC(9000)        // 17:  559
        await mintAREC(800)         // 18
        await mintAREC(3000)        // 19： 597
        await mintAREC(500)                   // 20:  602
        await mintARECMaker(2000000)          // 21:  602        
  
      })

      ///////////////////////////////////////////
 
      it("greenizeBTCNative", async () => {
        await mintAREC(5000)          // 2

        await arkreenRECToken.setClimateBuilder(arkreenBuilder.address)
  
        const bricksToGreen = BigNumber.from('0x00700F01200D009002001')
        const tokenETHAmount = expandTo18Decimals(1000)
        const tokenArtAmount = expandTo9Decimals(1000000)
        await addLiquidityEEA(tokenETHAmount, tokenArtAmount, 0)      // should be 0 here

        const amountPay = expandTo18Decimals(20)
        const amountART = expandTo9Decimals(14)
        const badgeInfo =  {
                  beneficiary:    owner1.address,
                  offsetEntityID: 'Owner1',
                  beneficiaryID:  'Tester',
                  offsetMessage:  "Just Testing B"
                }

        // Normal transaction   
        const expectedInputAmount  = amountART.mul(tokenETHAmount).add(tokenArtAmount.sub(amountART))  // to solve the round problem
                                      .div(tokenArtAmount.sub(amountART))  

        const balanceBefore = await ethers.provider.getBalance(owner1.address)                                      
        const ARECBefore = await arkreenRECToken.balanceOf(owner1.address)  
        
        await expect(hashKeyESGBTC.connect(owner1).greenizeBTCNative( bricksToGreen, constants.MaxUint256, badgeInfo, {value: amountPay}))   
                    .to.be.revertedWith("ERC721: transfer to non ERC721Receiver implementer")          

        await arkreenBuilder.mangeTrustedForwarder(hashKeyESGBTC.address, true)
        await expect(hashKeyESGBTC.connect(owner1).greenizeBTCNative( bricksToGreen, constants.MaxUint256, badgeInfo, {value: amountPay}))
                            .to.emit(hashKeyESGBTC, 'Transfer')
                            .withArgs(zeroAddress, owner1.address, 1)
                            .to.emit(WETH, 'Deposit')
                            .withArgs(hashKeyESGBTC.address, amountPay)
                            .to.emit(WETH, 'Transfer')
                            .withArgs(hashKeyESGBTC.address, arkreenBuilder.address, amountPay)
                            .to.emit(pairEEArt, 'Sync')
                            .withArgs(tokenETHAmount.add(expectedInputAmount), tokenArtAmount.sub(amountART))
                            .to.emit(pairEEArt, 'Swap')
                            .withArgs(router.address, expectedInputAmount, 0, amountART, arkreenBuilder.address)  
                            .to.emit(arkreenRetirement, "OffsetCertificateMinted")
                            .withArgs(1)           
                            .to.emit(arkreenRetirement, "Locked")
                            .withArgs(1)     
                            .to.emit(WETH, 'Withdrawal')
                            .withArgs(arkreenBuilder.address, amountPay.sub(expectedInputAmount))                                                         

        const actionID =1     
        const lastBlock = await ethers.provider.getBlock('latest')
        
        const tokenID = BigNumber.from(1)
        const action = [  owner1.address, manager.address, amountART,    // Manger is the issuer address
                          tokenID.add(MASK_OFFSET), lastBlock.timestamp, true ]     // Offset action is claimed
        expect(await arkreenRetirement.getOffsetActions(actionID)).to.deep.equal(action)

        const offsetRecord = [owner1.address, owner1.address, "Owner1", "Tester", "Just Testing B", 
                              BigNumber.from(lastBlock.timestamp), amountART, [actionID]]
        const badgeID = 1                            
        expect(await arkreenRetirement.getCertificate(badgeID)).to.deep.equal(offsetRecord)   

        const balanceAfter = await ethers.provider.getBalance(owner1.address)  
        expect(balanceAfter).to.gt(balanceBefore.sub(amountPay))                // Pay back
        expect(balanceAfter).to.lt(balanceBefore.sub(expectedInputAmount))      // Some gas fee
        expect(await arkreenRECToken.balanceOf(owner1.address)).to.equal(ARECBefore)

        expect(await hashKeyESGBTC.checkBrick(1)).to.equal(true)
        expect(await hashKeyESGBTC.checkBrick(2)).to.equal(true)
        expect(await hashKeyESGBTC.checkBrick(7)).to.equal(true)
        expect(await hashKeyESGBTC.checkBrick(9)).to.equal(true)
        expect(await hashKeyESGBTC.checkBrick(13)).to.equal(true)
        expect(await hashKeyESGBTC.checkBrick(15)).to.equal(true)
        expect(await hashKeyESGBTC.checkBrick(18)).to.equal(true)
        expect(await hashKeyESGBTC.checkBrick(10)).to.equal(false)

        const ownerInfo = [ owner1.address, 1, bricksToGreen]
        expect(await hashKeyESGBTC.ownerBricks(1)).to.deep.equal(ownerInfo)
        expect(await hashKeyESGBTC.ownerBricks(9)).to.deep.equal(ownerInfo)

        expect( await hashKeyESGBTC.tokenURI(badgeID)).to.equal("https://www.arkreen.com/ESGBTC/1");     
        await hashKeyESGBTC.setBaseURI("https://www.arkreen.com/ESGBTC/offset/")
        expect( await hashKeyESGBTC.tokenURI(badgeID)).to.equal("https://www.arkreen.com/ESGBTC/offset/1"); 

        const level = BigNumber.from('0x0801')
        const limit = BigNumber.from('0x0202030204020302')
        const stringL1 =  'bafkreib64j7h42fl5dtmtitzzhy4y7yolkx3x62lufuu2ul6wligq77nh4'+
                          'bafkreiefvf5z6zhpr2ppfsdfw2s7ca5pwkrpznrjbgy2m6ywx6txrf7hce'

        const stringL2 =  'bafkreifhjbxlhizvy6veei2o64repiwmyzgahu255nckeecqspunr5y5fm'+
                          'bafkreif2tj47e4zobhcfzvhebpxzzfkmz5k55uud7jojc454uh2bnwhjwa'+
                          'bafkreihppgyo65lyhnpa7vbzaa2evmb3h6sznxs4qp4457t3o5onyps7t4'

        const stringL3 =  'bafkreigruwjvwbaw6qgdtryvvfftwr2nqoyermzoeg2c35bin5m7kgqhpq'+
                          'bafkreibesooju4joh2bpd3tscjbxch2zb66cvsvsk3ihekntxdfenyuoby'

        const stringL4 =  'bafkreif5ua6x7abmnlr72j7nzcrha56jh4qj5wxcuswf45ojczm5oaubyu'+
                          'bafkreiczvkn3gf5n5d6w5uj72lbez6xvtts3ovbmc55x4zpkoo22uo45yi'+
                          'bafkreiefbnj6u2rqpgqlfr6eulkht4vweok6rqnddcafb5fmphoknkfep4'+
                          'bafkreidfc33ltms4kteeirne7n3vwr3y3xwwaeice2uiynqzwd7dgdvbe4'

        const stringL5 =  'bafkreiegcfh773f2truz3vvgxjco5blpl2iy33lorgrpvkfs6irbrnvlfu'+
                          'bafkreif4sjf6jn54qwfpne43xqc7rrqi2zlf4yvzqxq5h6zqkand6htlti'

        const stringL6 =  'bafkreidzkojf3c7zt2ynjjm6mj5chaj5iqb7pfqzxxlqt7ykjdhozpbbqa'+
                          'bafkreibv4xtvxxaeqtol5kxpa5kd5bceppmx4zgn3s5nkb64ezkrkzjwui'+
                          'bafkreiafuz6yxkpgtut5bwxdgi5x4767hs224xm4dfbx4nbidg4icivbdm'

        const stringL7 =  'bafkreies5t2b6yobyjsuhb6v7f6jfb2hxbeqp2uco6r3nwykyzvp2mol34'+
                          'bafkreify2oxnfarcckdbbot73jnqjjxasobndycndmvgic5kmnxkqcaneu'

        const stringL8 =  'bafkreidgv5f6dcyls56wivao67trxh3da7xwsxlrvgygwvhqg4ybgmttkq'+
                          'bafkreibtuwdzidhlls5uhdvlw2jigymcm2i7dwhcikpaorvmhu6etpwm2i'

        await hashKeyESGBTC.updateCID(level, limit, Buffer.from(  stringL1 + stringL2 + stringL3 +stringL4 +
                                                                  stringL5 +stringL6 +stringL7 + stringL8))

        expect(await hashKeyESGBTC.cidBadge(BigNumber.from("0x0101"))).to.equal("bafkreib64j7h42fl5dtmtitzzhy4y7yolkx3x62lufuu2ul6wligq77nh4"); 
        expect(await hashKeyESGBTC.cidBadge(BigNumber.from("0x0102"))).to.equal("bafkreiefvf5z6zhpr2ppfsdfw2s7ca5pwkrpznrjbgy2m6ywx6txrf7hce"); 

        expect(await hashKeyESGBTC.cidBadge(BigNumber.from("0x0401"))).to.equal("bafkreif5ua6x7abmnlr72j7nzcrha56jh4qj5wxcuswf45ojczm5oaubyu"); 
        expect(await hashKeyESGBTC.cidBadge(BigNumber.from("0x0402"))).to.equal("bafkreiczvkn3gf5n5d6w5uj72lbez6xvtts3ovbmc55x4zpkoo22uo45yi"); 
        expect(await hashKeyESGBTC.cidBadge(BigNumber.from("0x0403"))).to.equal("bafkreiefbnj6u2rqpgqlfr6eulkht4vweok6rqnddcafb5fmphoknkfep4"); 
        expect(await hashKeyESGBTC.cidBadge(BigNumber.from("0x0404"))).to.equal("bafkreidfc33ltms4kteeirne7n3vwr3y3xwwaeice2uiynqzwd7dgdvbe4"); 

        expect(await hashKeyESGBTC.cidBadge(BigNumber.from("0x0801"))).to.equal("bafkreidgv5f6dcyls56wivao67trxh3da7xwsxlrvgygwvhqg4ybgmttkq"); 
        expect(await hashKeyESGBTC.cidBadge(BigNumber.from("0x0802"))).to.equal("bafkreibtuwdzidhlls5uhdvlw2jigymcm2i7dwhcikpaorvmhu6etpwm2i"); 

        expect( await hashKeyESGBTC.tokenURI(badgeID)).to.equal("https://bafkreigruwjvwbaw6qgdtryvvfftwr2nqoyermzoeg2c35bin5m7kgqhpq.ipfs.w3s.link"); 

      });      

      it("greenizeBTC", async () => {
        await mintAREC(5000)          // 2

        await arkreenRECToken.setClimateBuilder(arkreenBuilder.address)
          
        const bricksToGreen = BigNumber.from('0x00700F01200D009002001')
        const tokenTTAmount = expandTo18Decimals(10000)
        const tokenArtAmount = expandTo9Decimals(1000000)
        await addLiquidityTTA(tokenTTAmount, tokenArtAmount, 100)

        const amountPay = expandTo18Decimals(20)
        const amountART = expandTo9Decimals(14)
        const badgeInfo =  {
                  beneficiary:    owner1.address,
                  offsetEntityID: 'Owner1',
                  beneficiaryID:  'Tester',
                  offsetMessage:  "Just Testing"
                }

        // Normal transaction   
        const expectedInputAmount  = amountART.mul(tokenTTAmount).add(tokenArtAmount.sub(amountART))  // to solve the round problem
                                      .div(tokenArtAmount.sub(amountART))  

        await expect(hashKeyESGBTC.connect(owner1).greenizeBTC( WETHPartner.address, 
                                        amountPay, bricksToGreen, constants.MaxUint256, badgeInfo))   
              .to.be.revertedWith("TransferHelper: TRANSFER_FROM_FAILED")     

        const ARECBefore = await arkreenRECToken.balanceOf(owner1.address)                                      
        await WETHPartner.connect(owner1).approve(hashKeyESGBTC.address, constants.MaxUint256)

        await expect(hashKeyESGBTC.connect(owner1).greenizeBTC( WETHPartner.address, 
                                        amountPay, bricksToGreen, constants.MaxUint256, badgeInfo))   
              .to.be.revertedWith("ERC721: transfer to non ERC721Receiver implementer")     

        await arkreenBuilder.mangeTrustedForwarder(hashKeyESGBTC.address, true)
        await expect(hashKeyESGBTC.connect(owner1).greenizeBTC( WETHPartner.address,
                                                      amountPay, bricksToGreen, constants.MaxUint256, badgeInfo))
                            .to.emit(hashKeyESGBTC, 'Transfer')
                            .withArgs(zeroAddress, owner1.address, 1)
                            .to.emit(WETHPartner, 'Transfer')
                            .withArgs(owner1.address, hashKeyESGBTC.address, amountPay)
                            .to.emit(WETHPartner, 'Transfer')
                            .withArgs(hashKeyESGBTC.address, arkreenBuilder.address, amountPay)                            
                            .to.emit(WETHPartner, 'Transfer')
                            .withArgs(arkreenBuilder.address, pairTTArt.address, expectedInputAmount)
                            .to.emit(arkreenRECToken, 'Transfer')
                            .withArgs(pairTTArt.address, arkreenBuilder.address, amountART)
                            .to.emit(pairTTArt, 'Sync')
                            .withArgs(tokenTTAmount.add(expectedInputAmount), tokenArtAmount.sub(amountART))
                            .to.emit(pairTTArt, 'Swap')
                            .withArgs(router.address, expectedInputAmount, 0, amountART, arkreenBuilder.address)  
                            .to.emit(arkreenRetirement, "OffsetCertificateMinted")
                            .withArgs(1)           
                            .to.emit(arkreenRetirement, "Locked")
                            .withArgs(1)
                            .to.emit(WETHPartner, 'Transfer')
                            .withArgs(arkreenBuilder.address, owner1.address, amountPay.sub(expectedInputAmount))      

        const actionID =1     
        const lastBlock = await ethers.provider.getBlock('latest')     
        
        const tokenID = BigNumber.from(1)
        const action = [  owner1.address, manager.address, amountART,    // Manger is the issuer address
                          tokenID.add(MASK_OFFSET), lastBlock.timestamp, true ]     // Offset action is claimed
        expect(await arkreenRetirement.getOffsetActions(actionID)).to.deep.equal(action)

        const offsetRecord = [owner1.address, owner1.address, "Owner1", "Tester", "Just Testing", 
                              BigNumber.from(lastBlock.timestamp), amountART, [actionID]]
        const badgeID = 1                            
        expect(await arkreenRetirement.getCertificate(badgeID)).to.deep.equal(offsetRecord)
        expect(await arkreenRECToken.balanceOf(owner1.address)).to.equal(ARECBefore)   

        expect(await hashKeyESGBTC.checkBrick(1)).to.equal(true)
        expect(await hashKeyESGBTC.checkBrick(2)).to.equal(true)
        expect(await hashKeyESGBTC.checkBrick(7)).to.equal(true)
        expect(await hashKeyESGBTC.checkBrick(9)).to.equal(true)
        expect(await hashKeyESGBTC.checkBrick(13)).to.equal(true)
        expect(await hashKeyESGBTC.checkBrick(15)).to.equal(true)
        expect(await hashKeyESGBTC.checkBrick(18)).to.equal(true)
        expect(await hashKeyESGBTC.checkBrick(10)).to.equal(false)

        const ownerInfo = [ owner1.address, 1, bricksToGreen]
        expect(await hashKeyESGBTC.ownerBricks(1)).to.deep.equal(ownerInfo)
        expect(await hashKeyESGBTC.ownerBricks(9)).to.deep.equal(ownerInfo)

      });      

      it("greenizeBTCWithART", async () => {
        await mintAREC(5000)          // 2

        await arkreenRECToken.setClimateBuilder(arkreenBuilder.address)
        const bricksToGreen = BigNumber.from('0x00700F01200D009002001')

        const amountART = expandTo9Decimals(14)
        const badgeInfo =  {
                  beneficiary:    owner1.address,
                  offsetEntityID: 'Owner1',
                  beneficiaryID:  'Tester',
                  offsetMessage:  "Just Testing"
                }

        await expect(hashKeyESGBTC.connect(owner1).greenizeBTCWithART( arkreenRECToken.address, 
                                        bricksToGreen, constants.MaxUint256, badgeInfo))   
              .to.be.revertedWith("HSKESG: ART Not Accepted")                     

        await hashKeyESGBTC.mangeARTTokens([arkreenRECToken.address],true)
        
        await expect(hashKeyESGBTC.connect(owner1).greenizeBTCWithART( arkreenRECToken.address, 
                                        bricksToGreen, constants.MaxUint256, badgeInfo))   
              .to.be.revertedWith("TransferHelper: TRANSFER_FROM_FAILED")     

        const ARECBefore = await arkreenRECToken.balanceOf(owner1.address)                                      
        await arkreenRECToken.connect(owner1).approve(hashKeyESGBTC.address, constants.MaxUint256)

        await expect(hashKeyESGBTC.connect(owner1).greenizeBTCWithART( arkreenRECToken.address, 
                                        bricksToGreen, constants.MaxUint256, badgeInfo))  
                .to.be.revertedWith("ERC721: transfer to non ERC721Receiver implementer")     

        await arkreenBuilder.mangeTrustedForwarder(hashKeyESGBTC.address, true)
        await expect(hashKeyESGBTC.connect(owner1).greenizeBTCWithART( arkreenRECToken.address,
                                                      bricksToGreen, constants.MaxUint256, badgeInfo))
                            .to.emit(hashKeyESGBTC, 'Transfer')
                            .withArgs(zeroAddress, owner1.address, 1)                                                      
                            .to.emit(arkreenRECToken, 'Transfer')
                            .withArgs(owner1.address, hashKeyESGBTC.address, amountART)
                            .to.emit(arkreenRECToken, 'Transfer')
                            .withArgs(hashKeyESGBTC.address, arkreenBuilder.address, amountART)
                            .to.emit(arkreenRECToken, 'Transfer')
                            .withArgs(arkreenBuilder.address, constants.AddressZero, amountART)
                            .to.emit(arkreenRECToken, "OffsetFinished")
                            .withArgs(owner1.address, amountART, 1)     
                            .to.emit(arkreenRetirement, "OffsetCertificateMinted")
                            .withArgs(1)           
                            .to.emit(arkreenRetirement, "Locked")
                            .withArgs(1)

        const actionID =1     
        const lastBlock = await ethers.provider.getBlock('latest')    
        
        const tokenID = BigNumber.from(1)
        const action = [  owner1.address, manager.address, amountART,    // Manger is the issuer address
                          tokenID.add(MASK_OFFSET), lastBlock.timestamp, true ]     // Offset action is claimed
        expect(await arkreenRetirement.getOffsetActions(actionID)).to.deep.equal(action)

        const offsetRecord = [owner1.address, owner1.address, "Owner1", "Tester", "Just Testing", 
                              BigNumber.from(lastBlock.timestamp), amountART, [actionID]]
        const badgeID = 1                            
        expect(await arkreenRetirement.getCertificate(badgeID)).to.deep.equal(offsetRecord)
        expect(await arkreenRECToken.balanceOf(owner1.address)).to.equal(ARECBefore.sub(amountART))   

        expect(await hashKeyESGBTC.checkBrick(1)).to.equal(true)
        expect(await hashKeyESGBTC.checkBrick(2)).to.equal(true)
        expect(await hashKeyESGBTC.checkBrick(7)).to.equal(true)
        expect(await hashKeyESGBTC.checkBrick(9)).to.equal(true)
        expect(await hashKeyESGBTC.checkBrick(13)).to.equal(true)
        expect(await hashKeyESGBTC.checkBrick(15)).to.equal(true)
        expect(await hashKeyESGBTC.checkBrick(18)).to.equal(true)
        expect(await hashKeyESGBTC.checkBrick(10)).to.equal(false)

        const ownerInfo = [ owner1.address, 1, bricksToGreen]
        expect(await hashKeyESGBTC.ownerBricks(1)).to.deep.equal(ownerInfo)
        expect(await hashKeyESGBTC.ownerBricks(9)).to.deep.equal(ownerInfo)

      });      

      it("HashKeyESGBTC with Permit 1: ", async () => {
        await mintAREC(5000)          // 2

        await arkreenRECToken.setClimateBuilder(arkreenBuilder.address)
  
        const tokenTTAmount = expandTo18Decimals(10000)
        const tokenArtAmount = expandTo9Decimals(1000000)
        await addLiquidityTTA(tokenTTAmount, tokenArtAmount, 100)

        const bricksToGreen = BigNumber.from('0x00700F01200D009002001')
        const amountPay = expandTo18Decimals(20)
        const amountART = expandTo9Decimals(14)
        const badgeInfo =  {
                  beneficiary:    owner1.address,
                  offsetEntityID: 'Owner1',
                  beneficiaryID:  'Tester',
                  offsetMessage:  "Just Testing"
                }

        const nonce1 = await WETHPartner.nonces(owner1.address)
        const digest1 = await getApprovalDigest( WETHPartner,
                                { owner: owner1.address, spender: hashKeyESGBTC.address, value: amountPay },
                                nonce1,
                                constants.MaxUint256
                              )
        const { v,r,s } = ecsign(Buffer.from(digest1.slice(2), 'hex'), Buffer.from(privateKeyOwner.slice(2), 'hex'))
        const permitToPay: SignatureStruct = { v, r, s, token: WETHPartner.address, value:amountPay, deadline: constants.MaxUint256 } 

        // Abnormal Test
        // Check signature
        permitToPay.deadline = constants.MaxUint256.sub(1)
        await expect(hashKeyESGBTC.connect(owner1).greenizeBTCPermit( bricksToGreen, badgeInfo, permitToPay ))
                                                    .to.be.revertedWith("FeSwap: INVALID_SIGNATURE")  

        // Normal transaction   
        permitToPay.deadline = constants.MaxUint256   
        const expectedInputAmount  = amountART.mul(tokenTTAmount).add(tokenArtAmount.sub(amountART))  // to solve the round problem
                                      .div(tokenArtAmount.sub(amountART))  

        const ARECBefore = await arkreenRECToken.balanceOf(owner1.address)  
        
        await expect(hashKeyESGBTC.connect(owner1).greenizeBTCPermit( bricksToGreen, badgeInfo, permitToPay ))
                            .to.be.revertedWith("ERC721: transfer to non ERC721Receiver implementer")  

        await arkreenBuilder.mangeTrustedForwarder(hashKeyESGBTC.address, true)
        await expect(hashKeyESGBTC.connect(owner1).greenizeBTCPermit( bricksToGreen, badgeInfo, permitToPay))
                            .to.emit(hashKeyESGBTC, 'Transfer')
                            .withArgs(zeroAddress, owner1.address, 1)        
                            .to.emit(WETHPartner, 'Transfer')
                            .withArgs(owner1.address, hashKeyESGBTC.address, amountPay)
                            .to.emit(WETHPartner, 'Transfer')
                            .withArgs(hashKeyESGBTC.address, arkreenBuilder.address, amountPay)
                            .to.emit(WETHPartner, 'Transfer')
                            .withArgs(arkreenBuilder.address, pairTTArt.address, expectedInputAmount)
                            .to.emit(arkreenRECToken, 'Transfer')
                            .withArgs(pairTTArt.address, arkreenBuilder.address, amountART)
                            .to.emit(pairTTArt, 'Sync')
                            .withArgs(tokenTTAmount.add(expectedInputAmount), tokenArtAmount.sub(amountART))
                            .to.emit(pairTTArt, 'Swap')
                            .withArgs(router.address, expectedInputAmount, 0, amountART, arkreenBuilder.address)  
                            .to.emit(arkreenRetirement, "OffsetCertificateMinted")
                            .withArgs(1)           
                            .to.emit(arkreenRetirement, "Locked")
                            .withArgs(1)
                            .to.emit(WETHPartner, 'Transfer')
                            .withArgs(arkreenBuilder.address, owner1.address, amountPay.sub(expectedInputAmount)) 

        const actionID =1     
        const lastBlock = await ethers.provider.getBlock('latest')     
        
        const tokenID = BigNumber.from(1)
        const action = [  owner1.address, manager.address, amountART,    // Manger is the issuer address
                          tokenID.add(MASK_OFFSET), lastBlock.timestamp, true ]     // Offset action is claimed
        expect(await arkreenRetirement.getOffsetActions(actionID)).to.deep.equal(action)

        const offsetRecord = [owner1.address, owner1.address, "Owner1", "Tester", "Just Testing", 
                              BigNumber.from(lastBlock.timestamp), amountART, [actionID]]
        const badgeID = 1                            
        expect(await arkreenRetirement.getCertificate(badgeID)).to.deep.equal(offsetRecord)
        expect(await arkreenRECToken.balanceOf(owner1.address)).to.equal(ARECBefore)   

        expect(await hashKeyESGBTC.checkBrick(1)).to.equal(true)
        expect(await hashKeyESGBTC.checkBrick(2)).to.equal(true)
        expect(await hashKeyESGBTC.checkBrick(7)).to.equal(true)
        expect(await hashKeyESGBTC.checkBrick(9)).to.equal(true)
        expect(await hashKeyESGBTC.checkBrick(13)).to.equal(true)
        expect(await hashKeyESGBTC.checkBrick(15)).to.equal(true)
        expect(await hashKeyESGBTC.checkBrick(18)).to.equal(true)
        expect(await hashKeyESGBTC.checkBrick(10)).to.equal(false)

        const ownerInfo = [ owner1.address, 1, bricksToGreen]
        expect(await hashKeyESGBTC.ownerBricks(1)).to.deep.equal(ownerInfo)
        expect(await hashKeyESGBTC.ownerBricks(9)).to.deep.equal(ownerInfo)        

      });      

      it("HashKeyESGBTC with Permit 2: ", async () => {
        await mintAREC(5000)          // 2

        await arkreenRECToken.setClimateBuilder(arkreenBuilder.address)
  
        const tokenTTAmount = expandTo18Decimals(10000)
        const tokenArtAmount = expandTo9Decimals(1000000)
        await addLiquidityTTA(tokenTTAmount, tokenArtAmount, 100)

        const bricksToGreen = BigNumber.from('0x00700F01200D009002001')        
        const amountPay = expandTo18Decimals(20)
        const amountART = expandTo9Decimals(14)
        const badgeInfo =  {
                  beneficiary:    owner2.address,
                  offsetEntityID: 'Owner1',
                  beneficiaryID:  'Tester',
                  offsetMessage:  "Just Testing"
                }

        const nonce1 = await WETHPartner.nonces(owner1.address)
        const digest1 = await getApprovalDigest( WETHPartner,
                                { owner: owner1.address, spender: hashKeyESGBTC.address, value: amountPay },
                                nonce1,
                                constants.MaxUint256
                              )
        const { v,r,s } = ecsign(Buffer.from(digest1.slice(2), 'hex'), Buffer.from(privateKeyOwner.slice(2), 'hex'))
        const permitToPay: SignatureStruct = { v, r, s, token: WETHPartner.address, value:amountPay, deadline: constants.MaxUint256 } 

        // Abnormal Test
        // Check signature
        permitToPay.deadline = constants.MaxUint256.sub(1)
        await expect(hashKeyESGBTC.connect(owner1).greenizeBTCPermit( bricksToGreen, badgeInfo, permitToPay ))
                                                    .to.be.revertedWith("FeSwap: INVALID_SIGNATURE")  

        // Normal transaction   
        permitToPay.deadline = constants.MaxUint256   
        const expectedInputAmount  = amountART.mul(tokenTTAmount).add(tokenArtAmount.sub(amountART))  // to solve the round problem
                                      .div(tokenArtAmount.sub(amountART))  

        await expect(hashKeyESGBTC.connect(owner1).greenizeBTCPermit( bricksToGreen, badgeInfo, permitToPay ))
                            .to.be.revertedWith("ERC721: transfer to non ERC721Receiver implementer")  
        await arkreenBuilder.mangeTrustedForwarder(hashKeyESGBTC.address, true)

        const ARECBefore = await arkreenRECToken.balanceOf(owner1.address)   
        await expect(hashKeyESGBTC.connect(owner1).greenizeBTCPermit( bricksToGreen, badgeInfo, permitToPay))
                            .to.emit(hashKeyESGBTC, 'Transfer')
                            .withArgs(zeroAddress, owner1.address, 1)     
                            .to.emit(WETHPartner, 'Transfer')
                            .withArgs(owner1.address, hashKeyESGBTC.address, amountPay)
                            .to.emit(WETHPartner, 'Transfer')
                            .withArgs(hashKeyESGBTC.address, arkreenBuilder.address, amountPay)
                            .to.emit(WETHPartner, 'Transfer')
                            .withArgs(arkreenBuilder.address, pairTTArt.address, expectedInputAmount)
                            .to.emit(arkreenRECToken, 'Transfer')
                            .withArgs(pairTTArt.address, arkreenBuilder.address, amountART)
                            .to.emit(pairTTArt, 'Sync')
                            .withArgs(tokenTTAmount.add(expectedInputAmount), tokenArtAmount.sub(amountART))
                            .to.emit(pairTTArt, 'Swap')
                            .withArgs(router.address, expectedInputAmount, 0, amountART, arkreenBuilder.address)  
                            .to.emit(arkreenRetirement, "OffsetCertificateMinted")
                            .withArgs(1)           
                            .to.emit(arkreenRetirement, "Locked")
                            .withArgs(1)
                            .to.emit(WETHPartner, 'Transfer')
                            .withArgs(arkreenBuilder.address, owner1.address, amountPay.sub(expectedInputAmount)) 

        const actionID =1     
        const lastBlock = await ethers.provider.getBlock('latest')     
        
        const tokenID = BigNumber.from(1)
        const action = [  owner1.address, manager.address, amountART,    // Manger is the issuer address
                          tokenID.add(MASK_OFFSET), lastBlock.timestamp, true ]     // Offset action is claimed
        expect(await arkreenRetirement.getOffsetActions(actionID)).to.deep.equal(action)

        const offsetRecord = [owner1.address, owner2.address, "Owner1", "Tester", "Just Testing", 
                              BigNumber.from(lastBlock.timestamp), amountART, [actionID]]
        const badgeID = 1                            
        expect(await arkreenRetirement.getCertificate(badgeID)).to.deep.equal(offsetRecord)
        expect(await arkreenRECToken.balanceOf(owner1.address)).to.equal(ARECBefore)   

        expect(await hashKeyESGBTC.checkBrick(1)).to.equal(true)
        expect(await hashKeyESGBTC.checkBrick(2)).to.equal(true)
        expect(await hashKeyESGBTC.checkBrick(7)).to.equal(true)
        expect(await hashKeyESGBTC.checkBrick(9)).to.equal(true)
        expect(await hashKeyESGBTC.checkBrick(13)).to.equal(true)
        expect(await hashKeyESGBTC.checkBrick(15)).to.equal(true)
        expect(await hashKeyESGBTC.checkBrick(18)).to.equal(true)
        expect(await hashKeyESGBTC.checkBrick(10)).to.equal(false)

        const ownerInfo = [ owner1.address, 1, bricksToGreen]
        expect(await hashKeyESGBTC.ownerBricks(1)).to.deep.equal(ownerInfo)
        expect(await hashKeyESGBTC.ownerBricks(9)).to.deep.equal(ownerInfo)

      });      

    })  
});
