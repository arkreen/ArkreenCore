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
    GreenBTC,
    WETH9,
    ERC20F,
    GreenBTCImage
} from "../../typechain";

import { time, loadFixture, mine } from "@nomicfoundation/hardhat-network-helpers";
import { getApprovalDigest, expandTo18Decimals, randomAddresses, getGreenBitcoinDigest, expandTo9Decimals } from "../utils/utilities";
import { getGreenBitcoinDigestBatch, GreenBTCInfo } from "../utils/utilities";

import { ecsign, fromRpcSig, ecrecover } from 'ethereumjs-util'
import { RECRequestStruct, SignatureStruct, RECDataStruct } from "../../typechain/contracts/ArkreenRECIssuance";
import { boolean } from "hardhat/internal/core/params/argumentTypes";

// import { mineBlock } from "../utils/utilities";
// import { Web3Provider } from "@ethersproject/providers";

const constants_MaxDealine = BigNumber.from('0xFFFFFFFF')
const constants_MaxDealineAndOpen = constants_MaxDealine.or(BigNumber.from(1).shl(63))
const constants_MaxDealineAndOpenSkip = constants_MaxDealine.or(BigNumber.from(3).shl(62))

describe("GreenBitcoinFee Test Campaign", () => {
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
    let greenBitcoin:                 GreenBTC
    let greenBTCImage:                GreenBTCImage

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
      const arkreenRECTokenESG = await upgrades.deployProxy(ArkreenRECTokenESGFactory,[arkreenRegistry.address, maker1.address,'Classic Based AREC Token','CART']) as ArkreenRECToken
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
      
      const GreenBTCProFactory = await ethers.getContractFactory("GreenBTCPro");
      const greenBTCPro = await GreenBTCProFactory.deploy();
      
      const GreenBTCFactory = await ethers.getContractFactory("GreenBTC");
      greenBitcoin = await upgrades.deployProxy(GreenBTCFactory,
                              [ register_authority.address, arkreenBuilder.address, 
                                arkreenRECTokenESG.address, WETH.address ]) as GreenBTC
      await greenBitcoin.deployed();
      await greenBitcoin.approveBuilder([AKREToken.address, WETH.address])

      await greenBitcoin.setGreenBTCPro(greenBTCPro.address);
      await greenBitcoin.setNewCaps(200, 100, 500);
              
      const GreenBTCImageFactory = await ethers.getContractFactory("GreenBTCImage");
      greenBTCImage = await GreenBTCImageFactory.deploy()
      await greenBTCImage.deployed();  

      await arkreenRECToken.setReceiverFee(fund_receiver.address)
      await arkreenRECToken.setRatioFeeOffset(500)

      await arkreenRECTokenESG.setReceiverFee(fund_receiver.address)
      await arkreenRECTokenESG.setRatioFeeOffset(500)

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

    describe("GreenBTC Test", () => {

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
                                constants_MaxDealine
                              )
        const { v,r,s } = ecsign(Buffer.from(digest1.slice(2), 'hex'), Buffer.from(privateKeyOwner.slice(2), 'hex'))
        const signature: SignatureStruct = { v, r, s, token: AKREToken.address, value:mintFee, deadline: constants_MaxDealine } 
        
        await arkreenRECIssuance.connect(owner1).mintRECRequest(recMintRequest, signature)
        tokenID = await arkreenRECIssuance.totalSupply()
  
        await arkreenRECIssuance.connect(manager).certifyRECRequest(tokenID, "Serial12345678")
        await arkreenRECIssuance.connect(owner1).liquidizeREC(tokenID)
      }

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

          await arkreenRECToken.connect(owner1).transfer(maker1.address, expandTo9Decimals(5000))
          await arkreenRECToken.connect(owner1).transfer(greenBitcoin.address, expandTo9Decimals(1000))
          await arkreenRECToken.connect(maker1).approve(arkreenRECBank.address, expandTo9Decimals(5000))
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
                                  constants_MaxDealine
                                )
          const { v,r,s } = ecsign(Buffer.from(digest1.slice(2), 'hex'), Buffer.from(privateKeyOwner.slice(2), 'hex'))
          signature = { v, r, s, token: AKREToken.address, value:mintFee, deadline: constants_MaxDealine } 

          await arkreenRECIssuanceExt.manageMVPAddress(true,[owner1.address])      

          await arkreenRECIssuanceExt.connect(owner1).mintESGBatch(1, expandTo9Decimals(10000), signature)
          tokenID = await arkreenRECIssuanceExt.totalSupply()

          await arkreenRECIssuanceExt.connect(owner1).updateRECDataExt(tokenID, startTime, endTime, cID, region, url, memo)                     
          await arkreenRECIssuance.connect(maker1).certifyRECRequest(tokenID, "Serial12345678")

          // Normal
          await arkreenRECIssuance.connect(owner1).liquidizeREC(tokenID)

          await arkreenRECTokenESG.connect(owner1).transfer(maker2.address, expandTo9Decimals(5000))
          await arkreenRECTokenESG.connect(owner1).transfer(greenBitcoin.address, expandTo9Decimals(1000))
          await arkreenRECTokenESG.connect(maker2).approve(arkreenRECBank.address, expandTo9Decimals(5000))   

        }
      });

      ///////////////////////////////////////////

      it("GreenBTC Test: authMintGreenBTCWithART", async () => {
        await arkreenRECBank.addNewART( arkreenRECToken.address,  maker1.address)
        await arkreenRECBank.addNewART( arkreenRECTokenESG.address,  maker2.address)  
        
        await arkreenRECBank.connect(maker1).depositART( arkreenRECToken.address,  expandTo9Decimals(5000))
        await arkreenRECBank.connect(maker2).depositART( arkreenRECTokenESG.address,  expandTo9Decimals(5000))

        await arkreenRECToken.setClimateBuilder(arkreenBuilder.address)
        await arkreenRECTokenESG.setClimateBuilder(arkreenBuilder.address)

        const badgeInfo =  {
          beneficiary:    owner1.address,
          offsetEntityID: 'Owner1',
          beneficiaryID:  'Tester',
          offsetMessage:  "Just Testing"
        }    

        const greenBTCInfo =  {
            height: BigNumber.from(12345),
            ARTCount: expandTo9Decimals(12),  // 12 HART
            minter: owner2.address,
            greenType: 0x12,
            blockTime: 'Apr 26, 2009 10:25 PM UTC',
            energyStr: '12.234 MWh'
        }

        const amountART = expandTo9Decimals(12)
        const artTokenESGBefore = await arkreenRECTokenESG.balanceOf(owner1.address)
        const artTokenESGBeforeGBTC = await arkreenRECTokenESG.balanceOf(greenBitcoin.address)

        // const receiver = owner1.address
        const register_digest = getGreenBitcoinDigest(
                        'Green BTC Club',
                        greenBitcoin.address,
                        { height:       greenBTCInfo.height,
                          energyStr:    greenBTCInfo.energyStr,
                          artCount:     greenBTCInfo.ARTCount,
                          blockTime:    greenBTCInfo.blockTime,
                          minter:       greenBTCInfo.minter,
                          greenType:    greenBTCInfo.greenType
                        }
                      )
  
        const {v,r,s} = ecsign( Buffer.from(register_digest.slice(2), 'hex'), 
                                              Buffer.from(privateKeyRegister.slice(2), 'hex'))           

        await arkreenBuilder.mangeTrustedForwarder(greenBitcoin.address, true)

        // Error: Check dealine
        const dealineBlock = await ethers.provider.getBlock('latest')
        await expect(greenBitcoin.connect(owner1).authMintGreenBTCWithART( greenBTCInfo, {v,r,s}, 
                                          badgeInfo, arkreenRECTokenESG.address, dealineBlock.timestamp-1 ))
                    .to.be.revertedWith("GBTC: EXPIRED")    

        await expect(greenBitcoin.connect(owner1).authMintGreenBTCWithART( greenBTCInfo, {v,r,s}, 
                                          badgeInfo, arkreenRECTokenESG.address, 
                                          BigNumber.from(dealineBlock.timestamp-1).or(BigNumber.from(1).shl(63))))
                    .to.be.revertedWith("GBTC: EXPIRED")

        // Error: Check ART is whitelisted
        await expect(greenBitcoin.connect(owner1).authMintGreenBTCWithART( greenBTCInfo, {v,r,s},
                                          badgeInfo, arkreenRECTokenESG.address, constants_MaxDealine ))
                    .to.be.revertedWith("GBTC: ART Not Accepted")    
        
        await greenBitcoin.mangeARTTokens([arkreenRECToken.address, arkreenRECTokenESG.address], true)                    

        // Error: Check ART Type
        greenBTCInfo.greenType = 0x02
        await expect(greenBitcoin.connect(owner1).authMintGreenBTCWithART( greenBTCInfo, {v,r,s},
                                          badgeInfo, arkreenRECTokenESG.address, constants_MaxDealine ))
                    .to.be.revertedWith("GBTC: Wrong ART Type")    

        greenBTCInfo.greenType = 0x12      

        // Error: Check signature of Green Bitcoin info      
        await expect(greenBitcoin.connect(owner1).authMintGreenBTCWithART( greenBTCInfo, {v,r:s,s},
                                          badgeInfo, arkreenRECTokenESG.address, constants_MaxDealine ))
                    .to.be.revertedWith("GBTC: Invalid Singature")    

        // Error: user need to approve greenBitcoin
        await expect(greenBitcoin.connect(owner1).authMintGreenBTCWithART( greenBTCInfo, {v,r,s}, 
                                                    badgeInfo, arkreenRECTokenESG.address, constants_MaxDealine ))
                    .to.be.revertedWith("TransferHelper: TRANSFER_FROM_FAILED")   
                    
        await arkreenRECTokenESG.connect(owner1).approve(greenBitcoin.address, constants.MaxUint256)  

        // Error: approveBuilder need to approve greenBitcoin
        await expect(greenBitcoin.connect(owner1).authMintGreenBTCWithART( greenBTCInfo, {v,r,s}, 
                                                    badgeInfo, arkreenRECTokenESG.address, constants_MaxDealine ))
                    .to.be.revertedWith("TransferHelper: TRANSFER_FROM_FAILED")   

        await greenBitcoin.approveBuilder([arkreenRECToken.address, arkreenRECTokenESG.address])

        // Normal: authMintGreenBTCWithART   
        const overAllARTwithFee = expandTo9Decimals(12).mul(100).div(95)    // Add offset fee, round-up
//        console.log("WWWWWWWWWWWWW", overAllARTwithFee.toString(), overAllARTwithFee.toHexString())
//        const tx = await greenBitcoin.connect(owner1).authMintGreenBTCWithART( greenBTCInfo, {v,r,s}, 
//                  badgeInfo, arkreenRECTokenESG.address, constants_MaxDealine )
//        
//        const receipt = await tx.wait()
//     
//        console.log("AAAAAAAAAAAA", tx, receipt, receipt.events![0], receipt.events![1], receipt.events![2], receipt.events![3])
//        console.log("BBBBBBBBBBBB", receipt.events![0], receipt.events![1], receipt.events![2], receipt.events![3])
//        console.log("CCCCCCCCCCCCC", receipt.events![4], receipt.events![5],receipt.events![6], receipt.events![7])
//        console.log("DDDDDDDDDDDDD", receipt.events![8], receipt.events![9],receipt.events![10], receipt.events![11])
//        console.log("EEEEEEEEEEEEEE", owner1.address, arkreenRECTokenESG.address, greenBitcoin.address, arkreenBuilder.address, fund_receiver.address)

        await expect(greenBitcoin.connect(owner1).authMintGreenBTCWithART( greenBTCInfo, {v,r,s}, 
                                                    badgeInfo, arkreenRECTokenESG.address, constants_MaxDealine ))
                      .to.emit(arkreenRECTokenESG, 'Transfer')
                      .withArgs(owner1.address, greenBitcoin.address, overAllARTwithFee)                                                         
                      .to.emit(arkreenRECTokenESG, 'Transfer')
                      .withArgs(greenBitcoin.address, arkreenBuilder.address, overAllARTwithFee)                                                       
                      .to.emit(arkreenRECTokenESG, 'Transfer')
                      .withArgs(arkreenBuilder.address, constants.AddressZero, expandTo9Decimals(12))  
                      .to.emit(arkreenRECTokenESG, "Transfer")
                      .withArgs(arkreenBuilder.address, fund_receiver.address, overAllARTwithFee.mul(5).div(100))                                                                        
                      .to.emit(greenBitcoin, 'Transfer')
                      .withArgs(constants.AddressZero, owner2.address, 12345)                                                 
                      .to.emit(greenBitcoin, 'GreenBitCoin')
                      .withArgs(12345, expandTo9Decimals(12), owner2.address, 0x12)  

        const actionID =1     
        const lastBlock = await ethers.provider.getBlock('latest')

        const tokenID = await arkreenRECIssuance.totalSupply()
        const action = [  owner1.address, maker1.address, amountART,                // Manger is the issuer address
                          tokenID.add(MASK_OFFSET), lastBlock.timestamp, true ]     // Offset action is claimed
        expect(await arkreenRetirement.getOffsetActions(actionID)).to.deep.equal(action)

        const offsetRecord = [owner1.address, owner1.address, "Owner1", "Tester", "Just Testing", 
                              BigNumber.from(lastBlock.timestamp), amountART, [actionID]]
        const badgeID = 1                            
        expect(await arkreenRetirement.getCertificate(badgeID)).to.deep.equal(offsetRecord)

        expect(await arkreenRECTokenESG.balanceOf(owner1.address)).to.equal(artTokenESGBefore.sub(overAllARTwithFee))

        expect(await arkreenRECTokenESG.balanceOf(greenBitcoin.address)).to.equal(artTokenESGBeforeGBTC)

        // Check dataGBTC
        const _dataGBTC = [ BigNumber.from(12345), expandTo9Decimals(12), owner2.address, 0x12,
                            'Apr 26, 2009 10:25 PM UTC', '12.234 MWh']

        expect(await greenBitcoin.dataGBTC(12345)).to.deep.equal(_dataGBTC)

        // Check dataGBTC
        const _dataNFT = [constants.AddressZero, 12345, false, false, false, 0, 0]
        expect(await greenBitcoin.dataNFT(12345)).to.deep.equal(_dataNFT)

        // Check NFT ID and owner
        expect(await greenBitcoin.ownerOf(12345)).to.equal(owner2.address)

        // 

        // Error: authMintGreenBTCWithART                     
        await expect(greenBitcoin.connect(owner1).authMintGreenBTCWithART( greenBTCInfo, {v,r,s}, 
                                                    badgeInfo, arkreenRECToken.address, constants_MaxDealine))
                      .to.be.revertedWith("GBTC: Already Minted")       
                      
        // Normal: authMintGreenBTCWithART: arkreenRECToken 
        // Buy and Open  
        {
          const greenBTCInfo =  {
            height: BigNumber.from(23456),
            ARTCount: expandTo9Decimals(13),  // 12 HART
            minter: owner1.address,
            greenType: 0x12,
            blockTime: 'Apr 26, 2009 10:25 PM UTC',
            energyStr: '12.234 MWh'
          }
          
          // const receiver = owner1.address
          const register_digest = getGreenBitcoinDigest(
                          'Green BTC Club',
                          greenBitcoin.address,
                          { height:       greenBTCInfo.height,
                            energyStr:    greenBTCInfo.energyStr,
                            artCount:     greenBTCInfo.ARTCount,
                            blockTime:    greenBTCInfo.blockTime,
                            minter:       greenBTCInfo.minter,
                            greenType:    greenBTCInfo.greenType
                          }
                        )
    
          const {v,r,s} = ecsign( Buffer.from(register_digest.slice(2), 'hex'), 
                                                Buffer.from(privateKeyRegister.slice(2), 'hex'))  

          const artTokenESGBefore = await arkreenRECToken.balanceOf(owner1.address) 
          await arkreenRECToken.connect(owner1).approve(greenBitcoin.address, constants.MaxUint256)  
          await greenBitcoin.connect(owner1).authMintGreenBTCWithART( greenBTCInfo, {v,r,s}, 
                                                      badgeInfo, arkreenRECToken.address, constants_MaxDealineAndOpen )     

          expect(await arkreenRECToken.balanceOf(owner1.address)).to.equal(artTokenESGBefore.sub(expandTo9Decimals(13).mul(100).div(95)))    
          
          // Check dataGBTC
          const _dataNFT = [owner1.address, 23456, true, false, false, 0, 0]
          expect(await greenBitcoin.dataNFT(23456)).to.deep.equal(_dataNFT)     
        }     
      });      


      it("GreenBTC Test: authMintGreenBTCWithARTBatch", async () => {
        await arkreenRECBank.addNewART( arkreenRECToken.address,  maker1.address)
        await arkreenRECBank.addNewART( arkreenRECTokenESG.address,  maker2.address)  
        
        await arkreenRECBank.connect(maker1).depositART( arkreenRECToken.address,  expandTo9Decimals(5000))
        await arkreenRECBank.connect(maker2).depositART( arkreenRECTokenESG.address,  expandTo9Decimals(5000))

        await arkreenRECToken.setClimateBuilder(arkreenBuilder.address)
        await arkreenRECTokenESG.setClimateBuilder(arkreenBuilder.address)

        const badgeInfo =  {
          beneficiary:    owner1.address,
          offsetEntityID: 'Owner1',
          beneficiaryID:  'Tester',
          offsetMessage:  "Just Testing"
        }    

        const greenBTCInfo1: GreenBTCInfo = {
          height:     BigNumber.from(12345),
          ARTCount:   expandTo9Decimals(12),  // 12 HART
          minter:     owner2.address,
          greenType:  0x12,
          blockTime:  'Apr 11, 2009 10:25 PM UTC',
          energyStr:  '12.234 MWh'
        }

        const greenBTCInfo2: GreenBTCInfo = {
          height:     BigNumber.from(23456),
          ARTCount:   expandTo9Decimals(23),  // 12 HART
          minter:     owner2.address,
          greenType:  0x12,
          blockTime:  'Apr 12, 2009 10:25 PM UTC',
          energyStr:  '23.234 MWh'
        }

        const greenBTCInfo3: GreenBTCInfo = {
          height:     BigNumber.from(34567),
          ARTCount:   expandTo9Decimals(34),  // 12 HART
          minter:     owner2.address,
          greenType:  0x12,
          blockTime:  'Apr 13, 2009 10:25 PM UTC',
          energyStr:  '34.234 MWh'
        }

        const amountART = expandTo9Decimals(12)
        const artTokenESGBefore = await arkreenRECTokenESG.balanceOf(owner1.address) 
        const artTokenESGBeforeGBTC = await arkreenRECTokenESG.balanceOf(greenBitcoin.address) 

        // const receiver = owner1.address
        const register_digest = getGreenBitcoinDigestBatch(
                        'Green BTC Club',
                        greenBitcoin.address,
                        [greenBTCInfo1, greenBTCInfo2, greenBTCInfo3]
                      )
  
        const {v,r,s} = ecsign( Buffer.from(register_digest.slice(2), 'hex'), 
                                              Buffer.from(privateKeyRegister.slice(2), 'hex'))           

        await arkreenBuilder.mangeTrustedForwarder(greenBitcoin.address, true)

        // Error: Check dealine
        const dealineBlock = await ethers.provider.getBlock('latest')
        await expect(greenBitcoin.connect(owner1).authMintGreenBTCWithARTBatch( [greenBTCInfo1, greenBTCInfo2, greenBTCInfo3], {v,r,s}, 
                                          badgeInfo, arkreenRECTokenESG.address, dealineBlock.timestamp-1 ))
                    .to.be.revertedWith("GBTC: EXPIRED")    

        // Error: Check ART is whitelisted
        await expect(greenBitcoin.connect(owner1).authMintGreenBTCWithARTBatch( [greenBTCInfo1, greenBTCInfo2, greenBTCInfo3], {v,r,s},
                                          badgeInfo, arkreenRECTokenESG.address, constants_MaxDealine ))
                    .to.be.revertedWith("GBTC: ART Not Accepted")    
        
        await greenBitcoin.mangeARTTokens([arkreenRECToken.address, arkreenRECTokenESG.address], true)   
        
        // Error: Check signature of Green Bitcoin info      
        await expect(greenBitcoin.connect(owner1).authMintGreenBTCWithARTBatch( [greenBTCInfo1, greenBTCInfo2, greenBTCInfo3], {v,r:s,s},
                                          badgeInfo, arkreenRECTokenESG.address, constants_MaxDealine ))
                    .to.be.revertedWith("GBTC: Invalid Singature")    
        /*
        // Error: Check ART Type
        greenBTCInfo1.greenType = 0x02
        await expect(greenBitcoin.connect(owner1).authMintGreenBTCWithARTBatch( [greenBTCInfo1, greenBTCInfo2, greenBTCInfo3], {v,r,s},
                                          badgeInfo, arkreenRECTokenESG.address, constants_MaxDealine ))
                    .to.be.revertedWith("GBTC: Wrong ART Type")    

        greenBTCInfo1.greenType = 0x12      
        */
        // Error: user need to approve greenBitcoin
        await expect(greenBitcoin.connect(owner1).authMintGreenBTCWithARTBatch( [greenBTCInfo1, greenBTCInfo2, greenBTCInfo3], {v,r,s}, 
                                                    badgeInfo, arkreenRECTokenESG.address, constants_MaxDealine ))
                    .to.be.revertedWith("TransferHelper: TRANSFER_FROM_FAILED")   
                    
        await arkreenRECTokenESG.connect(owner1).approve(greenBitcoin.address, constants.MaxUint256)  
        
        // Error: approveBuilder need to approve greenBitcoin
        await expect(greenBitcoin.connect(owner1).authMintGreenBTCWithARTBatch( [greenBTCInfo1, greenBTCInfo2, greenBTCInfo3], {v,r,s}, 
                                                    badgeInfo, arkreenRECTokenESG.address, constants_MaxDealine ))
                    .to.be.revertedWith("TransferHelper: TRANSFER_FROM_FAILED")   

        await greenBitcoin.approveBuilder([arkreenRECToken.address, arkreenRECTokenESG.address])

        const overAllARTToPay = expandTo9Decimals(12+23+34)
        const paymentByGreenBTC = expandTo9Decimals(12+23+34).mul(100).div(95)  
        

        // Normal: authMintGreenBTCWithARTBatch   
        /*
        const tx = await greenBitcoin.connect(owner1).authMintGreenBTCWithARTBatch( [greenBTCInfo1, greenBTCInfo2, greenBTCInfo3], {v,r,s}, 
                  badgeInfo, arkreenRECTokenESG.address, constants_MaxDealine )

        const receipt = await tx.wait()
     
        console.log("AAAAAAAAAAAA", tx, receipt, receipt.events![0], receipt.events![1], receipt.events![2], receipt.events![3])

        for(let index=0; index < receipt.events!.length; index++) {
          console.log("BBBBBBBBBBBBB", index, index, receipt.events![index])
        }

        console.log("CCCCCCCCCCCCCCCCCC", owner1.address, arkreenRECTokenESG.address, greenBitcoin.address, arkreenBuilder.address, fund_receiver.address)
        */
        await expect(greenBitcoin.connect(owner1).authMintGreenBTCWithARTBatch( [greenBTCInfo1, greenBTCInfo2, greenBTCInfo3], {v,r,s}, 
                                                    badgeInfo, arkreenRECTokenESG.address, constants_MaxDealine ))
                      .to.emit(arkreenRECTokenESG, 'Transfer')
                      .withArgs(owner1.address, greenBitcoin.address, paymentByGreenBTC)
                      .to.emit(arkreenRECTokenESG, 'Transfer')
                      .withArgs(greenBitcoin.address, arkreenBuilder.address, paymentByGreenBTC)                                                       
                      .to.emit(arkreenRECTokenESG, 'Transfer')
                      .withArgs(arkreenBuilder.address, constants.AddressZero, overAllARTToPay)
                      .to.emit(arkreenRECTokenESG, "Transfer")
                      .withArgs(arkreenBuilder.address, fund_receiver.address, paymentByGreenBTC.sub(overAllARTToPay))   
                      .to.emit(greenBitcoin, 'Transfer')
                      .withArgs(constants.AddressZero, owner2.address, 12345)                                                 
                      .to.emit(greenBitcoin, 'GreenBitCoin')
                      .withArgs(12345, expandTo9Decimals(12), owner2.address, 0x12)
                      .to.emit(greenBitcoin, 'Transfer')
                      .withArgs(constants.AddressZero, owner2.address, 23456)                                                 
                      .to.emit(greenBitcoin, 'GreenBitCoin')
                      .withArgs(23456, expandTo9Decimals(23), owner2.address, 0x12)    
                      .to.emit(greenBitcoin, 'Transfer')
                      .withArgs(constants.AddressZero, owner2.address, 34567)                                                 
                      .to.emit(greenBitcoin, 'GreenBitCoin')
                      .withArgs(34567, expandTo9Decimals(34), owner2.address, 0x12)      

        const lastBlock = await ethers.provider.getBlock('latest')

        const tokenID = await arkreenRECIssuance.totalSupply()              // should be arkreenRECIssuance
        expect(await arkreenRetirement.totalSupply()).to.deep.equal(1)
        expect(await arkreenRetirement.offsetCounter()).to.deep.equal(1)

        const amountART1 = expandTo9Decimals(12+23+34)

        const actionID1 = 1
        const action1 = [  owner1.address, maker1.address, amountART1,                // Manger is the issuer address
                          tokenID.add(MASK_OFFSET), lastBlock.timestamp, true ]       // Offset action is claimed
        expect(await arkreenRetirement.getOffsetActions(actionID1)).to.deep.equal(action1)

        const offsetRecord1 = [owner1.address, owner1.address, "Owner1", "Tester", "Just Testing", 
                              BigNumber.from(lastBlock.timestamp), amountART1, [actionID1]]
        const badgeID1 = 1                            
        expect(await arkreenRetirement.getCertificate(badgeID1)).to.deep.equal(offsetRecord1)

        expect(await arkreenRECTokenESG.balanceOf(owner1.address)).to.equal(artTokenESGBefore.sub(paymentByGreenBTC))
        expect(await arkreenRECTokenESG.balanceOf(greenBitcoin.address)).to.equal(artTokenESGBeforeGBTC)

        // Check dataGBTC
        const _dataGBTC1 = [ BigNumber.from(12345), expandTo9Decimals(12), owner2.address, 0x12,
                            'Apr 11, 2009 10:25 PM UTC', '12.234 MWh']

        expect(await greenBitcoin.dataGBTC(12345)).to.deep.equal(_dataGBTC1)

        // Check dataGBTC
        const _dataNFT1 = [constants.AddressZero, 12345, false, false, false, 0, 0]
        expect(await greenBitcoin.dataNFT(12345)).to.deep.equal(_dataNFT1)

        // Check NFT ID and owner
        expect(await greenBitcoin.ownerOf(12345)).to.equal(owner2.address)

        // Check dataGBTC
        const _dataGBTC3 = [ BigNumber.from(34567), expandTo9Decimals(34), owner2.address, 0x12,
                            'Apr 13, 2009 10:25 PM UTC', '34.234 MWh']

        expect(await greenBitcoin.dataGBTC(34567)).to.deep.equal(_dataGBTC3)

        // Check dataGBTC
        const _dataNFT3 = [constants.AddressZero, 34567, false, false, false, 0, 0]
        expect(await greenBitcoin.dataNFT(34567)).to.deep.equal(_dataNFT3)

        // Check NFT ID and owner
        expect(await greenBitcoin.ownerOf(34567)).to.equal(owner2.address)

        // Error: authMintGreenBTCWithARTBatch      
        {
          const greenBTCInfo: GreenBTCInfo=  {
            height:     BigNumber.from(12345),
            ARTCount:   expandTo9Decimals(45),  // 12 HART
            minter:     owner2.address,
            greenType:  0x12,
            blockTime:  'Apr 14, 2009 10:25 PM UTC',
            energyStr:  '45.234 MWh'
          }

          // const receiver = owner1.address
          const register_digest = getGreenBitcoinDigestBatch(
                          'Green BTC Club',
                          greenBitcoin.address,
                          [greenBTCInfo]
                        )
    
          const {v,r,s} = ecsign( Buffer.from(register_digest.slice(2), 'hex'), 
                                                Buffer.from(privateKeyRegister.slice(2), 'hex'))  

          await arkreenRECToken.connect(owner1).approve(greenBitcoin.address, constants.MaxUint256)  
          await expect(greenBitcoin.connect(owner1).authMintGreenBTCWithARTBatch( [greenBTCInfo], {v,r,s}, 
                                                    badgeInfo, arkreenRECToken.address, constants_MaxDealine))
                      .to.be.revertedWith("GBTC: Already Minted")       

        } 

        // Error: authMintGreenBTCWithARTBatch      
        {
          const greenBTCInfo: GreenBTCInfo=  {
            height:     BigNumber.from(45678),
            ARTCount:   expandTo9Decimals(45),  // 12 HART
            minter:     owner2.address,
            greenType:  0x02,
            blockTime:  'Apr 14, 2009 10:25 PM UTC',
            energyStr:  '45.234 MWh'
          }

          // const receiver = owner1.address
          const register_digest = getGreenBitcoinDigestBatch(
                          'Green BTC Club',
                          greenBitcoin.address,
                          [greenBTCInfo]
                        )
    
          const {v,r,s} = ecsign( Buffer.from(register_digest.slice(2), 'hex'), 
                                                Buffer.from(privateKeyRegister.slice(2), 'hex'))  
        
          await arkreenRECToken.connect(owner1).approve(greenBitcoin.address, constants.MaxUint256)  
          await expect(greenBitcoin.connect(owner1).authMintGreenBTCWithARTBatch( [greenBTCInfo], {v,r,s}, 
                                                    badgeInfo, arkreenRECToken.address, constants_MaxDealine))
                      .to.be.revertedWith("GBTC: Wrong ART Type")       

        } 
        
        // Normal: authMintGreenBTCWithARTBatch: arkreenRECToken   
        {
          const greenBTCInfo: GreenBTCInfo=  {
            height:     BigNumber.from(45678),
            ARTCount:   expandTo9Decimals(45),  // 12 HART
            minter:     owner2.address,
            greenType:  0x12,
            blockTime:  'Apr 14, 2009 10:25 PM UTC',
            energyStr:  '45.234 MWh'
          }

          // const receiver = owner1.address
          const register_digest = getGreenBitcoinDigestBatch(
                          'Green BTC Club',
                          greenBitcoin.address,
                          [greenBTCInfo]
                        )
    
          const {v,r,s} = ecsign( Buffer.from(register_digest.slice(2), 'hex'), 
                                                Buffer.from(privateKeyRegister.slice(2), 'hex'))  

          const artTokenESGBefore = await arkreenRECToken.balanceOf(owner1.address) 
          await arkreenRECToken.connect(owner1).approve(greenBitcoin.address, constants.MaxUint256)  
          await greenBitcoin.connect(owner1).authMintGreenBTCWithARTBatch( [greenBTCInfo], {v,r,s}, 
                                                      badgeInfo, arkreenRECToken.address, constants_MaxDealine )     

          expect(await arkreenRECToken.balanceOf(owner1.address)).to.equal(artTokenESGBefore.sub(expandTo9Decimals(45).mul(100).div(95)))                                                      
        }
             
        
        // Normal: authMintGreenBTCWithARTBatch: arkreenRECToken: Gasfee
        {
          let greenBTCInfo1: GreenBTCInfo=  {
            height:     BigNumber.from(56789),
            ARTCount:   expandTo9Decimals(45),  // 12 HART
            minter:     owner2.address,
            greenType:  0x12,
            blockTime:  'Apr 14, 2009 10:25 PM UTC',
            energyStr:  '45.234 MWh'
          }

          let greenBTCInfo2 = { ...greenBTCInfo1 };
          greenBTCInfo2.height = greenBTCInfo1.height.add(2)

          let greenBTCInfo3 = { ...greenBTCInfo1 };
          greenBTCInfo3.height = greenBTCInfo1.height.add(3)

          let greenBTCInfo4 = { ...greenBTCInfo1 };
          greenBTCInfo4.height = greenBTCInfo1.height.add(4)

          let greenBTCInfo5 = { ...greenBTCInfo1 };
          greenBTCInfo5.height = greenBTCInfo1.height.add(5)

          let greenBTCInfo6 = { ...greenBTCInfo1 };
          greenBTCInfo6.height = greenBTCInfo1.height.add(6)

          let greenBTCInfo7 = { ...greenBTCInfo1 };
          greenBTCInfo7.height = greenBTCInfo1.height.add(7)
          
          let greenBTCInfo8 = { ...greenBTCInfo1 };
          greenBTCInfo8.height = greenBTCInfo1.height.add(8)
          
          let greenBTCInfo9 = { ...greenBTCInfo1 };
          greenBTCInfo9.height = greenBTCInfo1.height.add(9)
          
          let greenBTCInfo10 = { ...greenBTCInfo1 };
          greenBTCInfo10.height = greenBTCInfo1.height.add(10)          

          // const receiver = owner1.address
          const register_digest = getGreenBitcoinDigestBatch(
                          'Green BTC Club',
                          greenBitcoin.address,
                          [ greenBTCInfo1, greenBTCInfo2, greenBTCInfo3, greenBTCInfo4, greenBTCInfo5,
                            greenBTCInfo6, greenBTCInfo7, greenBTCInfo8, greenBTCInfo9, greenBTCInfo10]
                        )
    
          const {v,r,s} = ecsign( Buffer.from(register_digest.slice(2), 'hex'), 
                                                Buffer.from(privateKeyRegister.slice(2), 'hex'))  

          await arkreenRECToken.connect(owner1).approve(greenBitcoin.address, constants.MaxUint256)  

          const tx = await greenBitcoin.connect(owner1).authMintGreenBTCWithARTBatch( 
              [ greenBTCInfo1, greenBTCInfo2, greenBTCInfo3, greenBTCInfo4, greenBTCInfo5,
                greenBTCInfo6, greenBTCInfo7, greenBTCInfo8, greenBTCInfo9, greenBTCInfo10], 
                {v,r,s}, badgeInfo, arkreenRECToken.address, constants_MaxDealine )  
           
          const receipt = await tx.wait()
          console.log("Gas used of authMintGreenBTCWithARTBatch of 10 items", receipt.gasUsed)
          // expect(receipt.gasUsed).to.eq("3027978")          // 10: 7169162 (Multiple Badge), 3027934(Single Badge) 3027978 302800
        } 
        
        // Normal: authMintGreenBTCWithARTBatch(Open): arkreenRECToken: Gasfee
        {
          let greenBTCInfoArray = new Array<GreenBTCInfo>(20)
          for( let index = 0; index < greenBTCInfoArray.length; index++) {
            greenBTCInfoArray[index]=  {
              height:     BigNumber.from(67890).add(index),
              ARTCount:   expandTo9Decimals(12),  // 12 HART
              minter:     owner1.address,
              greenType:  0x12,
              blockTime:  'Apr 14, 2009 10:25 PM UTC',
              energyStr:  '45.234 MWh'
            }
          }

          // const receiver = owner1.address
          const register_digest = getGreenBitcoinDigestBatch(
                          'Green BTC Club',
                          greenBitcoin.address, greenBTCInfoArray
                        )
    
          const {v,r,s} = ecsign( Buffer.from(register_digest.slice(2), 'hex'), 
                                                Buffer.from(privateKeyRegister.slice(2), 'hex'))  

          await arkreenRECToken.connect(owner1).approve(greenBitcoin.address, constants.MaxUint256)  

          const tx = await greenBitcoin.connect(owner1).authMintGreenBTCWithARTBatch( 
                            greenBTCInfoArray, {v,r,s}, badgeInfo, arkreenRECToken.address, constants_MaxDealineAndOpen )  

          const receipt = await tx.wait()
          console.log("Gas used of authMintGreenBTCWithARTBatch(Open) of 20 items", receipt.gasUsed)
          //expect(receipt.gasUsed).to.eq("5950804")        // 20: 14169028(Multiple Badge), 5950760(Single Badge)

          const _dataNFT1 = [owner1.address, 67890, true, false, false, 0, 0]
          expect(await greenBitcoin.dataNFT(67890)).to.deep.equal(_dataNFT1)

          const _dataNFTX = [owner1.address, 67890+19, true, false, false, 0, 0]
          expect(await greenBitcoin.dataNFT(67890+19)).to.deep.equal(_dataNFTX)       
        } 
      });   
         
      it("GreenBTC Test: authMintGreenBTCWithNative", async () => {
        await arkreenRECBank.addNewART( arkreenRECToken.address,  maker1.address)
        await arkreenRECBank.addNewART( arkreenRECTokenESG.address,  maker2.address)  
        
        await arkreenRECBank.connect(maker1).depositART( arkreenRECToken.address,  expandTo9Decimals(5000))
        await arkreenRECBank.connect(maker2).depositART( arkreenRECTokenESG.address,  expandTo9Decimals(5000))

        await arkreenRECToken.setClimateBuilder(arkreenBuilder.address)
        await arkreenRECTokenESG.setClimateBuilder(arkreenBuilder.address)

        const badgeInfo =  {
          beneficiary:    owner1.address,
          offsetEntityID: 'Owner1',
          beneficiaryID:  'Tester',
          offsetMessage:  "Just Testing"
        }    

        const greenBTCInfo =  {
            height: BigNumber.from(12345),
            ARTCount: expandTo9Decimals(12),  // 12 HART
            minter: owner2.address,
            greenType: 1,
            blockTime: 'Apr 26, 2009 10:25 PM UTC',
            energyStr: '12.234 MWh'
        }

        await arkreenRECBank.connect(maker2).changeSalePrice( arkreenRECTokenESG.address, WETH.address, expandTo18Decimals(2)) // 2 MATIC   

        const amountART = expandTo9Decimals(12)

        const ARECBefore = await arkreenRECTokenESG.balanceOf(arkreenRECBank.address) 
        const WMATICBefore = await WETH.balanceOf(greenBitcoin.address) 

        // const receiver = owner1.address
        const register_digest = getGreenBitcoinDigest(
                        'Green BTC Club',
                        greenBitcoin.address,
                        { height:       greenBTCInfo.height,
                          energyStr:    greenBTCInfo.energyStr,
                          artCount:     greenBTCInfo.ARTCount,
                          blockTime:    greenBTCInfo.blockTime,
                          minter:       greenBTCInfo.minter,
                          greenType:    greenBTCInfo.greenType
                        }
                      )
  
        const {v,r,s} = ecsign( Buffer.from(register_digest.slice(2), 'hex'), 
                                              Buffer.from(privateKeyRegister.slice(2), 'hex'))           

        await arkreenBuilder.mangeTrustedForwarder(greenBitcoin.address, true)

        // Error: Check dealine
        const dealineBlock = await ethers.provider.getBlock('latest')
        await expect(greenBitcoin.connect(owner1).authMintGreenBTCWithNative( greenBTCInfo, {v,r,s}, 
                                          badgeInfo, dealineBlock.timestamp-1, {value: expandTo18Decimals(24)}))
                    .to.be.revertedWith("GBTC: EXPIRED")    

        // Error: Check signature of Green Bitcoin info      
        await expect(greenBitcoin.connect(owner1).authMintGreenBTCWithNative( greenBTCInfo, {v,r:s,s},
                                          badgeInfo, constants_MaxDealine, {value: expandTo18Decimals(24)}))
                    .to.be.revertedWith("GBTC: Invalid Singature")    

        // Error: More ART required, so pay less
        await expect(greenBitcoin.connect(owner1).authMintGreenBTCWithNative( greenBTCInfo, {v,r,s}, 
                                                    badgeInfo, constants_MaxDealine, {value: expandTo18Decimals(24).sub(1)}))
                  .to.be.revertedWith("ARBK: Get Less")         //    ARBK: Get Less   
        //        .to.be.revertedWith("ARBK: Pay Less")         

        // Normal: authMintGreenBTCWithNative   
        
        // console.log('DDDDDDDDDDDDDDDDD', owner1.address, greenBitcoin.address, arkreenBuilder.address)
        // const resp = await greenBitcoin.connect(owner1).authMintGreenBTCWithNative( greenBTCInfo, {v,r,s}, 
        //                               badgeInfo, constants_MaxDealine, {value: expandTo18Decimals(24).mul(100).div(95)})        
        // const receipt = await resp.wait()
//
        // console.log('DDDDDDDDDDDDDDDDD', resp, receipt)
//
        // console.log("AAAAAAAAAAAA", receipt, receipt.events![0], receipt.events![1], receipt.events![2], receipt.events![3])
        // console.log("BBBBBBBBBBBB", receipt.events![0], receipt.events![1], receipt.events![2], receipt.events![3])
        // console.log("CCCCCCCCCCCCC", receipt.events![4], receipt.events![5],receipt.events![6], receipt.events![7])
        // console.log("DDDDDDDDDDDDD", receipt.events![8], receipt.events![9],receipt.events![10], receipt.events![11])
        // console.log("EEEEEEEEEEEEEE", WETH.address, arkreenRECBank.address, greenBitcoin.address, arkreenRECTokenESG.address, arkreenBuilder.address, fund_receiver.address)
//
        await expect(greenBitcoin.connect(owner1).authMintGreenBTCWithNative( greenBTCInfo, {v,r,s}, 
                                                    badgeInfo, constants_MaxDealine, {value: expandTo18Decimals(24).mul(100).div(95)}))
                      .to.emit(WETH, 'Transfer')
                      .withArgs(greenBitcoin.address, arkreenBuilder.address, expandTo18Decimals(24).mul(100).div(95))                             
                      .to.emit(arkreenRECBank, 'ARTSold')
                      .withArgs(arkreenRECTokenESG.address, WETH.address, expandTo9Decimals(12).mul(100).div(95), expandTo18Decimals(24).mul(100).div(95))   
                      .to.emit(arkreenRECTokenESG, 'Transfer')
                      .withArgs(arkreenBuilder.address, constants.AddressZero, amountART)
                      .to.emit(arkreenRECTokenESG, "Transfer")
                      .withArgs(arkreenBuilder.address, fund_receiver.address, amountART.mul(5).div(95))   
                      .to.emit(greenBitcoin, 'Transfer')
                      .withArgs(constants.AddressZero, owner2.address, 12345)                                                 
                      .to.emit(greenBitcoin, 'GreenBitCoin')
                      .withArgs(12345, expandTo9Decimals(12), owner2.address, 1)      

        const actionID =1     
        const lastBlock = await ethers.provider.getBlock('latest')
        
        const tokenID = await arkreenRECIssuance.totalSupply()
        const action = [  owner1.address, maker1.address, amountART,                // Manger is the issuer address
                          tokenID.add(MASK_OFFSET), lastBlock.timestamp, true ]     // Offset action is claimed
        expect(await arkreenRetirement.getOffsetActions(actionID)).to.deep.equal(action)

        const offsetRecord = [owner1.address, owner1.address, "Owner1", "Tester", "Just Testing", 
                              BigNumber.from(lastBlock.timestamp), amountART, [actionID]]
        const badgeID = 1                            
        expect(await arkreenRetirement.getCertificate(badgeID)).to.deep.equal(offsetRecord)

        expect(await arkreenRECTokenESG.balanceOf(arkreenRECBank.address)).to.equal(ARECBefore.sub(expandTo9Decimals(12).mul(100).div(95)))
        expect(await WETH.balanceOf(greenBitcoin.address)).to.equal(WMATICBefore)

        // Check dataGBTC
        const _dataGBTC = [ BigNumber.from(12345), expandTo9Decimals(12), owner2.address, 1,
                            'Apr 26, 2009 10:25 PM UTC', '12.234 MWh']

        expect(await greenBitcoin.dataGBTC(12345)).to.deep.equal(_dataGBTC)

        // Check dataGBTC
        const _dataNFT = [constants.AddressZero, 12345, false, false, false, 0, 0]
        expect(await greenBitcoin.dataNFT(12345)).to.deep.equal(_dataNFT)

        // Check NFT ID and owner
        expect(await greenBitcoin.ownerOf(12345)).to.equal(owner2.address)

        // Error: authMintGreenBTCWithNative                     
        await expect(greenBitcoin.connect(owner1).authMintGreenBTCWithNative( greenBTCInfo, {v,r,s}, 
                                                    badgeInfo, constants_MaxDealine))
                      .to.be.revertedWith("GBTC: Already Minted")      
                      
        // Buy and Open    
        {                 
          const greenBTCInfo =  {
              height: BigNumber.from(23456),
              ARTCount: expandTo9Decimals(23),  // 12 HART
              minter: owner1.address,
              greenType: 1,
              blockTime: 'Apr 26, 2009 10:25 PM UTC',
              energyStr: '23.234 MWh'
          }

          // const receiver = owner1.address
          const register_digest = getGreenBitcoinDigest(
                          'Green BTC Club',
                          greenBitcoin.address,
                          { height:       greenBTCInfo.height,
                            energyStr:    greenBTCInfo.energyStr,
                            artCount:     greenBTCInfo.ARTCount,
                            blockTime:    greenBTCInfo.blockTime,
                            minter:       owner1.address,
                            greenType:    greenBTCInfo.greenType
                          }
                        )
    
          const {v,r,s} = ecsign( Buffer.from(register_digest.slice(2), 'hex'), 
                                                Buffer.from(privateKeyRegister.slice(2), 'hex'))  

          await greenBitcoin.connect(owner1).authMintGreenBTCWithNative( greenBTCInfo, {v,r,s}, 
                                                    badgeInfo, constants_MaxDealineAndOpen, {value: expandTo18Decimals(46).mul(100).div(95)})

          // Check dataGBTC
          const _dataNFT = [owner1.address, 23456, true, false, false, 0, 0]
          expect(await greenBitcoin.dataNFT(23456)).to.deep.equal(_dataNFT)        
        }

      })


      it("GreenBTC Test: authMintGreenBTCWithApprove", async () => {

        await arkreenRECBank.addNewART( arkreenRECToken.address,  maker1.address)
        await arkreenRECBank.addNewART( arkreenRECTokenESG.address,  maker2.address)  
        
        await arkreenRECBank.connect(maker1).depositART( arkreenRECToken.address,  expandTo9Decimals(5000))
        await arkreenRECBank.connect(maker2).depositART( arkreenRECTokenESG.address,  expandTo9Decimals(5000))

        await arkreenRECToken.setClimateBuilder(arkreenBuilder.address)
        await arkreenRECTokenESG.setClimateBuilder(arkreenBuilder.address)

        const badgeInfo =  {
          beneficiary:    owner1.address,
          offsetEntityID: 'Owner1',
          beneficiaryID:  'Tester',
          offsetMessage:  "Just Testing"
        }    

        const greenBTCInfo =  {
            height: BigNumber.from(12345),
            ARTCount: expandTo9Decimals(12),  // 12 HART
            minter: owner2.address,
            greenType: 1,
            blockTime: 'Apr 26, 2009 10:25 PM UTC',
            energyStr: '12.234 MWh'
        }

        await AKREToken.approve(arkreenBuilder.address, constants.MaxUint256)    
          
        await arkreenRECBank.connect(maker2).changeSalePrice( arkreenRECTokenESG.address, AKREToken.address, expandTo18Decimals(10))

        const amountPay = expandTo18Decimals(200).mul(100).div(95)
        const amountART = expandTo9Decimals(20)

        const ARECBefore = await arkreenRECTokenESG.balanceOf(owner1.address)                    

        // const receiver = owner1.address
        const register_digest = getGreenBitcoinDigest(
                        'Green BTC Club',
                        greenBitcoin.address,
                        { height:       greenBTCInfo.height,
                          energyStr:    greenBTCInfo.energyStr,
                          artCount:     greenBTCInfo.ARTCount,
                          blockTime:    greenBTCInfo.blockTime,
                          minter:       greenBTCInfo.minter,
                          greenType:    greenBTCInfo.greenType
                        }
                      )
  
        const {v,r,s} = ecsign( Buffer.from(register_digest.slice(2), 'hex'), 
                                              Buffer.from(privateKeyRegister.slice(2), 'hex'))           

        await arkreenBuilder.mangeTrustedForwarder(greenBitcoin.address, true)

        // Error: Check dealine
        const dealineBlock = await ethers.provider.getBlock('latest')
        
        await expect(greenBitcoin.connect(owner1).authMintGreenBTCWithApprove( greenBTCInfo, {v,r,s}, badgeInfo, 
                                            {token: AKREToken.address, amount: amountPay}, dealineBlock.timestamp-1))
                    .to.be.revertedWith("GBTC: EXPIRED")

        // Error: Check signature of Green Bitcoin info                    
        await expect(greenBitcoin.connect(owner1).authMintGreenBTCWithApprove( greenBTCInfo, {v,r:s,s}, badgeInfo, 
                                            {token: AKREToken.address, amount: amountPay}, constants_MaxDealine))
                    .to.be.revertedWith("GBTC: Invalid Singature")    

        // Error: Should approved before
        await expect(greenBitcoin.connect(owner1).authMintGreenBTCWithApprove( greenBTCInfo, {v,r,s}, badgeInfo, 
                                            {token: AKREToken.address, amount: amountPay}, constants_MaxDealine))
                    .to.be.revertedWith("TransferHelper: TRANSFER_FROM_FAILED")

        await AKREToken.connect(owner1).approve(greenBitcoin.address, constants.MaxUint256)     

        // Error: More ART required, so pay less
        const amountRealPay = expandTo18Decimals(120).mul(100).div(95)
        await expect(greenBitcoin.connect(owner1).authMintGreenBTCWithApprove( greenBTCInfo, {v,r,s}, badgeInfo, 
                                            { token: AKREToken.address, 
                                              amount: amountRealPay.sub(1).sub(amountRealPay.mod(expandTo9Decimals(10)))
                                            }, 
                                              constants_MaxDealine))
                    .to.be.revertedWith("ARBK: Pay Less")           // ARBK: Get Less            

        // Normal: authMintGreenBTCWithApprove                     
        await greenBitcoin.connect(owner1).authMintGreenBTCWithApprove( greenBTCInfo, {v,r,s}, badgeInfo, 
                                            {token: AKREToken.address, amount: amountPay}, constants_MaxDealine)   

        const actionID =1     
        const lastBlock = await ethers.provider.getBlock('latest')
        
        const tokenID = await arkreenRECIssuance.totalSupply()
        const action = [  owner1.address, maker1.address, expandTo9Decimals(12),                // Manger is the issuer address
                          tokenID.add(MASK_OFFSET), lastBlock.timestamp, true ]     // Offset action is claimed
        expect(await arkreenRetirement.getOffsetActions(actionID)).to.deep.equal(action)

        const offsetRecord = [owner1.address, owner1.address, "Owner1", "Tester", "Just Testing", 
                              BigNumber.from(lastBlock.timestamp), expandTo9Decimals(12), [actionID]]
        const badgeID = 1                            
        expect(await arkreenRetirement.getCertificate(badgeID)).to.deep.equal(offsetRecord)
        expect(await arkreenRECTokenESG.balanceOf(owner1.address)).to.equal(ARECBefore)

        // Check Badge owner
        expect(await arkreenRetirement.ownerOf(badgeID)).to.equal(owner1.address)

        // Check dataGBTC
        const _dataGBTC = [ BigNumber.from(12345), expandTo9Decimals(12), owner2.address, 1,
                            'Apr 26, 2009 10:25 PM UTC', '12.234 MWh']

        expect(await greenBitcoin.dataGBTC(12345)).to.deep.equal(_dataGBTC)

        // Check dataGBTC
        const _dataNFT = [constants.AddressZero, 12345, false, false, false, 0, 0]
        expect(await greenBitcoin.dataNFT(12345)).to.deep.equal(_dataNFT)

        // Check NFT ID and owner
        expect(await greenBitcoin.ownerOf(12345)).to.equal(owner2.address)

        // Error: authMintGreenBTCWithApprove                     
        await expect(greenBitcoin.connect(owner1).authMintGreenBTCWithApprove( greenBTCInfo, {v,r,s}, badgeInfo, 
                                            {token: AKREToken.address, amount: amountPay}, constants_MaxDealine))
                      .to.be.revertedWith("GBTC: Already Minted")   
                      
                      
        // Buy and open                      
        {
          const greenBTCInfo =  {
            height: BigNumber.from(23456),
            ARTCount: expandTo9Decimals(23),  // 23 HART
            minter: owner1.address,
            greenType: 1,
            blockTime: 'Apr 26, 2009 10:25 PM UTC',
            energyStr: '23.234 MWh'
          }
          
          const amountPay = expandTo18Decimals(230).mul(100).div(95)

          // const receiver = owner1.address
          const register_digest = getGreenBitcoinDigest(
                          'Green BTC Club',
                          greenBitcoin.address,
                          { height:       greenBTCInfo.height,
                            energyStr:    greenBTCInfo.energyStr,
                            artCount:     greenBTCInfo.ARTCount,
                            blockTime:    greenBTCInfo.blockTime,
                            minter:       owner1.address,
                            greenType:    greenBTCInfo.greenType
                          }
                        )

          const {v,r,s} = ecsign( Buffer.from(register_digest.slice(2), 'hex'), 
                                                Buffer.from(privateKeyRegister.slice(2), 'hex'))  

          // Error: authMintGreenBTCWithApprove                     
          await greenBitcoin.connect(owner1).authMintGreenBTCWithApprove( greenBTCInfo, {v,r,s}, badgeInfo, 
                                  {token: AKREToken.address, amount: amountPay}, constants_MaxDealineAndOpen)

          // Check dataGBTC
          const _dataNFT = [owner1.address, 23456, true, false, false, 0, 0]
          expect(await greenBitcoin.dataNFT(23456)).to.deep.equal(_dataNFT)    
        }                      
      });

      it("GreenBTC Test: authMintGreenBTCWithApproveBatch", async () => {

        await arkreenRECBank.addNewART( arkreenRECToken.address,  maker1.address)
        await arkreenRECBank.addNewART( arkreenRECTokenESG.address,  maker2.address)  
        
        await arkreenRECBank.connect(maker1).depositART( arkreenRECToken.address,  expandTo9Decimals(5000))
        await arkreenRECBank.connect(maker2).depositART( arkreenRECTokenESG.address,  expandTo9Decimals(5000))

        await arkreenRECToken.setClimateBuilder(arkreenBuilder.address)
        await arkreenRECTokenESG.setClimateBuilder(arkreenBuilder.address)

        const badgeInfo =  {
          beneficiary:    owner1.address,
          offsetEntityID: 'Owner1',
          beneficiaryID:  'Tester',
          offsetMessage:  "Just Testing"
        }    

        const greenBTCInfo1: GreenBTCInfo = {
          height:     BigNumber.from(12345),
          ARTCount:   expandTo9Decimals(12),  // 12 HART
          minter:     owner2.address,
          greenType:  1,
          blockTime:  'Apr 11, 2009 10:25 PM UTC',
          energyStr:  '12.234 MWh'
        }

        const greenBTCInfo2: GreenBTCInfo = {
          height:     BigNumber.from(23456),
          ARTCount:   expandTo9Decimals(23),  // 12 HART
          minter:     owner2.address,
          greenType:  1,
          blockTime:  'Apr 12, 2009 10:25 PM UTC',
          energyStr:  '23.234 MWh'
        }

        const greenBTCInfo3: GreenBTCInfo = {
          height:     BigNumber.from(34567),
          ARTCount:   expandTo9Decimals(34),  // 12 HART
          minter:     owner2.address,
          greenType:  1,
          blockTime:  'Apr 13, 2009 10:25 PM UTC',
          energyStr:  '34.234 MWh'
        }

        await AKREToken.approve(arkreenBuilder.address, constants.MaxUint256)    
          
        await arkreenRECBank.connect(maker2).changeSalePrice( arkreenRECTokenESG.address, AKREToken.address, expandTo18Decimals(10))

        const amountPay = expandTo9Decimals(69).mul(100).div(95).mul(expandTo9Decimals(10))  // Must calculate this way
        const amountART = expandTo9Decimals(12+23+34)   //69

        const AKREBefore = await AKREToken.balanceOf(owner1.address)                

        // const receiver = owner1.address
        const register_digest = getGreenBitcoinDigestBatch(
                                'Green BTC Club',
                                greenBitcoin.address,
                                [greenBTCInfo1, greenBTCInfo2, greenBTCInfo3]
        )

        const {v,r,s} = ecsign( Buffer.from(register_digest.slice(2), 'hex'), 
                                              Buffer.from(privateKeyRegister.slice(2), 'hex'))           

        await arkreenBuilder.mangeTrustedForwarder(greenBitcoin.address, true)

        // Error: Check dealine
        const dealineBlock = await ethers.provider.getBlock('latest')
        
        await expect(greenBitcoin.connect(owner1).authMintGreenBTCWithApproveBatch( [greenBTCInfo1, greenBTCInfo2, greenBTCInfo3], 
                                      {v,r,s}, badgeInfo, {token: AKREToken.address, amount: amountPay}, dealineBlock.timestamp-1))
                    .to.be.revertedWith("GBTC: EXPIRED")    

        // Error: Check signature of Green Bitcoin info                    
        await expect(greenBitcoin.connect(owner1).authMintGreenBTCWithApproveBatch( [greenBTCInfo1, greenBTCInfo2, greenBTCInfo3], 
                                      {v,r:s,s}, badgeInfo, {token: AKREToken.address, amount: amountPay}, constants_MaxDealine))
                    .to.be.revertedWith("GBTC: Invalid Singature")    

        await AKREToken.connect(owner1).approve(greenBitcoin.address, constants.MaxUint256)     

        // Normal: authMintGreenBTCWithApproveBatch                     
        await greenBitcoin.connect(owner1).authMintGreenBTCWithApproveBatch( [greenBTCInfo1, greenBTCInfo2, greenBTCInfo3], 
                                      {v,r,s}, badgeInfo, {token: AKREToken.address, amount: amountPay}, constants_MaxDealine)   

        const lastBlock = await ethers.provider.getBlock('latest')

        const tokenID = await arkreenRECIssuance.totalSupply()
        expect(await arkreenRetirement.totalSupply()).to.deep.equal(1)
        expect(await arkreenRetirement.offsetCounter()).to.deep.equal(1)

        const amountART1 = expandTo9Decimals(12+23+34)

        const actionID1 = 1
        const action1 = [  owner1.address, maker1.address, amountART1,                // Manger is the issuer address
                          tokenID.add(MASK_OFFSET), lastBlock.timestamp, true ]     // Offset action is claimed
        expect(await arkreenRetirement.getOffsetActions(actionID1)).to.deep.equal(action1)

        const offsetRecord1 = [owner1.address, owner1.address, "Owner1", "Tester", "Just Testing", 
                              BigNumber.from(lastBlock.timestamp), amountART1, [actionID1]]
        const badgeID1 = 1                            
        expect(await arkreenRetirement.getCertificate(badgeID1)).to.deep.equal(offsetRecord1)

        const AKREAfter = await AKREToken.balanceOf(owner1.address)

        expect(await AKREToken.balanceOf(owner1.address)).to.equal(AKREBefore.sub(amountPay))

        // Check dataGBTC
        const _dataGBTC1 = [ BigNumber.from(12345), expandTo9Decimals(12), owner2.address, 1,
                            'Apr 11, 2009 10:25 PM UTC', '12.234 MWh']

        expect(await greenBitcoin.dataGBTC(12345)).to.deep.equal(_dataGBTC1)

        // Check dataGBTC
        const _dataNFT1 = [constants.AddressZero, 12345, false, false, false, 0, 0]
        expect(await greenBitcoin.dataNFT(12345)).to.deep.equal(_dataNFT1)

        // Check NFT ID and owner
        expect(await greenBitcoin.ownerOf(12345)).to.equal(owner2.address)

        // Check dataGBTC
        const _dataGBTC3 = [ BigNumber.from(34567), expandTo9Decimals(34), owner2.address, 1,
                            'Apr 13, 2009 10:25 PM UTC', '34.234 MWh']

        expect(await greenBitcoin.dataGBTC(34567)).to.deep.equal(_dataGBTC3)

        // Check dataGBTC
        const _dataNFT3 = [constants.AddressZero, 34567, false, false, false, 0, 0]
        expect(await greenBitcoin.dataNFT(34567)).to.deep.equal(_dataNFT3)

        // Check NFT ID and owner
        expect(await greenBitcoin.ownerOf(34567)).to.equal(owner2.address)

        // Error: authMintGreenBTCWithApproveBatch      
        {
          const greenBTCInfo: GreenBTCInfo=  {
            height:     BigNumber.from(12345),
            ARTCount:   expandTo9Decimals(45),  // 12 HART
            minter:     owner2.address,
            greenType:  2,
            blockTime:  'Apr 14, 2009 10:25 PM UTC',
            energyStr:  '45.234 MWh'
          }

          // const receiver = owner1.address
          const register_digest = getGreenBitcoinDigestBatch(
                          'Green BTC Club',
                          greenBitcoin.address,
                          [greenBTCInfo]
                        )
    
   
          const amountPay = expandTo18Decimals(45*10).mul(100).div(95)                   
          const {v,r,s} = ecsign( Buffer.from(register_digest.slice(2), 'hex'), 
                                                Buffer.from(privateKeyRegister.slice(2), 'hex'))  

          await arkreenRECToken.connect(owner1).approve(greenBitcoin.address, constants.MaxUint256)  
          await expect(greenBitcoin.connect(owner1).authMintGreenBTCWithApproveBatch( [greenBTCInfo], {v,r,s}, 
                                                    badgeInfo, {token: AKREToken.address, amount: amountPay}, constants_MaxDealine))
                      .to.be.revertedWith("GBTC: Already Minted")       
        } 

        // Error: authMintGreenBTCWithApproveBatch      
        {
          const greenBTCInfo: GreenBTCInfo=  {
            height:     BigNumber.from(45678),
            ARTCount:   expandTo9Decimals(45),  // 12 HART
            minter:     owner2.address,
            greenType:  0x12,
            blockTime:  'Apr 14, 2009 10:25 PM UTC',
            energyStr:  '45.234 MWh'
          }

          // const receiver = owner1.address
          const register_digest = getGreenBitcoinDigestBatch(
                          'Green BTC Club',
                          greenBitcoin.address,
                          [greenBTCInfo]
                        )
    
          const amountPay = expandTo18Decimals(45*10).mul(100).div(95)
          const {v,r,s} = ecsign( Buffer.from(register_digest.slice(2), 'hex'), 
                                                Buffer.from(privateKeyRegister.slice(2), 'hex'))  
        
          await arkreenRECToken.connect(owner1).approve(greenBitcoin.address, constants.MaxUint256)  
          await expect(greenBitcoin.connect(owner1).authMintGreenBTCWithApproveBatch( [greenBTCInfo], {v,r,s}, 
                                                    badgeInfo, {token: AKREToken.address, amount: amountPay}, constants_MaxDealine))
                      .to.be.revertedWith("GBTC: Wrong ART Type")       

        } 
        // Over Payment: authMintGreenBTCWithApproveBatch
        {
          let greenBTCInfoArray = new Array<GreenBTCInfo>(20)
          for( let index = 0; index < greenBTCInfoArray.length; index++) {
            greenBTCInfoArray[index]=  {
              height:     BigNumber.from(543210).add(index),
              ARTCount:   expandTo9Decimals(12),  // 12 HART
              minter:     owner1.address,
              greenType:  1,
              blockTime:  'Apr 14, 2009 10:25 PM UTC',
              energyStr:  '45.234 MWh'
            }
          }

          // const receiver = owner1.address
          const register_digest = getGreenBitcoinDigestBatch(
                          'Green BTC Club',
                          greenBitcoin.address, greenBTCInfoArray
                        )
    
          const {v,r,s} = ecsign( Buffer.from(register_digest.slice(2), 'hex'), 
                                                Buffer.from(privateKeyRegister.slice(2), 'hex'))  

          await arkreenRECToken.connect(owner1).approve(greenBitcoin.address, constants.MaxUint256)  

          const amountPay = expandTo18Decimals(12*20*10 + 5).mul(100).div(95)

          const arkreBefore = await AKREToken.balanceOf(owner1.address) 
          const arkreGreenBTCBefore = await AKREToken.balanceOf(greenBitcoin.address) 

          const tx = await greenBitcoin.connect(owner1).authMintGreenBTCWithApproveBatch( 
                            greenBTCInfoArray, {v,r,s}, badgeInfo, {token: AKREToken.address, amount: amountPay}, constants_MaxDealine )  

          const receipt = await tx.wait()
          console.log("Gas used of authMintGreenBTCWithApproveBatch of 20 items", receipt.gasUsed)
//        expect(receipt.gasUsed).to.eq("14774178")        // 20: 14193304  14193326       
          
          const arkreAfter = await AKREToken.balanceOf(owner1.address) 
          const arkreGreenBTCAfter = await AKREToken.balanceOf(greenBitcoin.address) 

          const amountPayReal = expandTo9Decimals(12*20).mul(100).div(95).mul(expandTo9Decimals(10))
          expect(arkreAfter).to.eq(arkreBefore.sub(amountPayReal))

        }       
                   
        // Normal: authMintGreenBTCWithApproveBatch: arkreenRECToken: Gasfee
        {
          let greenBTCInfoArray = new Array<GreenBTCInfo>(20)
          for( let index = 0; index < greenBTCInfoArray.length; index++) {
            greenBTCInfoArray[index]=  {
              height:     BigNumber.from(67890).add(index),
              ARTCount:   expandTo9Decimals(12),  // 12 HART
              minter:     owner2.address,
              greenType:  1,
              blockTime:  'Apr 14, 2009 10:25 PM UTC',
              energyStr:  '45.234 MWh'
            }
          }

          // const receiver = owner1.address
          const register_digest = getGreenBitcoinDigestBatch(
                          'Green BTC Club',
                          greenBitcoin.address, greenBTCInfoArray
                        )
    
          const {v,r,s} = ecsign( Buffer.from(register_digest.slice(2), 'hex'), 
                                                Buffer.from(privateKeyRegister.slice(2), 'hex'))  

          await arkreenRECToken.connect(owner1).approve(greenBitcoin.address, constants.MaxUint256)  

          const amountPay = expandTo18Decimals(12*20*10).mul(100).div(95)
          const tx = await greenBitcoin.connect(owner1).authMintGreenBTCWithApproveBatch( 
                            greenBTCInfoArray, {v,r,s}, badgeInfo, {token: AKREToken.address, amount: amountPay}, constants_MaxDealine )  

          const receipt = await tx.wait()
          console.log("Gas used of authMintGreenBTCWithApproveBatch of 20 items", receipt.gasUsed)
          //        expect(receipt.gasUsed).to.eq("5502643")        // 20: 14774178(Multi Badge), 5502643(Single Badge)  
        }
        
        // Normal: authMintGreenBTCWithApproveBatch: arkreenRECToken: Gasfee
        // Buy and open
        {
          let greenBTCInfoArray = new Array<GreenBTCInfo>(20)
          for( let index = 0; index < greenBTCInfoArray.length; index++) {
            greenBTCInfoArray[index]=  {
              height:     BigNumber.from(78901).add(index),
              ARTCount:   expandTo9Decimals(12),  // 12 HART
              minter:     owner1.address,
              greenType:  1,
              blockTime:  'Apr 14, 2009 10:25 PM UTC',
              energyStr:  '45.234 MWh'
            }
          }

          // const receiver = owner1.address
          const register_digest = getGreenBitcoinDigestBatch(
                          'Green BTC Club',
                          greenBitcoin.address, greenBTCInfoArray
                        )
    
          const {v,r,s} = ecsign( Buffer.from(register_digest.slice(2), 'hex'), 
                                                Buffer.from(privateKeyRegister.slice(2), 'hex'))  

          await arkreenRECToken.connect(owner1).approve(greenBitcoin.address, constants.MaxUint256)  

          const amountPay = expandTo18Decimals(12*20*10).mul(100).div(95)
          const tx = await greenBitcoin.connect(owner1).authMintGreenBTCWithApproveBatch( 
                            greenBTCInfoArray, {v,r,s}, badgeInfo, {token: AKREToken.address, amount: amountPay}, constants_MaxDealineAndOpen )  

          const receipt = await tx.wait()
          console.log("Gas used of authMintGreenBTCWithApproveBatch(Open) of 20 items", receipt.gasUsed)
          //        expect(receipt.gasUsed).to.eq("6030301")        // 20: 15290477(Multil Badge), 6030301(Single Badge)     
        }    
      })
      
      it("GreenBTC Test: openBox", async () => {

        await arkreenRECBank.addNewART( arkreenRECToken.address,  maker1.address)
        await arkreenRECBank.addNewART( arkreenRECTokenESG.address,  maker2.address)  
        
        await arkreenRECBank.connect(maker1).depositART( arkreenRECToken.address,  expandTo9Decimals(5000))
        await arkreenRECBank.connect(maker2).depositART( arkreenRECTokenESG.address,  expandTo9Decimals(5000))

        await arkreenRECToken.setClimateBuilder(arkreenBuilder.address)
        await arkreenRECTokenESG.setClimateBuilder(arkreenBuilder.address)

        const badgeInfo =  {
          beneficiary:    owner1.address,
          offsetEntityID: 'Owner1',
          beneficiaryID:  'Tester',
          offsetMessage:  "Just Testing"
        }    

        const greenBTCInfo =  {
            height: BigNumber.from(12345),
            ARTCount: expandTo9Decimals(12),  // 12 HART
            minter: owner2.address,
            greenType: 1,
            blockTime: 'Apr 26, 2009 10:25 PM UTC',
            energyStr: '12.234 MWh'
        }

        await AKREToken.approve(arkreenBuilder.address, constants.MaxUint256)    
          
        await arkreenRECBank.connect(maker2).changeSalePrice( arkreenRECTokenESG.address, AKREToken.address, expandTo18Decimals(10))

        const amountPay = expandTo18Decimals(200)

        // const receiver = owner1.address
        const register_digest = getGreenBitcoinDigest(
                        'Green BTC Club',
                        greenBitcoin.address,
                        { height:       greenBTCInfo.height,
                          energyStr:    greenBTCInfo.energyStr,
                          artCount:     greenBTCInfo.ARTCount,
                          blockTime:    greenBTCInfo.blockTime,
                          minter:       greenBTCInfo.minter,
                          greenType:    greenBTCInfo.greenType
                        }
                      )
  
        const {v,r,s} = ecsign( Buffer.from(register_digest.slice(2), 'hex'), 
                                              Buffer.from(privateKeyRegister.slice(2), 'hex'))           

        await arkreenBuilder.mangeTrustedForwarder(greenBitcoin.address, true)
        await AKREToken.connect(owner1).approve(greenBitcoin.address, constants.MaxUint256)            

        // Normal: authMintGreenBTCWithApprove                     
        await greenBitcoin.connect(owner1).authMintGreenBTCWithApprove( greenBTCInfo, {v,r,s}, badgeInfo, 
                                            {token: AKREToken.address, amount: amountPay}, constants_MaxDealine)                                            

        // Error: More ART required, so pay less
        await expect(greenBitcoin.connect(owner1).openBox(12345)).to.be.revertedWith("GBTC: Not Owner")   

        // Check dataGBTC, not opened
        const _dataNFT0 = [constants.AddressZero, 12345, false, false, false, 0, 0]
        expect(await greenBitcoin.dataNFT(12345)).to.deep.equal(_dataNFT0)      
        
        const lastBlock0 = await ethers.provider.getBlock('latest')
        
        await expect(greenBitcoin.connect(owner2).openBox(12345))
                    .to.emit(greenBitcoin, 'OpenBox')
                    .withArgs(owner2.address, 12345, lastBlock0.number + 1)

        const lastBlock = await ethers.provider.getBlock('latest')

        // Check dataGBTC
        const _dataNFT = [owner2.address, 12345, true, false, false, 0, 0]
        expect(await greenBitcoin.dataNFT(12345)).to.deep.equal(_dataNFT)    
        
        // Check dataGBTC
        const openingBoxList = [[12345, lastBlock.number]]
        expect(await greenBitcoin.getOpeningBoxList()).to.deep.equal(openingBoxList)    

        // Error: More ART required, so pay less
        await expect(greenBitcoin.connect(owner2).openBox(12345)).to.be.revertedWith("GBTC: Already Opened")   
        
        // 2nd Block: authMintGreenBTCWithApprove    
       { 
          const greenBTCInfo =  {
            height: BigNumber.from(23456),
            ARTCount: expandTo9Decimals(13),  // 13 HART
            minter: owner2.address,
            greenType: 1,
            blockTime: 'Apr 26, 2012 10:25 PM UTC',
            energyStr: '13.234 MWh'
          }
          
          // const receiver = owner1.address
          const register_digest = getGreenBitcoinDigest(
                          'Green BTC Club',
                          greenBitcoin.address,
                          { height:       greenBTCInfo.height,
                            energyStr:    greenBTCInfo.energyStr,
                            artCount:     greenBTCInfo.ARTCount,
                            blockTime:    greenBTCInfo.blockTime,
                            minter:       greenBTCInfo.minter,
                            greenType:    greenBTCInfo.greenType
                          }
                        )
    
          const {v,r,s} = ecsign( Buffer.from(register_digest.slice(2), 'hex'), 
                                                Buffer.from(privateKeyRegister.slice(2), 'hex'))   

          await greenBitcoin.connect(owner1).authMintGreenBTCWithApprove( greenBTCInfo, {v,r,s}, badgeInfo, 
                                              {token: AKREToken.address, amount: amountPay}, constants_MaxDealine)  
        }
      
        await greenBitcoin.connect(owner2).openBox(23456)
        const lastBlock1 = await ethers.provider.getBlock('latest')

        // Check dataGBTC
        const _dataNFT1 = [owner2.address, 23456, true, false, false, 0, 0]
        expect(await greenBitcoin.dataNFT(23456)).to.deep.equal(_dataNFT1)    
          
          // Check dataGBTC
        const openingBoxList1 = [[12345, lastBlock.number], [23456, lastBlock1.number]]
        expect(await greenBitcoin.getOpeningBoxList()).to.deep.equal(openingBoxList1)   
                                            
      });

      it("GreenBTC Test: authMintGreenBTCWithApproveOpen", async () => {

        await arkreenRECBank.addNewART( arkreenRECToken.address,  maker1.address)
        await arkreenRECBank.addNewART( arkreenRECTokenESG.address,  maker2.address)  
        
        await arkreenRECBank.connect(maker1).depositART( arkreenRECToken.address,  expandTo9Decimals(5000))
        await arkreenRECBank.connect(maker2).depositART( arkreenRECTokenESG.address,  expandTo9Decimals(5000))

        await arkreenRECToken.setClimateBuilder(arkreenBuilder.address)
        await arkreenRECTokenESG.setClimateBuilder(arkreenBuilder.address)

        const badgeInfo =  {
          beneficiary:    owner1.address,
          offsetEntityID: 'Owner1',
          beneficiaryID:  'Tester',
          offsetMessage:  "Just Testing"
        }    

        const greenBTCInfo =  {
            height: BigNumber.from(12345),
            ARTCount: expandTo9Decimals(12),  // 12 HART
            minter: owner1.address,
            greenType: 1,
            blockTime: 'Apr 26, 2009 10:25 PM UTC',
            energyStr: '12.234 MWh'
        }

        await AKREToken.approve(arkreenBuilder.address, constants.MaxUint256)    
          
        await arkreenRECBank.connect(maker2).changeSalePrice( arkreenRECTokenESG.address, AKREToken.address, expandTo18Decimals(10))

        const amountPay = expandTo18Decimals(200)

        // const receiver = owner1.address
        const register_digest = getGreenBitcoinDigest(
                        'Green BTC Club',
                        greenBitcoin.address,
                        { height:       greenBTCInfo.height,
                          energyStr:    greenBTCInfo.energyStr,
                          artCount:     greenBTCInfo.ARTCount,
                          blockTime:    greenBTCInfo.blockTime,
                          minter:       greenBTCInfo.minter,
                          greenType:    greenBTCInfo.greenType
                        }
                      )
  
        const {v,r,s} = ecsign( Buffer.from(register_digest.slice(2), 'hex'), 
                                              Buffer.from(privateKeyRegister.slice(2), 'hex'))           

        await arkreenBuilder.mangeTrustedForwarder(greenBitcoin.address, true)
        await AKREToken.connect(owner1).approve(greenBitcoin.address, constants.MaxUint256)            

        // Normal: authMintGreenBTCWithApproveOpen                     
        await greenBitcoin.connect(owner1).authMintGreenBTCWithApprove( greenBTCInfo, {v,r,s}, badgeInfo, 
                                            {token: AKREToken.address, amount: amountPay}, constants_MaxDealineAndOpen)                                            

        const lastBlock = await ethers.provider.getBlock('latest')

        // Check dataGBTC
        const _dataNFT = [owner1.address, 12345, true, false, false, 0, 0]
        expect(await greenBitcoin.dataNFT(12345)).to.deep.equal(_dataNFT)    
        
        // Check dataGBTC
        const openingBoxList = [[12345, lastBlock.number]]
        expect(await greenBitcoin.getOpeningBoxList()).to.deep.equal(openingBoxList)    

        // Error: More ART required, so pay less
        await expect(greenBitcoin.connect(owner1).openBox(12345)).to.be.revertedWith("GBTC: Already Opened")   
        
        // 2nd Block: authMintGreenBTCWithApproveOpen    
        { 
          const greenBTCInfo =  {
            height: BigNumber.from(23456),
            ARTCount: expandTo9Decimals(13),  // 13 HART
            minter: owner1.address,
            greenType: 1,
            blockTime: 'Apr 26, 2012 10:25 PM UTC',
            energyStr: '13.234 MWh'
          }
          
          // const receiver = owner1.address
          const register_digest = getGreenBitcoinDigest(
                          'Green BTC Club',
                          greenBitcoin.address,
                          { height:       greenBTCInfo.height,
                            energyStr:    greenBTCInfo.energyStr,
                            artCount:     greenBTCInfo.ARTCount,
                            blockTime:    greenBTCInfo.blockTime,
                            minter:       greenBTCInfo.minter,
                            greenType:    greenBTCInfo.greenType
                          }
                        )
    
          const {v,r,s} = ecsign( Buffer.from(register_digest.slice(2), 'hex'), 
                                                Buffer.from(privateKeyRegister.slice(2), 'hex'))   

          await greenBitcoin.connect(owner1).authMintGreenBTCWithApprove( greenBTCInfo, {v,r,s}, badgeInfo, 
                                              {token: AKREToken.address, amount: amountPay}, constants_MaxDealineAndOpen)  
        }
      
        const lastBlock1 = await ethers.provider.getBlock('latest')

        // Check dataGBTC
        const _dataNFT1 = [owner1.address, 23456, true, false, false, 0, 0]
        expect(await greenBitcoin.dataNFT(23456)).to.deep.equal(_dataNFT1)    
          
          // Check dataGBTC
        const openingBoxList1 = [[12345, lastBlock.number], [23456, lastBlock1.number]]
        expect(await greenBitcoin.getOpeningBoxList()).to.deep.equal(openingBoxList1)   
                                            
      });

      it("GreenBTC Test: authMintGreenBTCWithARTOpen", async () => {

        await arkreenRECBank.addNewART( arkreenRECToken.address,  maker1.address)
        await arkreenRECBank.addNewART( arkreenRECTokenESG.address,  maker2.address)  
        
        await arkreenRECBank.connect(maker1).depositART( arkreenRECToken.address,  expandTo9Decimals(5000))
        await arkreenRECBank.connect(maker2).depositART( arkreenRECTokenESG.address,  expandTo9Decimals(5000))

        await arkreenRECToken.setClimateBuilder(arkreenBuilder.address)
        await arkreenRECTokenESG.setClimateBuilder(arkreenBuilder.address)

        const badgeInfo =  {
          beneficiary:    owner1.address,
          offsetEntityID: 'Owner1',
          beneficiaryID:  'Tester',
          offsetMessage:  "Just Testing"
        }    

        const greenBTCInfo =  {
            height: BigNumber.from(12345),
            ARTCount: expandTo9Decimals(12),  // 12 HART
            minter: owner1.address,
            greenType: 0x12,
            blockTime: 'Apr 26, 2009 10:25 PM UTC',
            energyStr: '12.234 MWh'
        }

        await AKREToken.approve(arkreenBuilder.address, constants.MaxUint256)    
          
        await arkreenRECBank.connect(maker2).changeSalePrice( arkreenRECTokenESG.address, AKREToken.address, expandTo18Decimals(10))

        // const receiver = owner1.address
        const register_digest = getGreenBitcoinDigest(
                        'Green BTC Club',
                        greenBitcoin.address,
                        { height:       greenBTCInfo.height,
                          energyStr:    greenBTCInfo.energyStr,
                          artCount:     greenBTCInfo.ARTCount,
                          blockTime:    greenBTCInfo.blockTime,
                          minter:       greenBTCInfo.minter,
                          greenType:    greenBTCInfo.greenType
                        }
                      )
  
        const {v,r,s} = ecsign( Buffer.from(register_digest.slice(2), 'hex'), 
                                              Buffer.from(privateKeyRegister.slice(2), 'hex'))           

        await arkreenBuilder.mangeTrustedForwarder(greenBitcoin.address, true)
        await AKREToken.connect(owner1).approve(greenBitcoin.address, constants.MaxUint256)   
        
        await greenBitcoin.mangeARTTokens([arkreenRECToken.address, arkreenRECTokenESG.address], true)  
        
        await arkreenRECTokenESG.connect(owner1).approve(greenBitcoin.address, constants.MaxUint256)  
        
        await greenBitcoin.approveBuilder([arkreenRECToken.address, arkreenRECTokenESG.address])

        // Normal: authMintGreenBTCWithARTOpen                     
        await greenBitcoin.connect(owner1).authMintGreenBTCWithART( greenBTCInfo, {v,r,s}, badgeInfo, 
                                              arkreenRECTokenESG.address, constants_MaxDealineAndOpen)                                            

        const lastBlock = await ethers.provider.getBlock('latest')

        // Check dataGBTC
        const _dataNFT = [owner1.address, 12345, true, false, false, 0, 0]
        expect(await greenBitcoin.dataNFT(12345)).to.deep.equal(_dataNFT)    
        
        // Check dataGBTC
        const openingBoxList = [[12345, lastBlock.number]]
        expect(await greenBitcoin.getOpeningBoxList()).to.deep.equal(openingBoxList)    

        // Error: More ART required, so pay less
        await expect(greenBitcoin.connect(owner1).openBox(12345)).to.be.revertedWith("GBTC: Already Opened")   
        
        // 2nd Block: authMintGreenBTCWithARTOpen    
        { 
          const greenBTCInfo =  {
            height: BigNumber.from(23456),
            ARTCount: expandTo9Decimals(13),  // 13 HART
            minter: owner1.address,
            greenType: 0x12,
            blockTime: 'Apr 26, 2012 10:25 PM UTC',
            energyStr: '13.234 MWh'
          }
          
          // const receiver = owner1.address
          const register_digest = getGreenBitcoinDigest(
                          'Green BTC Club',
                          greenBitcoin.address,
                          { height:       greenBTCInfo.height,
                            energyStr:    greenBTCInfo.energyStr,
                            artCount:     greenBTCInfo.ARTCount,
                            blockTime:    greenBTCInfo.blockTime,
                            minter:       greenBTCInfo.minter,
                            greenType:    greenBTCInfo.greenType
                          }
                        )

          const {v,r,s} = ecsign( Buffer.from(register_digest.slice(2), 'hex'), 
                                                Buffer.from(privateKeyRegister.slice(2), 'hex'))   

          await greenBitcoin.connect(owner1).authMintGreenBTCWithART( greenBTCInfo, {v,r,s}, badgeInfo, 
                                                      arkreenRECTokenESG.address, constants_MaxDealineAndOpen)  
        }
      
        const lastBlock1 = await ethers.provider.getBlock('latest')

        // Check dataGBTC
        const _dataNFT1 = [owner1.address, 23456, true, false, false, 0, 0]
        expect(await greenBitcoin.dataNFT(23456)).to.deep.equal(_dataNFT1)    
          
          // Check dataGBTC
        const openingBoxList1 = [[12345, lastBlock.number], [23456, lastBlock1.number]]
        expect(await greenBitcoin.getOpeningBoxList()).to.deep.equal(openingBoxList1)   
                                            
      });

      it("GreenBTC Test: revealBoxes", async () => {

        await arkreenRECBank.addNewART( arkreenRECToken.address,  maker1.address)
        await arkreenRECBank.addNewART( arkreenRECTokenESG.address,  maker2.address)  
        
        await arkreenRECBank.connect(maker1).depositART( arkreenRECToken.address,  expandTo9Decimals(5000))
        await arkreenRECBank.connect(maker2).depositART( arkreenRECTokenESG.address,  expandTo9Decimals(5000))

        await arkreenRECToken.setClimateBuilder(arkreenBuilder.address)
        await arkreenRECTokenESG.setClimateBuilder(arkreenBuilder.address)

        const badgeInfo =  {
          beneficiary:    owner1.address,
          offsetEntityID: 'Owner1',
          beneficiaryID:  'Tester',
          offsetMessage:  "Just Testing"
        }    

        const greenBTCInfo =  {
            height: BigNumber.from(12345),
            ARTCount: expandTo9Decimals(12),  // 12 HART
            minter: owner2.address,
            greenType: 1,
            blockTime: 'Apr 26, 2009 10:25 PM UTC',
            energyStr: '12.234 MWh'
        }

        await AKREToken.approve(arkreenBuilder.address, constants.MaxUint256)    
          
        await arkreenRECBank.connect(maker2).changeSalePrice( arkreenRECTokenESG.address, AKREToken.address, expandTo18Decimals(10))

        const amountPay = expandTo18Decimals(200)

        // const receiver = owner1.address
        const register_digest = getGreenBitcoinDigest(
                        'Green BTC Club',
                        greenBitcoin.address,
                        { height:       greenBTCInfo.height,
                          energyStr:    greenBTCInfo.energyStr,
                          artCount:     greenBTCInfo.ARTCount,
                          blockTime:    greenBTCInfo.blockTime,
                          minter:       greenBTCInfo.minter,
                          greenType:    greenBTCInfo.greenType
                        }
                      )
  
        const {v,r,s} = ecsign( Buffer.from(register_digest.slice(2), 'hex'), 
                                              Buffer.from(privateKeyRegister.slice(2), 'hex'))           

        await arkreenBuilder.mangeTrustedForwarder(greenBitcoin.address, true)
        await AKREToken.connect(owner1).approve(greenBitcoin.address, constants.MaxUint256)      
        
        // Mining 256 blocks to increase block height to to avoid internal panic !!!!!!!!!!!!!!!!
        await mine(256)

        // Normal: authMintGreenBTCWithApprove                     
        await greenBitcoin.connect(owner1).authMintGreenBTCWithApprove( greenBTCInfo, {v,r,s}, badgeInfo, 
                                            {token: AKREToken.address, amount: amountPay}, constants_MaxDealine)                                            
        
        await greenBitcoin.connect(owner2).openBox(12345)

        // Nothing revealed 
        await expect(greenBitcoin.revealBoxes())
                .to.emit(greenBitcoin, 'RevealBoxes')
                .withArgs([], [])

        const openingBoxList = await greenBitcoin.getOpeningBoxList()
        expect(openingBoxList[0].tokenID).to.equal(12345)

        // 2nd Block: authMintGreenBTCWithApprove    
        { 
          const greenBTCInfo =  {
            height: BigNumber.from(23456),
            ARTCount: expandTo9Decimals(13),  // 13 HART
            minter: owner2.address,
            greenType: 1,
            blockTime: 'Apr 26, 2012 10:25 PM UTC',
            energyStr: '13.234 MWh'
          }
          
          // const receiver = owner1.address
          const register_digest = getGreenBitcoinDigest(
                          'Green BTC Club',
                          greenBitcoin.address,
                          { height:       greenBTCInfo.height,
                            energyStr:    greenBTCInfo.energyStr,
                            artCount:     greenBTCInfo.ARTCount,
                            blockTime:    greenBTCInfo.blockTime,
                            minter:       greenBTCInfo.minter,
                            greenType:    greenBTCInfo.greenType
                          }
                        )
    
          const {v,r,s} = ecsign( Buffer.from(register_digest.slice(2), 'hex'), 
                                                Buffer.from(privateKeyRegister.slice(2), 'hex'))   

          await greenBitcoin.connect(owner1).authMintGreenBTCWithApprove( greenBTCInfo, {v,r,s}, badgeInfo, 
                                              {token: AKREToken.address, amount: amountPay}, constants_MaxDealine)  
        }

        // 3rd Block: authMintGreenBTCWithApprove    
        { 
          const greenBTCInfo =  {
            height: BigNumber.from(34567),
            ARTCount: expandTo9Decimals(14),  // 14 HART
            minter: owner2.address,
            greenType: 1,
            blockTime: 'Apr 26, 2013 10:25 PM UTC',
            energyStr: '14.234 MWh'
          }
          
          // const receiver = owner1.address
          const register_digest = getGreenBitcoinDigest(
                          'Green BTC Club',
                          greenBitcoin.address,
                          { height:       greenBTCInfo.height,
                            energyStr:    greenBTCInfo.energyStr,
                            artCount:     greenBTCInfo.ARTCount,
                            blockTime:    greenBTCInfo.blockTime,
                            minter:       greenBTCInfo.minter,
                            greenType:    greenBTCInfo.greenType
                          }
                        )
    
          const {v,r,s} = ecsign( Buffer.from(register_digest.slice(2), 'hex'), 
                                                Buffer.from(privateKeyRegister.slice(2), 'hex'))   

          await greenBitcoin.connect(owner1).authMintGreenBTCWithApprove( greenBTCInfo, {v,r,s}, badgeInfo, 
                                              {token: AKREToken.address, amount: amountPay}, constants_MaxDealine)  
        }        

        await greenBitcoin.connect(owner2).openBox(23456)
        await greenBitcoin.connect(owner2).openBox(34567)

        const openingBoxList10 = await greenBitcoin.getOpeningBoxList()

        expect(openingBoxList10[0].tokenID).to.equal(12345)
        expect(openingBoxList10[1].tokenID).to.equal(23456)
        expect(openingBoxList10[2].tokenID).to.equal(34567)

        await greenBitcoin.revealBoxes()

        // Check dataGBTC
        expect((await greenBitcoin.dataNFT(12345))[3]).to.deep.equal(true)  
        expect((await greenBitcoin.dataNFT(23456))[3]).to.deep.equal(true)  
        expect((await greenBitcoin.dataNFT(34567))[3]).to.deep.equal(false)  
        
        const openingBoxList11 = await greenBitcoin.getOpeningBoxList()
        const openingOvertimed = await greenBitcoin.getOpeningOvertimed()

        expect(openingOvertimed).to.equal(2)  

        expect(openingBoxList11[0].tokenID).to.equal(0)                 
        expect(openingBoxList11[1].tokenID).to.equal(0)                 
        expect(openingBoxList11[2].tokenID).to.equal(34567)                 

        await mine(1)

        // const revealList = [ 34567 ]
        // const wonList = [ false]

        await expect(greenBitcoin.revealBoxes())
                .to.emit(greenBitcoin, 'RevealBoxes')
        //      .withArgs(revealList, wonList)
       
        const openingBoxList2 = await greenBitcoin.getOpeningBoxList()
        expect(openingBoxList2.length).to.equal(0)  

        // Check list is empty                
        await expect(greenBitcoin.revealBoxes()).to.be.revertedWith("GBTC: Empty List")           
                                            
      });

      it("GreenBTC Test: revealBoxesWithHash while overtime ", async () => {

        await arkreenRECBank.addNewART( arkreenRECToken.address,  maker1.address)
        await arkreenRECBank.addNewART( arkreenRECTokenESG.address,  maker2.address)  
        
        await arkreenRECBank.connect(maker1).depositART( arkreenRECToken.address,  expandTo9Decimals(5000))
        await arkreenRECBank.connect(maker2).depositART( arkreenRECTokenESG.address,  expandTo9Decimals(5000))

        await arkreenRECToken.setClimateBuilder(arkreenBuilder.address)
        await arkreenRECTokenESG.setClimateBuilder(arkreenBuilder.address)

        const badgeInfo =  {
          beneficiary:    owner1.address,
          offsetEntityID: 'Owner1',
          beneficiaryID:  'Tester',
          offsetMessage:  "Just Testing"
        }    

        const greenBTCInfo =  {
            height: BigNumber.from(12345),
            ARTCount: expandTo9Decimals(12),  // 12 HART
            minter: owner2.address,
            greenType: 1,
            blockTime: 'Apr 26, 2009 10:25 PM UTC',
            energyStr: '12.234 MWh'
        }

        await AKREToken.approve(arkreenBuilder.address, constants.MaxUint256)    
          
        await arkreenRECBank.connect(maker2).changeSalePrice( arkreenRECTokenESG.address, AKREToken.address, expandTo18Decimals(10))

        const amountPay = expandTo18Decimals(200)

        // const receiver = owner1.address
        const register_digest = getGreenBitcoinDigest(
                        'Green BTC Club',
                        greenBitcoin.address,
                        { height:       greenBTCInfo.height,
                          energyStr:    greenBTCInfo.energyStr,
                          artCount:     greenBTCInfo.ARTCount,
                          blockTime:    greenBTCInfo.blockTime,
                          minter:       greenBTCInfo.minter,
                          greenType:    greenBTCInfo.greenType
                        }
                      )
  
        const {v,r,s} = ecsign( Buffer.from(register_digest.slice(2), 'hex'), 
                                              Buffer.from(privateKeyRegister.slice(2), 'hex'))           

        await arkreenBuilder.mangeTrustedForwarder(greenBitcoin.address, true)
        await AKREToken.connect(owner1).approve(greenBitcoin.address, constants.MaxUint256)      
        
        // Mining 256 blocks to increase block height to to avoid internal panic !!!!!!!!!!!!!!!!
        await mine(256)

        let tx1, tx2, tx3, tx3A

        // Normal: authMintGreenBTCWithApprove                     
        tx1 = await greenBitcoin.connect(owner1).authMintGreenBTCWithApprove( greenBTCInfo, {v,r,s}, badgeInfo, 
                                            {token: AKREToken.address, amount: amountPay}, constants_MaxDealine)     
        
        await greenBitcoin.connect(owner2).openBox(12345)

        // Nothing revealed 
        await expect(greenBitcoin.revealBoxes())
                .to.emit(greenBitcoin, 'RevealBoxes')
                .withArgs([], [])

        const openingBoxList = await greenBitcoin.getOpeningBoxList()
        expect(openingBoxList[0].tokenID).to.equal(12345)

        // 2nd Block: authMintGreenBTCWithApprove    
        { 
          const greenBTCInfo =  {
            height: BigNumber.from(23456),
            ARTCount: expandTo9Decimals(13),  // 13 HART
            minter: owner2.address,
            greenType: 1,
            blockTime: 'Apr 26, 2012 10:25 PM UTC',
            energyStr: '13.234 MWh'
          }
          
          // const receiver = owner1.address
          const register_digest = getGreenBitcoinDigest(
                          'Green BTC Club',
                          greenBitcoin.address,
                          { height:       greenBTCInfo.height,
                            energyStr:    greenBTCInfo.energyStr,
                            artCount:     greenBTCInfo.ARTCount,
                            blockTime:    greenBTCInfo.blockTime,
                            minter:       greenBTCInfo.minter,
                            greenType:    greenBTCInfo.greenType
                          }
                        )
    
          const {v,r,s} = ecsign( Buffer.from(register_digest.slice(2), 'hex'), 
                                                Buffer.from(privateKeyRegister.slice(2), 'hex'))   

          tx2 = await greenBitcoin.connect(owner1).authMintGreenBTCWithApprove( greenBTCInfo, {v,r,s}, badgeInfo, 
                                              {token: AKREToken.address, amount: amountPay}, constants_MaxDealine)  
        }

        // 3rd Block: authMintGreenBTCWithApprove    
        { 
          const greenBTCInfo =  {
            height: BigNumber.from(34567),
            ARTCount: expandTo9Decimals(14),  // 14 HART
            minter: owner2.address,
            greenType: 1,
            blockTime: 'Apr 26, 2013 10:25 PM UTC',
            energyStr: '14.234 MWh'
          }
          
          // const receiver = owner1.address
          const register_digest = getGreenBitcoinDigest(
                          'Green BTC Club',
                          greenBitcoin.address,
                          { height:       greenBTCInfo.height,
                            energyStr:    greenBTCInfo.energyStr,
                            artCount:     greenBTCInfo.ARTCount,
                            blockTime:    greenBTCInfo.blockTime,
                            minter:       greenBTCInfo.minter,
                            greenType:    greenBTCInfo.greenType
                          }
                        )
    
          const {v,r,s} = ecsign( Buffer.from(register_digest.slice(2), 'hex'), 
                                                Buffer.from(privateKeyRegister.slice(2), 'hex'))   

          tx3 = await greenBitcoin.connect(owner1).authMintGreenBTCWithApprove( greenBTCInfo, {v,r,s}, badgeInfo, 
                                              {token: AKREToken.address, amount: amountPay}, constants_MaxDealine)  
        }   
        
        // 3rd Block: authMintGreenBTCWithApprove    
        { 
          const greenBTCInfo =  {
            height: BigNumber.from(34568),
            ARTCount: expandTo9Decimals(18),  // 14 HART
            minter: owner2.address,
            greenType: 1,
            blockTime: 'Apr 26, 2013 10:25 PM UTC',
            energyStr: '18.234 MWh'
          }
          
          // const receiver = owner1.address
          const register_digest = getGreenBitcoinDigest(
                          'Green BTC Club',
                          greenBitcoin.address,
                          { height:       greenBTCInfo.height,
                            energyStr:    greenBTCInfo.energyStr,
                            artCount:     greenBTCInfo.ARTCount,
                            blockTime:    greenBTCInfo.blockTime,
                            minter:       greenBTCInfo.minter,
                            greenType:    greenBTCInfo.greenType
                          }
                        )
    
          const {v,r,s} = ecsign( Buffer.from(register_digest.slice(2), 'hex'), 
                                                Buffer.from(privateKeyRegister.slice(2), 'hex'))   

          tx3A = await greenBitcoin.connect(owner1).authMintGreenBTCWithApprove( greenBTCInfo, {v,r,s}, badgeInfo, 
                                              {token: AKREToken.address, amount: amountPay}, constants_MaxDealine)  
        } 

        await greenBitcoin.connect(owner2).openBox(23456)
        await greenBitcoin.connect(owner2).openBox(34567)
        await greenBitcoin.connect(owner2).openBox(34568)

        await mine(252) // 252

        // 4th Block: authMintGreenBTCWithApprove    
        { 
          const greenBTCInfo =  {
            height: BigNumber.from(45678),
            ARTCount: expandTo9Decimals(15),  // 14 HART
            minter: owner2.address,
            greenType: 1,
            blockTime: 'Apr 26, 2014 10:25 PM UTC',
            energyStr: '15.234 MWh'
          }
          
          // const receiver = owner1.address
          const register_digest = getGreenBitcoinDigest(
                          'Green BTC Club',
                          greenBitcoin.address,
                          { height:       greenBTCInfo.height,
                            energyStr:    greenBTCInfo.energyStr,
                            artCount:     greenBTCInfo.ARTCount,
                            blockTime:    greenBTCInfo.blockTime,
                            minter:       greenBTCInfo.minter,
                            greenType:    greenBTCInfo.greenType
                          }
                        )
    
          const {v,r,s} = ecsign( Buffer.from(register_digest.slice(2), 'hex'), 
                                                Buffer.from(privateKeyRegister.slice(2), 'hex'))   

          await greenBitcoin.connect(owner1).authMintGreenBTCWithApprove( greenBTCInfo, {v,r,s}, badgeInfo, 
                                              {token: AKREToken.address, amount: amountPay}, constants_MaxDealine)  
        }        

        // 5th Block: authMintGreenBTCWithApprove    
        { 
          const greenBTCInfo =  {
            height: BigNumber.from(56789),
            ARTCount: expandTo9Decimals(16),  // 14 HART
            minter: owner2.address,
            greenType: 1,
            blockTime: 'Apr 26, 2015 10:25 PM UTC',
            energyStr: '16.234 MWh'
          }
          
          // const receiver = owner1.address
          const register_digest = getGreenBitcoinDigest(
                          'Green BTC Club',
                          greenBitcoin.address,
                          { height:       greenBTCInfo.height,
                            energyStr:    greenBTCInfo.energyStr,
                            artCount:     greenBTCInfo.ARTCount,
                            blockTime:    greenBTCInfo.blockTime,
                            minter:       greenBTCInfo.minter,
                            greenType:    greenBTCInfo.greenType
                          }
                        )
    
          const {v,r,s} = ecsign( Buffer.from(register_digest.slice(2), 'hex'), 
                                                Buffer.from(privateKeyRegister.slice(2), 'hex'))   

          await greenBitcoin.connect(owner1).authMintGreenBTCWithApprove( greenBTCInfo, {v,r,s}, badgeInfo, 
                                              {token: AKREToken.address, amount: amountPay}, constants_MaxDealine)  
        }    

        await greenBitcoin.connect(owner2).openBox(45678)
        await greenBitcoin.connect(owner2).openBox(56789)

        const openingBoxList10 = await greenBitcoin.getOpeningBoxList()

        expect(openingBoxList10[0].tokenID).to.equal(12345)
        expect(openingBoxList10[1].tokenID).to.equal(23456)
        expect(openingBoxList10[2].tokenID).to.equal(34567)
        expect(openingBoxList10[3].tokenID).to.equal(34568)
        expect(openingBoxList10[4].tokenID).to.equal(45678)
        expect(openingBoxList10[5].tokenID).to.equal(56789)

        await greenBitcoin.revealBoxes()

        // Check dataGBTC
        expect((await greenBitcoin.dataNFT(12345))[3]).to.deep.equal(false)  
        expect((await greenBitcoin.dataNFT(23456))[3]).to.deep.equal(false)  
        expect((await greenBitcoin.dataNFT(34567))[3]).to.deep.equal(false)  
        expect((await greenBitcoin.dataNFT(34568))[3]).to.deep.equal(true)  
        expect((await greenBitcoin.dataNFT(45678))[3]).to.deep.equal(true)  
        expect((await greenBitcoin.dataNFT(56789))[3]).to.deep.equal(false)  
        
        const openingBoxList11 = await greenBitcoin.getOpeningBoxList()
        expect(openingBoxList11.length).to.equal(6) 

        const openingOvertimed = await greenBitcoin.getOpeningOvertimed()

        expect(openingOvertimed).to.equal(5)  

        expect(openingBoxList11[0].tokenID).to.equal(0)                   //
        expect(openingBoxList11[1].tokenID).to.equal(0)                   //
        expect(openingBoxList11[2].tokenID).to.equal(0)                   //
        expect(openingBoxList11[3].tokenID).to.equal(0)                   //
        expect(openingBoxList11[4].tokenID).to.equal(0)                   //
        expect(openingBoxList11[5].tokenID).to.equal(56789)                   // only 56789 left


        const overtimeBoxList = await greenBitcoin.getOvertimeBoxList() 
        expect(overtimeBoxList.length).to.equal(3) 
        expect(overtimeBoxList[0].tokenID).to.deep.equal(12345)  
        expect(overtimeBoxList[1].tokenID).to.deep.equal(23456)  
        expect(overtimeBoxList[2].tokenID).to.deep.equal(34567)  

        await mine(1)

        // const revealList = [ 34567 ]
        // const wonList = [ false]

        await expect(greenBitcoin.revealBoxes())
                .to.emit(greenBitcoin, 'RevealBoxes')
        //      .withArgs(revealList, wonList)
       
        const openingBoxList2 = await greenBitcoin.getOpeningBoxList()
        expect(openingBoxList2.length).to.equal(0)  

        // Error: Wrong length
        await expect(greenBitcoin.revealBoxesWithHash([12345, 23456], [tx2.hash]))
                .to.be.revertedWith("GBTC: Wrong Length")    

        // Error: Need manager
        await expect(greenBitcoin.connect(owner1).revealBoxesWithHash([23456], [tx2.hash]))
                .to.be.revertedWith("GBTC: Not Manager")       

        await greenBitcoin.revealBoxesWithHash([23456], [tx2.hash])
        const overtimeBoxList2 = await greenBitcoin.getOvertimeBoxList() 
        expect(overtimeBoxList2.length).to.equal(2)

        await expect(greenBitcoin.revealBoxesWithHash([23456], [tx2.hash]))
                .to.be.revertedWith("GBTC: Wrong Overtime Status")    

        await greenBitcoin.revealBoxesWithHash([12345, 34567], [tx1.hash, tx3.hash])
        const overtimeBoxList3 = await greenBitcoin.getOvertimeBoxList() 
        expect(overtimeBoxList3.length).to.equal(0)  

        await expect(greenBitcoin.revealBoxesWithHash([12345, 34567], [tx1.hash, tx3.hash]))
                .to.be.revertedWith("GBTC: Empty Overtime List")    
                                            
      });

      it("GreenBTC Test: tokenURI", async () => {

        await arkreenRECBank.addNewART( arkreenRECToken.address,  maker1.address)
        await arkreenRECBank.addNewART( arkreenRECTokenESG.address,  maker2.address)  
        
        await arkreenRECBank.connect(maker1).depositART( arkreenRECToken.address,  expandTo9Decimals(5000))
        await arkreenRECBank.connect(maker2).depositART( arkreenRECTokenESG.address,  expandTo9Decimals(5000))

        await arkreenRECToken.setClimateBuilder(arkreenBuilder.address)
        await arkreenRECTokenESG.setClimateBuilder(arkreenBuilder.address)

        const badgeInfo =  {
          beneficiary:    owner1.address,
          offsetEntityID: 'Owner1',
          beneficiaryID:  'Tester',
          offsetMessage:  "Just Testing"
        }    

        const greenBTCInfo =  {
            height: BigNumber.from(12345),
            ARTCount: expandTo9Decimals(12),  // 12 HART
            minter: owner2.address,
            greenType: 1,
            blockTime: 'Apr 26, 2009 10:25 PM UTC',
            energyStr: '12.234 MWh'
        }

        await AKREToken.approve(arkreenBuilder.address, constants.MaxUint256)    
          
        await arkreenRECBank.connect(maker2).changeSalePrice( arkreenRECTokenESG.address, AKREToken.address, expandTo18Decimals(10))

        const amountPay = expandTo18Decimals(200)

        // const receiver = owner1.address
        const register_digest = getGreenBitcoinDigest(
                        'Green BTC Club',
                        greenBitcoin.address,
                        { height:       greenBTCInfo.height,
                          energyStr:    greenBTCInfo.energyStr,
                          artCount:     greenBTCInfo.ARTCount,
                          blockTime:    greenBTCInfo.blockTime,
                          minter:       greenBTCInfo.minter,
                          greenType:    greenBTCInfo.greenType
                        }
                      )
  
        const {v,r,s} = ecsign( Buffer.from(register_digest.slice(2), 'hex'), 
                                              Buffer.from(privateKeyRegister.slice(2), 'hex'))           

        await arkreenBuilder.mangeTrustedForwarder(greenBitcoin.address, true)
        await AKREToken.connect(owner1).approve(greenBitcoin.address, constants.MaxUint256)      
        
        // Mining 256 blocks to increase block height to to avoid internal panic !!!!!!!!!!!!!!!!
        await mine(256)

        // Normal: authMintGreenBTCWithApprove                     
        await greenBitcoin.connect(owner1).authMintGreenBTCWithApprove( greenBTCInfo, {v,r,s}, badgeInfo, 
                                            {token: AKREToken.address, amount: amountPay}, constants_MaxDealine)                                            

        await greenBitcoin.setImageContract(greenBTCImage.address)

        await expect(greenBitcoin.tokenURI(12340)).to.be.revertedWith("GBTC: Not Minted")    

        const uri1 = await greenBitcoin.tokenURI(12345)
        console.log(uri1,' \r\n')

        await greenBitcoin.connect(owner2).openBox(12345)
        const uri2 = await greenBitcoin.tokenURI(12345)
        console.log(uri2, '\r\n')

        await mine(1)

        await greenBitcoin.revealBoxes()
        const uri3 = await greenBitcoin.tokenURI(12345)
        console.log(uri3, '\r\n')

      });
    })  
});
