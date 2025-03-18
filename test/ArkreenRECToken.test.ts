import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import { expect } from "chai";
import { constants, BigNumber, Contract } from 'ethers'
import { ethers, network, upgrades } from "hardhat";

import {
    ArkreenToken,
    ArkreenMiner,
    ArkreenRECIssuance,
    ArkreenRegistry,
    ArkreenRECToken,
    ArkreenBadge,
    ArkreenBadgeImage
} from "../typechain";


import { time, loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { getApprovalDigest, expandTo18Decimals, randomAddresses, RECStatus, MinerType, expandTo9Decimals, urlData } from "./utils/utilities";
import { ecsign, fromRpcSig, ecrecover } from 'ethereumjs-util'
import { RECRequestStruct, SignatureStruct, RECDataStruct } from "../typechain/contracts/ArkreenRECIssuance";
import { OffsetActionStruct }  from "../typechain/contracts/ArkreenBadge";

const MASK_OFFSET = BigNumber.from('0x8000000000000000')
const MASK_DETAILS = BigNumber.from('0xC000000000000000')

describe("ArkreenRECToken", () => {
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
    let arkreenRECToken:              ArkreenRECToken
    let arkreenBadge:                 ArkreenBadge
    let arkreenBadgeImage:            ArkreenBadgeImage

    const Miner_Manager       = 0         

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

      const ArkreenRECTokenFactory = await ethers.getContractFactory("ArkreenRECToken")
      arkreenRECToken = await upgrades.deployProxy(ArkreenRECTokenFactory,[arkreenRegistry.address, manager.address, '', '']) as ArkreenRECToken
      await arkreenRECToken.deployed()
      
      const ArkreenBadgeFactory = await ethers.getContractFactory("ArkreenBadge")
      arkreenBadge = await upgrades.deployProxy(ArkreenBadgeFactory,[arkreenRegistry.address]) as ArkreenBadge
      await arkreenBadge.deployed()
      
      const ArkreenBadgeImageFactory = await ethers.getContractFactory("ArkreenBadgeImage")
      arkreenBadgeImage = await ArkreenBadgeImageFactory.deploy()
      await arkreenBadgeImage.deployed()

      await arkreenBadge.setBadgeImage(arkreenBadgeImage.address)
  
      await AKREToken.transfer(owner1.address, expandTo18Decimals(10000000))
      await AKREToken.connect(owner1).approve(arkreenRECIssuance.address, expandTo18Decimals(10000000))
      await AKREToken.transfer(maker1.address, expandTo18Decimals(10000000))
      await AKREToken.connect(maker1).approve(arkreenRECIssuance.address, expandTo18Decimals(10000000))
      await AKREToken.connect(owner1).approve(arkreenMiner.address, expandTo18Decimals(10000000))
      await AKREToken.connect(maker1).approve(arkreenMiner.address, expandTo18Decimals(10000000))

      const miners = randomAddresses(2)
      await arkreenMiner.connect(manager).RemoteMinerOnboardInBatch([owner1.address, maker1.address], miners)

      const payer = maker1.address
      await arkreenMiner.setManager(Miner_Manager, manager.address)
      await arkreenMiner.ManageManufactures([payer], true)     

      await arkreenRegistry.addRECIssuer(manager.address, arkreenRECToken.address, "Arkreen Issuer")
      await arkreenRegistry.setRECIssuance(arkreenRECIssuance.address)
      await arkreenRegistry.setArkreenRetirement(arkreenBadge.address)

      await arkreenRECToken.setOffsetMappingLimit(20)

      return {AKREToken, arkreenMiner, arkreenRegistry, arkreenRECIssuance, arkreenRECToken, arkreenBadge}
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
        arkreenBadge = fixture.arkreenBadge

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

    it("ArkreenRECToken: Basics", async () => {
        expect(await arkreenRECToken.NAME()).to.equal("Arkreen REC Token");
        expect(await arkreenRECToken.SYMBOL()).to.equal("ART");
    });

    it("ArkreenRECToken: commitOffset basics", async () => {

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
  
      // commitOffset
      await mintARECMaker(5000)       
      await expect(arkreenRECToken.connect(owner1).commitOffset(expandTo9Decimals(0)))
              .to.be.revertedWith("ART: Zero Offset")

      await expect(arkreenRECToken.connect(owner1).commitOffset(expandTo9Decimals(2000)))
              .to.be.revertedWith("ERC20: burn amount exceeds balance")

      let lastBlock
      const tokenID = BigNumber.from(1)
      const balance_1 = await arkreenRECToken.balanceOf(owner1.address)
      const totalSupply = await arkreenRECToken.totalSupply()
      await arkreenRECToken.connect(owner1).commitOffset(expandTo9Decimals(10))
      expect(await arkreenRECToken.balanceOf(owner1.address)).to.equal(balance_1.sub(expandTo9Decimals(10)))
      expect(await arkreenRECToken.totalSupply()).to.equal(totalSupply.sub(expandTo9Decimals(10)))
      const offsetID1 = await arkreenBadge.offsetCounter()
      lastBlock = await ethers.provider.getBlock('latest')
      const action_1 = [  owner1.address, manager.address, expandTo9Decimals(10),    // Manger is the issuer address
                          tokenID.add(MASK_OFFSET), lastBlock.timestamp, false ]

      expect(await arkreenBadge.getOffsetActions(offsetID1)).to.deep.equal(action_1)

      expect(await arkreenBadge.partialARECIDExt(arkreenRECToken.address)).to.equal(1)
      expect(await arkreenBadge.partialAvailableAmountExt(arkreenRECToken.address)).to.equal(balance_1.sub(expandTo9Decimals(10)))
      
      await arkreenRECToken.connect(owner1).commitOffset(expandTo9Decimals(10))
      expect(await arkreenRECToken.balanceOf(owner1.address)).to.equal(balance_1.sub(expandTo9Decimals(20)))
      const offsetID2 = await arkreenBadge.offsetCounter()
      lastBlock = await ethers.provider.getBlock('latest')
      const action_2 = [  owner1.address, manager.address, expandTo9Decimals(10),
                          tokenID.add(MASK_OFFSET), lastBlock.timestamp, false ]

      expect(await arkreenBadge.partialARECIDExt(arkreenRECToken.address)).to.equal(1)
      expect(await arkreenBadge.partialAvailableAmountExt(arkreenRECToken.address)).to.equal(balance_1.sub(expandTo9Decimals(20)))                          

      expect(await arkreenBadge.getOffsetActions(offsetID2)).to.deep.equal(action_2)

      await expect(arkreenRECToken.connect(owner1).commitOffset(expandTo9Decimals(10)))
              .to.emit(arkreenRECToken, "OffsetFinished")
              .withArgs(owner1.address, expandTo9Decimals(10), offsetID2.add(1)) 

      expect(await arkreenBadge.partialARECIDExt(arkreenRECToken.address)).to.equal(1)
      expect(await arkreenBadge.partialAvailableAmountExt(arkreenRECToken.address)).to.equal(balance_1.sub(expandTo9Decimals(30)))     
      
      const recData: RECDataStruct = await arkreenRECIssuance.getRECData(tokenID)
      expect(recData.status).to.equal(BigNumber.from(RECStatus.Retired));      

      expect(await arkreenRECToken.totalOffset()).to.equal(expandTo9Decimals(30))
      await arkreenBadge.connect(owner1).mintCertificate(
                              owner1.address, owner1.address, "Owner","","Save Earth",[offsetID1,offsetID2])
            
    })

    it("ArkreenRECToken: commitOffsetFrom", async () => {

      // commitOffsetFrom
      await arkreenRECToken.connect(owner1).approve(owner2.address, expandTo9Decimals(1000))
      const balance_1 = await arkreenRECToken.balanceOf(owner1.address)
      const allowance_1 = await arkreenRECToken.allowance(owner1.address, owner2.address)
      const totalSupply = await arkreenRECToken.totalSupply()

      await arkreenRECToken.connect(owner2).commitOffsetFrom(owner1.address, expandTo9Decimals(10))

      expect(await arkreenRECToken.balanceOf(owner1.address)).to.equal(balance_1.sub(expandTo9Decimals(10)))
      expect(await arkreenRECToken.allowance(owner1.address, owner2.address)).to.equal(allowance_1.sub(expandTo9Decimals(10)))
      expect(await arkreenRECToken.totalSupply()).to.equal(totalSupply.sub(expandTo9Decimals(10)))
      const offsetID1 = await arkreenBadge.offsetCounter()

      await arkreenRECToken.connect(owner2).commitOffsetFrom(owner1.address, expandTo9Decimals(10))
      expect(await arkreenRECToken.balanceOf(owner1.address)).to.equal(balance_1.sub(expandTo9Decimals(20)))
      const offsetID2 = await arkreenBadge.offsetCounter()

      await expect(arkreenRECToken.connect(owner2).commitOffsetFrom(owner1.address, expandTo9Decimals(10)))
              .to.emit(arkreenRECToken, "OffsetFinished")
             .withArgs(owner1.address, expandTo9Decimals(10), offsetID2.add(1))

      expect(await arkreenRECToken.totalOffset()).to.equal(expandTo9Decimals(30))        
      const offsetID3 = await arkreenBadge.offsetCounter()              
     
      await arkreenBadge.connect(owner1).mintCertificate(
                             owner1.address, owner1.address, "Owner","","Save Earth",[offsetID1, offsetID2, offsetID3])
           
   })

    it("ArkreenRECToken: mintCertificate: By REC token", async () => {
      // offsetAndMintCertificate
      await arkreenRECToken.connect(owner1).offsetAndMintCertificate(
                                              owner1.address, "Owner","Alice","Save Earth",expandTo9Decimals(10)) 

       // commitOffset
      await arkreenRECToken.connect(owner1).commitOffset(expandTo9Decimals(10))
      const offsetID1 = await arkreenBadge.offsetCounter()

      await arkreenRECToken.connect(owner1).commitOffset(expandTo9Decimals(10))
      const offsetID2 = await arkreenBadge.offsetCounter()
      
      await arkreenRECToken.connect(owner1).commitOffset(expandTo9Decimals(10))
      const offsetID3 = await arkreenBadge.offsetCounter()

      // mintCertificate
      await arkreenBadge.connect(owner1).mintCertificate(owner1.address, owner1.address, "Owner","","Save Earth",[offsetID1,offsetID2]) 
      const certId = await arkreenBadge.totalSupply()
      const lastBlock = await ethers.provider.getBlock('latest')

      // attachOffsetEvents
      await arkreenBadge.connect(owner1).attachOffsetEvents(certId, [offsetID3])
      
      // updateCertificate
      await arkreenBadge.connect(owner1).updateCertificate(certId, owner1.address, "Kitty","Alice","")

      const offsetRecord = [owner1.address, owner1.address, "Kitty", "Alice", "Save Earth", 
                            BigNumber.from(lastBlock.timestamp), expandTo9Decimals(30), [offsetID1,offsetID2,offsetID3]]
      expect(await arkreenBadge.getCertificate(certId)).to.deep.equal(offsetRecord)
      

      const iamgeURL = await arkreenBadge.tokenURI(certId)
      //expect(iamgeURL).to.eq(urlData)
      console.log("QQQQQQQQQQQQ", iamgeURL)

      // attachOffsetEvents
      await arkreenRECToken.connect(owner1).commitOffset(expandTo9Decimals(10))
      const offsetID4 = await arkreenBadge.offsetCounter()
      await arkreenBadge.connect(owner1).attachOffsetEvents(certId, [offsetID4])        

  });

  describe("commitOffset: Details", () => {
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

      const mintFee = expandTo18Decimals(1000).mul(50)
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
      tokenID = await arkreenRECIssuance.totalSupply()

      await arkreenRECIssuance.connect(manager).certifyRECRequest(tokenID, "Serial12345678")
      await arkreenRECIssuance.connect(maker1).liquidizeREC(tokenID)
    }

    async function getAREC(): Promise<number[]> {

      const latestARECID = await arkreenRECToken.latestARECID()
      const arec_1 = await arkreenRECToken.allARECLiquidized(latestARECID)
      const arec_2 = await arkreenRECToken.allARECLiquidized(arec_1)
      const arec_3 = await arkreenRECToken.allARECLiquidized(arec_2)
      return [arec_1.toNumber(), arec_2.toNumber(), arec_3.toNumber(), latestARECID.toNumber()]
    }

    beforeEach(async () => {
      // Mint
      await arkreenRegistry.setArkreenMiner(arkreenMiner.address)
      const price0:BigNumber = expandTo18Decimals(50).div(expandTo9Decimals(1))
      await arkreenRECIssuance.updateARECMintPrice(AKREToken.address, price0)
    })

    it("Offset Details: 1 AREC", async () => {
      const balance_1 = await arkreenRECToken.balanceOf(owner1.address)
      await expect(arkreenRECToken.connect(owner1).commitOffset(expandTo9Decimals(1000)))
              .to.emit(arkreenRECToken, "OffsetFinished")
              .withArgs(owner1.address, expandTo9Decimals(1000), 1) 

      const balance_2 = await arkreenRECToken.balanceOf(owner1.address)
      expect(balance_2).to.equal(balance_1.sub(expandTo9Decimals(1000)))

      expect(await arkreenRECToken.latestARECID()).to.equal(0)

      expect(await arkreenRECIssuance.balanceOf(arkreenBadge.address)).to.equal(1)
      expect(await arkreenRECIssuance.balanceOf(arkreenBadge.address)).to.equal(1)

      expect(await arkreenBadge.detailsCounter()).to.equal(0)
    });

    it("Offset Details: 2 AREC", async () => {
      await mintAREC(5000)          // 2

      const balance_1 = await arkreenRECToken.balanceOf(owner1.address)
      await arkreenRECToken.connect(owner1).commitOffset(expandTo9Decimals(500))

      await expect(arkreenRECToken.connect(owner1).commitOffset(expandTo9Decimals(1500)))
              .to.emit(arkreenRECToken, "OffsetFinished")
              .withArgs(owner1.address, expandTo9Decimals(1500), 2) 

      const balance_2 = await arkreenRECToken.balanceOf(owner1.address)
      expect(balance_2).to.equal(balance_1.sub(expandTo9Decimals(2000)))

      expect(await arkreenRECToken.latestARECID()).to.equal(0)

      expect(await arkreenRECIssuance.balanceOf(arkreenBadge.address)).to.equal(2)
      expect(await arkreenBadge.detailsCounter()).to.equal(1)

      const detail_0 = [1, expandTo9Decimals(500)]
      const detail_1 = [2, expandTo9Decimals(1000)]

      const offsetDetails = await arkreenBadge.getOffsetDetails(1)
      expect(offsetDetails[0]).to.deep.equal(detail_0)
      expect(offsetDetails[1]).to.deep.equal(detail_1)

      expect(await arkreenBadge.OffsetDetails(1,0)).to.deep.equal(detail_0)
      expect(await arkreenBadge.OffsetDetails(1,1)).to.deep.equal(detail_1)

      await arkreenRECToken.connect(owner1).commitOffset(expandTo9Decimals(1500))
      await arkreenRECToken.connect(owner1).commitOffset(expandTo9Decimals(2500))
    });

    it("Offset Details: 17 AREC", async () => {     // Offset 17 NFT in one offset transaction
      await mintAREC(5000)        // 2 :  45
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
      await mintAREC(500)         // 20:  602

      const balance_1 = await arkreenRECToken.balanceOf(owner1.address)
      await arkreenRECToken.connect(owner1).commitOffset(expandTo9Decimals(1500))

      await expect(arkreenRECToken.connect(owner1).commitOffset(expandTo9Decimals(50000)))
              .to.emit(arkreenRECToken, "OffsetFinished")
              .withArgs(owner1.address, expandTo9Decimals(50000), 2) 

      const balance_2 = await arkreenRECToken.balanceOf(owner1.address)
      expect(balance_2).to.equal(balance_1.sub(expandTo9Decimals(1500 +50000)))

      expect(await arkreenRECToken.latestARECID()).to.equal(20)  // 18, 19, 20

      expect(await arkreenRECIssuance.balanceOf(arkreenBadge.address)).to.equal(17)
      expect(await arkreenBadge.detailsCounter()).to.equal(2)

      const detail_0 = [4, expandTo9Decimals(8000)]
      const detail_1 = [11, expandTo9Decimals(5000)]
      const detail_2 = [17, expandTo9Decimals(3100)]

      expect(await arkreenBadge.partialARECIDExt(arkreenRECToken.address)).to.equal(17)
      expect(await arkreenBadge.partialAvailableAmountExt(arkreenRECToken.address)).to.equal(expandTo9Decimals(9000-3100))

      const offsetDetails = await arkreenBadge.getOffsetDetails(2)
      expect(offsetDetails[2]).to.deep.equal(detail_0)
      expect(offsetDetails[9]).to.deep.equal(detail_1)
      expect(offsetDetails[15]).to.deep.equal(detail_2)

      expect(await arkreenBadge.OffsetDetails(2,2)).to.deep.equal(detail_0)
      expect(await arkreenBadge.OffsetDetails(2,9)).to.deep.equal(detail_1)
      expect(await arkreenBadge.OffsetDetails(2,15)).to.deep.equal(detail_2)
    });

    it("Offset Details: 20 AREC", async () => {     // Maximum 20 NFT in one offset transaction
      await mintAREC(5000)        // 2 :  45
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
      await mintAREC(500)         // 20:  602

      await mintAREC(400)         // 21:  606
      await mintAREC(300)         // 22:  609
      await mintAREC(8000)        // 23:  689
      await mintAREC(200)         // 24:  691

      const balance_1 = await arkreenRECToken.balanceOf(owner1.address)
      await arkreenRECToken.connect(owner1).commitOffset(expandTo9Decimals(1500))

      const balance_1_A = await arkreenRECToken.balanceOf(owner1.address)
      expect(balance_1_A).to.equal(balance_1.sub(expandTo9Decimals(1500)))

      await expect(arkreenRECToken.connect(owner1).commitOffset(expandTo9Decimals(60600)))
              .to.emit(arkreenRECToken, "OffsetFinished")
              .withArgs(owner1.address, expandTo9Decimals(60600), 2) 

      const balance_2 = await arkreenRECToken.balanceOf(owner1.address)
      expect(balance_2).to.equal(balance_1.sub(expandTo9Decimals(1500 +60600)))

      expect(await arkreenRECToken.latestARECID()).to.equal(24)  // 22,23,24

      expect(await arkreenRECIssuance.balanceOf(arkreenBadge.address)).to.equal(21)
      expect(await arkreenBadge.detailsCounter()).to.equal(2)

      const detail_0 = [2, expandTo9Decimals(4500)]
      const detail_1 = [10, expandTo9Decimals(3000)]
      const detail_2 = [21, expandTo9Decimals(400)]

      const offsetDetails = await arkreenBadge.getOffsetDetails(2)
      expect(offsetDetails[0]).to.deep.equal(detail_0)
      expect(offsetDetails[8]).to.deep.equal(detail_1)
      expect(offsetDetails[19]).to.deep.equal(detail_2)

      expect(await arkreenBadge.OffsetDetails(2,0)).to.deep.equal(detail_0)
      expect(await arkreenBadge.OffsetDetails(2,8)).to.deep.equal(detail_1)
      expect(await arkreenBadge.OffsetDetails(2,19)).to.deep.equal(detail_2)
    });

    it("Offset Details: 20 AREC gas used ", async () => {     // Maximum 20 NFT in one offset transaction
      await mintAREC(5000)        // 2 :  45
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
      await mintAREC(500)         // 20:  602

      await mintAREC(400)         // 21:  606
      await mintAREC(300)         // 22:  609
      await mintAREC(8000)        // 23:  689
      await mintAREC(200)         // 24:  691

      const tx_1 = await arkreenRECToken.connect(owner1).commitOffset(expandTo9Decimals(500))
      const receipt_1 = await tx_1.wait()
      console.log("commitOffset Gasfee:", receipt_1.gasUsed.toString())
//     expect(receipt_1.gasUsed).to.eq("429465")  // 429465 431647 429551 429573 429595 435553 435586 435300 432982 460991 461138  

      const tx_2 = await arkreenRECToken.connect(owner1).commitOffset(expandTo9Decimals(800))
      const receipt_2 = await tx_2.wait()
      console.log("commitOffset Gasfee:", receipt_2.gasUsed.toString())
//      expect(receipt_2.gasUsed).to.eq("412777")  // 414959 412863 412907 422169 422158 414450 442460 442607 423814 

      const tx_3 = await arkreenRECToken.connect(owner1).commitOffset(expandTo9Decimals(200))
      const receipt_3 = await tx_3.wait()
      console.log("commitOffset Gasfee:", receipt_3.gasUsed.toString())
//      expect(receipt_3.gasUsed).to.eq("204179")  // 204179 204263 207832 207824 204554 204554   206361

      const tx = await arkreenRECToken.connect(owner1).commitOffset(expandTo9Decimals(60600))
      const receipt = await tx.wait()
      console.log("commitOffset Gasfee:", receipt.gasUsed.toString())
//      expect(receipt.gasUsed).to.eq("2107852")  // 2107974 2108392 2108414 2190594 2190925 2753332 2756125  2110034
    });
  })


  describe("liquidizeREC", () => {
    let tokenID: BigNumber

    beforeEach(async () => {
      const startTime = 1564888526
      const endTime   = 1654888526
      
      let recMintRequest: RECRequestStruct = { 
        issuer: manager.address, startTime, endTime,
        amountREC: expandTo9Decimals(1000), 
        cID: "bafybeihepmxz4ytc4ht67j73nzurkvsiuxhsmxk27utnopzptpo7wuigte",
        region: 'Beijing',
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
      //    await arkreenRECIssuance.managePaymentToken(AKREToken.address, true)
      const price0:BigNumber = expandTo18Decimals(50).div(expandTo9Decimals(1))
      await arkreenRECIssuance.updateARECMintPrice(AKREToken.address, price0)

      await arkreenRECIssuance.connect(owner1).mintRECRequest(recMintRequest, signature)
      tokenID = await arkreenRECIssuance.totalSupply()

      await arkreenRECIssuance.connect(manager).certifyRECRequest(tokenID, "Serial12345678")

    })

    it("ArkreenRECIssuance: liquidizeREC", async () => {
      const total_init = await arkreenRECToken.totalLiquidized()
      await arkreenRECIssuance.connect(owner1).liquidizeREC(tokenID)
      expect(await arkreenRECToken.totalLiquidized()).to.equal(total_init.add(expandTo9Decimals(1000)));

    });

    it("ArkreenRECIssuance: liquidizeREC (Liquidation no fee)", async () => {
      await expect(arkreenRECToken.setRatioFee(20000))
            .to.be.revertedWith("ART: Wrong Data")

      await expect(arkreenRECToken.connect(owner1).setRatioFee(1000))
            .to.be.revertedWith("Ownable: caller is not the owner")

      await arkreenRECToken.setRatioFee(1000)
       const total_init = await arkreenRECToken.totalLiquidized()
      await arkreenRECIssuance.connect(owner1).liquidizeREC(tokenID)
      expect(await arkreenRECToken.totalLiquidized()).to.equal(total_init.add(expandTo9Decimals(1000)));

    });

    it("ArkreenRECIssuance: liquidizeREC (Liquidation fee)", async () => {
      await expect(arkreenRECToken.setReceiverFee(constants.AddressZero))
            .to.be.revertedWith("ART: Wrong Address")

      await expect(arkreenRECToken.connect(owner1).setReceiverFee(owner2.address))
            .to.be.revertedWith("Ownable: caller is not the owner")

      await arkreenRECToken.setReceiverFee(owner2.address)
      await arkreenRECToken.setRatioFee(1000)
      const total_init = await arkreenRECToken.totalLiquidized()
      await arkreenRECIssuance.connect(owner1).liquidizeREC(tokenID)
      expect(await arkreenRECToken.totalLiquidized()).to.equal(total_init.add(expandTo9Decimals(1000)));

      expect(await arkreenRECToken.balanceOf(owner1.address))
              .to.equal(expandTo9Decimals(1000).mul(9).div(10).add(total_init));
      expect(await arkreenRECToken.balanceOf(owner2.address)).to.equal(expandTo9Decimals(1000).div(10));

    });    
  })

  describe("Solidify", () => {
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
      tokenID = await arkreenRECIssuance.totalSupply()

      await arkreenRECIssuance.connect(manager).certifyRECRequest(tokenID, "Serial12345678")
      await arkreenRECIssuance.connect(maker1).liquidizeREC(tokenID)
    }

    async function getAREC(): Promise<number[]> {

      const latestARECID = await arkreenRECToken.latestARECID()
      const arec_1 = await arkreenRECToken.allARECLiquidized(latestARECID)
      const arec_2 = await arkreenRECToken.allARECLiquidized(arec_1)
      const arec_3 = await arkreenRECToken.allARECLiquidized(arec_2)
      return [arec_1.toNumber(), arec_2.toNumber(), arec_3.toNumber(), latestARECID.toNumber()]
    }

    beforeEach(async () => {
      // Mint
      await arkreenRegistry.setArkreenMiner(arkreenMiner.address)
      const price0:BigNumber = expandTo18Decimals(50).div(expandTo9Decimals(1))
      await arkreenRECIssuance.updateARECMintPrice(AKREToken.address, price0)
    })

    it("Solidify: 1 AREC", async () => {
      await expect(arkreenRECToken.connect(owner1).solidify(expandTo9Decimals(900)))
              .to.be.revertedWith("ART: Amount Too Less")

      const balance_1 = await arkreenRECToken.balanceOf(owner1.address)

      await expect(arkreenRECToken.connect(owner1).solidify(expandTo9Decimals(1000)))
              .to.emit(arkreenRECToken, "Solidify")
              .withArgs(owner1.address, expandTo9Decimals(1000), 1, 0) 

      const balance_2 = await arkreenRECToken.balanceOf(owner1.address)
      expect(balance_2).to.equal(balance_1.sub(expandTo9Decimals(1000)))

      expect(await arkreenRECToken.latestARECID()).to.equal(0)

      expect(await arkreenRECIssuance.balanceOf(owner1.address)).to.equal(1)

    });

    it("Solidify: 2AREC: 1000", async () => {
      await mintAREC(1000)

      expect(await arkreenRECToken.getARECInfo(3)).to.deep.equals([2,
        [[1,expandTo9Decimals(1000)], [2,expandTo9Decimals(1000)], [0,expandTo9Decimals(0)]]])   
      const arecData1: RECDataStruct = await arkreenRECIssuance.getRECData(1)
      const arecData2: RECDataStruct = await arkreenRECIssuance.getRECData(2)
      expect(arecData1.status).to.equal(RECStatus.Liquidized)
      expect(arecData2.status).to.equal(RECStatus.Liquidized)
      await arkreenRECToken.connect(owner1).solidify(expandTo9Decimals(1000))
    });

    it("Solidify: 2AREC: 1500", async () => {
      await mintAREC(1000)
      await expect(arkreenRECToken.connect(owner1).solidify(expandTo9Decimals(1500)))
              .to.emit(arkreenRECToken, "Solidify")
              .withArgs(owner1.address, expandTo9Decimals(1000), 1, 0) 
    });

    it("Solidify: 2AREC: 2000", async () => {
      await mintAREC(1000)
      await expect(arkreenRECToken.connect(owner1).solidify(expandTo9Decimals(2000)))
              .to.emit(arkreenRECToken, "Solidify")
              .withArgs(owner1.address, expandTo9Decimals(2000), 2, 0) 
    });

    it("Solidify: 6AREC: 6000", async () => {
    // await mintAREC(1000)      
      await mintAREC(5000)
      await mintAREC(600)
      await mintAREC(8000)
      await mintAREC(200)
      await mintAREC(1000)

      expect(await arkreenRECToken.balanceOf(owner1.address)).to.equal(expandTo9Decimals((10+50+6+80+2+10)*100))

      expect(await getAREC()).to.deep.equals([1,2,3,6])   

      await expect(arkreenRECToken.connect(owner1).solidify(expandTo9Decimals(1900)))   // 1000+600+200
              .to.emit(arkreenRECToken, "Solidify")
              .withArgs(owner1.address, expandTo9Decimals(1800), 3, 0) 
      expect(await getAREC()).to.deep.equals([2,4,6,6])         

      expect(await arkreenRECIssuance.balanceOf(owner1.address)).to.equal(3)   

      await expect(arkreenRECToken.connect(owner1).solidify(expandTo9Decimals(8000)))   // 5000+ 1000
              .to.emit(arkreenRECToken, "Solidify")
              .withArgs(owner1.address, expandTo9Decimals(6000), 2, 0) 
      expect(await getAREC()).to.deep.equals([4,4,4,4])                

      await expect(arkreenRECToken.connect(owner1).solidify(expandTo9Decimals(8500)))   // 8000
              .to.emit(arkreenRECToken, "Solidify")
              .withArgs(owner1.address, expandTo9Decimals(8000), 1, 0)   
      expect(await arkreenRECToken.latestARECID()).to.equals(0)     
      expect(await arkreenRECToken.balanceOf(owner1.address)).to.equal(expandTo9Decimals(0))
      expect(await arkreenRECIssuance.balanceOf(owner1.address)).to.equal(6)          
    });

    it("Solidify: 10AREC", async () => {
      // await mintAREC(1000)     // 1
      await mintAREC(5000)        // 2
      await mintAREC(600)         // 3
      await mintAREC(8000)        // 4
      await mintAREC(200)         // 5
      await mintAREC(1000)        // 6
      await mintAREC(2000)        // 7
      await mintAREC(9000)        // 8
      await mintAREC(800)         // 9
      await mintAREC(3000)        // 10
            
      expect(await arkreenRECIssuance.allRECLiquidized()).to.equal(
                      expandTo9Decimals(1000+5000+600+8000+200+1000+2000+9000+800+3000))

      await expect(arkreenRECToken.connect(owner1).solidify(expandTo9Decimals(1600)))   // 1000+600
              .to.emit(arkreenRECToken, "Solidify")
              .withArgs(owner1.address, expandTo9Decimals(1600), 2, 0) 
      expect(await getAREC()).to.deep.equals([2,4,5,10])                   

      await expect(arkreenRECToken.connect(owner1).solidify(expandTo9Decimals(6500)))   // 5000+200+1000
              .to.emit(arkreenRECToken, "Solidify")
              .withArgs(owner1.address, expandTo9Decimals(6200), 3, 0) 
      expect(await getAREC()).to.deep.equals([4,7,8,10])   

      await expect(arkreenRECToken.connect(owner1).solidify(expandTo9Decimals(9000)))   // 8000+800
              .to.emit(arkreenRECToken, "Solidify")
              .withArgs(owner1.address, expandTo9Decimals(8800), 2, 0) 
      expect(await getAREC()).to.deep.equals([7,8,10,10])     

      await expect(arkreenRECToken.connect(owner1).solidify(expandTo9Decimals(6000)))   // 2000+3000
              .to.emit(arkreenRECToken, "Solidify")
              .withArgs(owner1.address, expandTo9Decimals(5000), 2, 0) 
      expect(await getAREC()).to.deep.equals([8,8,8,8])    

      await expect(arkreenRECToken.connect(owner1).solidify(expandTo9Decimals(9000)))   // 9000
              .to.emit(arkreenRECToken, "Solidify")
              .withArgs(owner1.address, expandTo9Decimals(9000), 1, 0) 
      expect(await arkreenRECToken.latestARECID()).to.equals(0) 
      expect(await arkreenRECToken.balanceOf(owner1.address)).to.equal(expandTo9Decimals(0))
      expect(await arkreenRECIssuance.balanceOf(owner1.address)).to.equal(10)    
      expect(await arkreenRECIssuance.allRECLiquidized()).to.equal(0)
    })      

    it("Solidify: 30AREC", async () => {
      // await mintAREC(1000)     // 1
      await mintAREC(5000)        // 2 *
      await mintAREC(600)         // 3 *
      await mintAREC(8000)        // 4 *
      await mintAREC(900)         // 5 *
      await mintAREC(1000)        // 6 *
      await mintAREC(2000)        // 7 *
      await mintAREC(9000)        // 8 0E
      await mintAREC(800)         // 9 *
      await mintAREC(3000)        // 10 0E

      await mintAREC(5000)        // 11 0E
      await mintAREC(600)         // 12 *
      await mintAREC(8000)        // 13 1F
      await mintAREC(500)         // 14 0E
      await mintAREC(1000)        // 15 0E
      await mintAREC(2000)        // 16 0E
      await mintAREC(9000)        // 17 1F
      await mintAREC(800)         // 18 1F
      await mintAREC(3000)        // 19 1F
      await mintAREC(500)         // 20 1F

      await mintAREC(400)         // 21 *
      await mintAREC(300)         // 22 *
      await mintAREC(8000)        // 23 2G
      await mintAREC(200)         // 24 *
      await mintAREC(1000)        // 25 2G
      await mintAREC(2000)        // 26 3H
      await mintAREC(9000)        // 27 4I
      await mintAREC(8000)        // 28 3HetAREC
      await mintAREC(800)         // 29 2G
      await mintAREC(600)         // 30 1F

      await expect(arkreenRECToken.connect(owner1).solidify(expandTo9Decimals(1400)))   // 1000+400, 1+21
              .to.emit(arkreenRECToken, "Solidify")
              .withArgs(owner1.address, expandTo9Decimals(1400), 2, 0)    
      expect(await getAREC()).to.deep.equals([2,3,4,30])    
      expect(await arkreenRECToken.getARECInfo(3)).to.deep.equals([3,
          [[2,expandTo9Decimals(5000)], [3,expandTo9Decimals(600)], [4,expandTo9Decimals(8000)]]])    

      await expect(arkreenRECToken.connect(owner1).solidify(expandTo9Decimals(7600)))   // 5000+600+900+1000, 2+3+5+6
              .to.emit(arkreenRECToken, "Solidify")
              .withArgs(owner1.address, expandTo9Decimals(7500), 4, 0) 
      expect(await getAREC()).to.deep.equals([4,7,8,30])  
      expect(await arkreenRECToken.getARECInfo(3)).to.deep.equals([3,
        [[4,expandTo9Decimals(8000)], [7,expandTo9Decimals(2000)], [8,expandTo9Decimals(9000)]]])    


      await expect(arkreenRECToken.connect(owner1).solidify(expandTo9Decimals(8300)))   // 8000+300, 4+22
              .to.emit(arkreenRECToken, "Solidify")
              .withArgs(owner1.address, expandTo9Decimals(8300), 2, 0) 
      expect(await getAREC()).to.deep.equals([7,8,9,30])                

      await expect(arkreenRECToken.connect(owner1).solidify(expandTo9Decimals(3600)))   // 2000+900+600+200, 7+9+12+24
              .to.emit(arkreenRECToken, "Solidify")
              .withArgs(owner1.address, expandTo9Decimals(3600), 4, 0) 
      expect(await getAREC()).to.deep.equals([8,10,11,30])                

      await expect(arkreenRECToken.connect(owner1).solidify(expandTo9Decimals(20500)))   // E: 9000+3000+5000+500+1000+2000 
              .to.emit(arkreenRECToken, "Solidify")                                       // 8+10+11+14+15+16
              .withArgs(owner1.address, expandTo9Decimals(20500), 6, 0) 
      expect(await getAREC()).to.deep.equals([13,17,18,30])                

      await expect(arkreenRECToken.connect(owner1).solidify(expandTo9Decimals(22000)))   // F: 8000+9000+800+3000+500+600
              .to.emit(arkreenRECToken, "Solidify")                                       // 13+17+18+19+20+30 
              .withArgs(owner1.address, expandTo9Decimals(21900), 6, 0) 
      expect(await getAREC()).to.deep.equals([23,25,26,29])                

      await expect(arkreenRECToken.connect(owner1).solidify(expandTo9Decimals(10000)))   // G: 8000+1000+800
              .to.emit(arkreenRECToken, "Solidify")                                       // 23+25+29
              .withArgs(owner1.address, expandTo9Decimals(9800), 3, 0) 
      expect(await getAREC()).to.deep.equals([26,27,28,28])       
      expect(await arkreenRECToken.getARECInfo(3)).to.deep.equals([3,
        [[26,expandTo9Decimals(2000)], [27,expandTo9Decimals(9000)], [28,expandTo9Decimals(8000)]]])         
      
      await expect(arkreenRECToken.connect(owner1).solidify(expandTo9Decimals(10000)))   // H: 2000+8000
              .to.emit(arkreenRECToken, "Solidify")                                       // 26+28
              .withArgs(owner1.address, expandTo9Decimals(10000), 2, 0) 
       expect(await getAREC()).to.deep.equals([27,27,27,27]) 
       expect(await arkreenRECToken.getARECInfo(3)).to.deep.equals([1,
        [[27,expandTo9Decimals(9000)], [0,expandTo9Decimals(0)], [0,expandTo9Decimals(0)]]])             
       
      await expect(arkreenRECToken.connect(owner1).solidify(expandTo9Decimals(10000)))   // 4I: 9000
              .to.emit(arkreenRECToken, "Solidify")                                       // 27
              .withArgs(owner1.address, expandTo9Decimals(9000), 1, 0) 

      expect(await arkreenRECToken.getARECInfo(3)).to.deep.equals([0,
                [[0,expandTo9Decimals(0)], [0,expandTo9Decimals(0)], [0,expandTo9Decimals(0)]]])                 

      expect(await arkreenRECToken.latestARECID()).to.equals(0)
      expect(await arkreenRECToken.balanceOf(owner1.address)).to.equal(expandTo9Decimals(0))
      expect(await arkreenRECIssuance.balanceOf(owner1.address)).to.equal(30)          

    })    
    
    it("Solidify: 10AREC with fee charged ", async () => {
      await arkreenRECToken.setReceiverFee(owner2.address)
      await arkreenRECToken.setRatioFeeToSolidify(1000)

      // await mintAREC(1000)     // 1
      await mintAREC(5000)        // 2
      await mintAREC(600)         // 3
      await mintAREC(8000)        // 4
      await mintAREC(900)         // 5
      await mintAREC(1000)        // 6
      await mintAREC(2000)        // 7
      await mintAREC(9000)        // 8
      await mintAREC(800)         // 9
      await mintAREC(300)         // 10

      await expect(arkreenRECToken.connect(owner1).solidify(expandTo9Decimals(1050)))   // Fee not enough
              .to.be.revertedWith("ART: Amount Too Less")

      await expect(arkreenRECToken.connect(owner1).solidify(expandTo9Decimals(1100)))
              .to.emit(arkreenRECToken, "Solidify")
              .withArgs(owner1.address, expandTo9Decimals(1000), 1, expandTo9Decimals(100)) 
      expect(await getAREC()).to.deep.equals([2,3,4,10])  

      await expect(arkreenRECToken.connect(owner1).solidify(expandTo9Decimals(7050)))           // 5000+600+800
              .to.emit(arkreenRECToken, "Solidify")
              .withArgs(owner1.address, expandTo9Decimals(6400), 3, expandTo9Decimals(640))       // 7040 

      expect(await getAREC()).to.deep.equals([4,5,6,10])                
      await expect(arkreenRECToken.connect(owner1).solidify(expandTo9Decimals(11220)))             // 8000+900+1000+300 
              .to.emit(arkreenRECToken, "Solidify")
              .withArgs(owner1.address, expandTo9Decimals(10200), 4, expandTo9Decimals(1020))     //11220
      expect(await getAREC()).to.deep.equals([7,8,7,8])                

      await mintARECMaker(900)         // 11
      await mintARECMaker(5000)        // 12
      await mintARECMaker(1200)        // 13
      await mintARECMaker(800)         // 14

      expect(await getAREC()).to.deep.equals([7,8,11,14])                 

      await expect(arkreenRECToken.connect(owner1).solidify(expandTo9Decimals(12100)))              // 2000+9000 
                .to.be.revertedWith("ERC20: burn amount exceeds balance")

      await arkreenRECToken.connect(maker1).transfer(owner1.address, expandTo9Decimals(3740))    // 100+640+1020+1180 + 800: 3740

      await expect(arkreenRECToken.connect(owner1).solidify(expandTo9Decimals(12980)))              // 2000+9000+800
              .to.emit(arkreenRECToken, "Solidify")
              .withArgs(owner1.address, expandTo9Decimals(11800), 3, expandTo9Decimals(1180))      //12980

      expect(await arkreenRECToken.balanceOf(owner1.address)).to.equal(expandTo9Decimals(0))    
      
      await expect(arkreenRECToken.connect(maker1).solidify(expandTo9Decimals(2500)))               // 900+1200
              .to.emit(arkreenRECToken, "Solidify")
              .withArgs(maker1.address, expandTo9Decimals(2100), 2, expandTo9Decimals(210))        // 2310       

      expect(await arkreenRECToken.balanceOf(maker1.address)).to.equal(expandTo9Decimals(5000+800-3740-210))    
      expect(await arkreenRECIssuance.balanceOf(maker1.address)).to.equal(2)                      // 11,13
      expect(await arkreenRECToken.latestARECID()).to.equals(12)                      
    })
  })
});
