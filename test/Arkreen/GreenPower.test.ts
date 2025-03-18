import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import { loadFixture, mine } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
const {ethers, upgrades} =  require("hardhat");
import hre from 'hardhat'
import { ecsign, fromRpcSig, ecrecover, zeroAddress } from 'ethereumjs-util'
import { getGreenPowerStakingDigest, getApprovalDigest, expandTo6Decimals, expandTo18Decimals, randomAddresses, expandTo9Decimals } from '../utils/utilities'
import { getGreenPowerUnstakingDigest, OffsetAction, OffsetActionAgent, OffsetActionBatch, getGreenPowerOffsetDigest } from '../utils/utilities'
import { getGreenPowerRewardDigest, getGreenPowerRewardDigestExt  } from '../utils/utilities'

import { constants, BigNumber, utils} from 'ethers'
import { anyValue } from "@nomicfoundation/hardhat-chai-matchers/withArgs";

import {
    ArkreenToken,
    ArkreenMiner,
    ArkreenRECIssuance,
    ArkreenRECIssuanceExt,
    ArkreenRegistry,
    ArkreenRECToken,
    ArkreenBadge,
    ArkreenBuilder,
    ArkreenRECBank,
    KWhToken,
    WETH9,
    ERC20F,
    GreenPower,
    ArkreenToken__factory,
    ArkreenTokenTest__factory
    // ArkreenTokenV2,
    // ArkreenTokenV2__factory
} from "../../typechain";

import { RECRequestStruct, SignatureStruct, RECDataStruct } from "../../typechain/contracts/ArkreenRECIssuance";
import Decimal from "decimal.js";
import { deploy } from "@openzeppelin/hardhat-upgrades/dist/utils";
import { any } from "hardhat/internal/core/params/argumentTypes";
const constants_MaxDealine = BigNumber.from('0xFFFFFFFF')

interface OffsetServerEvent {
  txid:               string
  offsetBaseIndex:    BigNumber
  totalOffsetAmount:  BigNumber
  offsetActionBatch:   OffsetActionBatch[]
}

enum SkipReason {
  NORMAL,
  WRONG_OWNER,
  WRONG_AMOUNT,
  LESS_DEPOSIT
}

const TIMESTAMP_NEW_UNIT = 1723795200     // 1723449600

