import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import { expect } from "chai";
import { constants, BigNumber, Contract } from 'ethers'
import { ethers, network, upgrades } from "hardhat";
import { ArkreenRECIssuanceExt__factory } from "../typechain";

import {
    ArkreenToken,
    ArkreenMiner,
    ArkreenRECIssuance,
    ArkreenRECIssuanceExt,
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
    let arkreenRECIssuanceExt:        ArkreenRECIssuanceExt


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

      const ArkreenRECIssuanceExtFactory = await ethers.getContractFactory("ArkreenRECIssuanceExt")
      const arkreenRECIssuanceExtImp = await ArkreenRECIssuanceExtFactory.deploy()
      await arkreenRECIssuanceExtImp.deployed()    

      await arkreenRECIssuance.setESGExtAddress(arkreenRECIssuanceExtImp.address)

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
  
      await AKREToken.transfer(owner1.address, expandTo18Decimals(20000000))
      await AKREToken.connect(owner1).approve(arkreenRECIssuance.address, expandTo18Decimals(20000000))
      await AKREToken.transfer(maker1.address, expandTo18Decimals(10000000))
      await AKREToken.connect(maker1).approve(arkreenRECIssuance.address, expandTo18Decimals(20000000))
      await AKREToken.connect(owner1).approve(arkreenMiner.address, expandTo18Decimals(20000000))
      await AKREToken.connect(maker1).approve(arkreenMiner.address, expandTo18Decimals(20000000))

      const miners = randomAddresses(2)
      await arkreenMiner.connect(manager).RemoteMinerOnboardInBatch([owner1.address, maker1.address], miners)

      const payer = maker1.address
      await arkreenMiner.setManager(Miner_Manager, manager.address)
      await arkreenMiner.ManageManufactures([payer], true)     

      await arkreenRegistry.addRECIssuer(manager.address, arkreenRECToken.address, "Arkreen Issuer")
      await arkreenRegistry.setRECIssuance(arkreenRECIssuance.address)
      await arkreenRegistry.setArkreenRetirement(arkreenBadge.address)
      await arkreenRECToken.setOffsetMappingLimit(20)

      arkreenRECIssuanceExt = ArkreenRECIssuanceExt__factory.connect(arkreenRECIssuance.address, deployer);

      await arkreenRegistry.newAssetAREC('Test ARE', manager.address, arkreenRECToken.address,
                  AKREToken.address, BigNumber.from("0x2b5e3af16b1880000"), 1000, 'HashKey ESG BTC' )

      return {AKREToken, arkreenMiner, arkreenRegistry, arkreenRECIssuance, arkreenRECToken, arkreenBadge, arkreenRECIssuanceExt}
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
        arkreenRECIssuanceExt = fixture.arkreenRECIssuanceExt

        let signature: SignatureStruct
        const mintFee = expandTo18Decimals(1000).mul(50)  
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

        await arkreenRECToken.setBridgedAssetType(1)         
        await arkreenRECIssuanceExt.manageMVPAddress(true,[owner1.address])         
  
        await arkreenRECIssuanceExt.connect(owner1).mintESGBatch(1, expandTo9Decimals(1000), signature)
        tokenID = await arkreenRECIssuanceExt.totalSupply()
  
        const startTime = 1564888526
        const endTime   = 1654888526
        const region = "Shanghai"
        const url = "https://www.arkreen.com/AREC/"
        const memo = "Test Update"   
        const cID = "bafybeihepmxz4ytc4ht67j73nzurkvsiuxhsmxk27utnopzptpo7wuigte"        
  
        await arkreenRECIssuanceExt.connect(owner1).updateRECDataExt(tokenID, startTime, endTime, cID, region, url, memo)     
        await arkreenRECIssuance.connect(manager).certifyRECRequest(tokenID, "Serial12345678")
        await arkreenRECIssuance.connect(owner1).liquidizeREC(tokenID)
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

    async function mintARECIREC(amountREC: number) {

      let signature: SignatureStruct
      const mintFee = expandTo18Decimals(amountREC).mul(50)  
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

      await arkreenRECIssuanceExt.connect(owner1).mintESGBatch(1, expandTo9Decimals(amountREC), signature)
      tokenID = await arkreenRECIssuanceExt.totalSupply()

      const startTime = 1564888526
      const endTime   = 1654888526
      const region = "Shanghai"
      const url = "https://www.arkreen.com/AREC/"
      const memo = "Test Update"   
      const cID = "bafybeihepmxz4ytc4ht67j73nzurkvsiuxhsmxk27utnopzptpo7wuigte"        

      await arkreenRECIssuanceExt.connect(owner1).updateRECDataExt(tokenID, startTime, endTime, cID, region, url, memo)     
      await arkreenRECIssuance.connect(manager).certifyRECRequest(tokenID, "Serial12345678")
      await arkreenRECIssuance.connect(owner1).liquidizeREC(tokenID)

    }

    beforeEach(async () => {
      // Mint
      await arkreenRegistry.setArkreenMiner(arkreenMiner.address)
      const price0:BigNumber = expandTo18Decimals(50).div(expandTo9Decimals(1))
      await arkreenRECIssuance.updateARECMintPrice(AKREToken.address, price0)
    })

    it("Offset Details: 18 AREC with bridge, Start with Bridged REC", async () => {     // Maximum 20 NFT in one offset transaction

 //     await arkreenRECToken.setBridgedAssetType(1)         
 //     await arkreenRECIssuanceExt.manageMVPAddress(true,[owner1.address])         

      await mintARECIREC(5000)          // 2 :  45
      await mintARECIREC(600)           // 3:   51
      await mintARECIREC(8000)          // 4:   131
      await mintARECIREC(900)           // 5:   140
      await mintARECIREC(1000)          // 6:   150

      await mintARECIREC(2000)          // 7:   170
      await mintARECIREC(9000)          // 8:   260
      await mintARECIREC(800)           // 9；  268
      await mintARECIREC(3000)          // 10:  298

      await mintARECIREC(5000)          // 11:  348
      await mintARECIREC(600)           // 12:  354
      await mintARECIREC(8000)          // 13:  434
      await mintARECIREC(500)           // 14:  439
      await mintARECIREC(1000)          // 15:  449
      await mintARECIREC(2000)          // 16:  469
      await mintARECIREC(9000)          // 17:  559
      await mintARECIREC(800)           // 18:  567
      await mintARECIREC(3000)          // 19： 597
      await mintARECIREC(20000)         // 20:  797;  137 left
      await mintARECIREC(4000)          // 21:  837
      await mintARECIREC(2000)          // 22:  857
      await mintARECIREC(3000)          // 23:  887

      const balance_1 = await arkreenRECToken.balanceOf(owner1.address)
      {
        await expect(arkreenRECToken.connect(owner1).commitOffset(expandTo9Decimals(1000)))
                  .to.emit(arkreenRECToken, "OffsetFinished")
                  .withArgs(owner1.address, expandTo9Decimals(1000), 1) 

        expect(await arkreenBadge.getDetailStatus(arkreenRECToken.address)).to.deep.eq([BigNumber.from(0), BigNumber.from(0)])
        expect(await arkreenBadge.getBridgeDetailStatus(arkreenRECToken.address)).to.deep.eq([expandTo9Decimals(0), BigNumber.from(1)])

        const balance_1_A = await arkreenRECToken.balanceOf(owner1.address)
        expect(balance_1_A).to.equal(balance_1.sub(expandTo9Decimals(1000)))
      }
      {
        await expect(arkreenRECToken.connect(owner1).commitOffset(expandTo9Decimals(500)))
                  .to.emit(arkreenRECToken, "OffsetFinished")
                  .withArgs(owner1.address, expandTo9Decimals(500), 2) 

        expect(await arkreenBadge.getDetailStatus(arkreenRECToken.address)).to.deep.eq([BigNumber.from(0), BigNumber.from(0)])
        expect(await arkreenBadge.getBridgeDetailStatus(arkreenRECToken.address)).to.deep.eq([expandTo9Decimals(4500), BigNumber.from(2)])

        const balance_1_A = await arkreenRECToken.balanceOf(owner1.address)
        expect(balance_1_A).to.equal(balance_1.sub(expandTo9Decimals(1000+500)))
      }

      {
        await expect(arkreenRECToken.connect(owner1).commitOffset(expandTo9Decimals(66000)))
                .to.emit(arkreenRECToken, "OffsetFinished")
                .withArgs(owner1.address, expandTo9Decimals(66000), 3) 

        expect(await arkreenBadge.getBridgeDetailStatus(arkreenRECToken.address)).to.deep.eq([expandTo9Decimals(20000-6300), BigNumber.from(20)])
        expect(await arkreenBadge.getDetailStatus(arkreenRECToken.address)).to.deep.eq([BigNumber.from(0), BigNumber.from(0)])

        const balance_2 = await arkreenRECToken.balanceOf(owner1.address)
        expect(balance_2).to.equal(balance_1.sub(expandTo9Decimals(1000 + 500 +66000)))
      }

      expect(await arkreenRECToken.latestARECID()).to.equal(0)  // 22,23,24
      expect(await arkreenRECToken.latestBridgeARECID()).to.equal(23)  // 21,22,23

      expect(await arkreenRECIssuance.balanceOf(arkreenBadge.address)).to.equal(20)
      expect(await arkreenBadge.detailsCounter()).to.equal(1)

      const detail_0 = [2, expandTo9Decimals(4500)]
      const detail_1 = [10, expandTo9Decimals(3000)]
      const detail_2 = [20, expandTo9Decimals(6300)]

      const offsetDetails = await arkreenBadge.getOffsetDetails(1)
      
      expect(offsetDetails[0]).to.deep.equal(detail_0)
      expect(offsetDetails[8]).to.deep.equal(detail_1)
      expect(offsetDetails[18]).to.deep.equal(detail_2)

      expect(await arkreenBadge.OffsetDetails(1,0)).to.deep.equal(detail_0)
      expect(await arkreenBadge.OffsetDetails(1,8)).to.deep.equal(detail_1)
      expect(await arkreenBadge.OffsetDetails(1,18)).to.deep.equal(detail_2)
      
      await expect(arkreenRECToken.connect(owner1).commitOffset(expandTo9Decimals(22800)))
                .to.be.revertedWith("ART: Too More Offset")
                
    })
  })
})
