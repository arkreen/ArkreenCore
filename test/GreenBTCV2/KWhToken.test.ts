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
    KWhToken,
    WETH9,
    ERC20F,
} from "../../typechain";

import { time, loadFixture, mine } from "@nomicfoundation/hardhat-network-helpers";
import { getApprovalDigest, expandTo18Decimals, randomAddresses, getGreenBitcoinDigest, expandTo9Decimals } from "../utils/utilities";

import { ecsign, fromRpcSig, ecrecover } from 'ethereumjs-util'
import { RECRequestStruct, SignatureStruct, RECDataStruct } from "../../typechain/contracts/ArkreenRECIssuance";

const constants_MaxDealine = BigNumber.from('0xFFFFFFFF')

describe("KWhToken Test Campaign", () => {
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
    let arkreenBuilder:               ArkreenBuilder
    let arkreenRECBank:               ArkreenRECBank
    let kWhToken:                     KWhToken

    let WETH:                         WETH9
    let tokenA:                       ERC20F

    const Miner_Manager       = 0 

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
      // set formal launch

      const payer = maker1.address
 
      await arkreenMiner.setManager(Miner_Manager, manager.address)
      await arkreenMiner.ManageManufactures([payer], true)     

      await arkreenRegistry.addRECIssuer(manager.address, arkreenRECToken.address, "Arkreen Issuer")
      await arkreenRegistry.setRECIssuance(arkreenRECIssuance.address)
      await arkreenRegistry.setArkreenRetirement(arkreenRetirement.address)

      arkreenRECIssuanceExt = ArkreenRECIssuanceExt__factory.connect(arkreenRECIssuance.address, deployer);

      const ArkreenBuilderFactory = await ethers.getContractFactory("ArkreenBuilder");
//    const arkreenBuilder = await ArkreenBuilderFactory.deploy(routerFeswa.address);
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

       return { AKREToken, arkreenMiner, arkreenRegistry, arkreenRECIssuance, arkreenRECToken, 
               arkreenRetirement, arkreenRECIssuanceExt, arkreenRECBank, kWhToken, WETH, tokenA }
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
        arkreenRECBank = fixture.arkreenRECBank
        kWhToken = fixture.kWhToken
        WETH = fixture.WETH
        tokenA = fixture.tokenA
    }); 

    describe("KWhToken Test", () => {

      beforeEach(async () => {
        {
          const startTime = 1564888526
          const endTime   = 1654888526
          
          let recMintRequest: RECRequestStruct = { 
            issuer: manager.address, startTime, endTime,
            amountREC: expandTo9Decimals(20000), 
            cID: "bafybeihepmxz4ytc4ht67j73nzurkvsiuxhsmxk27utnopzptpo7wuigte",
            region: 'Beijing',
            url:"", memo:""
          } 

          const mintFee = expandTo18Decimals(20000* 1000)
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

          const balanceRECToken = await arkreenRECToken.balanceOf(owner1.address) 
        }
        
      });

      ///////////////////////////////////////////

      it("KWhToken Test: setBadgeInfo", async () => {
        const badgeInfo =  {
          beneficiary:    owner1.address,
          offsetEntityID: 'Owner1',
          beneficiaryID:  'Tester',
          offsetMessage:  "Just Testing"
        }    

        // setBadgeInfo
        await expect(kWhToken.connect(owner2).setBadgeInfo(badgeInfo))
                    .to.be.revertedWith("kWh: Not Allowed")

        await kWhToken.setBadgeInfo(badgeInfo)
        expect(await kWhToken.badgeInfo()).to.deep.equal(Object.values(badgeInfo))
      }); 
     
      it("KWhToken Test: MintKWh with ART", async () => {
        await arkreenRECBank.addNewART( arkreenRECToken.address,  maker1.address)
        await arkreenRECBank.connect(maker1).depositART( arkreenRECToken.address,  expandTo9Decimals(9000))
        await arkreenRECToken.setClimateBuilder(arkreenBuilder.address)

        const badgeInfo =  {
          beneficiary:    owner1.address,
          offsetEntityID: 'Owner1',
          beneficiaryID:  'Tester',
          offsetMessage:  "Just Testing"
        }    

        await kWhToken.setBadgeInfo(badgeInfo)

        // MintKWh with ART
        await arkreenRECToken.connect(owner1).transfer(kWhToken.address, expandTo9Decimals(5000))
        const balancekWhTokenBefore = await kWhToken.balanceOf(kWhToken.address)

        // Only owner and manager can mint kWh
        await expect(kWhToken.connect(owner1).MintKWh( arkreenRECToken.address, expandTo9Decimals(5000)))
                          .to.be.revertedWith("kWh: Not Allowed")

        // Normal MintKWh                         
        expect(await kWhToken.MintKWh( arkreenRECToken.address, expandTo9Decimals(5000)))
                  .to.emit(kWhToken, 'KWhMinted')
                  .withArgs(arkreenRECToken.address, expandTo9Decimals(5000), expandTo9Decimals(5000))   
                  .to.emit(kWhToken, 'Transfer')
                  .withArgs(0, kWhToken.address, expandTo9Decimals(5000))   

        // Check totalSupply
        expect(await kWhToken.totalSupply()).to.eq(expandTo9Decimals(5000))

        // Check amount of kWh token                  
        expect(await kWhToken.balanceOf(kWhToken.address)).to.eq(balancekWhTokenBefore.add(expandTo9Decimals(5000)))

        const lastBlock = await ethers.provider.getBlock('latest')
        const badge = [kWhToken.address, owner1.address, "Owner1", "Tester", "Just Testing", 
                        BigNumber.from(lastBlock.timestamp), expandTo9Decimals(5000), [1]]

        // Check badge
        expect(await arkreenRetirement.getCertificate(1)).to.deep.equal(badge)

        // Manager can also MintkWh
        await arkreenRECToken.connect(owner1).transfer(kWhToken.address, expandTo9Decimals(1500))
        await kWhToken.connect(manager).MintKWh( arkreenRECToken.address, expandTo9Decimals(1500))

        // Fee is charged for Offseting
        await arkreenRECToken.setRatioFeeOffset(500)  
        await arkreenRECToken.connect(owner1).transfer(kWhToken.address, expandTo9Decimals(4000))

        expect(await kWhToken.MintKWh( arkreenRECToken.address, expandTo9Decimals(4000)))
                  .to.emit(kWhToken, 'KWhMinted')
                  .withArgs(arkreenRECToken.address, expandTo9Decimals(4000), expandTo9Decimals(3800))   
                  .to.emit(kWhToken, 'Transfer')
                  .withArgs(0, kWhToken.address, expandTo9Decimals(3800))   

      }); 

      it("KWhToken Test: MintKWh with token", async () => {
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
        await tokenA.transfer(kWhToken.address, expandTo18Decimals(15000))

        const balanceTokenABefore = await tokenA.balanceOf(kWhToken.address)
        const balancekWhTokenBefore = await kWhToken.balanceOf(kWhToken.address)

        expect(await kWhToken.MintKWh( tokenA.address, expandTo18Decimals(15000)))
                    .to.emit(kWhToken, 'KWhMinted')
                    .withArgs(tokenA.address, expandTo18Decimals(15000), expandTo9Decimals(100))   
                    .to.emit(kWhToken, 'Transfer')
                    .withArgs(0, kWhToken.address, expandTo9Decimals(100))   

        // Check amount of kWh token          
        expect(await tokenA.balanceOf(kWhToken.address)).to.eq(balanceTokenABefore.sub(expandTo18Decimals(15000)))
        expect(await kWhToken.balanceOf(kWhToken.address)).to.eq(balancekWhTokenBefore.add(expandTo9Decimals(100)))

        const lastBlock = await ethers.provider.getBlock('latest')
        const offsetRecord = [kWhToken.address, owner1.address, "Owner1", "Tester", "Just Testing", 
                BigNumber.from(lastBlock.timestamp), expandTo9Decimals(100), [1]]

        // Check badge
        expect(await arkreenRetirement.getCertificate(1)).to.deep.equal(offsetRecord)

        // Manager can also MintkWh
        await tokenA.transfer(kWhToken.address, expandTo18Decimals(300000))
        await kWhToken.connect(manager).MintKWh( tokenA.address, expandTo18Decimals(300000))

        // Fee is charged for Offseting
        await arkreenRECToken.setRatioFeeOffset(500)  
        await tokenA.transfer(kWhToken.address, expandTo18Decimals(600000))

        expect(await kWhToken.MintKWh( tokenA.address, expandTo18Decimals(600000)))
                  .to.emit(kWhToken, 'KWhMinted')
                  .withArgs(tokenA.address, expandTo18Decimals(600000), expandTo9Decimals(3800))   
                  .to.emit(kWhToken, 'Transfer')
                  .withArgs(0, kWhToken.address, expandTo9Decimals(3800))   
      });
      
      it("KWhToken Test: convertKWh with ART", async () => {
        await arkreenRECBank.addNewART( arkreenRECToken.address,  maker1.address)
        await arkreenRECBank.connect(maker1).depositART( arkreenRECToken.address,  expandTo9Decimals(9000))
        await arkreenRECToken.setClimateBuilder(arkreenBuilder.address)

        const badgeInfo =  {
          beneficiary:    owner1.address,
          offsetEntityID: 'Owner1',
          beneficiaryID:  'Tester',
          offsetMessage:  "Just Testing"
        }    

        await kWhToken.setBadgeInfo(badgeInfo)

        // MintKWh with ART
        await arkreenRECToken.connect(owner1).transfer(kWhToken.address, expandTo9Decimals(5000))

        // Normal MintKWh                         
        expect(await kWhToken.MintKWh( arkreenRECToken.address, expandTo9Decimals(5000)))
                  .to.emit(kWhToken, 'KWhMinted')
                  .withArgs(arkreenRECToken.address, expandTo9Decimals(5000), expandTo9Decimals(5000))   
                  .to.emit(kWhToken, 'Transfer')
                  .withArgs(0, kWhToken.address, expandTo9Decimals(5000))   

        await arkreenRECToken.connect(owner1).transfer(owner2.address, expandTo9Decimals(3000))
        await arkreenRECToken.connect(owner2).approve(kWhToken.address, expandTo9Decimals(3000))

        // Test changeSwapPrice
        await expect(kWhToken.connect(owner1).changeSwapPrice(arkreenRECToken.address, expandTo9Decimals(1)))
                        .to.be.revertedWith("kWh: Not Allowed")

        await expect(kWhToken.connect(owner2).convertKWh(arkreenRECToken.address, expandTo9Decimals(3000)))                        
                        .to.be.revertedWith("kWh: Payment Token Not Supported")

        await kWhToken.changeSwapPrice(arkreenRECToken.address, expandTo9Decimals(1))
        await kWhToken.connect(manager).changeSwapPrice(arkreenRECToken.address, expandTo9Decimals(1))

        // Normal convertKWh
        expect(await kWhToken.connect(owner2).convertKWh(arkreenRECToken.address, expandTo9Decimals(3000)))
                  .to.emit(arkreenRECToken, 'Transfer')
                  .withArgs(owner2.address, kWhToken.address, expandTo9Decimals(3000))   
                  .to.emit(kWhToken, 'Transfer')
                  .withArgs(kWhToken.address, owner2.address, expandTo9Decimals(3000))   
                  .to.emit(kWhToken, 'ARTConverted')
                  .withArgs(owner2.address, arkreenRECToken.address,  expandTo9Decimals(3000), expandTo9Decimals(3000))   

      }); 

      it("KWhToken Test: convertKWh with Token", async () => {
        await arkreenRECBank.addNewART( arkreenRECToken.address,  maker1.address)
        await arkreenRECBank.connect(maker1).depositART( arkreenRECToken.address,  expandTo9Decimals(9000))
        await arkreenRECToken.setClimateBuilder(arkreenBuilder.address)

        const badgeInfo =  {
          beneficiary:    owner1.address,
          offsetEntityID: 'Owner1',
          beneficiaryID:  'Tester',
          offsetMessage:  "Just Testing"
        }    

        await kWhToken.setBadgeInfo(badgeInfo)

        // MintKWh with ART
        await arkreenRECToken.connect(owner1).transfer(kWhToken.address, expandTo9Decimals(5000))

        // Normal MintKWh                         
        await kWhToken.MintKWh( arkreenRECToken.address, expandTo9Decimals(5000))

        // Normal convertKWh with token
        await tokenA.transfer(maker1.address, expandTo18Decimals(300000))
        await tokenA.connect(maker1).approve(kWhToken.address, expandTo18Decimals(300000))

        await kWhToken.changeSwapPrice(tokenA.address, expandTo18Decimals(150).div(1000))   // 1kWh = 0.15 TokenA

        // Normal convertKWh
        expect(await kWhToken.connect(maker1).convertKWh(tokenA.address, expandTo18Decimals(300000)))
                  .to.emit(tokenA, 'Transfer')
                  .withArgs(maker1.address, kWhToken.address, expandTo18Decimals(300000))   
                  .to.emit(kWhToken, 'Transfer')
                  .withArgs(kWhToken.address, maker1.address, expandTo9Decimals(2000))   
                  .to.emit(kWhToken, 'ARTConverted')
                  .withArgs(maker1.address, tokenA.address,  expandTo18Decimals(300000), expandTo9Decimals(2000))   

      }); 
    })  
});