describe("GreenPower Test Campaign", ()=>{

    let deployer: SignerWithAddress;
    let manager: SignerWithAddress;
    let register_authority: SignerWithAddress;
    let fund_receiver: SignerWithAddress;

    let owner1: SignerWithAddress;
    let maker1: SignerWithAddress;
    let user1:  SignerWithAddress
    let user2:  SignerWithAddress
    let user3:  SignerWithAddress

    let privateKeyManager:      string
    let privateKeyRegister:     string
    let privateKeyOwner:        string
    let privateKeyMaker:        string

    let AKREToken:                    ArkreenToken
    let arkreenMiner:                 ArkreenMiner
    let arkreenRegistry:              ArkreenRegistry
    let arkreenRECIssuance:           ArkreenRECIssuance
    let arkreenRECIssuanceExt:        ArkreenRECIssuanceExt

    let arkreenRECToken:              ArkreenRECToken
    let arkreenRetirement:            ArkreenBadge
    let arkreenBuilder:               ArkreenBuilder
    let arkreenRECBank:               ArkreenRECBank
    let kWhToken:                     KWhToken

    let WETH:                         WETH9
    let tokenA:                       ERC20F
    let greenPower:                   GreenPower

    const value10000 = BigNumber.from(10000).mul(256).add(18)     // 10000 AKRE
    const value1000 = BigNumber.from(1000).mul(256).add(18)       // 10000 AKRE
    const value100 = BigNumber.from(100).mul(256).add(18)         // 10000 AKRE

    const value50000 = BigNumber.from(50000).mul(256).add(18)     // 50000 AKRE
    const value5000 = BigNumber.from(5000).mul(256).add(18)       // 5000 AKRE
    const value500 = BigNumber.from(500).mul(256).add(18)         // 500 AKRE

    const Bytes32_Zero = "0x0000000000000000000000000000000000000000000000000000000000000000"

    async function deployFixture() {
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
  
        const ArkreenRECIssuanceExtFactory = await ethers.getContractFactory("ArkreenRECIssuanceExt")
        const arkreenRECIssuanceExtImp = await ArkreenRECIssuanceExtFactory.deploy()
        await arkreenRECIssuanceExtImp.deployed()    
        
        await arkreenRECIssuance.setESGExtAddress(arkreenRECIssuanceExtImp.address)
  
        const ArkreenRECTokenFactory = await ethers.getContractFactory("ArkreenRECToken")
        const arkreenRECToken = await upgrades.deployProxy(ArkreenRECTokenFactory,[arkreenRegistry.address, manager.address,'','']) as ArkreenRECToken
        await arkreenRECToken.deployed()   
  
        const ArkreenRetirementFactory = await ethers.getContractFactory("ArkreenBadge")
        const arkreenRetirement = await upgrades.deployProxy(ArkreenRetirementFactory,[arkreenRegistry.address]) as ArkreenBadge
        await arkreenRetirement.deployed()     
  
        const ERC20Factory = await ethers.getContractFactory("ERC20F");
        const tokenA = await ERC20Factory.deploy(expandTo18Decimals(100000000),"Token A");
        await tokenA.deployed();
  
        const WETH9Factory = await ethers.getContractFactory("WETH9");
        const WETH = await WETH9Factory.deploy();
        await WETH.deployed();
  
        const ArkreenRECBankFactory = await ethers.getContractFactory("ArkreenRECBank")
        const arkreenRECBank = await upgrades.deployProxy(ArkreenRECBankFactory,[WETH.address]) as ArkreenRECBank
        await arkreenRECBank.deployed()   
    
        await AKREToken.transfer(owner1.address, expandTo18Decimals(300_000_000))
        await AKREToken.connect(owner1).approve(arkreenRECIssuance.address, expandTo18Decimals(300_000_000))
        await AKREToken.transfer(maker1.address, expandTo18Decimals(300_000_000))
        await AKREToken.connect(maker1).approve(arkreenRECIssuance.address, expandTo18Decimals(300_000_000))
        await AKREToken.connect(owner1).approve(arkreenMiner.address, expandTo18Decimals(300_000_000))
        await AKREToken.connect(maker1).approve(arkreenMiner.address, expandTo18Decimals(300_000_000))
  
        const miners = randomAddresses(2)
        await arkreenMiner.connect(manager).RemoteMinerOnboardInBatch([owner1.address, maker1.address], miners)
  
        const payer = maker1.address
        const Miner_Manager = 0 
        await arkreenMiner.setManager(Miner_Manager, manager.address)
        await arkreenMiner.ManageManufactures([payer], true)     
  
        await arkreenRegistry.addRECIssuer(manager.address, arkreenRECToken.address, "Arkreen Issuer")
        await arkreenRegistry.setRECIssuance(arkreenRECIssuance.address)
        await arkreenRegistry.setArkreenRetirement(arkreenRetirement.address)
  
        const ArkreenBuilderFactory = await ethers.getContractFactory("ArkreenBuilder");
        arkreenBuilder = await upgrades.deployProxy(ArkreenBuilderFactory,[AKREToken.address, arkreenRECBank.address, WETH.address]) as ArkreenBuilder
        await arkreenBuilder.deployed();

        await arkreenBuilder.approveRouter([AKREToken.address, WETH.address])       
        await arkreenBuilder.approveArtBank([tokenA.address, WETH.address, manager.address])     
        
        const kWhFactory = await ethers.getContractFactory("KWhToken");
        const kWhToken = await upgrades.deployProxy(kWhFactory,
                                [ arkreenRECToken.address, arkreenRECBank.address, 
                                  arkreenBuilder.address, manager.address ]) as KWhToken
        await kWhToken.deployed()

        await kWhToken.approveBank([tokenA.address, WETH.address, AKREToken.address])       

        const GreenPowerFactory = await ethers.getContractFactory("GreenPower")
        const greenPower = await upgrades.deployProxy(GreenPowerFactory, [AKREToken.address, kWhToken.address, manager.address]) as GreenPower
        await greenPower.deployed()

        await greenPower.approveConvertkWh([tokenA.address, WETH.address])
        await greenPower.setBankAndART(arkreenRECBank.address, arkreenRECToken.address)
       
        return { AKREToken, arkreenMiner, arkreenRegistry, arkreenRECIssuance, arkreenRECToken, 
          arkreenRetirement, arkreenRECIssuanceExt, arkreenRECBank, kWhToken, WETH, tokenA,
          greenPower }
    }

    describe('GreenPower test', () => {

      beforeEach(async () => {

        [deployer, manager, register_authority, fund_receiver, owner1, user1, user2, user3, maker1] = await ethers.getSigners();

        privateKeyManager = process.env.MANAGER_TEST_PRIVATE_KEY as string
        privateKeyRegister = process.env.REGISTER_TEST_PRIVATE_KEY as string
        privateKeyOwner = process.env.OWNER_TEST_PRIVATE_KEY as string
        privateKeyMaker = process.env.MAKER_TEST_PRIVATE_KEY as string
    
        const fixture = await loadFixture(deployFixture)
        AKREToken = fixture.AKREToken
        arkreenMiner = fixture.arkreenMiner        
        arkreenRegistry = fixture.arkreenRegistry
        arkreenRECIssuance = fixture.arkreenRECIssuance
        arkreenRECIssuanceExt = fixture.arkreenRECIssuanceExt
        arkreenRECToken = fixture.arkreenRECToken
        arkreenRetirement = fixture.arkreenRetirement
        arkreenRECToken = fixture.arkreenRECToken
        arkreenRECBank = fixture.arkreenRECBank
        kWhToken = fixture.kWhToken
        WETH = fixture.WETH
        tokenA = fixture.tokenA
        greenPower = fixture.greenPower

        {
          const startTime = 1564888526
          const endTime   = 1654888526
          
          let recMintRequest: RECRequestStruct = { 
            issuer: manager.address, startTime, endTime,
            amountREC: expandTo9Decimals(50000), 
            cID: "bafybeihepmxz4ytc4ht67j73nzurkvsiuxhsmxk27utnopzptpo7wuigte",
            region: 'Beijing',
            url:"", memo:""
          } 

          const mintFee = expandTo18Decimals(50000* 1000)
          const nonce1 = await AKREToken.nonces(owner1.address)
          const digest1 = await getApprovalDigest(
                                  AKREToken,
                                  { owner: owner1.address, spender: arkreenRECIssuance.address, value: mintFee },
                                  nonce1,
                                  constants_MaxDealine
                                )
          const { v,r,s } = ecsign(Buffer.from(digest1.slice(2), 'hex'), Buffer.from(privateKeyOwner.slice(2), 'hex'))
          const signature: SignatureStruct = { v, r, s, token: AKREToken.address, value:mintFee, deadline: constants_MaxDealine } 
          
          const price0:BigNumber = expandTo18Decimals(1000).div(expandTo9Decimals(1))
          await arkreenRECIssuance.updateARECMintPrice(AKREToken.address, price0)

          // Mint
          await arkreenRegistry.setArkreenMiner(arkreenMiner.address)
          await arkreenRECIssuance.connect(owner1).mintRECRequest(recMintRequest, signature)
          const tokenID = await arkreenRECIssuance.totalSupply()

          await arkreenRECIssuance.connect(manager).certifyRECRequest(tokenID, "Serial12345678")

          // Normal
          await arkreenRECIssuance.connect(owner1).liquidizeREC(tokenID)

          await arkreenRECToken.connect(owner1).transfer(maker1.address, expandTo9Decimals(9000))
          await arkreenRECToken.connect(maker1).approve(arkreenRECBank.address, expandTo9Decimals(9000))

          await arkreenRECBank.addNewART( arkreenRECToken.address,  maker1.address)
          await arkreenRECBank.connect(maker1).depositART( arkreenRECToken.address,  expandTo9Decimals(9000))
          await arkreenRECBank.connect(maker1).changeSalePrice( arkreenRECToken.address, tokenA.address, expandTo18Decimals(150))
          await arkreenRECToken.setClimateBuilder(arkreenBuilder.address)
  
          const badgeInfo =  {
            beneficiary:    owner1.address,
            offsetEntityID: 'Owner1',
            beneficiaryID:  'Tester',
            offsetMessage:  "Just Testing"
          }    
  
          await kWhToken.setBadgeInfo(badgeInfo)
  
          // MintKWh with ART
          await arkreenRECToken.connect(owner1).transfer(kWhToken.address, expandTo9Decimals(20000))
          await arkreenRECToken.connect(owner1).transfer(deployer.address, expandTo9Decimals(5000))

          await kWhToken.changeSwapPrice(arkreenRECToken.address, expandTo9Decimals(1))

          // Normal MintKWh                         
          await kWhToken.MintKWh( arkreenRECToken.address, expandTo9Decimals(20000))

          await arkreenRECToken.approve(kWhToken.address, constants.MaxUint256)
          await kWhToken.convertKWh(arkreenRECToken.address, expandTo9Decimals(5000))

          await arkreenRECToken.connect(owner1).approve(kWhToken.address, constants.MaxUint256)
          await kWhToken.connect(owner1).convertKWh(arkreenRECToken.address, expandTo9Decimals(5000))

        }

        await AKREToken.connect(user1).approve(greenPower.address, constants.MaxUint256)
        await AKREToken.connect(user2).approve(greenPower.address, constants.MaxUint256)
        await AKREToken.connect(user3).approve(greenPower.address, constants.MaxUint256)

      });

      async function walletStake(wallet: SignerWithAddress, amount: BigNumber) {
        const {nonce}  = await greenPower.getUserInfo(wallet.address)

        const txid = randomAddresses(1)[0]

        let plugMiner =""
        if(wallet == user1) plugMiner = "0x280a7c4E032584F97E84eDd396a00799da8D061A"
        if(wallet == user2) plugMiner = "0x762d865e237e04e88e30333ae86315882a0b3745"
        if(wallet == user3) plugMiner = "0xfbc44c2c777e73efd6ac4abd2ce6b83779163b6c"

        const period = BigNumber.from(60 * 3600 * 24)
  
        const digest = getGreenPowerStakingDigest(
            'Green Power',
            greenPower.address,
            { txid, staker: wallet.address, plugMiner: plugMiner, amount: amount, period: period, nonce: nonce},
            constants.MaxUint256
          )

        const {v,r,s} = ecsign(Buffer.from(digest.slice(2), 'hex'), Buffer.from(privateKeyManager.slice(2), 'hex'))   
        const signature: GreenPower.SigStruct = { v, r, s }  

        await greenPower.connect(wallet).stake(txid, plugMiner, amount, period, nonce, constants.MaxUint256, signature) 
      }

      async function walletUnstake(wallet: SignerWithAddress, amount: BigNumber) {
        const {nonce}  = await greenPower.getUserInfo(wallet.address)
        const txid = randomAddresses(1)[0]
        const plugMiner = "0x280a7c4E032584F97E84eDd396a00799da8D061A"
  
        const digest = getGreenPowerUnstakingDigest(
            'Green Power',
            greenPower.address,
            {txid, staker: wallet.address, plugMiner: plugMiner, amount: amount, nonce: nonce},
            constants.MaxUint256
          )

        const {v,r,s} = ecsign(Buffer.from(digest.slice(2), 'hex'), Buffer.from(privateKeyManager.slice(2), 'hex'))   
        const signature: GreenPower.SigStruct = { v, r, s }  

        await greenPower.connect(wallet).unstake(txid, plugMiner, amount, nonce, constants.MaxUint256, signature) 
      }

      it("GreenPower Deposit and Withdraw test", async function () {
        await expect(greenPower.deposit(tokenA.address, expandTo18Decimals(12345)))
                  .to.be.revertedWith("TransferHelper: TRANSFER_FROM_FAILED")

        await expect(greenPower.deposit(tokenA.address, 0))
                  .to.be.revertedWith("Zero Amount")

        const balanceBefore = await tokenA.balanceOf(deployer.address)
        await greenPower.approveBank([tokenA.address])
        await tokenA.approve(greenPower.address, constants.MaxUint256)

        let amountART = expandTo18Decimals(12345).mul(expandTo6Decimals(1000)).div(expandTo18Decimals(150))

        await expect(greenPower.deposit(tokenA.address, expandTo18Decimals(12345)))
                  .to.emit(greenPower, 'Deposit')
                  .withArgs(deployer.address, tokenA.address, expandTo18Decimals(12345), amountART)

        expect(await greenPower.depositAmounts(deployer.address)).to.eq(amountART)

        await greenPower.deposit(tokenA.address, expandTo18Decimals(23456))

        amountART = expandTo18Decimals(12345+23456).mul(expandTo6Decimals(1000)).div(expandTo18Decimals(150))
        expect(await greenPower.depositAmounts(deployer.address)).to.eq(amountART)
        expect(await tokenA.balanceOf(deployer.address)).to.eq(balanceBefore.sub(expandTo18Decimals(12345+23456)))
        expect(await arkreenRECToken.balanceOf(greenPower.address)).to.eq(amountART)

        // Deposit ART
        await arkreenRECToken.connect(owner1).transfer(user1.address, expandTo9Decimals(1000))
        await arkreenRECToken.connect(user1).approve(greenPower.address, constants.MaxUint256)
        await greenPower.connect(user1).deposit(arkreenRECToken.address, expandTo9Decimals(1000))
        expect(await greenPower.depositAmounts(user1.address)).to.eq(expandTo9Decimals(1000))
        expect(await arkreenRECToken.balanceOf(greenPower.address)).to.eq(amountART.add(expandTo9Decimals(1000)))

        // Withdraw 
        await greenPower.withdraw(expandTo9Decimals(50))
        expect(await greenPower.depositAmounts(deployer.address)).to.eq(amountART.sub(expandTo9Decimals(50)))

        await expect(greenPower.withdraw(expandTo9Decimals(0)))
                .to.be.revertedWith("Zero Amount")

        await greenPower.changeAutoOffet(true)
        await expect(greenPower.withdraw(expandTo9Decimals(20)))
                .to.be.revertedWith("Auto Offset On")

        await greenPower.changeAutoOffet(false)

        const lastBlock = await ethers.provider.getBlock('latest')
        await ethers.provider.send("evm_increaseTime", [3600*8])

        await expect(greenPower.withdraw(expandTo9Decimals(200)))
                .to.be.revertedWith("Not ready")

        await ethers.provider.send("evm_increaseTime", [3600*16 + 2])

        await expect(greenPower.withdraw(expandTo9Decimals(200)))
                .to.be.revertedWith("Low deposit")
      });

      it("GreenPower offsetPower Agent Test", async function () {

        await greenPower.approveBank([tokenA.address])
        await tokenA.approve(greenPower.address, constants.MaxUint256)
        await greenPower.deposit(tokenA.address, expandTo18Decimals(1500))  // 10ART

        await tokenA.transfer(user1.address, expandTo18Decimals(1500))
        await tokenA.connect(user1).approve(greenPower.address, constants.MaxUint256)
        await greenPower.connect(user1).deposit(tokenA.address, expandTo18Decimals(1500)) //10ART

        const plugMiners = randomAddresses(4)

        const offsetAction1: OffsetActionAgent = {
          greener:        deployer.address, 
          plugMiner:      plugMiners[0],
          offsetAmount:   expandTo6Decimals(15),
        } 

        const offsetAction2: OffsetActionAgent = {
          greener:        user1.address, 
          plugMiner:      plugMiners[1],
          offsetAmount:   expandTo6Decimals(50),
        } 

        await greenPower.changeAutoOffet(true)

        await greenPower.approveConvertkWh([arkreenRECToken.address])
        await kWhToken.changeSwapPrice(arkreenRECToken.address, expandTo6Decimals(1))   // 1kWh = 0.001ART

        await expect(greenPower.offsetPowerAgent(plugMiners[3], [offsetAction1, offsetAction2], constants.MaxUint256))
                .to.be.revertedWith("Not Allowed")

//        await expect(greenPower.connect(manager).offsetPowerAgent(plugMiners[3], [offsetAction1, offsetAction2], constants.MaxUint256))
//                .to.be.revertedWith("Not ready")
        
        const lastBlock = await ethers.provider.getBlock('latest')
        await ethers.provider.send("evm_increaseTime", [ TIMESTAMP_NEW_UNIT - lastBlock.timestamp + 1])
        await mine(1)

        await expect(greenPower.connect(manager).offsetPowerAgent(plugMiners[3], [offsetAction1, offsetAction2], constants.MaxUint256))
                .to.be.revertedWith("Auto Offset Off")

        await greenPower.connect(user1).changeAutoOffet(true)

        await expect(greenPower.connect(manager).offsetPowerAgent(plugMiners[3], [offsetAction1, offsetAction2], constants.MaxUint256))
                .to.emit(kWhToken, 'Transfer')
                .withArgs(greenPower.address, zeroAddress, expandTo6Decimals(15+50)) 
                .to.emit(greenPower, 'OffsetAgent')
                .withArgs(plugMiners[3], 0, (15+50)*10)         // 0.1kWh/step

        expect(await greenPower.getMinerOffsetInfo(plugMiners[0])).to.deep.eq([deployer.address, BigNumber.from(1), expandTo6Decimals(15)])
        expect(await greenPower.getMinerOffsetInfo(plugMiners[1])).to.deep.eq([user1.address, BigNumber.from(1), expandTo6Decimals(50)])

        expect((await greenPower.depositAmounts(deployer.address)).and(BigNumber.from(1).shl(128).sub(1)))
                .to.deep.eq(expandTo9Decimals(10).sub( expandTo6Decimals(15)))
        expect((await greenPower.depositAmounts(user1.address)).and(BigNumber.from(1).shl(128).sub(1)))
                .to.deep.eq(expandTo9Decimals(10).sub(expandTo6Decimals(50)))

        const {offsetAmount: offsetAmount1}  = await greenPower.getUserInfo(deployer.address)
        expect(offsetAmount1).to.eq(expandTo6Decimals(15))

        const {offsetAmount: offsetAmount2}  = await greenPower.getUserInfo(user1.address)
        expect(offsetAmount2).to.eq(expandTo6Decimals(50))

        await expect(greenPower.connect(manager).offsetPowerAgent(plugMiners[3], [offsetAction1, offsetAction2], constants.MaxUint256))
                .to.emit(kWhToken, 'Transfer')
                .withArgs(greenPower.address, zeroAddress, expandTo6Decimals(15+50)) 
                .to.emit(greenPower, 'OffsetAgent')
                .withArgs(plugMiners[3], (15+50)*10, (15+50)*10)         // 0.1kWh/step

        // Abnormal test 
        const offsetAction3: OffsetActionAgent = {
          greener:        deployer.address, 
          plugMiner:      plugMiners[1],
          offsetAmount:   expandTo6Decimals(50),
        } 

        await expect(greenPower.connect(manager).offsetPowerAgent(plugMiners[3], [offsetAction3], constants.MaxUint256))
                .to.be.revertedWith("Wrong Owner")

        const offsetAction4: OffsetActionAgent = {
          greener:        deployer.address, 
          plugMiner:      plugMiners[2],
          offsetAmount:   expandTo6Decimals(5055).div(100),     // 50.55 kWh
        } 
        await expect(greenPower.connect(manager).offsetPowerAgent(plugMiners[3], [offsetAction4], constants.MaxUint256))
                .to.be.revertedWith("Wrong Offset Amount")

        const offsetAction5: OffsetActionAgent = {
          greener:        user2.address, 
          plugMiner:      plugMiners[2],
          offsetAmount:   expandTo6Decimals(30) 
        } 

        await greenPower.connect(user2).changeAutoOffet(true)
        await expect(greenPower.connect(manager).offsetPowerAgent(plugMiners[3], [offsetAction5], constants.MaxUint256))
                .to.be.revertedWith("Low deposit")

      });

/*
      it("GreenPower Withdraw test", async function () {
        await tokenA.approve(greenPower.address, constants.MaxUint256)
        await greenPower.deposit(tokenA.address, expandTo18Decimals(56789))

        await expect(greenPower.withdraw(tokenA.address, 0))
                  .to.be.revertedWith("Zero Amount")

        const balanceBefore = await tokenA.balanceOf(deployer.address)

        await expect(greenPower.withdraw(tokenA.address, expandTo18Decimals(23456)))
                  .to.emit(greenPower, 'Withdraw')
                  .withArgs(deployer.address, tokenA.address, expandTo18Decimals(23456))
        await greenPower.withdraw(tokenA.address, expandTo18Decimals(12345))                

        expect(await greenPower.depositAmounts(deployer.address, tokenA.address)).to.eq(expandTo18Decimals(56789 - 23456 - 12345))
        expect(await tokenA.balanceOf(deployer.address)).to.eq(balanceBefore.add(expandTo18Decimals(23456 + 12345)))
      });
*/

      it("GreenPower getRewardRate Test", async function () {
        // Normal
        await AKREToken.transfer(user1.address, expandTo18Decimals(100_000_000))
        await AKREToken.transfer(user2.address, expandTo18Decimals(100_000_000))
        await AKREToken.transfer(user3.address, expandTo18Decimals(100_000_000))

        const {nonce}  = await greenPower.getUserInfo(user1.address)

        const txid = randomAddresses(1)[0]
        const amount = expandTo18Decimals(140000)
        const plugMiner = "0x280a7c4E032584F97E84eDd396a00799da8D061A"
        const period = BigNumber.from(180 * 3600 * 24)
  
        const digest = getGreenPowerStakingDigest(
            'Green Power',
            greenPower.address,
            { txid, staker: user1.address, plugMiner, amount, period, nonce},
            constants.MaxUint256
          )

        const {v,r,s} = ecsign(Buffer.from(digest.slice(2), 'hex'), Buffer.from(privateKeyManager.slice(2), 'hex'))   
        const signature: GreenPower.SigStruct = { v, r, s }  

        await greenPower.connect(user1).stake(txid, plugMiner, amount, period, nonce, constants.MaxUint256, signature)
        const rewardRate = await greenPower.getRewardRate(user1.address)
        expect(rewardRate).to.eq(147217538)

        const rewardRateA = await greenPower.getRewardRate(AKREToken.address)
        expect(rewardRateA).to.eq(100000000)

      });

      it("GreenPower stake Test", async function () {
        // Normal
        await AKREToken.transfer(user1.address, expandTo18Decimals(100_000_000))
        await AKREToken.transfer(user2.address, expandTo18Decimals(100_000_000))
        await AKREToken.transfer(user3.address, expandTo18Decimals(100_000_000))

        await walletStake(user1, expandTo18Decimals(23456))

        const {nonce}  = await greenPower.getUserInfo(user1.address)

        const txid = randomAddresses(1)[0]
        const amount = expandTo18Decimals(12345)
        const plugMiner = "0x280a7c4E032584F97E84eDd396a00799da8D061A"
        const period = BigNumber.from(60 * 3600 * 24)
  
        const digest = getGreenPowerStakingDigest(
            'Green Power',
            greenPower.address,
            { txid, staker: user1.address, plugMiner, amount, period, nonce},
            constants.MaxUint256
          )

        const {v,r,s} = ecsign(Buffer.from(digest.slice(2), 'hex'), Buffer.from(privateKeyManager.slice(2), 'hex'))   
        const signature: GreenPower.SigStruct = { v, r, s }  

        const totalStake = await greenPower.totalStake()
        const balanceBefore = await AKREToken.balanceOf(greenPower.address)
        const {stakeAmount: stakeAmountA, offsetAmount: offsetAmountA, nonce: nonceA, releaseTime: releaseTimeA} 
                              = await greenPower.getUserInfo(user1.address)

        await expect(greenPower.connect(user1).stake(txid, plugMiner, amount, period, nonce, constants.MaxUint256, signature))
                      .to.emit(greenPower, 'Stake')
                      .withArgs(txid, user1.address, plugMiner, amount, period, nonce)

        // Check totalStake
        expect(await greenPower.totalStake()).to.eq(totalStake.add(expandTo18Decimals(12345)))

        const {stakeAmount: stakeAmountB, offsetAmount: offsetAmountB, nonce: nonceB, releaseTime: releaseTimeB} 
                              = await greenPower.getUserInfo(user1.address)

        // check stakerInfo
        const lastBlockN = await ethers.provider.getBlock('latest')
        expect(stakeAmountB).to.eq(stakeAmountA.add(expandTo18Decimals(12345)))
        expect(offsetAmountB).to.eq(0)        
        expect(nonceB).to.eq(nonce.add(1))
        expect(releaseTimeB).to.eq(lastBlockN.timestamp + 60 * 3600 * 24)

        // check akre balance
        expect(await AKREToken.balanceOf(greenPower.address)).to.eq(balanceBefore.add(expandTo18Decimals(12345)))

        // check minerOffsetInfo
        expect(await greenPower.getMinerOffsetInfo(plugMiner)).to.deep.eq([user1.address, 0, 0])
        
        // Abnormal test
        await expect(greenPower.connect(user1).stake(txid, plugMiner, 0, period, nonce, constants.MaxUint256, signature))
                      .to.be.revertedWith("Zero Stake")

        await expect(greenPower.connect(user1).stake(txid, plugMiner, amount, period, nonce, constants.MaxUint256, signature))
                      .to.be.revertedWith("Nonce Not Match")

        await expect(greenPower.connect(user1).stake(txid, plugMiner, amount, period.add(2), nonce.add(1), constants.MaxUint256, signature))
                      .to.be.revertedWith("Wrong period")

        await expect(greenPower.connect(user1).stake(txid, plugMiner, amount, period.div(2), nonce.add(1), constants.MaxUint256, signature))
                      .to.be.revertedWith("Short Period")

        await expect(greenPower.connect(user1).stake(txid, plugMiner, amount, period, nonce.add(1), constants.MaxUint256, signature))
                      .to.be.revertedWith("Wrong Signature")

        await walletStake(user1, expandTo18Decimals(10000))                      
        await walletStake(user2, expandTo18Decimals(30000))
        await walletStake(user3, expandTo18Decimals(50000))
        await walletStake(user2, expandTo18Decimals(70000))
        await walletStake(user3, expandTo18Decimals(90000))
        await walletStake(user2, expandTo18Decimals(110000))
        await walletStake(user2, expandTo18Decimals(130000))
        await walletStake(user1, expandTo18Decimals(150000))
        await walletStake(user3, expandTo18Decimals(170000))

        const stakeInfo1 = [ expandTo18Decimals(23456 + 12345 + 10000 + 150000), 0, 0, 4]
        const stakeInfo2 = [ expandTo18Decimals(30000 + 70000 + 110000 + 130000), 0, 0, 4]
        const stakeInfo3 = [ expandTo18Decimals(50000 + 90000 + 170000), 0, 0, 3]

        expect((await greenPower.getUserInfo(user1.address)).slice(0,4)) .to.deep.equal(stakeInfo1) // skip release time
        expect((await greenPower.getUserInfo(user2.address)).slice(0,4)).to.deep.equal(stakeInfo2)
        expect((await greenPower.getUserInfo(user3.address)).slice(0,4)).to.deep.equal(stakeInfo3)
      });

      it("GreenPower Unstake Test", async function () {
        // Normal
        await AKREToken.transfer(user1.address, expandTo18Decimals(100_000_000))
        await AKREToken.transfer(user2.address, expandTo18Decimals(100_000_000))
        await AKREToken.transfer(user3.address, expandTo18Decimals(100_000_000))

        await walletStake(user1, expandTo18Decimals(23456))

        let {nonce} = await greenPower.getUserInfo(user1.address)

        const txid = randomAddresses(1)[0]
        let amount = expandTo18Decimals(12345)
        const plugMiner = "0x280a7c4E032584F97E84eDd396a00799da8D061A"
  
        const digest = getGreenPowerUnstakingDigest(
            'Green Power',
            greenPower.address,
            { txid, staker: user1.address, plugMiner, amount, nonce},
            constants.MaxUint256
          )

        const {v,r,s} = ecsign(Buffer.from(digest.slice(2), 'hex'), Buffer.from(privateKeyManager.slice(2), 'hex'))   
        const signature: GreenPower.SigStruct = { v, r, s }  

        const totalStake = await greenPower.totalStake()
        const balanceBefore = await AKREToken.balanceOf(greenPower.address)
        const userBalanceBefore = await AKREToken.balanceOf(user1.address)
        const {stakeAmount: stakeAmountA, releaseTime: releaseTimeA} 
                              = await greenPower.getUserInfo(user1.address)

        // increase time to unstake                              
        await ethers.provider.send("evm_increaseTime", [60 * 3600 * 24]);
        await mine(1)

        await expect(greenPower.connect(user1).unstake(txid, plugMiner, amount, nonce, constants.MaxUint256, signature))
                      .to.emit(greenPower, 'Unstake')
                      .withArgs(txid, user1.address, plugMiner, amount, nonce)

        // Check totalStake
        expect(await greenPower.totalStake()).to.eq(totalStake.sub(expandTo18Decimals(12345)))

        const {stakeAmount: stakeAmountB, offsetAmount: offsetAmountB, nonce: nonceB, releaseTime: releaseTimeB} 
                              = await greenPower.getUserInfo(user1.address)

        // check stakerInfo
        expect(stakeAmountB).to.eq(stakeAmountA.sub(expandTo18Decimals(12345)))
        expect(offsetAmountB).to.eq(0)        
        expect(nonceB).to.eq(nonce.add(1))              // nonce + 1
        expect(releaseTimeB).to.eq(releaseTimeA)        // releas time is same 

        // check akre balance
        expect(await AKREToken.balanceOf(greenPower.address)).to.eq(balanceBefore.sub(expandTo18Decimals(12345)))
        expect(await AKREToken.balanceOf(user1.address)).to.eq(userBalanceBefore.add(expandTo18Decimals(12345)))

        // check minerOffsetInfo
        expect(await greenPower.getMinerOffsetInfo(plugMiner)).to.deep.eq([user1.address, 0, 0])
        
        // Abnormal test
        await walletStake(user1, expandTo18Decimals(12345))     // all stake = 23456
        nonce = nonce.add(2)

        await expect(greenPower.connect(user1).unstake(txid, plugMiner, 0, nonce, constants.MaxUint256, signature))
                      .to.be.revertedWith("Zero Stake")

        await expect(greenPower.connect(user1).unstake(txid, plugMiner, amount, nonce.add(1), constants.MaxUint256, signature))
                      .to.be.revertedWith("Nonce Not Match")

        amount = expandTo18Decimals(23456)
        await expect(greenPower.connect(user1).unstake(txid, plugMiner, amount.add(1), nonce, constants.MaxUint256, signature))
                      .to.be.revertedWith("Unstake Overflowed")

        await expect(greenPower.connect(user1).unstake(txid, plugMiner, amount, nonce, constants.MaxUint256, signature))
                      .to.be.revertedWith("Not Released")

        await ethers.provider.send("evm_increaseTime", [60 * 3600 * 24]);
        await mine(1)

        await expect(greenPower.connect(user1).unstake(txid, plugMiner, amount, nonce, constants.MaxUint256, signature))
                      .to.be.revertedWith("Wrong Signature")

      });

      it("GreenPower offsetPower Test", async function () {
        const greener = "0x71368B7eD926F9c3f36Edcfc5D23e992102528c7"
        const plugMiner  = "0x7b863ff48a02F3C76E00b2e3e879fe6Ba8dDF133"
        const blockHash  = "0x62115d167924f5d9c4e23e4cd0e5395172dba799ce4b8a3cdc2fea7c4e76c29b"
        const kWhIndex  = 0
        const kWhSteps = 1000
        const rewardRate = 100000000

        const offsetWonResult = await greenPower.checkIfOffsetWon(greener, plugMiner, 
          blockHash, kWhIndex, kWhSteps, rewardRate)

        console.log('AAAAAAAAAAA', offsetWonResult)

        const offseInfo = utils.defaultAbiCoder.encode(
          ['address', 'address', 'bytes32', 'uint256', 'uint256', 'uint256'],
          [greener, plugMiner, blockHash, kWhIndex, kWhSteps, rewardRate]
        )

        const offsetWonResultA = await greenPower.checkIfOffsetWonBytes(offseInfo)

        console.log('BBBBBBBBBBBBBBB', offseInfo, offsetWonResultA)

      })

      it("GreenPower offsetPower Test", async function () {

        await AKREToken.approve(greenPower.address, constants.MaxUint256)
        const plugMiners = randomAddresses(4)

      // stake on first miner
       {
          const {nonce}  = await greenPower.getUserInfo(deployer.address)

          const txid = randomAddresses(1)[0]
          const plugMiner = plugMiners[0]

          const period = BigNumber.from(60 * 3600 * 24)
    
          const digest = getGreenPowerStakingDigest(
              'Green Power',
              greenPower.address,
              { txid, staker: deployer.address, plugMiner: plugMiner, amount: expandTo18Decimals(23456), period: period, nonce: nonce},
              constants.MaxUint256
            )

          const {v,r,s} = ecsign(Buffer.from(digest.slice(2), 'hex'), Buffer.from(privateKeyManager.slice(2), 'hex'))   
          const signature: GreenPower.SigStruct = { v, r, s }  

          await greenPower.stake(txid, plugMiner, expandTo18Decimals(23456), period, nonce, constants.MaxUint256, signature) 
        }

        // Normal convertKWh with token
        await tokenA.approve(greenPower.address, expandTo18Decimals(30000000))
        await greenPower.approveConvertkWh([tokenA.address, arkreenRECToken.address])
        await kWhToken.changeSwapPrice(tokenA.address, expandTo18Decimals(150).div(1000))   // 1kWh = 0.15 TokenA

        const price = expandTo18Decimals(150).div(1000)
        const payment = price.mul(100)

        let {nonce, offsetAmount} = await greenPower.getUserInfo(deployer.address)

        const offsetAction1: OffsetAction = {
          plugMiner:      plugMiners[0],
          offsetAmount:   expandTo6Decimals(100)
        } 

        const txid = randomAddresses(1)[0]
        //let amount = expandTo18Decimals(12345)
        //const plugMiner = "0x280a7c4E032584F97E84eDd396a00799da8D061A"
  
        const digest = getGreenPowerOffsetDigest(
            'Green Power',
            greenPower.address,
            { txid, staker: deployer.address, offsetAction: [offsetAction1], tokenToPay: tokenA.address, nonce},
            constants.MaxUint256
          )

        const {v,r,s} = ecsign(Buffer.from(digest.slice(2), 'hex'), Buffer.from(privateKeyManager.slice(2), 'hex'))   
        const signature: GreenPower.SigStruct = { v, r, s }  

        const balanceBefore = await tokenA.balanceOf(deployer.address)
        const totalOffsetA = await greenPower.totalOffset()
      
        await expect(greenPower.offsetPower(txid, [offsetAction1], tokenA.address, nonce, constants.MaxUint256, signature))
                      .to.emit(tokenA, 'Transfer')
                      .withArgs(deployer.address, greenPower.address, payment)
                      .to.emit(tokenA, 'Transfer')
                      .withArgs(greenPower.address, kWhToken.address, payment)
                      .to.emit(kWhToken, 'Transfer')
                      .withArgs(kWhToken.address, greenPower.address, expandTo6Decimals(100))
                      .to.emit(kWhToken, 'ARTConverted')
                      .withArgs(greenPower.address, tokenA.address, payment, expandTo6Decimals(100))
                      .to.emit(kWhToken, 'Transfer')
                      .withArgs(greenPower.address, constants.AddressZero, expandTo6Decimals(100))
                      .to.emit(greenPower, 'Offset')
                      .withArgs(txid, deployer.address, anyValue, tokenA.address, expandTo18Decimals(23456), 0, nonce)
//                    .withArgs(txid, deployer.address, [offsetAction1], tokenA.address, expandTo18Decimals(23456), 0, nonce)   
        
        // check minerOffsetInfo
        expect(await greenPower.getMinerOffsetInfo(plugMiners[0])).to.deep.eq([deployer.address, 1, expandTo6Decimals(100)])

        // Check tokenA balance 
        expect(await tokenA.balanceOf(deployer.address)).to.eq(balanceBefore.sub(payment))

        // Check totalOffset
        expect(await greenPower.totalOffset()).to.eq(totalOffsetA.add(expandTo6Decimals(100)))

        let {nonce: nonceN, offsetAmount: offsetAmountN} = await greenPower.getUserInfo(deployer.address)
        expect(nonceN).to.eq(nonce.add(1))
        expect(offsetAmountN).to.eq(offsetAmount.add(expandTo6Decimals(100)))

        /////////////  3 offset actions ///////////////////////////
        {
          const txid = randomAddresses(1)[0]
          const {nonce, offsetAmount} = await greenPower.getUserInfo(deployer.address)
          const offsetAction1: OffsetAction = {
            plugMiner:      plugMiners[0],
            offsetAmount:   expandTo6Decimals(100)
          } 
  
          const offsetAction2: OffsetAction = {
            plugMiner:      plugMiners[1],
            offsetAmount:   expandTo6Decimals(300)
          } 
  
          const offsetAction3: OffsetAction = {
            plugMiner:      plugMiners[2],
            offsetAmount:   expandTo6Decimals(500)
          }

          const digest = getGreenPowerOffsetDigest(
            'Green Power',
            greenPower.address,
            { txid, staker: deployer.address, offsetAction: [offsetAction1, offsetAction2, offsetAction3], tokenToPay: tokenA.address, nonce},
            constants.MaxUint256
          )

          const payment = price.mul( 100 + 300 + 500)

          const {v,r,s} = ecsign(Buffer.from(digest.slice(2), 'hex'), Buffer.from(privateKeyManager.slice(2), 'hex'))   
          const signature: GreenPower.SigStruct = { v, r, s }  

          const balanceBefore = await tokenA.balanceOf(deployer.address)
          const totalOffsetA = await greenPower.totalOffset()

          await expect(greenPower.offsetPower(txid, [offsetAction1, offsetAction2, offsetAction3], tokenA.address, nonce, constants.MaxUint256, signature))
                      .to.emit(tokenA, 'Transfer')
                      .withArgs(deployer.address, greenPower.address, payment)
                      .to.emit(tokenA, 'Transfer')
                      .withArgs(greenPower.address, kWhToken.address, payment)
                      .to.emit(kWhToken, 'Transfer')
                      .withArgs(kWhToken.address, greenPower.address, expandTo6Decimals(100+300+500))
                      .to.emit(kWhToken, 'ARTConverted')
                      .withArgs(greenPower.address, tokenA.address, payment, expandTo6Decimals(100+300+500))
                      .to.emit(kWhToken, 'Transfer')
                      .withArgs(greenPower.address, constants.AddressZero, expandTo6Decimals(100+300+500))
                      .to.emit(greenPower, 'Offset')
                      .withArgs(txid, deployer.address, anyValue, tokenA.address, expandTo18Decimals(23456), 100 * 10, nonce)  // 0.1 kWh

          // checkIfOffsetWon
          let lastBlock = await ethers.provider.getBlock('latest')

          const offsetWonResult = await greenPower.checkIfOffsetWon(deployer.address, plugMiners[0], 
                                    lastBlock.hash, 100, 100, 100000000)

          await greenPower.checkIfOffsetWon(deployer.address, plugMiners[0], 
                                    lastBlock.hash, 100, 20000, 100000000)

          const offseInfo = utils.defaultAbiCoder.encode(
                                ['address', 'address', 'bytes32', 'uint256', 'uint256', 'uint256'],
                                [deployer.address, plugMiners[0], lastBlock.hash, 100, 100, 100000000]
                              )
                              
          const offsetWonResultA = await greenPower.checkIfOffsetWonBytes(offseInfo)

          console.log("Won Result: ", offsetWonResult.length, offsetWonResult, offsetWonResultA)    
          expect(offsetWonResult).to.deep.eq(offsetWonResultA)

          // check minerOffsetInfo
          expect(await greenPower.getMinerOffsetInfo(plugMiners[0])).to.deep.eq([deployer.address, 2, expandTo6Decimals(100+100)])
          expect(await greenPower.getMinerOffsetInfo(plugMiners[1])).to.deep.eq([deployer.address, 1, expandTo6Decimals(300)])
          expect(await greenPower.getMinerOffsetInfo(plugMiners[2])).to.deep.eq([deployer.address, 1, expandTo6Decimals(500)])

          // Check tokenA balance 
          expect(await tokenA.balanceOf(deployer.address)).to.eq(balanceBefore.sub(payment))

          // Check totalOffset
          expect(await greenPower.totalOffset()).to.eq(totalOffsetA.add(expandTo6Decimals(100+300+500)))

          let {nonce: nonceN, offsetAmount: offsetAmountN} = await greenPower.getUserInfo(deployer.address)
          expect(nonceN).to.eq(nonce.add(1))
          expect(offsetAmountN).to.eq(offsetAmount.add(expandTo6Decimals(100+300+500)))
  
        }

        /////////////  Abnormal Test ///////////////////////////
        {
          // Wrong ownner
          const txid = randomAddresses(1)[0]
          const {nonce} = await greenPower.getUserInfo(user1.address)
          const offsetAction1: OffsetAction = {
            plugMiner:      plugMiners[0],
            offsetAmount:   expandTo6Decimals(100)
          } 

          const digest = getGreenPowerOffsetDigest(
            'Green Power',
            greenPower.address,
            { txid, staker: user1.address, offsetAction: [offsetAction1], tokenToPay: tokenA.address, nonce},   // user1
            constants.MaxUint256
          )

          const payment = price.mul(100)

          const {v,r,s} = ecsign(Buffer.from(digest.slice(2), 'hex'), Buffer.from(privateKeyManager.slice(2), 'hex'))   
          const signature: GreenPower.SigStruct = { v, r, s }  

          await expect(greenPower.connect(user1).offsetPower(txid, [offsetAction1], tokenA.address, nonce, constants.MaxUint256, signature))
                                .to.be.revertedWith("Wrong Owner")

        }


        /////////////  Abnormal Test ///////////////////////////
        {
          // Wrong Offset Amount
          const txid = randomAddresses(1)[0]
          const {nonce} = await greenPower.getUserInfo(user1.address)
          const offsetAction1: OffsetAction = {
            plugMiner:      plugMiners[3],
            offsetAmount:   expandTo6Decimals(100).add(1)
          } 

          const digest = getGreenPowerOffsetDigest(
            'Green Power',
            greenPower.address,
            { txid, staker: user1.address, offsetAction: [offsetAction1], tokenToPay: tokenA.address, nonce},   // user1
            constants.MaxUint256
          )

          const {v,r,s} = ecsign(Buffer.from(digest.slice(2), 'hex'), Buffer.from(privateKeyManager.slice(2), 'hex'))   
          const signature: GreenPower.SigStruct = { v, r, s }  

          await expect(greenPower.connect(user1).offsetPower(txid, [offsetAction1], tokenA.address, nonce, constants.MaxUint256, signature))
                                .to.be.revertedWith("Wrong Offset Amount")
        }

        /////////////  Normal Transaction ///////////////////////////

        {
          const txid = randomAddresses(1)[0]
          const {nonce} = await greenPower.getUserInfo(user1.address)
          const offsetAction1: OffsetAction = {
            plugMiner:      plugMiners[3],
            offsetAmount:   expandTo6Decimals(100)
          } 

          const digest = getGreenPowerOffsetDigest(
            'Green Power',
            greenPower.address,
            { txid, staker: user1.address, offsetAction: [offsetAction1], tokenToPay: tokenA.address, nonce},   // user1
            constants.MaxUint256
          )

          const {v,r,s} = ecsign(Buffer.from(digest.slice(2), 'hex'), Buffer.from(privateKeyManager.slice(2), 'hex'))   
          const signature: GreenPower.SigStruct = { v, r, s }  

          await tokenA.transfer(user1.address, expandTo18Decimals(1_000_000))
          await tokenA.connect(user1).approve(greenPower.address, constants.MaxUint256)
          await greenPower.connect(user1).offsetPower(txid, [offsetAction1], tokenA.address, nonce, constants.MaxUint256, signature)
        }
      });
     

/*      
      it("GreenPower offsetPowerServer abonormal Test", async function () {

        await AKREToken.approve(greenPower.address, constants.MaxUint256)
        const plugMiners = randomAddresses(4)
  
        // Normal convertKWh with token
        await tokenA.approve(greenPower.address, expandTo18Decimals(30000000))
        await greenPower.approveConvertkWh([tokenA.address, arkreenRECToken.address])
        await kWhToken.changeSwapPrice(tokenA.address, expandTo18Decimals(150).div(1000))   // 1kWh = 0.15 TokenA

        const price = expandTo18Decimals(150).div(1000)
        const payment = price.mul(100)

        const offsetAction1: OffsetActionBatch = {
          plugMiner:      plugMiners[0],
          owner:          deployer.address,
          tokenPayment:   tokenA.address,
          offsetAmount:   expandTo6Decimals(100),
          nonce:          BigNumber.from(0)
        } 

        const txid = randomAddresses(1)[0]

        let offsetPowerServerTx = await greenPower.connect(manager).offsetPowerServer(txid, [offsetAction1])
        let offsetPowerServerreceipt = await offsetPowerServerTx.wait()

        const eventPos = offsetPowerServerreceipt.events?.length!
        const offsetServerEvent =  (offsetPowerServerreceipt.events?.[eventPos-1].args! as unknown) as OffsetServerEvent

        // check txid, offsetBaseIndex, totalOffsetAmount
        const {txid: txidR, offsetBaseIndex, totalOffsetAmount} = offsetServerEvent
        expect({txid: txidR, offsetBaseIndex, totalOffsetAmount}).to.deep.eq({txid, offsetBaseIndex:BigNumber.from(0), totalOffsetAmount: BigNumber.from(0)})
    
        // check LESS_DEPOSIT
        let offsetAction1E = {...offsetAction1, nonce: BigNumber.from(SkipReason.LESS_DEPOSIT).shl(64)}
        let {plugMiner, owner, tokenPayment, offsetAmount, nonce} = offsetServerEvent.offsetActionBatch[0]
        expect({plugMiner, owner, tokenPayment, offsetAmount, nonce}).to.deep.eq(offsetAction1E)

        // check WRONG_AMOUNT
        {
          await greenPower.deposit(tokenA.address, expandTo18Decimals(100000))

          offsetAction1.offsetAmount = offsetAction1.offsetAmount.add(1)
          const offsetPowerServerTx = await greenPower.connect(manager).offsetPowerServer(txid, [offsetAction1])
          const offsetPowerServerreceipt = await offsetPowerServerTx.wait()

          const eventPos = offsetPowerServerreceipt.events?.length!
          const offsetServerEvent =  (offsetPowerServerreceipt.events?.[eventPos-1].args! as unknown) as OffsetServerEvent
    
          const offsetAction1E = {...offsetAction1, nonce: BigNumber.from(SkipReason.WRONG_AMOUNT).shl(64)}
          const {plugMiner, owner, tokenPayment, offsetAmount, nonce} = offsetServerEvent.offsetActionBatch[0]
          
          expect({plugMiner, owner, tokenPayment, offsetAmount, nonce}).to.deep.eq(offsetAction1E)
        }

        // check WRONG_OWNER
        {
          await greenPower.deposit(tokenA.address, expandTo18Decimals(100000))

          offsetAction1.offsetAmount = offsetAction1.offsetAmount.sub(1)
          await greenPower.connect(manager).offsetPowerServer(txid, [offsetAction1])      // Normal offsetPowerServer

          offsetAction1.owner = user1.address
          const offsetPowerServerTx = await greenPower.connect(manager).offsetPowerServer(txid, [offsetAction1])
          const offsetPowerServerreceipt = await offsetPowerServerTx.wait()

          const eventPos = offsetPowerServerreceipt.events?.length!
          const offsetServerEvent =  (offsetPowerServerreceipt.events?.[eventPos-1].args! as unknown) as OffsetServerEvent
    
          const offsetAction1E = {...offsetAction1, nonce: BigNumber.from(SkipReason.WRONG_OWNER).shl(64)}
          const {plugMiner, owner, tokenPayment, offsetAmount, nonce} = offsetServerEvent.offsetActionBatch[0]
          
          expect({plugMiner, owner, tokenPayment, offsetAmount, nonce}).to.deep.eq(offsetAction1E)
        }
      });

      it("GreenPower offsetPowerServer Normal Test", async function () {

        await AKREToken.approve(greenPower.address, constants.MaxUint256)
        const plugMiners = randomAddresses(4)
  
        // Normal convertKWh with token
        await tokenA.approve(greenPower.address, constants.MaxUint256)
        await greenPower.approveConvertkWh([tokenA.address, arkreenRECToken.address])
        await kWhToken.changeSwapPrice(tokenA.address, expandTo18Decimals(150).div(1000))   // 1kWh = 0.15 TokenA

        await greenPower.deposit(tokenA.address, expandTo18Decimals(100000))

        await tokenA.transfer(user1.address, expandTo18Decimals(100000))
        await tokenA.connect(user1).approve(greenPower.address, constants.MaxUint256)
        await greenPower.connect(user1).deposit(tokenA.address, expandTo18Decimals(100000))

        await tokenA.transfer(user2.address, expandTo18Decimals(100000))
        await tokenA.connect(user2).approve(greenPower.address, constants.MaxUint256)
        await greenPower.connect(user2).deposit(tokenA.address, expandTo18Decimals(100000))

        const price = expandTo18Decimals(150).div(1000)
        let payment = price.mul(100)

        const offsetAction1: OffsetActionBatch = {
          plugMiner:      plugMiners[0],
          owner:          deployer.address,
          tokenPayment:   tokenA.address,
          offsetAmount:   expandTo6Decimals(100),
          nonce:          BigNumber.from(0)
        } 

        const depositBefore = await greenPower.depositAmounts(deployer.address, tokenA.address)
        const tokenABefore = await tokenA.balanceOf(kWhToken.address)
        const kWhBefore = await kWhToken.balanceOf(kWhToken.address)
        const totalOffsetBefore = await greenPower.totalOffset()

        let {nonce: nonceA, offsetAmount: offsetAmountA} = await greenPower.getUserInfo(deployer.address)
        
        const txid = randomAddresses(1)[0]

        const offsetPowerServerTx = await greenPower.connect(manager).offsetPowerServer(txid, [offsetAction1])
        const offsetPowerServerreceipt = await offsetPowerServerTx.wait()

        const eventPos = offsetPowerServerreceipt.events?.length!
        const offsetServerEvent =  (offsetPowerServerreceipt.events?.[eventPos-1].args! as unknown) as OffsetServerEvent

        // check txid, offsetBaseIndex, totalOffsetAmount
        const {txid: txidR, offsetBaseIndex, totalOffsetAmount} = offsetServerEvent
        expect({txid: txidR, offsetBaseIndex, totalOffsetAmount}).to.deep.eq({txid, offsetBaseIndex:BigNumber.from(0), totalOffsetAmount: expandTo6Decimals(100)})
    
        // check LESS_DEPOSIT
        const offsetAction1E = {...offsetAction1, nonce: BigNumber.from(SkipReason.NORMAL).shl(64)}
        let {plugMiner, owner, tokenPayment, offsetAmount, nonce} = offsetServerEvent.offsetActionBatch[0]
        expect({plugMiner, owner, tokenPayment, offsetAmount, nonce}).to.deep.eq(offsetAction1E)

        expect(await greenPower.depositAmounts(deployer.address, tokenA.address)).to.eq(depositBefore.sub(payment))
        expect(await tokenA.balanceOf(kWhToken.address)).to.eq(tokenABefore.add(payment))
        expect(await kWhToken.balanceOf(kWhToken.address)).to.eq(kWhBefore.sub(expandTo6Decimals(100)))

        expect(await greenPower.getMinerOffsetInfo(plugMiners[0])).to.deep.eq([deployer.address, 1, expandTo6Decimals(100)])
        expect(await greenPower.totalOffset()).to.eq(totalOffsetBefore.add(expandTo6Decimals(100)))

        let {nonce: nonceB, offsetAmount: offsetAmountB} = await greenPower.getUserInfo(deployer.address)
        expect(nonceB).to.eq(nonceA.add(1))
        expect(offsetAmountB).to.eq(offsetAmountA.add(expandTo6Decimals(100)))

        ///////////// 3 offet actions ////////////////////////////////////
        {
          const offsetAction1: OffsetActionBatch = {
            plugMiner:      plugMiners[0],
            owner:          deployer.address,
            tokenPayment:   tokenA.address,
            offsetAmount:   expandTo6Decimals(100),
            nonce:          BigNumber.from(1)
          } 

          const offsetAction2: OffsetActionBatch = {
            plugMiner:      plugMiners[1],
            owner:          user1.address,
            tokenPayment:   tokenA.address,
            offsetAmount:   expandTo6Decimals(300),
            nonce:          BigNumber.from(0)
          } 

          const offsetAction3: OffsetActionBatch = {
            plugMiner:      plugMiners[2],
            owner:          user2.address,
            tokenPayment:   tokenA.address,
            offsetAmount:   expandTo6Decimals(500),
            nonce:          BigNumber.from(0)
          } 

          const depositBeforeDeployer = await greenPower.depositAmounts(deployer.address, tokenA.address)
          const depositBeforeUser1 = await greenPower.depositAmounts(user1.address, tokenA.address)
          const depositBeforeUser2 = await greenPower.depositAmounts(user2.address, tokenA.address)

          const tokenABefore = await tokenA.balanceOf(kWhToken.address)
          const kWhBefore = await kWhToken.balanceOf(kWhToken.address)
          const totalOffsetBefore = await greenPower.totalOffset()

          let {nonce: nonceDeployerA, offsetAmount: offsetAmountDeployerA} = await greenPower.getUserInfo(deployer.address)
          let {nonce: nonceUser1A, offsetAmount: offsetAmountUser1A} = await greenPower.getUserInfo(user1.address)
          let {nonce: nonceUser2A, offsetAmount: offsetAmountUser2A} = await greenPower.getUserInfo(user2.address)
          
          const txid = randomAddresses(1)[0]

          const offsetPowerServerTx = await greenPower.connect(manager).offsetPowerServer(txid, [offsetAction1, offsetAction2, offsetAction3])
          const offsetPowerServerreceipt = await offsetPowerServerTx.wait()

          const eventPos = offsetPowerServerreceipt.events?.length!
          const offsetServerEvent =  (offsetPowerServerreceipt.events?.[eventPos-1].args! as unknown) as OffsetServerEvent

          // check txid, offsetBaseIndex, totalOffsetAmount
          const {txid: txidR, offsetBaseIndex, totalOffsetAmount} = offsetServerEvent
          expect({txid: txidR, offsetBaseIndex, totalOffsetAmount}).to.deep.eq({txid, offsetBaseIndex:BigNumber.from(100), totalOffsetAmount: expandTo6Decimals(100+300+500)})
      
          // check LESS_DEPOSIT
          let {plugMiner, owner, tokenPayment, offsetAmount, nonce} = offsetServerEvent.offsetActionBatch[0]
          expect({plugMiner, owner, tokenPayment, offsetAmount, nonce}).to.deep.eq({...offsetAction1})

          {
            let {plugMiner, owner, tokenPayment, offsetAmount, nonce} = offsetServerEvent.offsetActionBatch[1]
            expect({plugMiner, owner, tokenPayment, offsetAmount, nonce}).to.deep.eq({...offsetAction2})
          }

          {
            let {plugMiner, owner, tokenPayment, offsetAmount, nonce} = offsetServerEvent.offsetActionBatch[2]
            expect({plugMiner, owner, tokenPayment, offsetAmount, nonce}).to.deep.eq({...offsetAction3})
          }

          let payment = price.mul(100+300+500)

          expect(await greenPower.depositAmounts(deployer.address, tokenA.address)).to.eq(depositBeforeDeployer.sub(price.mul(100)))
          expect(await greenPower.depositAmounts(user1.address, tokenA.address)).to.eq(depositBeforeUser1.sub(price.mul(300)))
          expect(await greenPower.depositAmounts(user2.address, tokenA.address)).to.eq(depositBeforeUser2.sub(price.mul(500)))

          expect(await tokenA.balanceOf(kWhToken.address)).to.eq(tokenABefore.add(payment))
          expect(await kWhToken.balanceOf(kWhToken.address)).to.eq(kWhBefore.sub(expandTo6Decimals(100+300+500)))

          expect(await greenPower.getMinerOffsetInfo(plugMiners[0])).to.deep.eq([deployer.address, 2, expandTo6Decimals(100+100)])
          expect(await greenPower.getMinerOffsetInfo(plugMiners[1])).to.deep.eq([user1.address, 1, expandTo6Decimals(300)])
          expect(await greenPower.getMinerOffsetInfo(plugMiners[2])).to.deep.eq([user2.address, 1, expandTo6Decimals(500)])

          expect(await greenPower.totalOffset()).to.eq(totalOffsetBefore.add(expandTo6Decimals(100+300+500)))

          let {nonce: nonceDeployerB, offsetAmount: offsetAmountDeployerB} = await greenPower.getUserInfo(deployer.address)
          let {nonce: nonceUser1B, offsetAmount: offsetAmountUser1B} = await greenPower.getUserInfo(user1.address)
          let {nonce: nonceUser2B, offsetAmount: offsetAmountUser2B} = await greenPower.getUserInfo(user2.address)

          expect(nonceDeployerB).to.eq(nonceDeployerA.add(1))
          expect(nonceUser1B).to.eq(nonceUser1A.add(1))
          expect(nonceUser2B).to.eq(nonceUser2A.add(1))

          expect(offsetAmountDeployerB).to.eq(offsetAmountDeployerA.add(expandTo6Decimals(100)))
          expect(offsetAmountUser1B).to.eq(offsetAmountUser1A.add(expandTo6Decimals(300)))
          expect(offsetAmountUser2B).to.eq(offsetAmountUser2A.add(expandTo6Decimals(500)))
          
        }

      });
*/
      it("GreenPower claimReward Test", async function () {
        // Normal
        await AKREToken.transfer(user1.address, expandTo18Decimals(100_000_000))
        await AKREToken.transfer(user2.address, expandTo18Decimals(100_000_000))
        await AKREToken.transfer(user3.address, expandTo18Decimals(100_000_000))

        await walletStake(user1, expandTo18Decimals(23456))

        const {nonce}  = await greenPower.getUserInfo(user1.address)

        const txid = randomAddresses(1)[0]
        const amount = expandTo18Decimals(12345)
  
        const digest = getGreenPowerRewardDigest(
            'Green Power',
            greenPower.address,
            { txid, greener: user1.address, amount, nonce},
            constants.MaxUint256
          )

        const {v,r,s} = ecsign(Buffer.from(digest.slice(2), 'hex'), Buffer.from(privateKeyManager.slice(2), 'hex'))   
        const signature: GreenPower.SigStruct = { v, r, s }  

        const balanceBefore = await AKREToken.balanceOf(greenPower.address)
        const {stakeAmount: stakeAmountA, rewardAmount: rewardAmountA, nonce: nonceA} = await greenPower.getUserInfo(user1.address)
        const totalReward = await greenPower.totalReward()
        const balanceAKRE = await AKREToken.balanceOf(user1.address)

        await expect(greenPower.connect(user1).claimReward(txid, amount, nonce, constants.MaxUint256, signature))
                      .to.emit(greenPower, 'Reward')
                      .withArgs(txid, user1.address, amount,  nonce)

        // Check totalStake
        expect(await greenPower.totalReward()).to.eq(totalReward.add(expandTo18Decimals(12345)))

        const {rewardAmount: rewardAmountB, nonce: nonceB} = await greenPower.getUserInfo(user1.address)
        expect(nonceB).to.eq(nonceA.add(1))
        expect(rewardAmountB).to.eq(rewardAmountA.add(expandTo18Decimals(12345)))
        expect(await AKREToken.balanceOf(user1.address)).to.eq(balanceAKRE.add(expandTo18Decimals(12345)))
        expect(await AKREToken.balanceOf(greenPower.address)).to.eq(balanceBefore.sub(expandTo18Decimals(12345)))

        // Abnormal
        await expect(greenPower.connect(user1).claimReward(txid, amount, nonce.add(2), constants.MaxUint256, signature))
                    .to.be.revertedWith("Nonce Not Match")

        await expect(greenPower.connect(user1).claimReward(txid, amount, nonce.add(1), constants.MaxUint256, signature))
                    .to.be.revertedWith("Wrong Signature")
        
      });

      it("GreenPower claimRewardTxt Test", async function () {
        // Normal
        await AKREToken.transfer(user1.address, expandTo18Decimals(100_000_000))
        await AKREToken.transfer(user2.address, expandTo18Decimals(100_000_000))
        await AKREToken.transfer(user3.address, expandTo18Decimals(100_000_000))

        await walletStake(user1, expandTo18Decimals(23456))

        const {nonce}  = await greenPower.getUserInfo(user1.address)

        const txid = randomAddresses(1)[0]
        const amount = expandTo18Decimals(12345)
  
        const digest = getGreenPowerRewardDigestExt(
            'Green Power',
            greenPower.address,
            { txid, greener: user1.address, receiver: user2.address, amount, nonce},
            constants.MaxUint256
          )

        const {v,r,s} = ecsign(Buffer.from(digest.slice(2), 'hex'), Buffer.from(privateKeyManager.slice(2), 'hex'))   
        const signature: GreenPower.SigStruct = { v, r, s }  

        const balanceBefore = await AKREToken.balanceOf(greenPower.address)
        const {stakeAmount: stakeAmountA, rewardAmount: rewardAmountA, nonce: nonceA} = await greenPower.getUserInfo(user1.address)
        const totalReward = await greenPower.totalReward()
        const balanceAKRE = await AKREToken.balanceOf(user2.address)

        await expect(greenPower.connect(user1).claimRewardExt(txid, user2.address, amount, nonce, constants.MaxUint256, signature))
                      .to.emit(greenPower, 'ClaimRewardExt')
                      .withArgs(txid, user1.address, user2.address, amount,  nonce)

        // Check totalStake
        expect(await greenPower.totalReward()).to.eq(totalReward.add(expandTo18Decimals(12345)))

        const {rewardAmount: rewardAmountB, nonce: nonceB} = await greenPower.getUserInfo(user1.address)
        expect(nonceB).to.eq(nonceA.add(1))
        expect(rewardAmountB).to.eq(rewardAmountA.add(expandTo18Decimals(12345)))
        expect(await AKREToken.balanceOf(user2.address)).to.eq(balanceAKRE.add(expandTo18Decimals(12345)))
        expect(await AKREToken.balanceOf(greenPower.address)).to.eq(balanceBefore.sub(expandTo18Decimals(12345)))

        // Abnormal
        await expect(greenPower.connect(user1).claimRewardExt(txid, user2.address, amount, nonce.add(2), constants.MaxUint256, signature))
                    .to.be.revertedWith("Nonce Not Match")

        await expect(greenPower.connect(user1).claimRewardExt(txid, user2.address, amount, nonce.add(1), constants.MaxUint256, signature))
                    .to.be.revertedWith("Wrong Signature")
        
      });

    })
})