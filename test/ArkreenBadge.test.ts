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
} from "../typechain";


import { time, loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { getApprovalDigest, expandTo18Decimals, randomAddresses, MinerType, RECStatus, expandTo9Decimals, urlBadgeData } from "./utils/utilities";
import { ecsign, fromRpcSig, ecrecover } from 'ethereumjs-util'
import { RECRequestStruct, SignatureStruct, RECDataStruct } from "../typechain/contracts/ArkreenRECIssuance";

describe("ArkreenBadge", () => {
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
      
      const ArkreenRetirementFactory = await ethers.getContractFactory("ArkreenBadge")
      arkreenBadge = await upgrades.deployProxy(ArkreenRetirementFactory,[arkreenRegistry.address]) as ArkreenBadge
      await arkreenBadge.deployed()           

      const ArkreenBadgeImageFactory = await ethers.getContractFactory("ArkreenBadgeImage")
      const arkreenBadgeImage = await ArkreenBadgeImageFactory.deploy()
      await arkreenBadgeImage.deployed()

      await arkreenBadge.setBadgeImage(arkreenBadgeImage.address)
  
      await AKREToken.transfer(owner1.address, expandTo18Decimals(100000))
      await AKREToken.connect(owner1).approve(arkreenRECIssuance.address, expandTo18Decimals(100000))
      await AKREToken.transfer(maker1.address, expandTo18Decimals(100000))
      await AKREToken.connect(maker1).approve(arkreenRECIssuance.address, expandTo18Decimals(100000))
      await AKREToken.connect(owner1).approve(arkreenMiner.address, expandTo18Decimals(100000))
      await AKREToken.connect(maker1).approve(arkreenMiner.address, expandTo18Decimals(100000))

      const payer = maker1.address
      const nonce = await AKREToken.nonces(payer)
      const gameMiner =  constants.AddressZero
      const feeRegister = expandTo18Decimals(200)

      const digest = await getApprovalDigest(
        AKREToken,
        { owner: payer, spender: arkreenMiner.address, value: feeRegister },
        nonce,
        constants.MaxUint256
      )

      const {v,r,s} = ecsign(Buffer.from(digest.slice(2), 'hex'), Buffer.from(privateKeyMaker.slice(2), 'hex'))
      const signature = { v, r, s, token: AKREToken.address, value:feeRegister, deadline: constants.MaxUint256 }    
 
      await arkreenMiner.setManager(Miner_Manager, manager.address)
      await arkreenMiner.ManageManufactures([payer], true)     

      let DTUMiner = randomAddresses(1)[0]
      await arkreenMiner.connect(manager).RemoteMinerOnboardInBatch([owner1.address], [DTUMiner])

      await arkreenRegistry.addRECIssuer(manager.address, arkreenRECToken.address, "Arkreen Issuer")
      await arkreenRegistry.setRECIssuance(arkreenRECIssuance.address)
      await arkreenRegistry.setArkreenRetirement(arkreenBadge.address)

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
        //        await arkreenRECIssuance.managePaymentToken(AKREToken.address, true)
        const price0:BigNumber = expandTo18Decimals(50).div(expandTo9Decimals(1))
        await arkreenRECIssuance.updateARECMintPrice(AKREToken.address, price0)

        await arkreenRECIssuance.connect(owner1).mintRECRequest(recMintRequest, signature)
  
        const tokenID = await arkreenRECIssuance.totalSupply()
        await arkreenRECIssuance.connect(manager).certifyRECRequest(tokenID, "Serial12345678")
  
        await arkreenRECIssuance.connect(owner1).liquidizeREC(tokenID)

    });

    it("ArkreenBadge: Basics", async () => {
        expect(await arkreenBadge.NAME()).to.equal("Arkreen REC Badge");
        expect(await arkreenBadge.SYMBOL()).to.equal("ARB");
    });

    it("ArkreenBadge: setBaseURI", async () => {
      expect(await arkreenBadge.baseURI()).to.equal("https://www.arkreen.com/badge/");
      await arkreenBadge.setBaseURI("https://www.arkreen.com/offset/")
      expect(await arkreenBadge.baseURI()).to.equal("https://www.arkreen.com/offset/");
    });

    it("ArkreenRECIssuance: supportsInterface", async () => {   
      expect(await arkreenBadge.supportsInterface("0x01ffc9a7")).to.equal(true);    // EIP165
      expect(await arkreenBadge.supportsInterface("0x80ac58cd")).to.equal(true);    // ERC721
      expect(await arkreenBadge.supportsInterface("0x780e9d63")).to.equal(true);    // ERC721Enumerable
      expect(await arkreenBadge.supportsInterface("0x5b5e139f")).to.equal(true);    // ERC721Metadata
      expect(await arkreenBadge.supportsInterface("0x150b7a02")).to.equal(true);    // ERC721TokenReceiver
      expect(await arkreenBadge.supportsInterface("0xb45a3c0e")).to.equal(true);    // EIP-5192
    });     

    describe("registerOffset", () => {
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
        //      await arkreenRECIssuance.managePaymentToken(AKREToken.address, true)
        const price0:BigNumber = expandTo18Decimals(50).div(expandTo9Decimals(1))
        await arkreenRECIssuance.updateARECMintPrice(AKREToken.address, price0)

        await arkreenRECIssuance.connect(owner1).mintRECRequest(recMintRequest, signature)
        tokenID = await arkreenRECIssuance.totalSupply()
        await arkreenRECIssuance.connect(manager).certifyRECRequest(tokenID, "Serial12345678")
      })

      it("registerOffset: Wrong Issuer", async () => {
        await expect(arkreenBadge.registerOffset(owner1.address, manager.address, 0, 0))
                .to.be.revertedWith("ARB: Wrong Issuer")
      })

      it("registerOffset: Less Amount (redeem) ", async () => {
        await arkreenBadge.setMinOffsetAmount(expandTo9Decimals(1000).add(1))
        await expect(arkreenRECIssuance.connect(owner1).redeem(tokenID))
                .to.be.revertedWith("ARB: Less Amount")
      })

      it("registerOffset: Less Amount (offset) ", async () => {
        await arkreenBadge.setMinOffsetAmount(expandTo9Decimals(10).add(1))
        await expect(arkreenRECToken.connect(owner1).commitOffset(expandTo9Decimals(10)))
                .to.be.revertedWith("ARB: Less Amount")
      })

      it("registerOffset: Normal (redeem) ", async () => {
        await arkreenRECIssuance.connect(owner1).redeem(tokenID)

        const userActions = await arkreenBadge.getUserEvents(owner1.address)

        const lastBlock = await ethers.provider.getBlock('latest')
        const offsetAction = [owner1.address, manager.address, expandTo9Decimals(1000),
                              tokenID, BigNumber.from(lastBlock.timestamp), false]
        
        expect(await arkreenBadge.offsetActions(userActions[userActions.length-1])).to.deep.equal(offsetAction)
        expect(await arkreenBadge.totalOffsetRegistered()).to.deep.eq(expandTo9Decimals(1000));                
      })

      it("registerOffset: Normal (offset) ", async () => {
        const MASK_OFFSET = BigNumber.from('0x8000000000000000')
        await arkreenRECToken.connect(owner1).commitOffset(expandTo9Decimals(10))

        const offsetID1 = await arkreenBadge.offsetCounter()
        const userActions = await arkreenBadge.getUserEvents(owner1.address)
        expect(offsetID1).to.equal(userActions[userActions.length-1])

        const lastBlock = await ethers.provider.getBlock('latest')
        const offsetAction = [owner1.address, manager.address, expandTo9Decimals(10),
                                MASK_OFFSET.add(1), BigNumber.from(lastBlock.timestamp), false]      // TokenId must be zero
        
        expect(await arkreenBadge.offsetActions(userActions[userActions.length-1])).to.deep.equal(offsetAction)
        expect(await arkreenBadge.totalOffsetRegistered()).to.deep.eq(expandTo9Decimals(10));                
      })
    })

    describe("onERC721Received", () => {
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
        //      await arkreenRECIssuance.managePaymentToken(AKREToken.address, true)
        const price0:BigNumber = expandTo18Decimals(50).div(expandTo9Decimals(1))
        await arkreenRECIssuance.updateARECMintPrice(AKREToken.address, price0)        
        await arkreenRECIssuance.connect(owner1).mintRECRequest(recMintRequest, signature)
        tokenID = await arkreenRECIssuance.totalSupply()
      })
      
      it("ArkreenBadge: onERC721Received Abnormal", async () => {
        await arkreenRECIssuance.connect(manager).certifyRECRequest(tokenID, "Serial12345678")   
        //  await expect(arkreenRECIssuance.connect(owner1).transferFrom(owner1.address, arkreenBadge.address, tokenID))
        //          .to.be.revertedWith("ARB: Refused")
                
        await expect(arkreenRECIssuance.connect(owner1)["safeTransferFrom(address,address,uint256)"](
                    owner1.address, arkreenBadge.address, tokenID))
                .to.be.revertedWith("ARB: Refused")
                
        await expect(arkreenRECIssuance.connect(owner1)["safeTransferFrom(address,address,uint256,bytes)"](
                  owner1.address, arkreenBadge.address, tokenID, "0x123456"))
              .to.be.revertedWith("ARB: Refused")
      })

      it("ArkreenBadge: onERC721Received Normal", async () => {
        await arkreenRECIssuance.connect(manager).certifyRECRequest(tokenID, "Serial12345678")   
        await arkreenRECIssuance.connect(owner1).redeem(tokenID)
        expect(await arkreenBadge.totalRedeemed()).to.equals(expandTo9Decimals(1000));    
      })      

      it("ArkreenBadge: onERC721Received Normal", async () => {
        await arkreenRECIssuance.connect(manager).certifyRECRequest(tokenID, "Serial12345678")  
        await arkreenRECIssuance.connect(owner1).setApprovalForAll(owner2.address,true)
        await arkreenRECIssuance.connect(owner2).redeemFrom(owner1.address, tokenID)
        expect(await arkreenBadge.totalRedeemed()).to.equals(expandTo9Decimals(1000));    
      })   
      
      it("ArkreenBadge: onERC721Received Normal", async () => {
        await arkreenRECIssuance.connect(manager).certifyRECRequest(tokenID, "Serial12345678")   
        await arkreenRECIssuance.connect(owner1).redeemAndMintCertificate(
                                        tokenID, owner1.address, "Owner","Alice","Save Earth")
        expect(await arkreenBadge.totalRedeemed()).to.equals(expandTo9Decimals(1000));    
      })   
    })    

    describe("mintCertificate", () => {
      it("ArkreenBadge: mintCertificate", async () => {
        // commitOffset
        await arkreenRECToken.connect(owner1).commitOffset(expandTo9Decimals(10))
        const offsetID1 = await arkreenBadge.offsetCounter()

        await arkreenRECToken.connect(owner1).commitOffset(expandTo9Decimals(10))
        const offsetID2 = await arkreenBadge.offsetCounter()

        // mintCertificate
        await expect(arkreenBadge.connect(owner2).mintCertificate(
                    owner1.address, owner1.address, "Owner","","Save Earth",[offsetID1,offsetID2])) 
                .to.be.revertedWith("ARB: Caller Not Allowed")

        await arkreenBadge.connect(owner1).mintCertificate(owner1.address, owner1.address, "Owner","","Save Earth",[offsetID1,offsetID2]) 
        const certId = await arkreenBadge.totalSupply()
        const lastBlock = await ethers.provider.getBlock('latest')

        const offsetRecord1 = [owner1.address, owner1.address, "Owner", "", "Save Earth", 
                              BigNumber.from(lastBlock.timestamp), expandTo9Decimals(20), [offsetID1,offsetID2]]

        expect(await arkreenBadge.getCertificate(certId)).to.deep.equal(offsetRecord1)    
        expect(await arkreenBadge.totalOffsetRetired()).to.equal(expandTo9Decimals(20))  

        const imageURL = await arkreenBadge.tokenURI(certId)   

        expect(imageURL.slice(0,8000)).to.eq(urlBadgeData.slice(0,8000))

/*        
        await arkreenBadge.setBaseURI("https://www.arkreen.com/offset/")
        expect( await arkreenBadge.tokenURI(certId)).to.equal("https://www.arkreen.com/offset/1"); 

        await arkreenBadge.updateCID([certId], ["bafkreidotvli35mt5rjywkps7aqxo3elc5dh6dlynd6yxcyipnfaghkoe4"])
        const cid = await arkreenBadge.cidBadge(certId)

        expect(cid).to.equal("bafkreidotvli35mt5rjywkps7aqxo3elc5dh6dlynd6yxcyipnfaghkoe4"); 
        expect( await arkreenBadge.tokenURI(certId)).to.equal("https://bafkreidotvli35mt5rjywkps7aqxo3elc5dh6dlynd6yxcyipnfaghkoe4.ipfs.w3s.link"); 
*/
      });
    })

    describe("updateCertificate", () => {
      it("ArkreenBadge: updateCertificate", async () => {
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
        await expect(arkreenBadge.connect(owner2).updateCertificate(certId, owner1.address, "Kitty","Alice",""))
                .to.be.revertedWith("ARB: Not Owner")

        expect(await arkreenBadge.connect(owner1).updateCertificate(certId, owner1.address, "Kitty","Alice",""))
                .to.emit(arkreenBadge, "OffsetCertificateUpdated")
                .withArgs(certId)         // Here offsetActionId is same as tokenID 

        const offsetRecord2 = [owner1.address, owner1.address, "Kitty", "Alice", "Save Earth", 
                              BigNumber.from(lastBlock.timestamp), expandTo9Decimals(30), [offsetID1,offsetID2,offsetID3]]

        expect(await arkreenBadge.getCertificate(certId)).to.deep.equal(offsetRecord2)

//        await time.increaseTo(lastBlock.timestamp + 3 *24 * 3600 + 1)    // 3 days
//        await expect(arkreenBadge.connect(owner1).updateCertificate(certId, owner1.address, "Kitty","Alice",""))
//                .to.be.revertedWith("ARB: Time Elapsed")
      });
    })

    describe("attachOffsetEvents", () => {

      it("ArkreenBadge: attachOffsetEvents", async () => {
          // commitOffset
        await arkreenRECToken.connect(owner1).commitOffset(expandTo9Decimals(10))
        const offsetID1 = await arkreenBadge.offsetCounter()

        await arkreenRECToken.connect(owner1).commitOffset(expandTo9Decimals(10))
        const offsetID2 = await arkreenBadge.offsetCounter()
        
        await arkreenRECToken.connect(owner1).commitOffset(expandTo9Decimals(10))
        const offsetID3 = await arkreenBadge.offsetCounter()

        // mintCertificate
        await arkreenBadge.connect(owner1).mintCertificate(owner1.address, owner1.address, 
                                                                "Owner","","Save Earth",[offsetID1,offsetID2]) 
        const certId = await arkreenBadge.totalSupply()
        const lastBlock = await ethers.provider.getBlock('latest')

        expect(await arkreenBadge.totalOffsetRetired()).to.equal(expandTo9Decimals(20))

        // attachOffsetEvents
        await arkreenBadge.connect(owner1).attachOffsetEvents(certId, [offsetID3])

        await expect(arkreenBadge.connect(owner1).attachOffsetEvents(certId, [offsetID3]))
                .to.be.revertedWith("ARB: Already Claimed")

        await arkreenRECToken.connect(owner1).commitOffset(expandTo9Decimals(10))
        const offsetID4 = await arkreenBadge.offsetCounter()
        
        // updateCertificate
        await expect(arkreenBadge.connect(owner2).attachOffsetEvents(certId, [offsetID4]))
                .to.be.revertedWith("ARB: Not Owner")

        await time.increaseTo(lastBlock.timestamp + 3 *24 * 3600 + 1)    // 3 days
        await expect(arkreenBadge.connect(owner1).attachOffsetEvents(certId, [offsetID4]))
                        .to.be.revertedWith("ARB: Time Elapsed")

        const offsetRecord2 = [owner1.address, owner1.address, "Owner", "", "Save Earth", 
                              BigNumber.from(lastBlock.timestamp), expandTo9Decimals(30), [offsetID1,offsetID2,offsetID3]]

        expect(await arkreenBadge.getCertificate(certId)).to.deep.equal(offsetRecord2)
      });
    })

    describe("SBT Test", () => {
        it("ArkreenBadge: Locked event emitted", async () => {
              // commitOffset
            await arkreenRECToken.connect(owner1).commitOffset(expandTo9Decimals(10))
            const offsetID1 = await arkreenBadge.offsetCounter()

            await arkreenRECToken.connect(owner1).commitOffset(expandTo9Decimals(10))
            const offsetID2 = await arkreenBadge.offsetCounter()
            
            await arkreenRECToken.connect(owner1).commitOffset(expandTo9Decimals(10))
            const offsetID3 = await arkreenBadge.offsetCounter()

            // mintCertificate
            await expect(arkreenBadge.connect(owner1).mintCertificate(owner1.address, owner1.address, 
                                                                    "Owner","","Save Earth",[offsetID1,offsetID2, offsetID3])) 
                    .to.emit(arkreenBadge, "OffsetCertificateMinted")
                    .withArgs(1)
                    .to.emit(arkreenBadge, "Locked")
                    .withArgs(1)
          }
        );

        it("ArkreenBadge: Transfer not allowed, ", async () => {
            // commitOffset
          await arkreenRECToken.connect(owner1).commitOffset(expandTo9Decimals(10))
          const offsetID1 = await arkreenBadge.offsetCounter()

          await arkreenRECToken.connect(owner1).commitOffset(expandTo9Decimals(10))
          const offsetID2 = await arkreenBadge.offsetCounter()
          
          await arkreenRECToken.connect(owner1).commitOffset(expandTo9Decimals(10))
          const offsetID3 = await arkreenBadge.offsetCounter()

          // mintCertificate
          await arkreenBadge.connect(owner1).mintCertificate(owner1.address, owner1.address, 
                                                                  "Owner","","Save Earth",[offsetID1,offsetID2])

          // mintCertificate
          await arkreenBadge.connect(owner1).mintCertificate(owner1.address, owner1.address, 
                    "Owner", "" , "Save Earth", [offsetID3])                                                                  

          const tokenID = await arkreenBadge.tokenOfOwnerByIndex(owner1.address, 0)
          await expect(arkreenBadge.connect(owner1).transferFrom(owner1.address, owner2.address,tokenID))
                  .to.be.revertedWith("ARB: Transfer Not Allowed")
        });

        it("ArkreenBadge: locking status", async () => {
            // commitOffset
          await arkreenRECToken.connect(owner1).commitOffset(expandTo9Decimals(10))
          const offsetID1 = await arkreenBadge.offsetCounter()

          await arkreenRECToken.connect(owner1).commitOffset(expandTo9Decimals(10))
          const offsetID2 = await arkreenBadge.offsetCounter()
          
          await arkreenRECToken.connect(owner1).commitOffset(expandTo9Decimals(10))
          const offsetID3 = await arkreenBadge.offsetCounter()

          // mintCertificate
          await arkreenBadge.connect(owner1).mintCertificate(owner1.address, owner1.address, 
                                                                  "Owner","","Save Earth",[offsetID1,offsetID2])
          const tokenID1 = await arkreenBadge.tokenOfOwnerByIndex(owner1.address, 0)
          expect(await arkreenBadge.locked(tokenID1)).to.equal(true)

          // mintCertificate
          await arkreenBadge.connect(owner1).mintCertificate(owner1.address, owner1.address, 
                    "Owner", "" , "Save Earth", [offsetID3])                                                                  
          const tokenID2 = await arkreenBadge.tokenOfOwnerByIndex(owner1.address, 0)
          expect(await arkreenBadge.locked(tokenID2)).to.equal(true)
          expect(await arkreenBadge.getVersion()).to.equal('0.3.0')
      });        

    })
});
