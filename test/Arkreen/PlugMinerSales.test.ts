import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import { loadFixture, mine } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
const {ethers, upgrades} =  require("hardhat");
import hre from 'hardhat'
import { ecsign, fromRpcSig, ecrecover, zeroAddress } from 'ethereumjs-util'
import { getApprovalDigest, expandTo18Decimals, randomAddresses, expandTo9Decimals } from '../utils/utilities'
import { PlugActionInfo, OffsetActionBatch, getPlugActionInfoHash, getCspActionInfoHash } from '../utils/utilities'

import { constants, BigNumber, utils} from 'ethers'

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
    WETH9,
    ERC20F,
    PlugMinerSales,
    ArkreenToken__factory,
    ArkreenTokenTest__factory
    // ArkreenTokenV2,
    // ArkreenTokenV2__factory
} from "../../typechain";

import { RECRequestStruct, SignatureStruct, RECDataStruct } from "../../typechain/contracts/ArkreenRECIssuance";
const constants_MaxDealine = BigNumber.from('0xFFFFFFFF')

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

    let WETH:                         WETH9
    let tokenA:                       ERC20F
    let plugMinerSales:              PlugMinerSales

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
   
        const PlugMinerActionFactory = await ethers.getContractFactory("PlugMinerSales")
        const plugMinerSales = await upgrades.deployProxy(PlugMinerActionFactory, [tokenA.address, manager.address, fund_receiver.address]) as PlugMinerSales
        await plugMinerSales.deployed()
       
        return { AKREToken, arkreenMiner, arkreenRegistry, arkreenRECIssuance, arkreenRECToken, 
          arkreenRetirement, arkreenRECIssuanceExt, arkreenRECBank, WETH, tokenA,
          plugMinerSales }
    }

    describe('PlugMinerSales test', () => {

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
        WETH = fixture.WETH
        tokenA = fixture.tokenA
        plugMinerSales = fixture.plugMinerSales

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
        }

        await AKREToken.connect(user1).approve(plugMinerSales.address, constants.MaxUint256)
        await AKREToken.connect(user2).approve(plugMinerSales.address, constants.MaxUint256)
        await AKREToken.connect(user3).approve(plugMinerSales.address, constants.MaxUint256)

      });
     
      it("plugMinerSales actionPlugMiner Test: Basic Mint and abnormal", async function () {
        // Normal
        let plugActionInfo: PlugActionInfo = {
          owner:          user1.address,
          tokenPay:       AKREToken.address,              // Used as USDC
          amountPay:      expandTo18Decimals(99),
          tokenGet:       arkreenRECToken.address,
          amountGet:      expandTo9Decimals(1),
          actionType:     utils.hexlify(utils.toUtf8Bytes("Buy in 99")).padEnd(66, '0'),
          action:         BigNumber.from(1).shl(248)
        }

        let txid = randomAddresses(1)[0]
        let nonce = BigNumber.from(0)

        const digest = getPlugActionInfoHash(
            'Plug Miner Action',
            plugMinerSales.address,
            txid,
            plugActionInfo,
            nonce,
            constants.MaxUint256
        )

        await arkreenRECToken.connect(owner1).approve(plugMinerSales.address, constants.MaxUint256)
        await plugMinerSales.connect(owner1).depositToken(arkreenRECToken.address, expandTo9Decimals(10000))

        await AKREToken.transfer(user1.address, expandTo18Decimals(1_000_000))

        await AKREToken.connect(user1).approve(plugMinerSales.address, constants.MaxUint256)
        await arkreenRECToken.connect(user1).approve(plugMinerSales.address, constants.MaxUint256)
        
        const {v,r,s} = ecsign(Buffer.from(digest.slice(2), 'hex'), Buffer.from(privateKeyManager.slice(2), 'hex'))   
        const signature: PlugMinerSales.SigStruct = { v, r, s }  

        const balanceAKREBeore = await AKREToken.balanceOf(plugMinerSales.address)
        const balanceARTBeore = await arkreenRECToken.balanceOf(plugMinerSales.address)

        await expect(plugMinerSales.connect(user1).actionPlugMiner(txid, plugActionInfo, nonce, constants.MaxUint256, signature))
                .to.emit(AKREToken, 'Transfer')
                .withArgs(user1.address, plugMinerSales.address, expandTo18Decimals(99))    
                .to.emit(arkreenRECToken, 'Transfer')
                .withArgs(plugMinerSales.address, user1.address, expandTo9Decimals(1))
                .to.emit(plugMinerSales, 'Transfer')
                .withArgs(zeroAddress(), user1.address, 1)    
                .to.emit(plugMinerSales, 'ActionPlugMiner')
                .withArgs(txid, plugActionInfo.owner, plugActionInfo.actionType, 1, 1)  
                
        expect(await plugMinerSales.getIncomeInfo(AKREToken.address)).to.deep.eq([expandTo18Decimals(99), expandTo18Decimals(99)])
        expect(await plugMinerSales.getDepositInfo(arkreenRECToken.address)).to.deep.eq([expandTo9Decimals(10000), expandTo9Decimals(1)])
                
        expect(await AKREToken.balanceOf(plugMinerSales.address)).to.eq(balanceAKREBeore.add(expandTo18Decimals(99)))
        expect(await arkreenRECToken.balanceOf(plugMinerSales.address)).to.eq(balanceARTBeore.sub(expandTo9Decimals(1)))
        expect(await plugMinerSales.balanceOf(user1.address)).to.eq(1)

        // Abnormal test 
        nonce = BigNumber.from(1)
        {               
          await expect(plugMinerSales.connect(user1).actionPlugMiner(txid, plugActionInfo, nonce, constants.MaxUint256, signature))
                .to.be.revertedWith("Wrong Signature")
        }
        
        {        
          let txid = randomAddresses(1)[0]
          nonce = BigNumber.from(2)
          const digest = getPlugActionInfoHash(
                  'Plug Miner Action',
                  plugMinerSales.address,
                  txid,
                  plugActionInfo,
                  nonce,
                  constants.MaxUint256
              )
      
          const {v,r,s} = ecsign(Buffer.from(digest.slice(2), 'hex'), Buffer.from(privateKeyManager.slice(2), 'hex'))   
          const signature: PlugMinerSales.SigStruct = { v, r, s }  
          await expect(plugMinerSales.connect(user1).actionPlugMiner(txid, plugActionInfo, nonce, constants.MaxUint256, signature))
                .to.be.revertedWith("Wrong Nonce")
        }
        {
          let txid = randomAddresses(1)[0]
          nonce = BigNumber.from(1)
          plugActionInfo.owner = user2.address
          const digest = getPlugActionInfoHash(
                  'Plug Miner Action',
                  plugMinerSales.address,
                  txid,
                  plugActionInfo,
                  nonce,
                  constants.MaxUint256
              )
          
          const {v,r,s} = ecsign(Buffer.from(digest.slice(2), 'hex'), Buffer.from(privateKeyManager.slice(2), 'hex'))   
          const signature: PlugMinerSales.SigStruct = { v, r, s }  
    
          await expect(plugMinerSales.connect(user1).actionPlugMiner(txid, plugActionInfo, nonce, constants.MaxUint256, signature))
                .to.be.revertedWith("Wrong Sender")
        }
        {
          let txid = randomAddresses(1)[0]
          nonce = BigNumber.from(1)
          plugActionInfo.owner = user1.address
          plugActionInfo.action =  BigNumber.from(3).shl(248)
          const digest = getPlugActionInfoHash(
                  'Plug Miner Action',
                  plugMinerSales.address,
                  txid,
                  plugActionInfo,
                  nonce,
                  constants.MaxUint256
              )
          const {v,r,s} = ecsign(Buffer.from(digest.slice(2), 'hex'), Buffer.from(privateKeyManager.slice(2), 'hex'))   
          const signature: PlugMinerSales.SigStruct = { v, r, s }  
    
          await expect(plugMinerSales.connect(user1).actionPlugMiner(txid, plugActionInfo, nonce, constants.MaxUint256, signature))
                .to.be.revertedWith("Wrong Action!")
          
        }

      })

      it("plugMinerSales actionPlugMiner Test: Multiple Mint", async function () {
        // Normal
        let plugActionInfo: PlugActionInfo = {
          owner:          user1.address,
          tokenPay:       AKREToken.address,              // Used as USDC
          amountPay:      expandTo18Decimals(99).mul(4),
          tokenGet:       arkreenRECToken.address,
          amountGet:      expandTo9Decimals(1).mul(4),
          actionType:     utils.hexlify(utils.toUtf8Bytes("Buy in 99")).padEnd(66, '0'),
          action:         BigNumber.from(1).shl(248).add(BigNumber.from(4).shl(240))
        }

        let txid = randomAddresses(1)[0]
        let nonce = BigNumber.from(0)

        const digest = getPlugActionInfoHash(
            'Plug Miner Action',
            plugMinerSales.address,
            txid,
            plugActionInfo,
            nonce,
            constants.MaxUint256
        )

        await arkreenRECToken.connect(owner1).approve(plugMinerSales.address, constants.MaxUint256)
        await plugMinerSales.connect(owner1).depositToken(arkreenRECToken.address, expandTo9Decimals(10000))

        await AKREToken.transfer(user1.address, expandTo18Decimals(1_000_000))

        await AKREToken.connect(user1).approve(plugMinerSales.address, constants.MaxUint256)
        await arkreenRECToken.connect(user1).approve(plugMinerSales.address, constants.MaxUint256)
        
        const {v,r,s} = ecsign(Buffer.from(digest.slice(2), 'hex'), Buffer.from(privateKeyManager.slice(2), 'hex'))   
        const signature: PlugMinerSales.SigStruct = { v, r, s }  

        const balanceAKREBeore = await AKREToken.balanceOf(plugMinerSales.address)
        const balanceARTBeore = await arkreenRECToken.balanceOf(plugMinerSales.address)

        await expect(plugMinerSales.connect(user1).actionPlugMiner(txid, plugActionInfo, nonce, constants.MaxUint256, signature))
                .to.emit(AKREToken, 'Transfer')
                .withArgs(user1.address, plugMinerSales.address, expandTo18Decimals(99).mul(4))    
                .to.emit(arkreenRECToken, 'Transfer')
                .withArgs(plugMinerSales.address, user1.address, expandTo9Decimals(1).mul(4))    
                .to.emit(plugMinerSales, 'Transfer')
                .withArgs(zeroAddress(), user1.address, 1)    
                .to.emit(plugMinerSales, 'Transfer')
                .withArgs(zeroAddress(), user1.address, 2)    
                .to.emit(plugMinerSales, 'Transfer')
                .withArgs(zeroAddress(), user1.address, 3)    
                .to.emit(plugMinerSales, 'Transfer')
                .withArgs(zeroAddress(), user1.address, 4)    
                .to.emit(plugMinerSales, 'ActionPlugMiner')
                .withArgs(txid, plugActionInfo.owner, plugActionInfo.actionType, 1, 4)   

        expect(await plugMinerSales.getIncomeInfo(AKREToken.address)).to.deep.eq([expandTo18Decimals(99).mul(4), expandTo18Decimals(99).mul(4)])
        expect(await plugMinerSales.getDepositInfo(arkreenRECToken.address)).to.deep.eq([expandTo9Decimals(10000), expandTo9Decimals(4)])
                
        expect(await AKREToken.balanceOf(plugMinerSales.address)).to.eq(balanceAKREBeore.add(expandTo18Decimals(99).mul(4)))
        expect(await arkreenRECToken.balanceOf(plugMinerSales.address)).to.eq(balanceARTBeore.sub(expandTo9Decimals(1).mul(4)))
        expect(await plugMinerSales.balanceOf(user1.address)).to.eq(4)
        expect(await plugMinerSales.totalSupply()).to.eq(4)

        // test withdraw
        await expect(plugMinerSales.connect(user1).withdraw(AKREToken.address, expandTo18Decimals(99).mul(4)))
                .to.be.revertedWith("Ownable: caller is not the owner")

        await expect(plugMinerSales.withdraw(AKREToken.address, expandTo18Decimals(100).mul(4)))
                .to.be.revertedWith("Withdraw More")

        const balanceBefore = await AKREToken.balanceOf(fund_receiver.address)

        await plugMinerSales.withdraw(AKREToken.address, expandTo18Decimals(99).mul(4))
        expect(await plugMinerSales.getIncomeInfo(AKREToken.address)).to.deep.eq([expandTo18Decimals(99).mul(4), expandTo18Decimals(0)])
        expect(await AKREToken.balanceOf(fund_receiver.address)).to.eq(balanceBefore.add(expandTo18Decimals(99).mul(4)))

      })
    
      it("plugMinerSales actionPlugMiner Test: Multiple Mint with native Token ", async function () {
        // Normal
        let plugActionInfo: PlugActionInfo = {
          owner:          user1.address,
          tokenPay:       tokenA.address,              // Used as USDC
          amountPay:      expandTo18Decimals(99).mul(4),
          tokenGet:       arkreenRECToken.address,
          amountGet:      expandTo9Decimals(1).mul(4),
          actionType:     utils.hexlify(utils.toUtf8Bytes("Buy in 99")).padEnd(66, '0'),
          action:         BigNumber.from(1).shl(248).add(BigNumber.from(4).shl(240))
        }

        let txid = randomAddresses(1)[0]
        let nonce = BigNumber.from(0)

        const digest = getPlugActionInfoHash(
            'Plug Miner Action',
            plugMinerSales.address,
            txid,
            plugActionInfo,
            nonce,
            constants.MaxUint256
        )

        await arkreenRECToken.connect(owner1).approve(plugMinerSales.address, constants.MaxUint256)
        await plugMinerSales.connect(owner1).depositToken(arkreenRECToken.address, expandTo9Decimals(10000))
        await AKREToken.transfer(user1.address, expandTo18Decimals(1_000_000))

        await AKREToken.connect(user1).approve(plugMinerSales.address, constants.MaxUint256)
        await arkreenRECToken.connect(user1).approve(plugMinerSales.address, constants.MaxUint256)
        
        const {v,r,s} = ecsign(Buffer.from(digest.slice(2), 'hex'), Buffer.from(privateKeyManager.slice(2), 'hex'))   
        const signature: PlugMinerSales.SigStruct = { v, r, s }  

        const balanceMATICBefore = await ethers.provider.getBalance(plugMinerSales.address)
        const balanceARTBeore = await arkreenRECToken.balanceOf(plugMinerSales.address)

        await expect(plugMinerSales.connect(user1).actionPlugMiner(txid, plugActionInfo, nonce, constants.MaxUint256, signature, {value: expandTo18Decimals(99)}))
                .to.be.revertedWith("Pay low!")

        await expect(plugMinerSales.connect(user1).actionPlugMiner(txid, plugActionInfo, nonce, constants.MaxUint256, signature, {value: expandTo18Decimals(99).mul(4)}))
                .to.emit(arkreenRECToken, 'Transfer')
                .withArgs(plugMinerSales.address, user1.address, expandTo9Decimals(1).mul(4))    
                .to.emit(plugMinerSales, 'Transfer')
                .withArgs(zeroAddress(), user1.address, 1)    
                .to.emit(plugMinerSales, 'Transfer')
                .withArgs(zeroAddress(), user1.address, 2)    
                .to.emit(plugMinerSales, 'Transfer')
                .withArgs(zeroAddress(), user1.address, 3)    
                .to.emit(plugMinerSales, 'Transfer')
                .withArgs(zeroAddress(), user1.address, 4)    
                .to.emit(plugMinerSales, 'ActionPlugMiner')
                .withArgs(txid, plugActionInfo.owner, plugActionInfo.actionType, 1, 4)   
                
        expect(await plugMinerSales.getIncomeInfo(tokenA.address)).to.deep.eq([expandTo18Decimals(99).mul(4), expandTo18Decimals(99).mul(4)])
        expect(await plugMinerSales.getDepositInfo(arkreenRECToken.address)).to.deep.eq([expandTo9Decimals(10000), expandTo9Decimals(4)])

        expect(await ethers.provider.getBalance(plugMinerSales.address)).to.eq(balanceMATICBefore.add(expandTo18Decimals(99).mul(4)))
        expect(await arkreenRECToken.balanceOf(plugMinerSales.address)).to.eq(balanceARTBeore.sub(expandTo9Decimals(1).mul(4)))
        expect(await plugMinerSales.balanceOf(user1.address)).to.eq(4)
        expect(await plugMinerSales.totalSupply()).to.eq(4)

        // test withdraw
        await expect(plugMinerSales.connect(user1).withdraw(tokenA.address, expandTo18Decimals(99).mul(4)))
                .to.be.revertedWith("Ownable: caller is not the owner")

        await expect(plugMinerSales.withdraw(tokenA.address, expandTo18Decimals(100).mul(4)))
                .to.be.revertedWith("Withdraw More")

        const balanceBefore = await ethers.provider.getBalance(fund_receiver.address)

        await plugMinerSales.withdraw(tokenA.address, expandTo18Decimals(99).mul(4))
        expect(await plugMinerSales.getIncomeInfo(tokenA.address)).to.deep.eq([expandTo18Decimals(99).mul(4), expandTo18Decimals(0)])
        expect(await ethers.provider.getBalance(fund_receiver.address)).to.eq(balanceBefore.add(expandTo18Decimals(99).mul(4)))

      })

      it("plugMinerSales actionPlugMiner Test: Refund 2 Miner", async function () {
        // Prepare 4 miners
        {
          let plugActionInfo: PlugActionInfo = {
            owner:          user1.address,
            tokenPay:       AKREToken.address,              // Used as USDC
            amountPay:      expandTo18Decimals(99).mul(4),
            tokenGet:       arkreenRECToken.address,
            amountGet:      expandTo9Decimals(1).mul(4),
            actionType:     utils.hexlify(utils.toUtf8Bytes("Buy in 99")).padEnd(66, '0'),
            action:         BigNumber.from(1).shl(248).add(BigNumber.from(4).shl(240))
          }

          let txid = randomAddresses(1)[0]
          let nonce = BigNumber.from(0)

          const digest = getPlugActionInfoHash(
              'Plug Miner Action',
              plugMinerSales.address,
              txid,
              plugActionInfo,
              nonce,
              constants.MaxUint256
          )

          await arkreenRECToken.connect(owner1).approve(plugMinerSales.address, constants.MaxUint256)
          await plugMinerSales.connect(owner1).depositToken(arkreenRECToken.address, expandTo9Decimals(10000))

          await AKREToken.transfer(user1.address, expandTo18Decimals(1_000_000))
          await AKREToken.connect(user1).approve(plugMinerSales.address, constants.MaxUint256)
          
          const {v,r,s} = ecsign(Buffer.from(digest.slice(2), 'hex'), Buffer.from(privateKeyManager.slice(2), 'hex'))   
          const signature: PlugMinerSales.SigStruct = { v, r, s }  

          await plugMinerSales.connect(user1).actionPlugMiner(txid, plugActionInfo, nonce, constants.MaxUint256, signature)
        }

        let plugActionInfo: PlugActionInfo = {
          owner:          user1.address,
          tokenPay:       arkreenRECToken.address,              // Used as USDC AKREToken
          amountPay:      expandTo9Decimals(1).mul(2),
          tokenGet:       AKREToken.address,
          amountGet:      expandTo18Decimals(99).mul(2),
          actionType:     utils.hexlify(utils.toUtf8Bytes("Refund 99")).padEnd(66, '0'),
          action:         BigNumber.from(2).shl(248).add(BigNumber.from(2).shl(240)).add(BigNumber.from(2).shl(32)).add(BigNumber.from(3))
        }

        let txid = randomAddresses(1)[0]
        let nonce = BigNumber.from(1)

        const digest = getPlugActionInfoHash(
            'Plug Miner Action',
            plugMinerSales.address,
            txid,
            plugActionInfo,
            nonce,
            constants.MaxUint256
        )
       
        const {v,r,s} = ecsign(Buffer.from(digest.slice(2), 'hex'), Buffer.from(privateKeyManager.slice(2), 'hex'))   
        const signature: PlugMinerSales.SigStruct = { v, r, s }  

        await arkreenRECToken.connect(owner1).transfer(user1.address, expandTo9Decimals(100))
        await arkreenRECToken.connect(user1).approve(plugMinerSales.address, constants.MaxUint256)

        const balanceARTEBefore = await arkreenRECToken.balanceOf(plugMinerSales.address)
        const balanceAKREBefore = await AKREToken.balanceOf(plugMinerSales.address)

        await expect(plugMinerSales.connect(user1).actionPlugMiner(txid, plugActionInfo, nonce, constants.MaxUint256, signature))
                  .to.emit(arkreenRECToken, 'Transfer')
                  .withArgs(user1.address, plugMinerSales.address, expandTo9Decimals(1).mul(2))     
                  .to.emit(AKREToken, 'Transfer')
                  .withArgs(plugMinerSales.address, user1.address, expandTo18Decimals(99).mul(2))
                  .to.emit(plugMinerSales, 'ActionPlugMiner')
                  .withArgs(txid, plugActionInfo.owner, plugActionInfo.actionType, 2, 2)   

        expect(await plugMinerSales.getIncomeInfo(arkreenRECToken.address)).to.deep.eq([expandTo9Decimals(1).mul(2), expandTo9Decimals(1).mul(2)])
        expect(await plugMinerSales.getDepositInfo(AKREToken.address)).to.deep.eq([expandTo9Decimals(0), expandTo18Decimals(99).mul(2)])
                
        expect(await arkreenRECToken.balanceOf(plugMinerSales.address)).to.eq(balanceARTEBefore.add(expandTo9Decimals(1).mul(2)))
        expect(await AKREToken.balanceOf(plugMinerSales.address)).to.eq(balanceAKREBefore.sub(expandTo18Decimals(99).mul(2)))

        expect(await plugMinerSales.balanceOf(user1.address)).to.eq(4)
        expect(await plugMinerSales.totalSupply()).to.eq(4)

        expect(await plugMinerSales.statusPlugMiner(1)).to.eq(0)
        expect(await plugMinerSales.statusPlugMiner(2)).to.eq(2)
        expect(await plugMinerSales.statusPlugMiner(3)).to.eq(2)
        expect(await plugMinerSales.statusPlugMiner(4)).to.eq(0)

        // Abnormal test
        {
          let plugActionInfo: PlugActionInfo = {
            owner:          user1.address,
            tokenPay:       arkreenRECToken.address,              // Used as USDC AKREToken
            amountPay:      expandTo9Decimals(1).mul(2),
            tokenGet:       AKREToken.address,
            amountGet:      expandTo18Decimals(99).mul(2),
            actionType:     utils.hexlify(utils.toUtf8Bytes("Refund 99")).padEnd(66, '0'),
            action:         BigNumber.from(2).shl(248).add(BigNumber.from(2).shl(240)).add(BigNumber.from(4).shl(32)).add(BigNumber.from(0))
          }
  
          let txid = randomAddresses(1)[0]
          let nonce = BigNumber.from(2)
  
          const digest = getPlugActionInfoHash(
              'Plug Miner Action',
              plugMinerSales.address,
              txid,
              plugActionInfo,
              nonce,
              constants.MaxUint256
          )

          await arkreenRECToken.connect(owner1).transfer(user1.address, expandTo9Decimals(100))
          await arkreenRECToken.connect(user1).approve(plugMinerSales.address, constants.MaxUint256)
         
          const {v,r,s} = ecsign(Buffer.from(digest.slice(2), 'hex'), Buffer.from(privateKeyManager.slice(2), 'hex'))   
          const signature: PlugMinerSales.SigStruct = { v, r, s }  
 
          await expect(plugMinerSales.connect(user1).actionPlugMiner(txid, plugActionInfo, nonce, constants.MaxUint256, signature))
                  .to.be.revertedWith("Wrong ID")
        }
        {
          let plugActionInfo: PlugActionInfo = {
            owner:          user1.address,
            tokenPay:       arkreenRECToken.address,              // Used as USDC AKREToken
            amountPay:      expandTo9Decimals(1).mul(2),
            tokenGet:       AKREToken.address,
            amountGet:      expandTo18Decimals(99).mul(2),
            actionType:     utils.hexlify(utils.toUtf8Bytes("Refund 99")).padEnd(66, '0'),
            action:         BigNumber.from(2).shl(248).add(BigNumber.from(2).shl(240)).add(BigNumber.from(1).shl(32)).add(BigNumber.from(3))
          }
  
          let txid = randomAddresses(1)[0]
          let nonce = BigNumber.from(2)
  
          const digest = getPlugActionInfoHash(
              'Plug Miner Action',
              plugMinerSales.address,
              txid,
              plugActionInfo,
              nonce,
              constants.MaxUint256
          )

          await arkreenRECToken.connect(owner1).transfer(user1.address, expandTo9Decimals(100))
          await arkreenRECToken.connect(user1).approve(plugMinerSales.address, constants.MaxUint256)
         
          const {v,r,s} = ecsign(Buffer.from(digest.slice(2), 'hex'), Buffer.from(privateKeyManager.slice(2), 'hex'))   
          const signature: PlugMinerSales.SigStruct = { v, r, s }  
 
          await expect(plugMinerSales.connect(user1).actionPlugMiner(txid, plugActionInfo, nonce, constants.MaxUint256, signature))
                  .to.be.revertedWith("Pay back not allowed")
        }
        {
          let plugActionInfo: PlugActionInfo = {
            owner:          user2.address,
            tokenPay:       arkreenRECToken.address,              // Used as USDC AKREToken
            amountPay:      expandTo9Decimals(1).mul(2),
            tokenGet:       AKREToken.address,
            amountGet:      expandTo18Decimals(99).mul(2),
            actionType:     utils.hexlify(utils.toUtf8Bytes("Refund 99")).padEnd(66, '0'),
            action:         BigNumber.from(2).shl(248).add(BigNumber.from(2).shl(240)).add(BigNumber.from(1).shl(32)).add(BigNumber.from(4))
          }
  
          let txid = randomAddresses(1)[0]
          let nonce = BigNumber.from(0)
  
          const digest = getPlugActionInfoHash(
              'Plug Miner Action',
              plugMinerSales.address,
              txid,
              plugActionInfo,
              nonce,
              constants.MaxUint256
          )

          await arkreenRECToken.connect(owner1).transfer(user2.address, expandTo9Decimals(100))
          await arkreenRECToken.connect(user2).approve(plugMinerSales.address, constants.MaxUint256)
         
          const {v,r,s} = ecsign(Buffer.from(digest.slice(2), 'hex'), Buffer.from(privateKeyManager.slice(2), 'hex'))   
          const signature: PlugMinerSales.SigStruct = { v, r, s }  
 
          await expect(plugMinerSales.connect(user2).actionPlugMiner(txid, plugActionInfo, nonce, constants.MaxUint256, signature))
                  .to.be.revertedWith("Not Owner")
        }
      })

      it("plugMinerSales actionCspMiner Test: Basic Mint and abnormal", async function () {
        // Normal
        let plugActionInfo: PlugActionInfo = {
          owner:          user1.address,
          tokenPay:       AKREToken.address,              // Used as USDC
          amountPay:      expandTo18Decimals(99),
          tokenGet:       arkreenRECToken.address,
          amountGet:      expandTo9Decimals(1),
          actionType:     utils.hexlify(utils.toUtf8Bytes("Buy in 99")).padEnd(66, '0'),
          action:         BigNumber.from(1).shl(248)
        }

        let txid = randomAddresses(1)[0]
        let nonce = BigNumber.from(0)

        const digest = getCspActionInfoHash(
            'Plug Miner Action',
            plugMinerSales.address,
            txid,
            plugActionInfo,
            nonce,
            constants.MaxUint256
        )

        await arkreenRECToken.connect(owner1).approve(plugMinerSales.address, constants.MaxUint256)
        await plugMinerSales.connect(owner1).depositToken(arkreenRECToken.address, expandTo9Decimals(10000))

        await AKREToken.transfer(user1.address, expandTo18Decimals(1_000_000))

        await AKREToken.connect(user1).approve(plugMinerSales.address, constants.MaxUint256)
        await arkreenRECToken.connect(user1).approve(plugMinerSales.address, constants.MaxUint256)
        
        const {v,r,s} = ecsign(Buffer.from(digest.slice(2), 'hex'), Buffer.from(privateKeyManager.slice(2), 'hex'))   
        const signature: PlugMinerSales.SigStruct = { v, r, s }  

        const balanceAKREBeore = await AKREToken.balanceOf(plugMinerSales.address)
        const balanceARTBeore = await arkreenRECToken.balanceOf(plugMinerSales.address)

        await expect(plugMinerSales.connect(user1).actionCspMiner(txid, plugActionInfo, nonce, constants.MaxUint256, signature))
                .to.emit(AKREToken, 'Transfer')
                .withArgs(user1.address, plugMinerSales.address, expandTo18Decimals(99))    
                .to.emit(arkreenRECToken, 'Transfer')
                .withArgs(plugMinerSales.address, user1.address, expandTo9Decimals(1))
                .to.emit(plugMinerSales, 'Transfer')
                .withArgs(zeroAddress(), user1.address, 1)    
                .to.emit(plugMinerSales, 'ActionCspMiner')
                .withArgs(txid, plugActionInfo.owner, plugActionInfo.actionType, 1, 1)  
                
        expect(await plugMinerSales.getIncomeInfo(AKREToken.address)).to.deep.eq([expandTo18Decimals(99), expandTo18Decimals(99)])
        expect(await plugMinerSales.getDepositInfo(arkreenRECToken.address)).to.deep.eq([expandTo9Decimals(10000), expandTo9Decimals(1)])
                
        expect(await AKREToken.balanceOf(plugMinerSales.address)).to.eq(balanceAKREBeore.add(expandTo18Decimals(99)))
        expect(await arkreenRECToken.balanceOf(plugMinerSales.address)).to.eq(balanceARTBeore.sub(expandTo9Decimals(1)))
        expect(await plugMinerSales.balanceOf(user1.address)).to.eq(1)

        // Abnormal test 
        nonce = BigNumber.from(1)
        {               
          await expect(plugMinerSales.connect(user1).actionCspMiner(txid, plugActionInfo, nonce, constants.MaxUint256, signature))
                .to.be.revertedWith("Wrong Signature")
        }
        
        {        
          let txid = randomAddresses(1)[0]
          nonce = BigNumber.from(2)
          const digest = getCspActionInfoHash(
                  'Plug Miner Action',
                  plugMinerSales.address,
                  txid,
                  plugActionInfo,
                  nonce,
                  constants.MaxUint256
              )
      
          const {v,r,s} = ecsign(Buffer.from(digest.slice(2), 'hex'), Buffer.from(privateKeyManager.slice(2), 'hex'))   
          const signature: PlugMinerSales.SigStruct = { v, r, s }  
          await expect(plugMinerSales.connect(user1).actionCspMiner(txid, plugActionInfo, nonce, constants.MaxUint256, signature))
                .to.be.revertedWith("Wrong Nonce")
        }
        {
          let txid = randomAddresses(1)[0]
          nonce = BigNumber.from(1)
          plugActionInfo.owner = user2.address
          const digest = getCspActionInfoHash(
                  'Plug Miner Action',
                  plugMinerSales.address,
                  txid,
                  plugActionInfo,
                  nonce,
                  constants.MaxUint256
              )
          
          const {v,r,s} = ecsign(Buffer.from(digest.slice(2), 'hex'), Buffer.from(privateKeyManager.slice(2), 'hex'))   
          const signature: PlugMinerSales.SigStruct = { v, r, s }  
    
          await expect(plugMinerSales.connect(user1).actionCspMiner(txid, plugActionInfo, nonce, constants.MaxUint256, signature))
                .to.be.revertedWith("Wrong Sender")
        }
        {
          let txid = randomAddresses(1)[0]
          nonce = BigNumber.from(1)
          plugActionInfo.owner = user1.address
          plugActionInfo.action =  BigNumber.from(3).shl(248)
          const digest = getCspActionInfoHash(
                  'Plug Miner Action',
                  plugMinerSales.address,
                  txid,
                  plugActionInfo,
                  nonce,
                  constants.MaxUint256
              )
          const {v,r,s} = ecsign(Buffer.from(digest.slice(2), 'hex'), Buffer.from(privateKeyManager.slice(2), 'hex'))   
          const signature: PlugMinerSales.SigStruct = { v, r, s }  
    
          await expect(plugMinerSales.connect(user1).actionCspMiner(txid, plugActionInfo, nonce, constants.MaxUint256, signature))
                .to.be.revertedWith("Wrong Action!")
          
        }

      })

      it("plugMinerSales actionCspMiner Test: Multiple Mint", async function () {
        // Normal
        let plugActionInfo: PlugActionInfo = {
          owner:          user1.address,
          tokenPay:       AKREToken.address,              // Used as USDC
          amountPay:      expandTo18Decimals(99).mul(4),
          tokenGet:       arkreenRECToken.address,
          amountGet:      expandTo9Decimals(1).mul(4),
          actionType:     utils.hexlify(utils.toUtf8Bytes("Buy in 99")).padEnd(66, '0'),
          action:         BigNumber.from(1).shl(248).add(BigNumber.from(4).shl(240))
        }

        let txid = randomAddresses(1)[0]
        let nonce = BigNumber.from(0)

        const digest = getCspActionInfoHash(
            'Plug Miner Action',
            plugMinerSales.address,
            txid,
            plugActionInfo,
            nonce,
            constants.MaxUint256
        )

        await arkreenRECToken.connect(owner1).approve(plugMinerSales.address, constants.MaxUint256)
        await plugMinerSales.connect(owner1).depositToken(arkreenRECToken.address, expandTo9Decimals(10000))

        await AKREToken.transfer(user1.address, expandTo18Decimals(1_000_000))

        await AKREToken.connect(user1).approve(plugMinerSales.address, constants.MaxUint256)
        await arkreenRECToken.connect(user1).approve(plugMinerSales.address, constants.MaxUint256)
        
        const {v,r,s} = ecsign(Buffer.from(digest.slice(2), 'hex'), Buffer.from(privateKeyManager.slice(2), 'hex'))   
        const signature: PlugMinerSales.SigStruct = { v, r, s }  

        const balanceAKREBeore = await AKREToken.balanceOf(plugMinerSales.address)
        const balanceARTBeore = await arkreenRECToken.balanceOf(plugMinerSales.address)

        await expect(plugMinerSales.connect(user1).actionCspMiner(txid, plugActionInfo, nonce, constants.MaxUint256, signature))
                .to.emit(AKREToken, 'Transfer')
                .withArgs(user1.address, plugMinerSales.address, expandTo18Decimals(99).mul(4))    
                .to.emit(arkreenRECToken, 'Transfer')
                .withArgs(plugMinerSales.address, user1.address, expandTo9Decimals(1).mul(4))    
                .to.emit(plugMinerSales, 'Transfer')
                .withArgs(zeroAddress(), user1.address, 1)    
                .to.emit(plugMinerSales, 'Transfer')
                .withArgs(zeroAddress(), user1.address, 2)    
                .to.emit(plugMinerSales, 'Transfer')
                .withArgs(zeroAddress(), user1.address, 3)    
                .to.emit(plugMinerSales, 'Transfer')
                .withArgs(zeroAddress(), user1.address, 4)    
                .to.emit(plugMinerSales, 'ActionCspMiner')
                .withArgs(txid, plugActionInfo.owner, plugActionInfo.actionType, 1, 4)   

        expect(await plugMinerSales.getIncomeInfo(AKREToken.address)).to.deep.eq([expandTo18Decimals(99).mul(4), expandTo18Decimals(99).mul(4)])
        expect(await plugMinerSales.getDepositInfo(arkreenRECToken.address)).to.deep.eq([expandTo9Decimals(10000), expandTo9Decimals(4)])
                
        expect(await AKREToken.balanceOf(plugMinerSales.address)).to.eq(balanceAKREBeore.add(expandTo18Decimals(99).mul(4)))
        expect(await arkreenRECToken.balanceOf(plugMinerSales.address)).to.eq(balanceARTBeore.sub(expandTo9Decimals(1).mul(4)))
        expect(await plugMinerSales.balanceOf(user1.address)).to.eq(4)
        expect(await plugMinerSales.totalSupply()).to.eq(4)

        // test withdraw
        await expect(plugMinerSales.connect(user1).withdraw(AKREToken.address, expandTo18Decimals(99).mul(4)))
                .to.be.revertedWith("Ownable: caller is not the owner")

        await expect(plugMinerSales.withdraw(AKREToken.address, expandTo18Decimals(100).mul(4)))
                .to.be.revertedWith("Withdraw More")

        const balanceBefore = await AKREToken.balanceOf(fund_receiver.address)

        await plugMinerSales.withdraw(AKREToken.address, expandTo18Decimals(99).mul(4))
        expect(await plugMinerSales.getIncomeInfo(AKREToken.address)).to.deep.eq([expandTo18Decimals(99).mul(4), expandTo18Decimals(0)])
        expect(await AKREToken.balanceOf(fund_receiver.address)).to.eq(balanceBefore.add(expandTo18Decimals(99).mul(4)))

      })
    
      it("plugMinerSales actionCspMiner Test: Multiple Mint with native Token ", async function () {
        // Normal
        let plugActionInfo: PlugActionInfo = {
          owner:          user1.address,
          tokenPay:       tokenA.address,              // Used as USDC
          amountPay:      expandTo18Decimals(99).mul(4),
          tokenGet:       arkreenRECToken.address,
          amountGet:      expandTo9Decimals(1).mul(4),
          actionType:     utils.hexlify(utils.toUtf8Bytes("Buy in 99")).padEnd(66, '0'),
          action:         BigNumber.from(1).shl(248).add(BigNumber.from(4).shl(240))
        }

        let txid = randomAddresses(1)[0]
        let nonce = BigNumber.from(0)

        const digest = getCspActionInfoHash(
            'Plug Miner Action',
            plugMinerSales.address,
            txid,
            plugActionInfo,
            nonce,
            constants.MaxUint256
        )

        await arkreenRECToken.connect(owner1).approve(plugMinerSales.address, constants.MaxUint256)
        await plugMinerSales.connect(owner1).depositToken(arkreenRECToken.address, expandTo9Decimals(10000))
        await AKREToken.transfer(user1.address, expandTo18Decimals(1_000_000))

        await AKREToken.connect(user1).approve(plugMinerSales.address, constants.MaxUint256)
        await arkreenRECToken.connect(user1).approve(plugMinerSales.address, constants.MaxUint256)
        
        const {v,r,s} = ecsign(Buffer.from(digest.slice(2), 'hex'), Buffer.from(privateKeyManager.slice(2), 'hex'))   
        const signature: PlugMinerSales.SigStruct = { v, r, s }  

        const balanceMATICBefore = await ethers.provider.getBalance(plugMinerSales.address)
        const balanceARTBeore = await arkreenRECToken.balanceOf(plugMinerSales.address)

        await expect(plugMinerSales.connect(user1).actionCspMiner(txid, plugActionInfo, nonce, constants.MaxUint256, signature, {value: expandTo18Decimals(99)}))
                .to.be.revertedWith("Pay low!")

        await expect(plugMinerSales.connect(user1).actionCspMiner(txid, plugActionInfo, nonce, constants.MaxUint256, signature, {value: expandTo18Decimals(99).mul(4)}))
                .to.emit(arkreenRECToken, 'Transfer')
                .withArgs(plugMinerSales.address, user1.address, expandTo9Decimals(1).mul(4))    
                .to.emit(plugMinerSales, 'Transfer')
                .withArgs(zeroAddress(), user1.address, 1)    
                .to.emit(plugMinerSales, 'Transfer')
                .withArgs(zeroAddress(), user1.address, 2)    
                .to.emit(plugMinerSales, 'Transfer')
                .withArgs(zeroAddress(), user1.address, 3)    
                .to.emit(plugMinerSales, 'Transfer')
                .withArgs(zeroAddress(), user1.address, 4)    
                .to.emit(plugMinerSales, 'ActionCspMiner')
                .withArgs(txid, plugActionInfo.owner, plugActionInfo.actionType, 1, 4)   
                
        expect(await plugMinerSales.getIncomeInfo(tokenA.address)).to.deep.eq([expandTo18Decimals(99).mul(4), expandTo18Decimals(99).mul(4)])
        expect(await plugMinerSales.getDepositInfo(arkreenRECToken.address)).to.deep.eq([expandTo9Decimals(10000), expandTo9Decimals(4)])

        expect(await ethers.provider.getBalance(plugMinerSales.address)).to.eq(balanceMATICBefore.add(expandTo18Decimals(99).mul(4)))
        expect(await arkreenRECToken.balanceOf(plugMinerSales.address)).to.eq(balanceARTBeore.sub(expandTo9Decimals(1).mul(4)))
        expect(await plugMinerSales.balanceOf(user1.address)).to.eq(4)
        expect(await plugMinerSales.totalSupply()).to.eq(4)

        // test withdraw
        await expect(plugMinerSales.connect(user1).withdraw(tokenA.address, expandTo18Decimals(99).mul(4)))
                .to.be.revertedWith("Ownable: caller is not the owner")

        await expect(plugMinerSales.withdraw(tokenA.address, expandTo18Decimals(100).mul(4)))
                .to.be.revertedWith("Withdraw More")

        const balanceBefore = await ethers.provider.getBalance(fund_receiver.address)

        await plugMinerSales.withdraw(tokenA.address, expandTo18Decimals(99).mul(4))
        expect(await plugMinerSales.getIncomeInfo(tokenA.address)).to.deep.eq([expandTo18Decimals(99).mul(4), expandTo18Decimals(0)])
        expect(await ethers.provider.getBalance(fund_receiver.address)).to.eq(balanceBefore.add(expandTo18Decimals(99).mul(4)))

      })

      it("plugMinerSales actionPlugMiner Test: Refund 2 Miner", async function () {
        // Prepare 4 miners
        {
          let plugActionInfo: PlugActionInfo = {
            owner:          user1.address,
            tokenPay:       AKREToken.address,              // Used as USDC
            amountPay:      expandTo18Decimals(99).mul(4),
            tokenGet:       arkreenRECToken.address,
            amountGet:      expandTo9Decimals(1).mul(4),
            actionType:     utils.hexlify(utils.toUtf8Bytes("Buy in 99")).padEnd(66, '0'),
            action:         BigNumber.from(1).shl(248).add(BigNumber.from(4).shl(240))
          }

          let txid = randomAddresses(1)[0]
          let nonce = BigNumber.from(0)

          const digest = getCspActionInfoHash(
              'Plug Miner Action',
              plugMinerSales.address,
              txid,
              plugActionInfo,
              nonce,
              constants.MaxUint256
          )

          await arkreenRECToken.connect(owner1).approve(plugMinerSales.address, constants.MaxUint256)
          await plugMinerSales.connect(owner1).depositToken(arkreenRECToken.address, expandTo9Decimals(10000))

          await AKREToken.transfer(user1.address, expandTo18Decimals(1_000_000))
          await AKREToken.connect(user1).approve(plugMinerSales.address, constants.MaxUint256)
          
          const {v,r,s} = ecsign(Buffer.from(digest.slice(2), 'hex'), Buffer.from(privateKeyManager.slice(2), 'hex'))   
          const signature: PlugMinerSales.SigStruct = { v, r, s }  

          await plugMinerSales.connect(user1).actionCspMiner(txid, plugActionInfo, nonce, constants.MaxUint256, signature)
        }

        let plugActionInfo: PlugActionInfo = {
          owner:          user1.address,
          tokenPay:       arkreenRECToken.address,              // Used as USDC AKREToken
          amountPay:      expandTo9Decimals(1).mul(2),
          tokenGet:       AKREToken.address,
          amountGet:      expandTo18Decimals(99).mul(2),
          actionType:     utils.hexlify(utils.toUtf8Bytes("Refund 99")).padEnd(66, '0'),
          action:         BigNumber.from(2).shl(248).add(BigNumber.from(2).shl(240)).add(BigNumber.from(2).shl(32)).add(BigNumber.from(3))
        }

        let txid = randomAddresses(1)[0]
        let nonce = BigNumber.from(1)

        const digest = getCspActionInfoHash(
            'Plug Miner Action',
            plugMinerSales.address,
            txid,
            plugActionInfo,
            nonce,
            constants.MaxUint256
        )
       
        const {v,r,s} = ecsign(Buffer.from(digest.slice(2), 'hex'), Buffer.from(privateKeyManager.slice(2), 'hex'))   
        const signature: PlugMinerSales.SigStruct = { v, r, s }  

        await arkreenRECToken.connect(owner1).transfer(user1.address, expandTo9Decimals(100))
        await arkreenRECToken.connect(user1).approve(plugMinerSales.address, constants.MaxUint256)

        const balanceARTEBefore = await arkreenRECToken.balanceOf(plugMinerSales.address)
        const balanceAKREBefore = await AKREToken.balanceOf(plugMinerSales.address)

        await expect(plugMinerSales.connect(user1).actionCspMiner(txid, plugActionInfo, nonce, constants.MaxUint256, signature))
                  .to.emit(arkreenRECToken, 'Transfer')
                  .withArgs(user1.address, plugMinerSales.address, expandTo9Decimals(1).mul(2))     
                  .to.emit(AKREToken, 'Transfer')
                  .withArgs(plugMinerSales.address, user1.address, expandTo18Decimals(99).mul(2))
                  .to.emit(plugMinerSales, 'ActionCspMiner')
                  .withArgs(txid, plugActionInfo.owner, plugActionInfo.actionType, 2, 2)   

        expect(await plugMinerSales.getIncomeInfo(arkreenRECToken.address)).to.deep.eq([expandTo9Decimals(1).mul(2), expandTo9Decimals(1).mul(2)])
        expect(await plugMinerSales.getDepositInfo(AKREToken.address)).to.deep.eq([expandTo9Decimals(0), expandTo18Decimals(99).mul(2)])
                
        expect(await arkreenRECToken.balanceOf(plugMinerSales.address)).to.eq(balanceARTEBefore.add(expandTo9Decimals(1).mul(2)))
        expect(await AKREToken.balanceOf(plugMinerSales.address)).to.eq(balanceAKREBefore.sub(expandTo18Decimals(99).mul(2)))

        expect(await plugMinerSales.balanceOf(user1.address)).to.eq(4)
        expect(await plugMinerSales.totalSupply()).to.eq(4)

        expect(await plugMinerSales.statusPlugMiner(1)).to.eq(0)
        expect(await plugMinerSales.statusPlugMiner(2)).to.eq(2)
        expect(await plugMinerSales.statusPlugMiner(3)).to.eq(2)
        expect(await plugMinerSales.statusPlugMiner(4)).to.eq(0)

        // Abnormal test
        {
          let plugActionInfo: PlugActionInfo = {
            owner:          user1.address,
            tokenPay:       arkreenRECToken.address,              // Used as USDC AKREToken
            amountPay:      expandTo9Decimals(1).mul(2),
            tokenGet:       AKREToken.address,
            amountGet:      expandTo18Decimals(99).mul(2),
            actionType:     utils.hexlify(utils.toUtf8Bytes("Refund 99")).padEnd(66, '0'),
            action:         BigNumber.from(2).shl(248).add(BigNumber.from(2).shl(240)).add(BigNumber.from(4).shl(32)).add(BigNumber.from(0))
          }
  
          let txid = randomAddresses(1)[0]
          let nonce = BigNumber.from(2)
  
          const digest = getCspActionInfoHash(
              'Plug Miner Action',
              plugMinerSales.address,
              txid,
              plugActionInfo,
              nonce,
              constants.MaxUint256
          )

          await arkreenRECToken.connect(owner1).transfer(user1.address, expandTo9Decimals(100))
          await arkreenRECToken.connect(user1).approve(plugMinerSales.address, constants.MaxUint256)
         
          const {v,r,s} = ecsign(Buffer.from(digest.slice(2), 'hex'), Buffer.from(privateKeyManager.slice(2), 'hex'))   
          const signature: PlugMinerSales.SigStruct = { v, r, s }  
 
          await expect(plugMinerSales.connect(user1).actionCspMiner(txid, plugActionInfo, nonce, constants.MaxUint256, signature))
                  .to.be.revertedWith("Wrong ID")
        }
        {
          let plugActionInfo: PlugActionInfo = {
            owner:          user1.address,
            tokenPay:       arkreenRECToken.address,              // Used as USDC AKREToken
            amountPay:      expandTo9Decimals(1).mul(2),
            tokenGet:       AKREToken.address,
            amountGet:      expandTo18Decimals(99).mul(2),
            actionType:     utils.hexlify(utils.toUtf8Bytes("Refund 99")).padEnd(66, '0'),
            action:         BigNumber.from(2).shl(248).add(BigNumber.from(2).shl(240)).add(BigNumber.from(1).shl(32)).add(BigNumber.from(3))
          }
  
          let txid = randomAddresses(1)[0]
          let nonce = BigNumber.from(2)
  
          const digest = getCspActionInfoHash(
              'Plug Miner Action',
              plugMinerSales.address,
              txid,
              plugActionInfo,
              nonce,
              constants.MaxUint256
          )

          await arkreenRECToken.connect(owner1).transfer(user1.address, expandTo9Decimals(100))
          await arkreenRECToken.connect(user1).approve(plugMinerSales.address, constants.MaxUint256)
         
          const {v,r,s} = ecsign(Buffer.from(digest.slice(2), 'hex'), Buffer.from(privateKeyManager.slice(2), 'hex'))   
          const signature: PlugMinerSales.SigStruct = { v, r, s }  
 
          await expect(plugMinerSales.connect(user1).actionCspMiner(txid, plugActionInfo, nonce, constants.MaxUint256, signature))
                  .to.be.revertedWith("Pay back not allowed")
        }
        {
          let plugActionInfo: PlugActionInfo = {
            owner:          user2.address,
            tokenPay:       arkreenRECToken.address,              // Used as USDC AKREToken
            amountPay:      expandTo9Decimals(1).mul(2),
            tokenGet:       AKREToken.address,
            amountGet:      expandTo18Decimals(99).mul(2),
            actionType:     utils.hexlify(utils.toUtf8Bytes("Refund 99")).padEnd(66, '0'),
            action:         BigNumber.from(2).shl(248).add(BigNumber.from(2).shl(240)).add(BigNumber.from(1).shl(32)).add(BigNumber.from(4))
          }
  
          let txid = randomAddresses(1)[0]
          let nonce = BigNumber.from(0)
  
          const digest = getCspActionInfoHash(
              'Plug Miner Action',
              plugMinerSales.address,
              txid,
              plugActionInfo,
              nonce,
              constants.MaxUint256
          )

          await arkreenRECToken.connect(owner1).transfer(user2.address, expandTo9Decimals(100))
          await arkreenRECToken.connect(user2).approve(plugMinerSales.address, constants.MaxUint256)
         
          const {v,r,s} = ecsign(Buffer.from(digest.slice(2), 'hex'), Buffer.from(privateKeyManager.slice(2), 'hex'))   
          const signature: PlugMinerSales.SigStruct = { v, r, s }  
 
          await expect(plugMinerSales.connect(user2).actionCspMiner(txid, plugActionInfo, nonce, constants.MaxUint256, signature))
                  .to.be.revertedWith("Not Owner")
        }
      })


  })
})