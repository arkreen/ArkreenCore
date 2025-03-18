import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import { expect } from "chai";
import { constants, BigNumber, Contract } from 'ethers'
import { ethers, network, upgrades } from "hardhat";
import { ArkreenRECIssuanceExt__factory } from "../../typechain";

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
    HashKeyESGBTC,
    WETH9,
    ERC20F,
} from "../../typechain";

import { time, loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { getApprovalDigest, expandTo18Decimals, randomAddresses, MinerType, RECStatus, expandTo9Decimals } from "../utils/utilities";
import { ecsign, fromRpcSig, ecrecover } from 'ethereumjs-util'
import { RECRequestStruct, SignatureStruct, RECDataStruct } from "../../typechain/contracts/ArkreenRECIssuance";

describe("HashKeyESGBTCBank", () => {
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
    let arkreenRECTokenESG:           ArkreenRECToken
    let arkreenRetirement:            ArkreenBadge
    let arkreenBuilder:               ArkreenBuilder
    let arkreenRECBank:               ArkreenRECBank
    let hashKeyESGBTC:                HashKeyESGBTC

    let WETH:                         WETH9
    let tokenA:                       ERC20F

    const FORMAL_LAUNCH = 1682913600;         // 2024-05-01, 12:00:00
    const Miner_Manager       = 0 
    const MASK_OFFSET = BigNumber.from('0x8000000000000000')
    const MASK_DETAILS = BigNumber.from('0xC000000000000000')    

    const startTime = 1564888526
    const endTime   = 1654888526
    const region = "Shanghai"
    const url = "https://www.arkreen.com/AREC/"
    const memo = "Test Update"   
    const cID = "bafybeihepmxz4ytc4ht67j73nzurkvsiuxhsmxk27utnopzptpo7wuigte"        

    async function deployFixture() {
      let lastBlock = await ethers.provider.getBlock('latest')
      console.log("ArkreenRECBank", lastBlock.timestamp)

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

      const ArkreenRECTokenESGFactory = await ethers.getContractFactory("ArkreenRECToken")
      const arkreenRECTokenESG = await upgrades.deployProxy(ArkreenRECTokenESGFactory,[arkreenRegistry.address, maker1.address,'HashKey AREC Token','HART']) as ArkreenRECToken
      await arkreenRECTokenESG.deployed()          
      
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
  
      await AKREToken.transfer(owner1.address, expandTo18Decimals(30_000_000))
      await AKREToken.connect(owner1).approve(arkreenRECIssuance.address, expandTo18Decimals(30_000_000))
      await AKREToken.transfer(maker1.address, expandTo18Decimals(30_000_000))
      await AKREToken.connect(maker1).approve(arkreenRECIssuance.address, expandTo18Decimals(30_000_000))
      await AKREToken.connect(owner1).approve(arkreenMiner.address, expandTo18Decimals(30_000_000))
      await AKREToken.connect(maker1).approve(arkreenMiner.address, expandTo18Decimals(30_000_000))

      const miners = randomAddresses(2)
      await arkreenMiner.connect(manager).RemoteMinerOnboardInBatch([owner1.address, maker1.address], miners)
      // set formal launch

      const payer = maker1.address
 
      await arkreenMiner.setManager(Miner_Manager, manager.address)
      await arkreenMiner.ManageManufactures([payer], true)     

      await arkreenRegistry.addRECIssuer(manager.address, arkreenRECToken.address, "Arkreen Issuer")
      await arkreenRegistry.setRECIssuance(arkreenRECIssuance.address)
      await arkreenRegistry.setArkreenRetirement(arkreenRetirement.address)

      arkreenRECIssuanceExt = ArkreenRECIssuanceExt__factory.connect(arkreenRECIssuance.address, deployer);

      await arkreenRegistry.newAssetAREC('Test ARE', maker1.address, arkreenRECTokenESG.address,
                  AKREToken.address, BigNumber.from("0x3635c9adc5dea00000"), 1000, 'HashKey ESG BTC')

      const ArkreenBuilderFactory = await ethers.getContractFactory("ArkreenBuilder");
//    const arkreenBuilder = await ArkreenBuilderFactory.deploy(routerFeswa.address);
      arkreenBuilder = await upgrades.deployProxy(ArkreenBuilderFactory,[AKREToken.address, arkreenRECBank.address, WETH.address]) as ArkreenBuilder
      await arkreenBuilder.deployed();
      await arkreenBuilder.approveRouter([AKREToken.address, WETH.address])       
      await arkreenBuilder.approveArtBank([tokenA.address, WETH.address, AKREToken.address])      
      
      const HashKeyESGBTCFactory = await ethers.getContractFactory("HashKeyESGBTC");
      hashKeyESGBTC = await upgrades.deployProxy(HashKeyESGBTCFactory,
                              [arkreenBuilder.address, arkreenRECTokenESG.address, WETH.address, 2000]) as HashKeyESGBTC
      await hashKeyESGBTC.deployed();
      await hashKeyESGBTC.approveBuilder([AKREToken.address, WETH.address])

      return { AKREToken, arkreenMiner, arkreenRegistry, arkreenRECIssuance, arkreenRECToken, arkreenRECTokenESG, 
               arkreenRetirement, arkreenRECIssuanceExt, arkreenRECBank, WETH, tokenA }
    }

    beforeEach(async () => {
        [deployer, manager, register_authority, fund_receiver, owner1, owner2, miner1, miner2, maker1, maker2] = await ethers.getSigners();

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
        arkreenRECTokenESG = fixture.arkreenRECTokenESG
        arkreenRECBank = fixture.arkreenRECBank
        WETH = fixture.WETH
        tokenA = fixture.tokenA
    }); 

    describe("HashKey for ESG AREC", () => {

      beforeEach(async () => {
        {
          const startTime = 1564888526
          const endTime   = 1654888526
          
          let recMintRequest: RECRequestStruct = { 
            issuer: manager.address, startTime, endTime,
            amountREC: expandTo9Decimals(10000), 
            cID: "bafybeihepmxz4ytc4ht67j73nzurkvsiuxhsmxk27utnopzptpo7wuigte",
            region: 'Beijing',
            url:"", memo:""
          } 

          const mintFee = expandTo18Decimals(10000* 1000)
          const nonce1 = await AKREToken.nonces(owner1.address)
          const digest1 = await getApprovalDigest(
                                  AKREToken,
                                  { owner: owner1.address, spender: arkreenRECIssuance.address, value: mintFee },
                                  nonce1,
                                  constants.MaxUint256
                                )
          const { v,r,s } = ecsign(Buffer.from(digest1.slice(2), 'hex'), Buffer.from(privateKeyOwner.slice(2), 'hex'))
          const signature: SignatureStruct = { v, r, s, token: AKREToken.address, value:mintFee, deadline: constants.MaxUint256 } 
          
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
        }

        {
          let signature: SignatureStruct
          const mintFee = expandTo18Decimals(10000 *1000)    
          let tokenID: BigNumber          

          const nonce1 = await AKREToken.nonces(owner1.address)
          const digest1 = await getApprovalDigest(
                                  AKREToken,
                                  { owner: owner1.address, spender: arkreenRECIssuance.address, value: mintFee },
                                  nonce1,
                                  constants.MaxUint256
                                )
          const { v,r,s } = ecsign(Buffer.from(digest1.slice(2), 'hex'), Buffer.from(privateKeyOwner.slice(2), 'hex'))
          signature = { v, r, s, token: AKREToken.address, value:mintFee, deadline: constants.MaxUint256 } 

          await arkreenRECIssuanceExt.manageMVPAddress(true,[owner1.address])      

          await arkreenRECIssuanceExt.connect(owner1).mintESGBatch(1, expandTo9Decimals(10000), signature)
          tokenID = await arkreenRECIssuanceExt.totalSupply()

          await arkreenRECIssuanceExt.connect(owner1).updateRECDataExt(tokenID, startTime, endTime, cID, region, url, memo)                     
          await arkreenRECIssuance.connect(maker1).certifyRECRequest(tokenID, "Serial12345678")

          // Normal
          await arkreenRECIssuance.connect(owner1).liquidizeREC(tokenID)

          await arkreenRECTokenESG.connect(owner1).transfer(maker2.address, expandTo9Decimals(9000))
          await arkreenRECTokenESG.connect(maker2).approve(arkreenRECBank.address, expandTo9Decimals(9000))   

          const limit= BigNumber.from('0x0a141428283c3c64')
          await hashKeyESGBTC.UpdateESGBadgeLimit(limit, 0)

        }
      });

      ///////////////////////////////////////////

      it("ActionBuilderBadge: Exact ART Token", async () => {

        await arkreenRECBank.addNewART( arkreenRECToken.address,  maker1.address)
        await arkreenRECBank.addNewART( arkreenRECTokenESG.address,  maker2.address)  
        
        await arkreenRECBank.connect(maker1).depositART( arkreenRECToken.address,  expandTo9Decimals(9000))
        await arkreenRECBank.connect(maker2).depositART( arkreenRECTokenESG.address,  expandTo9Decimals(9000))

        await arkreenRECToken.setClimateBuilder(arkreenBuilder.address)
        await arkreenRECTokenESG.setClimateBuilder(arkreenBuilder.address)

        const badgeInfo =  {
          beneficiary:    owner1.address,
          offsetEntityID: 'Owner1',
          beneficiaryID:  'Tester',
          offsetMessage:  "Just Testing"
        }        

        await AKREToken.approve(arkreenBuilder.address, constants.MaxUint256)    
          
        const bricksToGreen = BigNumber.from('0x00700F01200D009002001').or(BigNumber.from(1).shl(255))
        await arkreenRECBank.connect(maker2).changeSalePrice( arkreenRECTokenESG.address, AKREToken.address, expandTo18Decimals(10))

        const amountPay = expandTo18Decimals(200)
        const amountART = expandTo9Decimals(14)

        const ARECBefore = await arkreenRECTokenESG.balanceOf(owner1.address)                    
        await AKREToken.connect(owner1).approve(hashKeyESGBTC.address, constants.MaxUint256)

        await arkreenBuilder.mangeTrustedForwarder(hashKeyESGBTC.address, true)
        await hashKeyESGBTC.connect(owner1).greenizeBTC( AKREToken.address,
                                                      amountPay, bricksToGreen, constants.MaxUint256, badgeInfo)

        const actionID =1     
        const lastBlock = await ethers.provider.getBlock('latest')     
        
        const tokenID = await arkreenRECIssuance.totalSupply()
        const action = [  owner1.address, maker1.address, amountART,    // Manger is the issuer address
                          tokenID.add(MASK_OFFSET), lastBlock.timestamp, true ]     // Offset action is claimed
        expect(await arkreenRetirement.getOffsetActions(actionID)).to.deep.equal(action)

        const offsetRecord = [owner1.address, owner1.address, "Owner1", "Tester", "Just Testing", 
                              BigNumber.from(lastBlock.timestamp), amountART, [actionID]]
        const badgeID = 1                            
        expect(await arkreenRetirement.getCertificate(badgeID)).to.deep.equal(offsetRecord)
        expect(await arkreenRECTokenESG.balanceOf(owner1.address)).to.equal(ARECBefore)   

        expect(await hashKeyESGBTC.checkBrick(1)).to.equal(true)
        expect(await hashKeyESGBTC.checkBrick(2)).to.equal(true)
        expect(await hashKeyESGBTC.checkBrick(7)).to.equal(true)
        expect(await hashKeyESGBTC.checkBrick(9)).to.equal(true)
        expect(await hashKeyESGBTC.checkBrick(13)).to.equal(true)
        expect(await hashKeyESGBTC.checkBrick(15)).to.equal(true)
        expect(await hashKeyESGBTC.checkBrick(18)).to.equal(true)
        expect(await hashKeyESGBTC.checkBrick(10)).to.equal(false)

        const ownerInfo = [ owner1.address, 1, bricksToGreen.xor(BigNumber.from(1).shl(255))]   // Mask the highest bit
        expect(await hashKeyESGBTC.ownerBricks(1)).to.deep.equal(ownerInfo)
        expect(await hashKeyESGBTC.ownerBricks(9)).to.deep.equal(ownerInfo)

        const ESGID = await hashKeyESGBTC.totalSupply()
        await hashKeyESGBTC.connect(owner1).transferFrom(owner1.address, owner2.address, ESGID)

      });      

      it("HashKeyESGBTCBank:  greenizeBTCPermit", async () => {

        await arkreenRECBank.addNewART( arkreenRECToken.address,  maker1.address)
        await arkreenRECBank.addNewART( arkreenRECTokenESG.address,  maker2.address)  
        
        await arkreenRECBank.connect(maker1).depositART( arkreenRECToken.address,  expandTo9Decimals(9000))
        await arkreenRECBank.connect(maker2).depositART( arkreenRECTokenESG.address,  expandTo9Decimals(9000))

        await arkreenRECToken.setClimateBuilder(arkreenBuilder.address)
        await arkreenRECTokenESG.setClimateBuilder(arkreenBuilder.address)

        const badgeInfo =  {
          beneficiary:    owner1.address,
          offsetEntityID: 'Owner1',
          beneficiaryID:  'Tester',
          offsetMessage:  "Just Testing"
        }        

        await AKREToken.approve(arkreenBuilder.address, constants.MaxUint256)    
          
        const bricksToGreen = BigNumber.from('0x09109209309409509609708808708608508408308200700F01200D009002001').or(BigNumber.from(1).shl(255))
        await arkreenRECBank.connect(maker2).changeSalePrice( arkreenRECTokenESG.address, AKREToken.address, expandTo18Decimals(10))

        const bricksToGreen1 = BigNumber.from('0x101102103104105106107110112113114115116117121122123124125126127')
        const bricksToGreen2 = BigNumber.from('0x201202203204205206207208210211212213')     //12 
  
        const amountPay = expandTo18Decimals(1100)
        const amountART = expandTo9Decimals(54*2)

        const ARECBefore = await arkreenRECTokenESG.balanceOf(owner1.address)                    
        await AKREToken.connect(owner1).approve(hashKeyESGBTC.address, constants.MaxUint256)

        await arkreenBuilder.mangeTrustedForwarder(hashKeyESGBTC.address, true)
        await hashKeyESGBTC.connect(owner1).greenizeBTCMVP( AKREToken.address,
                                                      amountPay, bricksToGreen, [bricksToGreen1, bricksToGreen2], 
                                                      constants.MaxUint256, badgeInfo)

        const actionID =1     
        const lastBlock = await ethers.provider.getBlock('latest')     
        
        const tokenID = await arkreenRECIssuance.totalSupply()
        const action = [  owner1.address, maker1.address, amountART,    // Manger is the issuer address
                          tokenID.add(MASK_OFFSET), lastBlock.timestamp, true ]     // Offset action is claimed
        expect(await arkreenRetirement.getOffsetActions(actionID)).to.deep.equal(action)

        const offsetRecord = [owner1.address, owner1.address, "Owner1", "Tester", "Just Testing", 
                              BigNumber.from(lastBlock.timestamp), amountART, [actionID]]
        const badgeID = 1                            
        expect(await arkreenRetirement.getCertificate(badgeID)).to.deep.equal(offsetRecord)
        expect(await arkreenRECTokenESG.balanceOf(owner1.address)).to.equal(ARECBefore)   

        expect(await hashKeyESGBTC.checkBrick(1)).to.equal(true)
        expect(await hashKeyESGBTC.checkBrick(2)).to.equal(true)
        expect(await hashKeyESGBTC.checkBrick(7)).to.equal(true)
        expect(await hashKeyESGBTC.checkBrick(9)).to.equal(true)
        expect(await hashKeyESGBTC.checkBrick(13)).to.equal(true)
        expect(await hashKeyESGBTC.checkBrick(15)).to.equal(true)
        expect(await hashKeyESGBTC.checkBrick(18)).to.equal(true)
        expect(await hashKeyESGBTC.checkBrick(10)).to.equal(false)

        const ownerInfo = [ owner1.address, 1, bricksToGreen.or(BigNumber.from(1).shl(255))]   // Mask the highest bit to flag MVP  
        expect(await hashKeyESGBTC.ownerBricks(1)).to.deep.equal(ownerInfo)
        expect(await hashKeyESGBTC.ownerBricks(9)).to.deep.equal(ownerInfo)

        const brickIdsMVP0 = await hashKeyESGBTC.brickIdsMVP(1,0)
        const brickIdsMVP1 = await hashKeyESGBTC.brickIdsMVP(1,1)
        const brickIds = await hashKeyESGBTC.brickIds(1)
        expect(brickIdsMVP0).to.equal(bricksToGreen1)
        expect(brickIdsMVP1).to.equal(bricksToGreen2)
        expect(brickIds).to.equal(bricksToGreen.or(BigNumber.from(1).shl(255)))

        expect(await hashKeyESGBTC.getMVPBlocks(1)).to.deep.equal([bricksToGreen1, bricksToGreen2])
      });      

      //////////////////////////////////////
     
      it("ActionBuilder: actionBuilderBadge with Bank", async () => {
        // Add ART token
        await arkreenRECBank.addNewART( arkreenRECToken.address,  maker1.address)
        await arkreenRECBank.addNewART( arkreenRECTokenESG.address,  maker2.address)  
        
        await arkreenRECBank.connect(maker1).depositART( arkreenRECToken.address,  expandTo9Decimals(9000))
        await arkreenRECBank.connect(maker2).depositART( arkreenRECTokenESG.address,  expandTo9Decimals(9000))

        await arkreenRECToken.setClimateBuilder(arkreenBuilder.address)
        await arkreenRECTokenESG.setClimateBuilder(arkreenBuilder.address)

        const badgeInfo =  {
          beneficiary:    owner1.address,
          offsetEntityID: 'Owner1',
          beneficiaryID:  'Tester',
          offsetMessage:  "Just Testing"
        }        

        await tokenA.approve(arkreenBuilder.address, constants.MaxUint256)    
        
        {
          await arkreenRECBank.connect(maker1).changeSalePrice( arkreenRECToken.address, tokenA.address, expandTo18Decimals(150))

          const ARECBefore = await arkreenRECToken.balanceOf(deployer.address)
          await expect(arkreenBuilder.actionBuilderBadge( tokenA.address, arkreenRECToken.address,
                              expandTo18Decimals(100*150), expandTo9Decimals(100), 3, constants.MaxUint256, badgeInfo))
                              .to.emit(tokenA, 'Transfer')
                              .withArgs(deployer.address, arkreenBuilder.address, expandTo18Decimals(100*150))
                              .to.emit(tokenA, 'Transfer')
                              .withArgs(arkreenBuilder.address, arkreenRECBank.address, expandTo18Decimals(100*150))                              
                              .to.emit(arkreenRECBank, "ARTSold")
                              .withArgs(arkreenRECToken.address, tokenA.address, expandTo9Decimals(100), expandTo18Decimals(100*150))
                              .to.emit(arkreenRECToken, "OffsetFinished")
                              .withArgs(deployer.address, expandTo9Decimals(100), 1) 
                              .to.emit(arkreenRetirement, "OffsetCertificateMinted")
                              .withArgs(1)           
                              .to.emit(arkreenRetirement, "Locked")
                              .withArgs(1)      

          const actionID =1     
          const lastBlock = await ethers.provider.getBlock('latest')     

          const tokenID = BigNumber.from(1)
          const action = [  deployer.address, manager.address, expandTo9Decimals(100),    // Manger is the issuer address
                            tokenID.add(MASK_OFFSET), lastBlock.timestamp, true ]     // Offset action is claimed
          expect(await arkreenRetirement.getOffsetActions(actionID)).to.deep.equal(action)
  
          const offsetRecord = [deployer.address, owner1.address, "Owner1", "Tester", "Just Testing", 
                                BigNumber.from(lastBlock.timestamp), expandTo9Decimals(100), [actionID]]
          const badgeID = 1                            
          expect(await arkreenRetirement.getCertificate(badgeID)).to.deep.equal(offsetRecord)   
          expect(await arkreenRECToken.balanceOf(deployer.address)).to.equal(ARECBefore)
        }

        {
          await arkreenRECBank.connect(maker2).changeSalePrice( arkreenRECTokenESG.address, tokenA.address, expandTo18Decimals(250))

          const ARECBefore = await arkreenRECTokenESG.balanceOf(deployer.address)
          await expect(arkreenBuilder.actionBuilderBadge( tokenA.address, arkreenRECTokenESG.address,
                                              expandTo18Decimals(150*250), expandTo9Decimals(150), 2, constants.MaxUint256, badgeInfo))
                          .to.emit(tokenA, 'Transfer')
                          .withArgs(deployer.address, arkreenBuilder.address, expandTo18Decimals(150*250))
                          .to.emit(tokenA, 'Transfer')
                          .withArgs(arkreenBuilder.address, arkreenRECBank.address, expandTo18Decimals(150*250))                              
                          .to.emit(arkreenRECBank, "ARTSold")
                          .withArgs(arkreenRECTokenESG.address, tokenA.address, expandTo9Decimals(150), expandTo18Decimals(150*250))
                          .to.emit(arkreenRECTokenESG, "OffsetFinished")
                          .withArgs(deployer.address, expandTo9Decimals(150), 2) 
                          .to.emit(arkreenRetirement, "OffsetCertificateMinted")    
                          .withArgs(2)           
                          .to.emit(arkreenRetirement, "Locked")
                          .withArgs(2)                                                                       

          const actionID = await arkreenRetirement.offsetCounter()
          const lastBlock = await ethers.provider.getBlock('latest')    
          
          const tokenID = await arkreenRECIssuanceExt.totalSupply()
          const action = [  deployer.address, maker1.address, expandTo9Decimals(150),    // Manger is the issuer address
                            tokenID.add(MASK_OFFSET), lastBlock.timestamp, true ]        // Offset action is claimed
          expect(await arkreenRetirement.getOffsetActions(actionID)).to.deep.equal(action)

          const offsetRecord = [deployer.address, owner1.address, "Owner1", "Tester", "Just Testing", 
                                BigNumber.from(lastBlock.timestamp), expandTo9Decimals(150), [actionID]]
          const badgeID = 2                            
          expect(await arkreenRetirement.getCertificate(badgeID)).to.deep.equal(offsetRecord)  
          expect(await arkreenRECTokenESG.balanceOf(deployer.address)).to.equal(ARECBefore)

        }   
      })

      it("ActionBuilder: actionBuilderNative with Bank", async () => {
        // Add ART token
        await arkreenRECBank.addNewART( arkreenRECToken.address,  maker1.address)
        await arkreenRECBank.addNewART( arkreenRECTokenESG.address,  maker2.address)  
        
        await arkreenRECBank.connect(maker1).depositART( arkreenRECToken.address,  expandTo9Decimals(9000))
        await arkreenRECBank.connect(maker2).depositART( arkreenRECTokenESG.address,  expandTo9Decimals(9000))

        await arkreenRECToken.setClimateBuilder(arkreenBuilder.address)
        await arkreenRECTokenESG.setClimateBuilder(arkreenBuilder.address)

        await tokenA.approve(arkreenBuilder.address, constants.MaxUint256)    
        
        {
          await arkreenRECBank.connect(maker1).changeSalePrice( arkreenRECToken.address, WETH.address, expandTo9Decimals(2_000_000)) //0.002 WETH         

          const ARECBefore = await arkreenRECToken.balanceOf(deployer.address)
          await expect(arkreenBuilder.actionBuilderNative( arkreenRECToken.address, expandTo9Decimals(500), 3, constants.MaxUint256, {value: expandTo18Decimals(1)}))
                              .to.emit(WETH, 'Transfer')
                              .withArgs(arkreenBuilder.address, arkreenRECBank.address, expandTo18Decimals(1))                              
                              .to.emit(arkreenRECBank, "ARTSold")
                              .withArgs(arkreenRECToken.address, WETH.address, expandTo9Decimals(500), expandTo18Decimals(1))
                              .to.emit(arkreenRECToken, "OffsetFinished")
                              .withArgs(deployer.address, expandTo9Decimals(500), 1)     

          const actionID =1     
          const lastBlock = await ethers.provider.getBlock('latest')    

          const tokenID = BigNumber.from(1)
          const action = [  deployer.address, manager.address, expandTo9Decimals(500),    // Manger is the issuer address
                            tokenID.add(MASK_OFFSET), lastBlock.timestamp, false ]        // Offset action is claimed
                            
          expect(await arkreenRetirement.getOffsetActions(actionID)).to.deep.equal(action)
          expect(await arkreenRECToken.balanceOf(deployer.address)).to.equal(ARECBefore)
        }

        {
          await arkreenRECBank.connect(maker2).changeSalePrice( arkreenRECTokenESG.address, WETH.address, expandTo9Decimals(2_500_000))  // 0.025ETH

          const ARECBefore = await arkreenRECTokenESG.balanceOf(deployer.address)
          await expect(arkreenBuilder.actionBuilderNative( arkreenRECTokenESG.address,
                                              expandTo9Decimals(400), 2, constants.MaxUint256, {value: expandTo18Decimals(1)}))
                          .to.emit(WETH, 'Transfer')
                          .withArgs(arkreenBuilder.address, arkreenRECBank.address, expandTo18Decimals(1))                              
                          .to.emit(arkreenRECBank, "ARTSold")
                          .withArgs(arkreenRECTokenESG.address, WETH.address, expandTo9Decimals(400), expandTo18Decimals(1))
                          .to.emit(arkreenRECTokenESG, "OffsetFinished")
                          .withArgs(deployer.address, expandTo9Decimals(400), 2)                                                 

          const actionID = await arkreenRetirement.offsetCounter()
          const lastBlock = await ethers.provider.getBlock('latest')    
          
          const tokenID = await arkreenRECIssuanceExt.totalSupply()
          const action = [  deployer.address, maker1.address, expandTo9Decimals(400),    // Manger is the issuer address
                            tokenID.add(MASK_OFFSET), lastBlock.timestamp, false ]        // Offset action is claimed
          expect(await arkreenRetirement.getOffsetActions(actionID)).to.deep.equal(action)
          expect(await arkreenRECTokenESG.balanceOf(deployer.address)).to.equal(ARECBefore)

        }   
      })

      it("ActionBuilder: actionBuilderWithPermit with Bank", async () => {
        // Add ART token
        await arkreenRECBank.addNewART( arkreenRECToken.address,  maker1.address)
        await arkreenRECBank.addNewART( arkreenRECTokenESG.address,  maker2.address)  
        
        await arkreenRECBank.connect(maker1).depositART( arkreenRECToken.address,  expandTo9Decimals(9000))
        await arkreenRECBank.connect(maker2).depositART( arkreenRECTokenESG.address,  expandTo9Decimals(9000))

        await arkreenRECToken.setClimateBuilder(arkreenBuilder.address)
        await arkreenRECTokenESG.setClimateBuilder(arkreenBuilder.address)
       
        {
          await arkreenRECBank.connect(maker1).changeSalePrice( arkreenRECToken.address, AKREToken.address, expandTo18Decimals(100))    // 100 AKRE                

          const nonce1 = await AKREToken.nonces(owner1.address)
          const digest1 = await getApprovalDigest( AKREToken,
                                  { owner: owner1.address, spender: arkreenBuilder.address, value: expandTo18Decimals(500*100) },
                                  nonce1,
                                  constants.MaxUint256
                                )
          const { v,r,s } = ecsign(Buffer.from(digest1.slice(2), 'hex'), Buffer.from(privateKeyOwner.slice(2), 'hex'))
          const permitToPay: SignatureStruct = { v, r, s, token: AKREToken.address, value:expandTo18Decimals(500*100), deadline: constants.MaxUint256 }      

          const ARECBefore = await arkreenRECToken.balanceOf(owner1.address)
          await expect(arkreenBuilder.connect(owner1).actionBuilderWithPermit( arkreenRECToken.address, expandTo9Decimals(500), 3, permitToPay))
                              .to.emit(AKREToken, 'Transfer')
                              .withArgs(owner1.address, arkreenBuilder.address, expandTo18Decimals(500*100))
                              .to.emit(AKREToken, 'Transfer')
                              .withArgs(arkreenBuilder.address, arkreenRECBank.address, expandTo18Decimals(500*100))                              
                              .to.emit(arkreenRECBank, "ARTSold")
                              .withArgs(arkreenRECToken.address, AKREToken.address, expandTo9Decimals(500), expandTo18Decimals(500*100))
                              .to.emit(arkreenRECToken, "OffsetFinished")
                              .withArgs(owner1.address, expandTo9Decimals(500), 1) 
                              
          const actionID =1     
          const lastBlock = await ethers.provider.getBlock('latest')    

          const tokenID = BigNumber.from(1)
          const action = [  owner1.address, manager.address, expandTo9Decimals(500),    // Manger is the issuer address
                            tokenID.add(MASK_OFFSET), lastBlock.timestamp, false ]        // Offset action is claimed
                            
          expect(await arkreenRetirement.getOffsetActions(actionID)).to.deep.equal(action)
          expect(await arkreenRECToken.balanceOf(owner1.address)).to.equal(ARECBefore)
        }

        {
          await arkreenRECBank.connect(maker2).changeSalePrice( arkreenRECTokenESG.address, AKREToken.address, expandTo18Decimals(150))

          const nonce1 = await AKREToken.nonces(owner1.address)
          const digest1 = await getApprovalDigest( AKREToken,
                                  { owner: owner1.address, spender: arkreenBuilder.address, value: expandTo18Decimals(1500*150) },
                                  nonce1,
                                  constants.MaxUint256
                                )
          const { v,r,s } = ecsign(Buffer.from(digest1.slice(2), 'hex'), Buffer.from(privateKeyOwner.slice(2), 'hex'))
          const permitToPay: SignatureStruct = { v, r, s, token: AKREToken.address, value:expandTo18Decimals(1500*150), deadline: constants.MaxUint256 }      

          const ARECBefore = await arkreenRECTokenESG.balanceOf(owner1.address)
          await expect(arkreenBuilder.connect(owner1).actionBuilderWithPermit( arkreenRECTokenESG.address, expandTo9Decimals(1500), 2, permitToPay))
                          .to.emit(AKREToken, 'Transfer')
                          .withArgs(owner1.address, arkreenBuilder.address, expandTo18Decimals(1500*150))
                          .to.emit(AKREToken, 'Transfer')
                          .withArgs(arkreenBuilder.address, arkreenRECBank.address, expandTo18Decimals(1500*150))                              
                          .to.emit(arkreenRECBank, "ARTSold")
                          .withArgs(arkreenRECTokenESG.address, AKREToken.address, expandTo9Decimals(1500), expandTo18Decimals(1500*150))
                          .to.emit(arkreenRECTokenESG, "OffsetFinished")
                          .withArgs(owner1.address, expandTo9Decimals(1500), 2)  

          const actionID = await arkreenRetirement.offsetCounter()
          const lastBlock = await ethers.provider.getBlock('latest')    

          const tokenID = await arkreenRECIssuanceExt.totalSupply()
          const action = [  owner1.address, maker1.address, expandTo9Decimals(1500),    // Manger is the issuer address
                            tokenID.add(MASK_OFFSET), lastBlock.timestamp, false ]        // Offset action is claimed
          expect(await arkreenRetirement.getOffsetActions(actionID)).to.deep.equal(action)
          expect(await arkreenRECTokenESG.balanceOf(owner1.address)).to.equal(ARECBefore)

        }   
      })

    })  

});
