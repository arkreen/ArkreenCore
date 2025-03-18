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
    ArkreenBadge
} from "../typechain";

import { time, loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { getApprovalDigest, expandTo18Decimals, randomAddresses, MinerType, RECStatus, expandTo9Decimals } from "./utils/utilities";
import { ecsign, fromRpcSig, ecrecover } from 'ethereumjs-util'
import { RECRequestStruct, SignatureStruct, RECDataStruct } from "../typechain/contracts/ArkreenRECIssuance";

describe("ArkreenRECIssuance", () => {
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
    let arkreenRetirement:            ArkreenBadge

//    const FORMAL_LAUNCH = 1682913600;         // 2023-05-01, 12:00:00
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
      const arkreenRECIssuanceExt = await ArkreenRECIssuanceExtFactory.deploy()
      await arkreenRECIssuanceExt.deployed()    
      
      await arkreenRECIssuance.setESGExtAddress(arkreenRECIssuanceExt.address)

      const ArkreenRECIssuanceImageLogoFactory = await ethers.getContractFactory("ArkreenRECIssuanceImageLogo")
      const arkreenRECIssuanceImageLogo = await ArkreenRECIssuanceImageLogoFactory.deploy()
      await arkreenRECIssuanceImageLogo.deployed()

      const ArkreenRECIssuanceImageFactory = await ethers.getContractFactory("ArkreenRECIssuanceImage")
      const arkreenRECIssuanceImage = await ArkreenRECIssuanceImageFactory.deploy(arkreenRECIssuance.address,arkreenRECIssuanceImageLogo.address)
      await arkreenRECIssuanceImage.deployed()

      await arkreenRECIssuance.setARECImage(arkreenRECIssuanceImage.address)

      const ArkreenRECTokenFactory = await ethers.getContractFactory("ArkreenRECToken")
      arkreenRECToken = await upgrades.deployProxy(ArkreenRECTokenFactory,[arkreenRegistry.address, manager.address,'','']) as ArkreenRECToken
      await arkreenRECToken.deployed()     
      
      const ArkreenRetirementFactory = await ethers.getContractFactory("ArkreenBadge")
      arkreenRetirement = await upgrades.deployProxy(ArkreenRetirementFactory,[arkreenRegistry.address]) as ArkreenBadge
      await arkreenRetirement.deployed()           
  
      await AKREToken.transfer(owner1.address, expandTo18Decimals(100000))
      await AKREToken.connect(owner1).approve(arkreenRECIssuance.address, expandTo18Decimals(100000))
      await AKREToken.transfer(maker1.address, expandTo18Decimals(100000))
      await AKREToken.connect(maker1).approve(arkreenRECIssuance.address, expandTo18Decimals(100000))
      await AKREToken.connect(owner1).approve(arkreenMiner.address, expandTo18Decimals(100000))
      await AKREToken.connect(maker1).approve(arkreenMiner.address, expandTo18Decimals(100000))

      const payer = maker1.address

      let DTUMiner = randomAddresses(1)[0]
      await arkreenMiner.connect(manager).RemoteMinerOnboardInBatch([owner1.address], [DTUMiner])

      await arkreenMiner.setManager(Miner_Manager, manager.address)
      await arkreenMiner.ManageManufactures([payer], true)     

      await arkreenRegistry.addRECIssuer(manager.address, arkreenRECToken.address, "Arkreen Issuer")
      await arkreenRegistry.setRECIssuance(arkreenRECIssuance.address)
      await arkreenRegistry.setArkreenRetirement(arkreenRetirement.address)

      return {AKREToken, arkreenMiner, arkreenRegistry, arkreenRECIssuance, arkreenRECToken, arkreenRetirement}
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
    });

    it("ArkreenRECIssuance: Basics", async () => {
        expect(await arkreenRECIssuance.NAME()).to.equal("Arkreen RE Certificate");
        expect(await arkreenRECIssuance.SYMBOL()).to.equal("AREC");
    });

    it("ArkreenRECIssuance: setBaseURI", async () => {
      expect(await arkreenRECIssuance.baseURI()).to.equal("https://www.arkreen.com/AREC/");
      await arkreenRECIssuance.setBaseURI("https://www.arkreen.com/A-REC/")
      expect(await arkreenRECIssuance.baseURI()).to.equal("https://www.arkreen.com/A-REC/");
    });

    it("ArkreenRECIssuance: supportsInterface", async () => {      
      expect(await arkreenRECIssuance.supportsInterface("0x01ffc9a7")).to.equal(true);    // EIP165
      expect(await arkreenRECIssuance.supportsInterface("0x80ac58cd")).to.equal(true);    // ERC721
      expect(await arkreenRECIssuance.supportsInterface("0x780e9d63")).to.equal(true);    // ERC721Enumerable
      expect(await arkreenRECIssuance.supportsInterface("0x5b5e139f")).to.equal(true);    // ERC721Metadata
      expect(await arkreenRECIssuance.supportsInterface("0x150b7a02")).to.equal(false);   // ERC721TokenReceiver
    });   

   
    describe("ARECMintPrice related", () => {

      let TokenA: ArkreenToken
      let TokenB: ArkreenToken
      let TokenC: ArkreenToken
      let TokenD: ArkreenToken
      let arkreenRECIssuanceExt: ArkreenRECIssuanceExt

      beforeEach(async () => {
        const ERC20Factory = await ethers.getContractFactory("ArkreenToken");
        TokenA = await upgrades.deployProxy(ERC20Factory, [10_000_000_000, deployer.address,'','']) as ArkreenToken
        await TokenA.deployed();
        TokenB = await upgrades.deployProxy(ERC20Factory, [10_000_000_000, deployer.address,'','']) as ArkreenToken
        await TokenB.deployed();
        TokenC = await upgrades.deployProxy(ERC20Factory, [10_000_000_000, deployer.address,'','']) as ArkreenToken
        await TokenC.deployed();  
        TokenD = await upgrades.deployProxy(ERC20Factory, [10_000_000_000, deployer.address,'','']) as ArkreenToken
        await TokenD.deployed();     
        arkreenRECIssuanceExt = ArkreenRECIssuanceExt__factory.connect(arkreenRECIssuance.address, deployer);       
        
      })

      it("ArkreenRECIssuance: updateARECMintPrice Normal", async () => {
        // Normal
        const price0:BigNumber = expandTo18Decimals(50)
        const price1:BigNumber = expandTo18Decimals(60)
        const price2:BigNumber = expandTo18Decimals(70)
        const price3:BigNumber = expandTo18Decimals(80)
        const price4:BigNumber = expandTo18Decimals(90)

        await arkreenRECIssuance.updateARECMintPrice(AKREToken.address, price0)
        await arkreenRECIssuance.updateARECMintPrice(TokenA.address, price1)
        await arkreenRECIssuance.updateARECMintPrice(TokenB.address, price2)
        await arkreenRECIssuance.updateARECMintPrice(TokenC.address, price3)
        await arkreenRECIssuance.updateARECMintPrice(TokenD.address, price4)

        const priceList0 = [ [AKREToken.address, price0],
                            [TokenA.address, price1],
                            [TokenB.address, price2],
                            [TokenC.address, price3],
                            [TokenD.address, price4] ]

        let allARECMintPrice
        allARECMintPrice = await arkreenRECIssuanceExt.allARECMintPrice()
        expect(allARECMintPrice).to.deep.eq(priceList0);

        //  Remove TokenA
        await arkreenRECIssuance.updateARECMintPrice(TokenA.address, 0)
        const priceList1 = [ [AKREToken.address, price0],
                              [TokenD.address, price4],
                              [TokenB.address, price2],
                              [TokenC.address, price3] ]
        allARECMintPrice = await arkreenRECIssuanceExt.allARECMintPrice()                            
        expect(allARECMintPrice).to.deep.eq(priceList1);   
        
//        console.log('allARECMintPrice', allARECMintPrice, priceList1)

        //  Update TokenB
        await arkreenRECIssuance.updateARECMintPrice(TokenB.address, price4)
        const priceList2 = [ [AKREToken.address, price0],
                              [TokenD.address, price4],
                              [TokenB.address, price4],
                              [TokenC.address, price3] ]
        allARECMintPrice = await arkreenRECIssuanceExt.allARECMintPrice()                            
        expect(allARECMintPrice).to.deep.eq(priceList2);   

        //  add TokenA
        await arkreenRECIssuance.updateARECMintPrice(TokenA.address, price2)
        const priceList3 = [ [AKREToken.address, price0],
                              [TokenD.address, price4],
                              [TokenB.address, price4],
                              [TokenC.address, price3],
                              [TokenA.address, price2],
                             ]
        allARECMintPrice = await arkreenRECIssuanceExt.allARECMintPrice()                            
        expect(allARECMintPrice).to.deep.eq(priceList3);
        
        // Not Owner
        await expect(arkreenRECIssuance.connect(owner1).updateARECMintPrice(TokenA.address, price2))
                .to.be.revertedWith("Ownable: caller is not the owner") 

        // Not contract                              
        await expect(arkreenRECIssuance.updateARECMintPrice(owner1.address, price2))
                .to.be.revertedWith("AREC: Wrong token") 

        // Zero price      
        await arkreenRECIssuance.updateARECMintPrice(TokenA.address, 0)                        
        await expect(arkreenRECIssuance.updateARECMintPrice(TokenA.address, 0))
                .to.be.revertedWith("AREC: Zero Price") 
      })
    })

    describe("mintRECRequest", () => {
      let signature: SignatureStruct
      let recMintRequest: RECRequestStruct 
      const startTime = 1564888526
      const endTime   = 1654888526
      const mintFee = expandTo18Decimals(1000).mul(50)      

      beforeEach(async () => {
        recMintRequest = { 
          issuer: manager.address, startTime, endTime,
          amountREC: expandTo9Decimals(1000), 
          cID: "bafybeihepmxz4ytc4ht67j73nzurkvsiuxhsmxk27utnopzptpo7wuigte", 
          region: 'Beijing',
          url:"", memo:""
        } 
        const nonce1 = await AKREToken.nonces(owner1.address)
        const digest1 = await getApprovalDigest(
                                AKREToken,
                                { owner: owner1.address, spender: arkreenRECIssuance.address, value: mintFee },
                                nonce1,
                                constants.MaxUint256
                              )
        const { v,r,s } = ecsign(Buffer.from(digest1.slice(2), 'hex'), Buffer.from(privateKeyOwner.slice(2), 'hex'))
        signature = { v, r, s, token: AKREToken.address, value:mintFee, deadline: constants.MaxUint256 } 
      })

      it("ArkreenRECIssuance: mintRECRequest Abnormal", async () => {
        // Wrong Issuer
        recMintRequest.issuer = maker1.address
        await expect(arkreenRECIssuance.connect(owner1).mintRECRequest(recMintRequest, signature))
                .to.be.revertedWith("AREC: Wrong Issuer") 
        recMintRequest.issuer = manager.address    

        recMintRequest.startTime = 1654888526 + 10
        await expect(arkreenRECIssuance.connect(owner1).mintRECRequest(recMintRequest, signature))
                .to.be.revertedWith("AREC: Wrong Period") 
        recMintRequest.startTime = 1564888526        

        // Miner Contract not set
        await expect(arkreenRECIssuance.connect(owner1).mintRECRequest(recMintRequest, signature))
                .to.be.revertedWith("Arkreen: Zero Miner Address") 
        await arkreenRegistry.setArkreenMiner(arkreenMiner.address)

        // Not Miner
        /////////////////////////////////////////////////////////
//        await expect(arkreenRECIssuance.connect(owner2).mintRECRequest(recMintRequest, signature))
//                .to.be.revertedWith("AREC: Not Miner")                 
        /////////////////////////////////////////////////////////

        // Payment token not set  
        signature.token = maker1.address              
        await expect(arkreenRECIssuance.connect(owner1).mintRECRequest(recMintRequest, signature))
                .to.be.revertedWith("AREC: Wrong Payment Token") 
        signature.token = AKREToken.address  

        signature.value = expandTo18Decimals(50 * 1000 + 1)

        const price0:BigNumber = expandTo18Decimals(50).div(expandTo9Decimals(1))
        await arkreenRECIssuance.updateARECMintPrice(AKREToken.address, price0)

        await expect(arkreenRECIssuance.connect(owner1).mintRECRequest(recMintRequest, signature))
                .to.be.revertedWith("ERC20Permit: invalid signature") 
        signature.value = expandTo18Decimals(100)

        // Deadline expired
        const lastBlock = await ethers.provider.getBlock('latest')
        signature.deadline = BigNumber.from(lastBlock.timestamp + 600)

        await network.provider.send("evm_increaseTime", [601]);
        await expect(arkreenRECIssuance.connect(owner1).mintRECRequest(recMintRequest, signature))
                .to.be.revertedWith("RECIssuance: EXPIRED") 
      });

      it("ArkreenRECIssuance: mintRECRequest Normal", async () => {
        // Normal
        await arkreenRegistry.setArkreenMiner(arkreenMiner.address)        

        const price0:BigNumber = expandTo18Decimals(50).div(expandTo9Decimals(1))
        await arkreenRECIssuance.updateARECMintPrice(AKREToken.address, price0)       

        const balanceArkreenRECIssuance = await AKREToken.balanceOf(arkreenRECIssuance.address)
        await arkreenRECIssuance.connect(owner1).mintRECRequest(recMintRequest, signature)

        let recData = [ manager.address,  "",  owner1.address,
                        startTime,  endTime,
                        expandTo9Decimals(1000), 
                        BigNumber.from(RECStatus.Pending),
                        "bafybeihepmxz4ytc4ht67j73nzurkvsiuxhsmxk27utnopzptpo7wuigte", 
                        'Beijing',
                        "", "", 0 ]

        expect(await arkreenRECIssuance.getRECData(1)).to.deep.eq(recData);

        let payInfo = [AKREToken.address, mintFee]
        expect(await arkreenRECIssuance.allPayInfo(1)).to.deep.eq(payInfo);
        
        expect(await AKREToken.balanceOf(arkreenRECIssuance.address)).to.equal(balanceArkreenRECIssuance.add(mintFee))
      })
    })

    describe("rejectRECRequest", () => {
      let tokenID: BigNumber
      let signature: SignatureStruct
      let recMintRequest: RECRequestStruct 
      const startTime = 1564888526
      const endTime   = 1654888526
      const mintFee = expandTo18Decimals(100)      

      beforeEach(async () => {
        recMintRequest = { 
          issuer: manager.address, startTime, endTime,
          amountREC: BigNumber.from(1000), 
          cID: "bafybeihepmxz4ytc4ht67j73nzurkvsiuxhsmxk27utnopzptpo7wuigte", 
          region: 'Beijing',
          url:"", memo:""
        } 
        const nonce1 = await AKREToken.nonces(owner1.address)
        const digest1 = await getApprovalDigest(
                                AKREToken,
                                { owner: owner1.address, spender: arkreenRECIssuance.address, value: mintFee },
                                nonce1,
                                constants.MaxUint256
                              )
        const { v,r,s } = ecsign(Buffer.from(digest1.slice(2), 'hex'), Buffer.from(privateKeyOwner.slice(2), 'hex'))
        signature = { v, r, s, token: AKREToken.address, value:mintFee, deadline: constants.MaxUint256 } 

        // Normal
        await arkreenRegistry.setArkreenMiner(arkreenMiner.address)   
        const price0:BigNumber = expandTo18Decimals(50).div(expandTo9Decimals(1))
        await arkreenRECIssuance.updateARECMintPrice(AKREToken.address, price0)

        await arkreenRECIssuance.connect(owner1).mintRECRequest(recMintRequest, signature)
        tokenID = await arkreenRECIssuance.totalSupply()
      })

      it("ArkreenRECIssuance: rejectRECRequest", async () => {
        // Not issuer
        await expect(arkreenRECIssuance.connect(maker1).rejectRECRequest(tokenID))
                .to.be.revertedWith("AREC: Not Issuer") 

        await arkreenRegistry.addRECIssuer(maker1.address, arkreenRECToken.address, "Arkreen Issuer Maker") 

        await expect(arkreenRECIssuance.connect(maker1).rejectRECRequest(tokenID))
                .to.be.revertedWith("AREC: Wrong Issuer")                       

        await expect(arkreenRECIssuance.connect(manager).rejectRECRequest(tokenID))
                .to.emit(arkreenRECIssuance, "RECRejected")
                .withArgs(tokenID)
        
        const recData: RECDataStruct = await arkreenRECIssuance.getRECData(tokenID)
        expect(recData.status).to.equal(BigNumber.from(RECStatus.Rejected));                      

        await expect(arkreenRECIssuance.connect(manager).rejectRECRequest(tokenID))
                .to.be.revertedWith("AREC: Wrong Status")    
      })
    })

    describe("updateRECData", () => {
      let tokenID: BigNumber
      let signature: SignatureStruct
      let recMintRequest: RECRequestStruct 
      const startTime = 1564888526
      const endTime   = 1654888526
      const mintFee = expandTo18Decimals(100)    

      const region = "Shanghai"
      const url = "https://www.arkreen.com/AREC/"
      const memo = "Test Update"    
      const price0:BigNumber = expandTo18Decimals(50).div(expandTo9Decimals(1))    

      beforeEach(async () => {
        recMintRequest = { 
          issuer: manager.address, startTime, endTime,
          amountREC: BigNumber.from(1000), 
          cID: "bafybeihepmxz4ytc4ht67j73nzurkvsiuxhsmxk27utnopzptpo7wuigte", 
          region: 'Beijing',
          url:"", memo:""
        } 
        const nonce1 = await AKREToken.nonces(owner1.address)
        const digest1 = await getApprovalDigest(
                                AKREToken,
                                { owner: owner1.address, spender: arkreenRECIssuance.address, value: mintFee },
                                nonce1,
                                constants.MaxUint256
                              )
        const { v,r,s } = ecsign(Buffer.from(digest1.slice(2), 'hex'), Buffer.from(privateKeyOwner.slice(2), 'hex'))
        signature = { v, r, s, token: AKREToken.address, value:mintFee, deadline: constants.MaxUint256 } 

        // Normal
        await arkreenRegistry.setArkreenMiner(arkreenMiner.address)      
        await arkreenRECIssuance.updateARECMintPrice(AKREToken.address, price0)
        
        await arkreenRECIssuance.connect(owner1).mintRECRequest(recMintRequest, signature)
        tokenID = await arkreenRECIssuance.totalSupply()
      })

      it("ArkreenRECIssuance: updateRECData Abnormal", async () => {
        await expect(arkreenRECIssuance.connect(owner2).updateRECData(tokenID, maker1.address, region, url, memo ))
                .to.be.revertedWith("AREC: Not Owner") 

        await expect(arkreenRECIssuance.connect(owner1).updateRECData(tokenID, maker1.address, region, url, memo ))
                .to.be.revertedWith("AREC: Wrong Issuer") 

        await arkreenRECIssuance.connect(manager).rejectRECRequest(tokenID)  
        await expect(arkreenRECIssuance.connect(owner1).updateRECData(tokenID, maker1.address, region, url, memo ))
                .to.be.revertedWith("AREC: Wrong Issuer")  
                
        let arkreenRECIssuanceExt: ArkreenRECIssuanceExt
        arkreenRECIssuanceExt = ArkreenRECIssuanceExt__factory.connect(arkreenRECIssuance.address, deployer);

        await arkreenRECIssuanceExt.connect(owner1).cancelRECRequest(tokenID )

        await expect(arkreenRECIssuance.connect(owner1).updateRECData(tokenID, manager.address, region, url, memo ))
                .to.be.revertedWith("AREC: Wrong Status")      

      })

      it("ArkreenRECIssuance: updateRECData Normal", async () => {
        await arkreenRECIssuance.connect(manager).rejectRECRequest(tokenID)  
        await expect(arkreenRECIssuance.connect(owner1).updateRECData(tokenID, manager.address, region, url, memo))
                .to.emit(arkreenRECIssuance, "RECDataUpdated")
                .withArgs(owner1.address, tokenID)

        let recData = [ manager.address,  "",  owner1.address,
                        startTime,  endTime,
                        BigNumber.from(1000), 
                        BigNumber.from(RECStatus.Pending),
                        "bafybeihepmxz4ytc4ht67j73nzurkvsiuxhsmxk27utnopzptpo7wuigte", 
                        region, url, memo, 0 ]

        expect(await arkreenRECIssuance.getRECData(tokenID)).to.deep.eq(recData);     
      })
    })

    describe("cancelRECRequest", () => {
      let tokenID: BigNumber
      let signature: SignatureStruct
      let recMintRequest: RECRequestStruct 
      const startTime = 1564888526
      const endTime   = 1654888526
      const price0:BigNumber = expandTo18Decimals(50).div(expandTo9Decimals(1))
      const mintFee = BigNumber.from(1000).mul(price0)
      let arkreenRECIssuanceExt: ArkreenRECIssuanceExt

      beforeEach(async () => {
        recMintRequest = { 
          issuer: manager.address, startTime, endTime,
          amountREC: BigNumber.from(1000), 
          cID: "bafybeihepmxz4ytc4ht67j73nzurkvsiuxhsmxk27utnopzptpo7wuigte", 
          region: 'Beijing',
          url:"", memo:""
        } 
        const nonce1 = await AKREToken.nonces(owner1.address)
        const digest1 = await getApprovalDigest(
                                AKREToken,
                                { owner: owner1.address, spender: arkreenRECIssuance.address, value: mintFee },
                                nonce1,
                                constants.MaxUint256
                              )
        const { v,r,s } = ecsign(Buffer.from(digest1.slice(2), 'hex'), Buffer.from(privateKeyOwner.slice(2), 'hex'))
        signature = { v, r, s, token: AKREToken.address, value:mintFee, deadline: constants.MaxUint256 } 

        // Normal
        await arkreenRegistry.setArkreenMiner(arkreenMiner.address)      
        await arkreenRECIssuance.updateARECMintPrice(AKREToken.address, price0)

        await arkreenRECIssuance.connect(owner1).mintRECRequest(recMintRequest, signature)
        tokenID = await arkreenRECIssuance.totalSupply()

        arkreenRECIssuanceExt = ArkreenRECIssuanceExt__factory.connect(arkreenRECIssuance.address, deployer);

      })

      it("ArkreenRECIssuance: cancelRECRequest Abnormal", async () => {
        await expect(arkreenRECIssuanceExt.connect(owner2).cancelRECRequest(tokenID ))
                .to.be.revertedWith("AREC: Not Owner") 

//        await expect(arkreenRECIssuanceExt.connect(owner1).cancelRECRequest(tokenID))
//                .to.be.revertedWith("AREC: Wrong Status") 
     
      })

      it("ArkreenRECIssuance: cancelRECRequest Normal", async () => {
        await arkreenRECIssuance.connect(manager).rejectRECRequest(tokenID)  

        await expect(arkreenRECIssuanceExt.connect(owner1).cancelRECRequest(tokenID))
                .to.emit(AKREToken, 'Transfer')
                .withArgs(arkreenRECIssuanceExt.address, owner1.address, mintFee)
                .to.emit(arkreenRECIssuance, "RECCanceled")
                .withArgs(owner1.address, tokenID)

        let recData = [ manager.address,  "",  owner1.address,
                        startTime,  endTime,
                        BigNumber.from(1000), 
                        BigNumber.from(RECStatus.Cancelled),
                        "bafybeihepmxz4ytc4ht67j73nzurkvsiuxhsmxk27utnopzptpo7wuigte", 
                        "Beijing", "", "", 0 ]

        expect(await arkreenRECIssuance.getRECData(tokenID)).to.deep.eq(recData);

        let payInfo = [constants.AddressZero, BigNumber.from(0)]
        expect(await arkreenRECIssuance.allPayInfo(tokenID)).to.deep.eq(payInfo);
      })
    })

    describe("certifyRECRequest", () => {
      let tokenID: BigNumber
      let signature: SignatureStruct
      let recMintRequest: RECRequestStruct 
      const startTime = 1564888526
      const endTime   = 1654888526
      const mintFee = expandTo18Decimals(1000).mul(50)    

      beforeEach(async () => {
        recMintRequest = { 
          issuer: manager.address, startTime, endTime,
          amountREC: expandTo9Decimals(1000), 
          cID: "bafybeihepmxz4ytc4ht67j73nzurkvsiuxhsmxk27utnopzptpo7wuigte", 
          region: 'Beijing',
          url:"", memo:""
        } 
        const nonce1 = await AKREToken.nonces(owner1.address)
        const digest1 = await getApprovalDigest(
                                AKREToken,
                                { owner: owner1.address, spender: arkreenRECIssuance.address, value: mintFee },
                                nonce1,
                                constants.MaxUint256
                              )
        const { v,r,s } = ecsign(Buffer.from(digest1.slice(2), 'hex'), Buffer.from(privateKeyOwner.slice(2), 'hex'))
        signature = { v, r, s, token: AKREToken.address, value:mintFee, deadline: constants.MaxUint256 } 

        // Normal
        await arkreenRegistry.setArkreenMiner(arkreenMiner.address)     
        const price0:BigNumber = expandTo18Decimals(50).div(expandTo9Decimals(1))
        await arkreenRECIssuance.updateARECMintPrice(AKREToken.address, price0)

        await arkreenRECIssuance.connect(owner1).mintRECRequest(recMintRequest, signature)
        tokenID = await arkreenRECIssuance.totalSupply()
      })

      it("ArkreenRECIssuance: certifyRECRequest Abnormal", async () => {
        await arkreenRegistry.addRECIssuer(maker1.address, arkreenRECToken.address, "Arkreen Issuer Maker") 
        await expect(arkreenRECIssuance.connect(owner2).certifyRECRequest(tokenID,"Serial12345678" ))
                .to.be.revertedWith("AREC: Not Issuer") 

        await expect(arkreenRECIssuance.connect(maker1).certifyRECRequest(tokenID,"Serial12345678" ))
                .to.be.revertedWith("AREC: Wrong Issuer") 

        await arkreenRECIssuance.connect(manager).rejectRECRequest(tokenID)    
        await expect(arkreenRECIssuance.connect(manager).certifyRECRequest(tokenID,"Serial12345678" ))
                .to.be.revertedWith("AREC: Wrong Status")         
     
      })

      it("ArkreenRECIssuance: certifyRECRequest Normal", async () => {
        await expect(arkreenRECIssuance.connect(manager).certifyRECRequest(tokenID, "Serial12345678"))
                .to.emit(arkreenRECIssuance, "RECCertified")
                .withArgs(manager.address, tokenID)

        let recData = [ manager.address,  "Serial12345678",  owner1.address,
                        startTime,  endTime,
                        expandTo9Decimals(1000), 
                        BigNumber.from(RECStatus.Certified),
                        "bafybeihepmxz4ytc4ht67j73nzurkvsiuxhsmxk27utnopzptpo7wuigte", 
                        "Beijing", "", "", 0 ]

        expect(await arkreenRECIssuance.getRECData(tokenID)).to.deep.eq(recData);
        expect(await arkreenRECIssuance.allRECByIssuer(manager.address)).to.deep.eq(expandTo9Decimals(1000));
        expect(await arkreenRECIssuance.allRECIssued()).to.deep.eq(expandTo9Decimals(1000));
        expect(await arkreenRECIssuance.paymentByIssuer(manager.address, AKREToken.address)).to.deep.eq(expandTo18Decimals(1000).mul(50));
        let payInfo = [constants.AddressZero, BigNumber.from(0)]
        expect(await arkreenRECIssuance.allPayInfo(tokenID)).to.deep.eq(payInfo);

      })
    })


    describe("redeem", () => {
      it("ArkreenRECIssuance: redeem", async () => {

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
        const price0:BigNumber = expandTo18Decimals(50).div(expandTo9Decimals(1))
        await arkreenRECIssuance.updateARECMintPrice(AKREToken.address, price0)

        await arkreenRECIssuance.connect(owner1).mintRECRequest(recMintRequest, signature)
        const tokenID = await arkreenRECIssuance.totalSupply()

        // Abnormal Test
        // Abnormal 1: Not owner   
        await expect(arkreenRECIssuance.connect(owner2).redeem(tokenID))
                .to.be.revertedWith("AREC: Not Owner") 

        // Abnormal 2: Not Certified  
        await expect(arkreenRECIssuance.connect(owner1).redeem(tokenID))
                .to.be.revertedWith("AREC: Not Certified")  

        await arkreenRECIssuance.connect(manager).certifyRECRequest(tokenID, "Serial12345678")

        // Abnormal 3: Not owner
        await expect(arkreenRECIssuance.connect(owner2).redeem(tokenID))
                .to.be.revertedWith("AREC: Not Owner")  
      
        // Normal
        await expect(arkreenRECIssuance.connect(owner1).redeem(tokenID))
              .to.emit(arkreenRECIssuance, "RedeemFinished")
              .withArgs(owner1.address, tokenID, tokenID)     // Here offsetActionId is same as tokenID 

        const userActions = await arkreenRetirement.getUserEvents(owner1.address)

        const lastBlock = await ethers.provider.getBlock('latest')
        const offsetAction = [owner1.address, manager.address, expandTo9Decimals(1000),
                              tokenID, BigNumber.from(lastBlock.timestamp), false]

        expect(await arkreenRetirement.offsetActions(userActions[userActions.length-1])).to.deep.equal(offsetAction)

        let recData: RECDataStruct = await arkreenRECIssuance.getRECData(tokenID)
        expect(recData.status).to.equal(BigNumber.from(RECStatus.Retired));      
        
        expect(await arkreenRECIssuance.allRECRedeemed()).to.deep.eq(expandTo9Decimals(1000));
       
      })
    })

    describe("redeemFrom", () => {
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
        const price0:BigNumber = expandTo18Decimals(50).div(expandTo9Decimals(1))
        await arkreenRECIssuance.updateARECMintPrice(AKREToken.address, price0)

        await arkreenRECIssuance.connect(owner1).mintRECRequest(recMintRequest, signature)
        tokenID = await arkreenRECIssuance.totalSupply()

      })

      it("ArkreenRECIssuance: redeemFrom Abnormal", async () => {
        // Abnormal Test
        // Abnormal 1: Not owner   
        await expect(arkreenRECIssuance.connect(owner2).redeemFrom(owner1.address, tokenID))
                .to.be.revertedWith("AREC: Not Approved") 

        // Abnormal 2: Not Certified  
        await expect(arkreenRECIssuance.connect(owner1).redeemFrom(owner1.address, tokenID))
                .to.be.revertedWith("AREC: Not Certified")  

        await arkreenRECIssuance.connect(manager).certifyRECRequest(tokenID, "Serial12345678")

        // Abnormal 3: Not owner
        await expect(arkreenRECIssuance.connect(owner2).redeemFrom(owner1.address, tokenID))
                .to.be.revertedWith("AREC: Not Approved")  
      })

      it("ArkreenRECIssuance: redeemFrom Normal", async () => {
        // Normal
        await arkreenRECIssuance.connect(manager).certifyRECRequest(tokenID, "Serial12345678")
        await expect(arkreenRECIssuance.connect(owner1).redeemFrom(owner1.address, tokenID))
              .to.emit(arkreenRECIssuance, "RedeemFinished")
              .withArgs(owner1.address, tokenID, tokenID)       // Here offsetActionId is same as tokenID 

        const userActions = await arkreenRetirement.getUserEvents(owner1.address)

        const lastBlock = await ethers.provider.getBlock('latest')
        const offsetAction = [owner1.address, manager.address, expandTo9Decimals(1000),
                              tokenID, BigNumber.from(lastBlock.timestamp), false]

        expect(await arkreenRetirement.offsetActions(userActions[userActions.length-1])).to.deep.equal(offsetAction)

        let recData: RECDataStruct = await arkreenRECIssuance.getRECData(tokenID)
        expect(recData.status).to.equal(BigNumber.from(RECStatus.Retired));   
        
        expect(await arkreenRECIssuance.allRECRedeemed()).to.deep.eq(expandTo9Decimals(1000));        
      })

      it("ArkreenRECIssuance: redeemFrom by approval", async () => {
        await arkreenRECIssuance.connect(manager).certifyRECRequest(tokenID, "Serial12345678")

        // Abnormal 3: Not owner
        await expect(arkreenRECIssuance.connect(owner2).redeemFrom(owner1.address, tokenID))
                .to.be.revertedWith("AREC: Not Approved")  

        await arkreenRECIssuance.connect(owner1).approve(owner2.address,tokenID)
      
        // Normal
        await arkreenRECIssuance.connect(owner2).redeemFrom(owner1.address, tokenID)
      })

      it("ArkreenRECIssuance: redeemFrom by approve for all", async () => {
        await arkreenRECIssuance.connect(manager).certifyRECRequest(tokenID, "Serial12345678")

        // Abnormal 3: Not owner
        await expect(arkreenRECIssuance.connect(owner2).redeemFrom(owner1.address, tokenID))
                .to.be.revertedWith("AREC: Not Approved")  

        await arkreenRECIssuance.connect(owner1).setApprovalForAll(owner2.address,true)
      
        // Normal
        await arkreenRECIssuance.connect(owner2).redeemFrom(owner1.address, tokenID)
      })
    })

    describe("redeemAndMintCertificate", () => {
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
        const price0:BigNumber = expandTo18Decimals(50).div(expandTo9Decimals(1))
        await arkreenRECIssuance.updateARECMintPrice(AKREToken.address, price0)

        await arkreenRECIssuance.connect(owner1).mintRECRequest(recMintRequest, signature)
        tokenID = await arkreenRECIssuance.totalSupply()

        await arkreenRECIssuance.connect(manager).certifyRECRequest(tokenID, "Serial12345678")
      });
    
      it("ArkreenRECIssuance: redeemAndMintCertificate", async () => {
        // Normal
        // offsetAndMintCertificate
        await arkreenRECIssuance.connect(owner1).redeemAndMintCertificate(
                  tokenID, owner1.address, "Owner","Alice","Save Earcth") 
      })
    
      it("ArkreenRECIssuance: redeemAndMintCertificate by approval", async () => {
        // Abnormal: Not owner
        await expect(arkreenRECIssuance.connect(owner2).redeemFrom(owner1.address, tokenID))
                .to.be.revertedWith("AREC: Not Approved")  

        await arkreenRECIssuance.connect(owner1).approve(owner2.address, tokenID)
      
        // Normal
        // offsetAndMintCertificate
        await expect(arkreenRECIssuance.connect(owner2).redeemAndMintCertificate(
                        tokenID, owner1.address, "Owner","Alice","Save Earcth")) 
                .to.emit(arkreenRECIssuance, "RedeemFinished")
                .withArgs(owner1.address, tokenID, tokenID)         // Here offsetActionId is same as tokenID 
      })
    
      it("ArkreenRECIssuance: redeemAndMintCertificate by approval for all", async () => {
        // Abnormal: Not owner
        await expect(arkreenRECIssuance.connect(owner2).redeemFrom(owner1.address, tokenID))
                .to.be.revertedWith("AREC: Not Approved")  

        await arkreenRECIssuance.connect(owner1).setApprovalForAll(owner2.address,true)
      
        // Normal
        // offsetAndMintCertificate
        await expect(arkreenRECIssuance.connect(owner2).redeemAndMintCertificate(
                        tokenID, owner1.address, "Owner","Alice","Save Earcth")) 
                .to.emit(arkreenRECIssuance, "RedeemFinished")
                .withArgs(owner1.address, tokenID, tokenID)         // Here offsetActionId is same as tokenID                         

        const lastBlock = await ethers.provider.getBlock('latest')
        const offsetID = await arkreenRetirement.offsetCounter()
        const certId = await arkreenRetirement.totalSupply()

        expect(await arkreenRECIssuance.allRECRedeemed()).to.deep.eq(expandTo9Decimals(1000));   
     
        const offsetRecord = [owner1.address, owner1.address, "Owner", "Alice", "Save Earcth", 
                              BigNumber.from(lastBlock.timestamp), expandTo9Decimals(1000), [offsetID]]
        expect(await arkreenRetirement.getCertificate(certId)).to.deep.equal(offsetRecord)
      })      
    })
    
    describe("liquidizeREC", () => {
      it("ArkreenRECIssuance: liquidizeREC", async () => {

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
        const price0:BigNumber = expandTo18Decimals(50).div(expandTo9Decimals(1))
        await arkreenRECIssuance.updateARECMintPrice(AKREToken.address, price0)

        await arkreenRECIssuance.connect(owner1).mintRECRequest(recMintRequest, signature)
        const tokenID = await arkreenRECIssuance.totalSupply()

        // Abnormal Test
        // Abnormal 1: Not owner
        await expect(arkreenRECIssuance.connect(owner2).liquidizeREC(tokenID))
                .to.be.revertedWith("AREC: Not Approved")  
                
        // Abnormal 2: Not Certified        
        await expect(arkreenRECIssuance.connect(owner1).liquidizeREC(tokenID))
                .to.be.revertedWith("AREC: Not Certified")       

        await arkreenRECIssuance.connect(manager).certifyRECRequest(tokenID, "Serial12345678")

        // Normal
        await expect(arkreenRECIssuance.connect(owner1).liquidizeREC(tokenID))
                .to.emit(arkreenRECIssuance, "RECLiquidized")
                .withArgs(owner1.address, tokenID, expandTo9Decimals(1000))

        expect(await arkreenRECToken.balanceOf(owner1.address)).to.equal(expandTo9Decimals(1000));
        expect(await arkreenRECIssuance.ownerOf(tokenID)).to.equal(arkreenRECToken.address);
      
        let recData: RECDataStruct = await arkreenRECIssuance.getRECData(tokenID)
        expect(recData.status).to.equal(BigNumber.from(RECStatus.Liquidized));

        expect(await arkreenRECIssuance.allRECLiquidized()).to.deep.eq(expandTo9Decimals(1000));  
    });
  })

  describe("tokenURI", () => {
    let tokenID: BigNumber
    let recMintRequest: RECRequestStruct
    let signature: SignatureStruct

    beforeEach(async () => {
      const startTime = 1564888526
      const endTime   = 1654888526
      
      recMintRequest = { 
        issuer: manager.address, startTime, endTime,
        amountREC: expandTo9Decimals(1000), 
        cID: "bafybeihepmxz4ytc4ht67j73nzurkvsiuxhsmxk27utnopzptpo7wuigte",
        region: 'Beijing',
        url:"https://bafybeihepmxz4ytc4ht67j73nzurkvsiuxhsmxk27utnopzptpo7wuigte.ipfs.dweb.link", memo:""
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
      signature = { v, r, s, token: AKREToken.address, value:mintFee, deadline: constants.MaxUint256 } 
      
      // Mint
      await arkreenRegistry.setArkreenMiner(arkreenMiner.address)
    })

    it("ArkreenRECIssuance: tokenURI, No given URI", async () => {

      signature.value = expandTo18Decimals(50 * 1000)
      const price0:BigNumber = expandTo18Decimals(50).div(expandTo9Decimals(1))
      await arkreenRECIssuance.updateARECMintPrice(AKREToken.address, price0)

      await arkreenRECIssuance.connect(owner1).mintRECRequest(recMintRequest, signature)
      tokenID = await arkreenRECIssuance.totalSupply()
      await arkreenRECIssuance.connect(manager).certifyRECRequest(tokenID, "Serial12345678")
      const uri = await arkreenRECIssuance.tokenURI(tokenID);
      console.log("AAAAAAAAAAAA", uri)
    })

/*
    it("ArkreenRECIssuance: tokenURI, No given URI", async () => {
      await arkreenRECIssuance.connect(owner1).mintRECRequest(recMintRequest, signature)
      tokenID = await arkreenRECIssuance.totalSupply()
      await arkreenRECIssuance.connect(manager).certifyRECRequest(tokenID, "Serial12345678")
      expect( await arkreenRECIssuance.tokenURI(tokenID)).to.equal("https://www.arkreen.com/AREC/1");
    })

    it("ArkreenRECIssuance: tokenURI, given URI", async () => {
      recMintRequest.url = "Shangxi"
      await arkreenRECIssuance.connect(owner1).mintRECRequest(recMintRequest, signature)
      tokenID = await arkreenRECIssuance.totalSupply()
      await arkreenRECIssuance.connect(manager).certifyRECRequest(tokenID, "Serial12345678")
      expect( await arkreenRECIssuance.tokenURI(tokenID)).to.equal("https://www.arkreen.com/AREC/Shangxi");
    })
*/  
  })

  describe("Mint Fee Withdraw", () => {
    let tokenID: BigNumber
    let recMintRequest: RECRequestStruct
    let signature: SignatureStruct
    const startTime = 1564888526
    const endTime   = 1654888526
    const mintFee = expandTo18Decimals(1000).mul(50)

    beforeEach(async () => {
      recMintRequest = { 
        issuer: manager.address, startTime, endTime,
        amountREC: expandTo9Decimals(1000), 
        cID: "bafybeihepmxz4ytc4ht67j73nzurkvsiuxhsmxk27utnopzptpo7wuigte",
        region: 'Beijing',
        url:"", memo:""
      } 

      const nonce1 = await AKREToken.nonces(owner1.address)
      const digest1 = await getApprovalDigest(
                              AKREToken,
                              { owner: owner1.address, spender: arkreenRECIssuance.address, value: mintFee },
                              nonce1,
                              constants.MaxUint256
                            )
      const { v,r,s } = ecsign(Buffer.from(digest1.slice(2), 'hex'), Buffer.from(privateKeyOwner.slice(2), 'hex'))
      signature = { v, r, s, token: AKREToken.address, value:mintFee, deadline: constants.MaxUint256 } 
      
      // Mint
      await arkreenRegistry.setArkreenMiner(arkreenMiner.address)
      const price0:BigNumber = expandTo18Decimals(50).div(expandTo9Decimals(1))
      await arkreenRECIssuance.updateARECMintPrice(AKREToken.address, price0)    

      await arkreenRECIssuance.connect(owner1).mintRECRequest(recMintRequest, signature)
      tokenID = await arkreenRECIssuance.totalSupply()
      await arkreenRECIssuance.connect(manager).certifyRECRequest(tokenID, "Serial12345678")
    })

    it("ArkreenRECIssuance: Withdraw: zero address", async () => {
      const amount = expandTo18Decimals(50000)
      await expect(arkreenRECIssuance.connect(owner1).withdraw(AKREToken.address, owner1.address, amount))
              .to.be.revertedWith("Ownable: caller is not the owner")    

      const balance = await AKREToken.balanceOf(deployer.address)
      await arkreenRECIssuance.withdraw(AKREToken.address, constants.AddressZero, amount)
      expect(await AKREToken.balanceOf(deployer.address)).to.equal(balance.add(mintFee))
    })

    it("ArkreenRECIssuance: withdraw: given address", async () => {
      const amount = expandTo18Decimals(50000)
      await arkreenRECIssuance.withdraw(AKREToken.address, owner2.address, amount)
      expect(await AKREToken.balanceOf(owner2.address)).to.equal(mintFee)
    })
  })

  describe("REC NFT Transfer", () => {
    let tokenID: BigNumber
    let recMintRequest: RECRequestStruct
    let signature: SignatureStruct

    beforeEach(async () => {
      const startTime = 1564888526
      const endTime   = 1654888526
      
      recMintRequest = { 
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
      signature = { v, r, s, token: AKREToken.address, value:mintFee, deadline: constants.MaxUint256 } 
      
      // Mint
      await arkreenRegistry.setArkreenMiner(arkreenMiner.address)
      const price0:BigNumber = expandTo18Decimals(50).div(expandTo9Decimals(1))
      await arkreenRECIssuance.updateARECMintPrice(AKREToken.address, price0)

      await arkreenRECIssuance.connect(owner1).mintRECRequest(recMintRequest, signature)
      tokenID = await arkreenRECIssuance.totalSupply()
    })

    it("ArkreenRECIssuance: Transfer: not allowed", async () => {
      await expect(arkreenRECIssuance.connect(owner1).transferFrom(owner1.address, owner2.address, tokenID))
              .to.be.revertedWith("AREC: Wrong Status")    

      await expect(arkreenRECIssuance.connect(owner1)["safeTransferFrom(address,address,uint256)"](
                    owner1.address, owner2.address, tokenID))
              .to.be.revertedWith("AREC: Wrong Status")    

      await expect(arkreenRECIssuance.connect(owner1)["safeTransferFrom(address,address,uint256,bytes)"](
                owner1.address, owner2.address, tokenID,"0x123456"))
          .to.be.revertedWith("AREC: Wrong Status")                  
    })

    it("ArkreenRECIssuance: Transfer: Allowed", async () => {
      await arkreenRECIssuance.connect(manager).certifyRECRequest(tokenID, "Serial12345678")
      await arkreenRECIssuance.connect(owner1)["safeTransferFrom(address,address,uint256)"](
                owner1.address, owner2.address, tokenID)
    })
  })

});
