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
    ArkreenRECBank,
    WETH9,
    ERC20F,
} from "../../typechain";

import { time, loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { getApprovalDigest, expandTo18Decimals, randomAddresses, MinerType, RECStatus, expandTo9Decimals } from "../utils/utilities";
import { ecsign, fromRpcSig, ecrecover } from 'ethereumjs-util'
import { RECRequestStruct, SignatureStruct, RECDataStruct } from "../../typechain/contracts/ArkreenRECIssuance";

describe("ArkreenRECBank", () => {
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
    let arkreenRECBank:               ArkreenRECBank

    let WETH:                         WETH9
    let tokenA:                       ERC20F

    const FORMAL_LAUNCH = 1682913600;         // 2024-05-01, 12:00:00
    const Miner_Manager       = 0 

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
      const arkreenRECTokenESG = await upgrades.deployProxy(ArkreenRECTokenESGFactory,[arkreenRegistry.address, manager.address,'HashKey AREC Token','HART']) as ArkreenRECToken
      await arkreenRECTokenESG.deployed()          
      
      const ArkreenRetirementFactory = await ethers.getContractFactory("ArkreenBadge")
      const arkreenRetirement = await upgrades.deployProxy(ArkreenRetirementFactory,[arkreenRegistry.address]) as ArkreenBadge
      await arkreenRetirement.deployed()     

      const ERC20Factory = await ethers.getContractFactory("ERC20F");
      const tokenA = await ERC20Factory.deploy(expandTo18Decimals(10000),"Token A");
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

    describe("ArkreenRECBank", () => {

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
        }
      });

      it("ArkreenRECBank: addNewART test", async () => {
        await expect(arkreenRECBank.connect(owner1).addNewART( arkreenRECToken.address,  constants.AddressZero))
                  .to.be.revertedWith("Ownable: caller is not the owner")  

        await expect(arkreenRECBank.addNewART( arkreenRECToken.address,  constants.AddressZero))
                  .to.be.revertedWith("ARBK: Zero Address")  

        await arkreenRECBank.addNewART( arkreenRECToken.address,  maker1.address)

        await expect(arkreenRECBank.addNewART( arkreenRECToken.address,  maker1.address))
                  .to.be.revertedWith("ARBK: Already Added")  

        await arkreenRECBank.addNewART( arkreenRECTokenESG.address,  maker2.address)                  

        const artSaleInfo1 = await arkreenRECBank.artSaleInfo(arkreenRECToken.address)
        const artSaleInfo2 = await arkreenRECBank.artSaleInfo(arkreenRECTokenESG.address)

        expect(artSaleInfo1.controller).to.deep.equal( maker1.address)
        expect(artSaleInfo2.controller).to.deep.equal(maker2.address)
      })

      it("ArkreenRECBank: changeARTOwner test", async () => {
        await arkreenRECBank.addNewART( arkreenRECToken.address,  maker1.address)
        await arkreenRECBank.addNewART( arkreenRECTokenESG.address,  maker2.address)   

        await expect(arkreenRECBank.connect(maker2).changeARTOwner( arkreenRECToken.address,  owner1.address))
                  .to.be.revertedWith("ARBK: Not allowed")  

        await expect(arkreenRECBank.connect(maker1).changeARTOwner( arkreenRECToken.address,  constants.AddressZero))
                  .to.be.revertedWith("ARBK: Zero Address")  

        await arkreenRECBank.connect(maker1).changeARTOwner( arkreenRECToken.address,  maker2.address)
        await arkreenRECBank.changeARTOwner( arkreenRECToken.address,  maker1.address)

        await arkreenRECBank.connect(maker2).changeARTOwner( arkreenRECTokenESG.address, owner1.address)                  

        const artSaleInfo1 = await arkreenRECBank.artSaleInfo(arkreenRECToken.address)
        const artSaleInfo2 = await arkreenRECBank.artSaleInfo(arkreenRECTokenESG.address)

        expect(artSaleInfo1.controller).to.deep.equal(maker1.address)
        expect(artSaleInfo2.controller).to.deep.equal(owner1.address)

      })

      it("ArkreenRECBank: setFundReceiver", async () => {
        await arkreenRECBank.addNewART( arkreenRECToken.address,  maker1.address)
        await arkreenRECBank.addNewART( arkreenRECTokenESG.address,  maker2.address)   

        await expect(arkreenRECBank.connect(maker2).setFundReceiver( arkreenRECToken.address,  owner2.address))
                  .to.be.revertedWith("ARBK: Not allowed")  

        await expect(arkreenRECBank.connect(maker1).setFundReceiver( arkreenRECTokenESG.address, owner1.address))
                  .to.be.revertedWith("ARBK: Not allowed")  

        await arkreenRECBank.connect(maker1).setFundReceiver( arkreenRECToken.address,  owner1.address)
        await arkreenRECBank.connect(maker2).setFundReceiver( arkreenRECTokenESG.address, owner2.address)                  

        const artSaleInfo1 = await arkreenRECBank.artSaleInfo(arkreenRECToken.address)
        const artSaleInfo2 = await arkreenRECBank.artSaleInfo(arkreenRECTokenESG.address)

        expect(artSaleInfo1.fundReceiver).to.deep.equal(owner1.address)
        expect(artSaleInfo2.fundReceiver).to.deep.equal(owner2.address)
      })

      it("ArkreenRECBank: depositART test", async () => {
        await arkreenRECBank.addNewART( arkreenRECToken.address,  maker1.address)
        await arkreenRECBank.addNewART( arkreenRECTokenESG.address,  maker2.address)   

        await expect(arkreenRECBank.connect(maker2).depositART( arkreenRECToken.address,  expandTo9Decimals(1000)))
                  .to.be.revertedWith("ARBK: Not allowed")  

        await expect(arkreenRECBank.connect(maker1).depositART( arkreenRECToken.address,   BigNumber.from(2).mul(BigNumber.from(256).pow(16))))
                  .to.be.revertedWith("ARBK: Deposit overflowed")  

        await arkreenRECBank.connect(maker1).depositART( arkreenRECToken.address,  expandTo9Decimals(1000))
        expect(await arkreenRECToken.balanceOf(arkreenRECBank.address)).to.eq(expandTo9Decimals(1000))
        await arkreenRECBank.connect(maker1).depositART( arkreenRECToken.address,  expandTo9Decimals(500))
        expect(await arkreenRECToken.balanceOf(arkreenRECBank.address)).to.eq(expandTo9Decimals(1500))

        await arkreenRECBank.connect(maker2).depositART( arkreenRECTokenESG.address,  expandTo9Decimals(1000))
        expect(await arkreenRECTokenESG.balanceOf(arkreenRECBank.address)).to.eq(expandTo9Decimals(1000))
        await arkreenRECBank.connect(maker2).depositART( arkreenRECTokenESG.address,  expandTo9Decimals(1500))
        expect(await arkreenRECTokenESG.balanceOf(arkreenRECBank.address)).to.eq(expandTo9Decimals(2500))
      })     
      
      it("ArkreenRECBank: changeSalePrice test", async () => {
        await arkreenRECBank.addNewART( arkreenRECToken.address,  maker1.address)
        await arkreenRECBank.addNewART( arkreenRECTokenESG.address,  maker2.address)   

        await expect(arkreenRECBank.connect(maker2).changeSalePrice( arkreenRECToken.address, WETH.address, expandTo9Decimals(100000)))
                  .to.be.revertedWith("ARBK: Not allowed")  

        await arkreenRECBank.connect(maker1).changeSalePrice( arkreenRECToken.address, WETH.address, expandTo9Decimals(100000))
        await arkreenRECBank.connect(maker1).changeSalePrice( arkreenRECToken.address, tokenA.address, 10000000)
        await arkreenRECBank.connect(maker1).changeSalePrice( arkreenRECToken.address, AKREToken.address, expandTo18Decimals(100))

        const saleIncome1 = await arkreenRECBank.connect(maker1).saleIncome( arkreenRECToken.address, WETH.address)
        expect(saleIncome1.priceForSale).to.eq(expandTo9Decimals(100000))

        const saleIncome2 = await arkreenRECBank.connect(maker1).saleIncome( arkreenRECToken.address, tokenA.address)
        expect(saleIncome2.priceForSale).to.eq(10000000)

        const saleIncome3 = await arkreenRECBank.connect(maker1).saleIncome( arkreenRECToken.address, AKREToken.address)
        expect(saleIncome3.priceForSale).to.eq(expandTo18Decimals(100))

        await arkreenRECBank.connect(maker2).changeSalePrice( arkreenRECTokenESG.address, WETH.address, expandTo9Decimals(200000))
        await arkreenRECBank.connect(maker2).changeSalePrice( arkreenRECTokenESG.address, tokenA.address, 20_000_000)
        await arkreenRECBank.connect(maker2).changeSalePrice( arkreenRECTokenESG.address, AKREToken.address, expandTo18Decimals(200))

        const saleIncome11 = await arkreenRECBank.connect(maker1).saleIncome( arkreenRECTokenESG.address, WETH.address)
        expect(saleIncome11.priceForSale).to.eq(expandTo9Decimals(200000))

        const saleIncome22 = await arkreenRECBank.connect(maker1).saleIncome( arkreenRECTokenESG.address, tokenA.address)
        expect(saleIncome22.priceForSale).to.eq(20000000)

        const saleIncome33 = await arkreenRECBank.connect(maker1).saleIncome( arkreenRECTokenESG.address, AKREToken.address)
        expect(saleIncome33.priceForSale).to.eq(expandTo18Decimals(200))

      })    
      
      it("ArkreenRECBank: buyART + withdraw", async () => {
        // Add ART token
        await arkreenRECBank.addNewART( arkreenRECToken.address,  maker1.address)
        await arkreenRECBank.addNewART( arkreenRECTokenESG.address,  maker2.address)  
        
        await arkreenRECBank.connect(maker1).depositART( arkreenRECToken.address,  expandTo9Decimals(9000))
        await arkreenRECBank.connect(maker2).depositART( arkreenRECTokenESG.address,  expandTo9Decimals(9000))

        await tokenA.approve(arkreenRECBank.address, constants.MaxUint256)    
        
        {
          await expect(arkreenRECBank.buyART( tokenA.address, arkreenRECToken.address, 1000_000_000, 0, true))    
                        .to.be.revertedWith("ARBK: Payment token not allowed")  

          await arkreenRECBank.connect(maker1).changeSalePrice( arkreenRECToken.address, tokenA.address, 10_000_000)
          await expect(arkreenRECBank.buyART( tokenA.address, arkreenRECToken.address, 1000_000_000, expandTo9Decimals(100).add(1), true))    
                        .to.be.revertedWith("ARBK: Get Less")  

          await expect(arkreenRECBank.buyART( tokenA.address, arkreenRECToken.address, 1000_000_000, expandTo9Decimals(100), true))
                  .to.emit(arkreenRECBank, "ARTSold")
                  .withArgs(arkreenRECToken.address, tokenA.address, expandTo9Decimals(100), 1000_000_000)

          expect(await arkreenRECToken.balanceOf(deployer.address)).to.eq(expandTo9Decimals(100))

          const saleIncome0 = await arkreenRECBank.saleIncome(arkreenRECToken.address, tokenA.address)
          expect(saleIncome0.amountReceived).to.equal(1000_000_000)

          const artSaleInfo0 = await arkreenRECBank.artSaleInfo(arkreenRECToken.address)
          expect(artSaleInfo0.amountSold).to.equal(expandTo9Decimals(100))

          await arkreenRECBank.buyART( tokenA.address, arkreenRECToken.address, 2000_000_000, expandTo9Decimals(200), true)       

          expect(await arkreenRECToken.balanceOf(deployer.address)).to.eq(expandTo9Decimals(100 + 200))   // 100 + 200

          const saleIncome1 = await arkreenRECBank.saleIncome(arkreenRECToken.address, tokenA.address)
          expect(saleIncome1.amountReceived).to.equal(1000_000_000 + 2000_000_000)

          const artSaleInfo1 = await arkreenRECBank.artSaleInfo(arkreenRECToken.address)
          expect(artSaleInfo1.amountSold).to.equal(expandTo9Decimals(100 + 200))

          // Test withdraw
          await expect(arkreenRECBank.connect(maker2).withdraw(arkreenRECToken.address, tokenA.address))
                  .to.be.revertedWith("ARBK: Not allowed")

          await arkreenRECBank.connect(maker1).withdraw(arkreenRECToken.address, tokenA.address)          
          expect(await tokenA.balanceOf(maker1.address)).to.eq(1000_000_000 + 2000_000_000)
        }
        {
          await arkreenRECBank.connect(maker2).changeSalePrice( arkreenRECTokenESG.address, tokenA.address, 20_000_000)

          await expect(arkreenRECBank.buyART( tokenA.address, arkreenRECTokenESG.address, 2999_000_000, expandTo9Decimals(150), false))    
                        .to.be.revertedWith("ARBK: Pay Less")  

          await expect(arkreenRECBank.buyART( tokenA.address, arkreenRECTokenESG.address, 3000_000_000, expandTo9Decimals(150), false))
                  .to.emit(arkreenRECBank, "ARTSold")
                  .withArgs(arkreenRECTokenESG.address, tokenA.address, expandTo9Decimals(150), 3000_000_000)

          expect(await arkreenRECTokenESG.balanceOf(deployer.address)).to.eq(expandTo9Decimals(150))

          const saleIncome0 = await arkreenRECBank.saleIncome(arkreenRECTokenESG.address, tokenA.address)
          expect(saleIncome0.amountReceived).to.equal(3000_000_000)

          const artSaleInfo0 = await arkreenRECBank.artSaleInfo(arkreenRECTokenESG.address)
          expect(artSaleInfo0.amountSold).to.equal(expandTo9Decimals(150))

          await arkreenRECBank.buyART( tokenA.address, arkreenRECTokenESG.address, 4000_000_000, expandTo9Decimals(200), false)       

          expect(await arkreenRECTokenESG.balanceOf(deployer.address)).to.eq(expandTo9Decimals(150 + 200))  

          const saleIncome1 = await arkreenRECBank.saleIncome(arkreenRECTokenESG.address, tokenA.address)
          expect(saleIncome1.amountReceived).to.equal(3000_000_000 + 4000_000_000)

          const artSaleInfo1 = await arkreenRECBank.artSaleInfo(arkreenRECTokenESG.address)
          expect(artSaleInfo1.amountSold).to.equal(expandTo9Decimals(150 + 200))

          // Test withdraw
          await expect(arkreenRECBank.connect(maker1).withdraw(arkreenRECTokenESG.address, tokenA.address))
                  .to.be.revertedWith("ARBK: Not allowed")

          await arkreenRECBank.connect(maker2).setFundReceiver( arkreenRECTokenESG.address, owner2.address)                  
          await arkreenRECBank.connect(maker2).withdraw(arkreenRECTokenESG.address, tokenA.address)          
          expect(await tokenA.balanceOf(owner2.address)).to.eq(3000_000_000 + 4000_000_000)
        }   
      })

      it("ArkreenRECBank: buyARTNtative + withdraw", async () => {
        // Add ART token
        await arkreenRECBank.addNewART( arkreenRECToken.address,  maker1.address)
        await arkreenRECBank.addNewART( arkreenRECTokenESG.address,  maker2.address)  
        
        await arkreenRECBank.connect(maker1).depositART( arkreenRECToken.address,  expandTo9Decimals(9000))
        await arkreenRECBank.connect(maker2).depositART( arkreenRECTokenESG.address,  expandTo9Decimals(9000))
       
        {
          await expect(arkreenRECBank.buyARTNative( arkreenRECToken.address, 0, true, {value: expandTo18Decimals(1)}))    
                        .to.be.revertedWith("ARBK: Payment token not allowed")  

          await arkreenRECBank.connect(maker1).changeSalePrice( arkreenRECToken.address, WETH.address, expandTo9Decimals(2_000_000)) //0.002 WETH         
          await expect(arkreenRECBank.buyARTNative( arkreenRECToken.address, expandTo9Decimals(500).add(1), true, {value: expandTo18Decimals(1)}))    
                        .to.be.revertedWith("ARBK: Get Less")  

          await expect(arkreenRECBank.buyARTNative( arkreenRECToken.address, expandTo9Decimals(500), true, {value: expandTo18Decimals(1)}))
                  .to.emit(arkreenRECBank, "ARTSold")
                  .withArgs(arkreenRECToken.address, WETH.address, expandTo9Decimals(500), expandTo18Decimals(1))

          expect(await arkreenRECToken.balanceOf(deployer.address)).to.eq(expandTo9Decimals(500))

          const saleIncome0 = await arkreenRECBank.saleIncome(arkreenRECToken.address, WETH.address)
          expect(saleIncome0.amountReceived).to.equal(expandTo18Decimals(1))

          const artSaleInfo0 = await arkreenRECBank.artSaleInfo(arkreenRECToken.address)
          expect(artSaleInfo0.amountSold).to.equal(expandTo9Decimals(500))

          await arkreenRECBank.buyARTNative( arkreenRECToken.address, expandTo9Decimals(1500), true, {value: expandTo18Decimals(3)})    
          expect(await arkreenRECToken.balanceOf(deployer.address)).to.eq(expandTo9Decimals(500 + 1500))   // 100 + 200

          const saleIncome1 = await arkreenRECBank.saleIncome(arkreenRECToken.address, WETH.address)
          expect(saleIncome1.amountReceived).to.equal(expandTo18Decimals(1+3))

          const artSaleInfo1 = await arkreenRECBank.artSaleInfo(arkreenRECToken.address)
          expect(artSaleInfo1.amountSold).to.equal(expandTo9Decimals(500 + 1500))

          // Test withdraw
          await expect(arkreenRECBank.connect(maker2).withdraw(arkreenRECToken.address, WETH.address))
                  .to.be.revertedWith("ARBK: Not allowed")
                  
          const balanceBefore = await ethers.provider.getBalance(maker1.address)      
          await arkreenRECBank.connect(maker1).withdraw(arkreenRECToken.address, WETH.address)
          expect( await ethers.provider.getBalance(maker1.address)).to.gt(balanceBefore)
        }
        {
          await arkreenRECBank.connect(maker2).changeSalePrice( arkreenRECTokenESG.address, WETH.address, expandTo9Decimals(2_500_000))  // 0.025ETH

          await expect(arkreenRECBank.buyARTNative( arkreenRECTokenESG.address, expandTo9Decimals(400).add(1), false, {value: expandTo18Decimals(1)} ))    
                        .to.be.revertedWith("ARBK: Pay Less")  

          await expect(arkreenRECBank.buyARTNative( arkreenRECTokenESG.address, expandTo9Decimals(400), false, {value: expandTo18Decimals(1)}))
                  .to.emit(arkreenRECBank, "ARTSold")
                  .withArgs(arkreenRECTokenESG.address, WETH.address, expandTo9Decimals(400), expandTo18Decimals(1))

          expect(await arkreenRECTokenESG.balanceOf(deployer.address)).to.eq(expandTo9Decimals(400))

          const saleIncome0 = await arkreenRECBank.saleIncome(arkreenRECTokenESG.address, WETH.address)
          expect(saleIncome0.amountReceived).to.equal(expandTo18Decimals(1))

          const artSaleInfo0 = await arkreenRECBank.artSaleInfo(arkreenRECTokenESG.address)
          expect(artSaleInfo0.amountSold).to.equal(expandTo9Decimals(400))

          await arkreenRECBank.buyARTNative( arkreenRECTokenESG.address, expandTo9Decimals(1200), false, {value: expandTo18Decimals(3)})    
          expect(await arkreenRECTokenESG.balanceOf(deployer.address)).to.eq(expandTo9Decimals(400 + 1200))  

          const saleIncome1 = await arkreenRECBank.saleIncome(arkreenRECTokenESG.address, WETH.address)
          expect(saleIncome1.amountReceived).to.equal(expandTo18Decimals(1 +3 ))

          const artSaleInfo1 = await arkreenRECBank.artSaleInfo(arkreenRECTokenESG.address)
          expect(artSaleInfo1.amountSold).to.equal(expandTo9Decimals(400 + 1200))

          const balanceBefore = await ethers.provider.getBalance(deployer.address)       
          await expect(arkreenRECBank.buyARTNative( arkreenRECTokenESG.address, expandTo9Decimals(800), false, {value: expandTo18Decimals(5)}))
                  .to.emit(arkreenRECBank, "ARTSold")
                  .withArgs(arkreenRECTokenESG.address, WETH.address, expandTo9Decimals(800), expandTo18Decimals(2))
          const balanceAfter = await ethers.provider.getBalance(deployer.address)   
          expect(balanceBefore.sub(balanceAfter)).to.lte(expandTo18Decimals(3))  
          
          {
            // Test withdraw
            await expect(arkreenRECBank.connect(maker1).withdraw(arkreenRECTokenESG.address, WETH.address))
                    .to.be.revertedWith("ARBK: Not allowed")
                    
            const balanceBefore = await ethers.provider.getBalance(owner2.address)   
            await arkreenRECBank.connect(maker2).setFundReceiver( arkreenRECTokenESG.address, owner2.address)     
            await arkreenRECBank.connect(maker2).withdraw(arkreenRECTokenESG.address, WETH.address)

            expect( await ethers.provider.getBalance(owner2.address)).to.gt(
                balanceBefore.add(expandTo18Decimals(1 +3).sub(expandTo18Decimals(1).div(100))))    // gas fee less than 0.01ETH
          }
        }   
      })

      it("ArkreenRECBank: buyARTWithPermit test", async () => {
        // Add ART token
        await arkreenRECBank.addNewART( arkreenRECToken.address,  maker1.address)
        await arkreenRECBank.addNewART( arkreenRECTokenESG.address,  maker2.address)  
        
        await arkreenRECBank.connect(maker1).depositART( arkreenRECToken.address,  expandTo9Decimals(9000))
        await arkreenRECBank.connect(maker2).depositART( arkreenRECTokenESG.address,  expandTo9Decimals(9000))
       
        {
          const nonce1 = await AKREToken.nonces(owner1.address)
          const digest1 = await getApprovalDigest( AKREToken,
                                  { owner: owner1.address, spender: arkreenRECBank.address, value: expandTo18Decimals(500*100) },
                                  nonce1,
                                  constants.MaxUint256
                                )
          const { v,r,s } = ecsign(Buffer.from(digest1.slice(2), 'hex'), Buffer.from(privateKeyOwner.slice(2), 'hex'))
          const permitToPay: SignatureStruct = { v, r, s, token: AKREToken.address, value:expandTo18Decimals(500*100), deadline: constants.MaxUint256 }      

          permitToPay.deadline = 0
          await expect(arkreenRECBank.connect(owner1).buyARTWithPermit( arkreenRECToken.address, 0, true, permitToPay))    
                        .to.be.revertedWith("ERC20Permit: expired deadline")  

          permitToPay.deadline = constants.MaxUint256.sub(1)
          await expect(arkreenRECBank.connect(owner1).buyARTWithPermit( arkreenRECToken.address, 0, true, permitToPay))    
                        .to.be.revertedWith("ERC20Permit: invalid signature")            

          permitToPay.deadline = constants.MaxUint256                        
          await expect(arkreenRECBank.connect(owner1).buyARTWithPermit( arkreenRECToken.address, expandTo9Decimals(500), true, permitToPay))    
                        .to.be.revertedWith("ARBK: Payment token not allowed")  

          await arkreenRECBank.connect(maker1).changeSalePrice( arkreenRECToken.address, AKREToken.address, expandTo18Decimals(100))    // 100 AKRE                
          await expect(arkreenRECBank.connect(owner1).buyARTWithPermit( arkreenRECToken.address, expandTo9Decimals(500).add(1), true, permitToPay))    
                        .to.be.revertedWith("ARBK: Get Less")  

          const ARTBalance = await arkreenRECToken.balanceOf(owner1.address)               
          await expect(arkreenRECBank.connect(owner1).buyARTWithPermit( arkreenRECToken.address, expandTo9Decimals(500), true, permitToPay))
                  .to.emit(arkreenRECBank, "ARTSold")
                  .withArgs(arkreenRECToken.address, AKREToken.address, expandTo9Decimals(500), expandTo18Decimals(500*100))

          expect(await arkreenRECToken.balanceOf(owner1.address)).to.eq(ARTBalance.add(expandTo9Decimals(500)))

          const saleIncome0 = await arkreenRECBank.saleIncome(arkreenRECToken.address, AKREToken.address)
          expect(saleIncome0.amountReceived).to.equal(expandTo18Decimals(500*100))

          const artSaleInfo0 = await arkreenRECBank.artSaleInfo(arkreenRECToken.address)
          expect(artSaleInfo0.amountSold).to.equal(expandTo9Decimals(500))

          {
            const nonce1 = await AKREToken.nonces(owner1.address)
            const digest1 = await getApprovalDigest( AKREToken,
                                    { owner: owner1.address, spender: arkreenRECBank.address, value: expandTo18Decimals(1500*100) },
                                    nonce1,
                                    constants.MaxUint256
                                  )
            const { v,r,s } = ecsign(Buffer.from(digest1.slice(2), 'hex'), Buffer.from(privateKeyOwner.slice(2), 'hex'))
            const permitToPay: SignatureStruct = { v, r, s, token: AKREToken.address, value:expandTo18Decimals(1500*100), deadline: constants.MaxUint256 }      

            await arkreenRECBank.connect(owner1).buyARTWithPermit( arkreenRECToken.address, expandTo9Decimals(1500), true, permitToPay)    
            expect(await arkreenRECToken.balanceOf(owner1.address)).to.eq(ARTBalance.add(expandTo9Decimals(500 + 1500)))   // 100 + 200

            const saleIncome1 = await arkreenRECBank.saleIncome(arkreenRECToken.address, AKREToken.address)
            expect(saleIncome1.amountReceived).to.equal(expandTo18Decimals((500+1500)*100))

            const artSaleInfo1 = await arkreenRECBank.artSaleInfo(arkreenRECToken.address)
            expect(artSaleInfo1.amountSold).to.equal(expandTo9Decimals(500 + 1500))

          }

          // Test withdraw
          await expect(arkreenRECBank.connect(maker2).withdraw(arkreenRECToken.address, AKREToken.address))
                  .to.be.revertedWith("ARBK: Not allowed")

          const AKREBalanceBefore = await AKREToken.balanceOf(maker1.address)                  
          await arkreenRECBank.connect(maker1).withdraw(arkreenRECToken.address, AKREToken.address)  

          expect(await AKREToken.balanceOf(maker1.address)).to.eq(AKREBalanceBefore.add(expandTo18Decimals((500+1500)*100)))
        }

        {
          const nonce1 = await AKREToken.nonces(owner1.address)
          const digest1 = await getApprovalDigest( AKREToken,
                                  { owner: owner1.address, spender: arkreenRECBank.address, value: expandTo18Decimals(1500*150) },
                                  nonce1,
                                  constants.MaxUint256
                                )
          const { v,r,s } = ecsign(Buffer.from(digest1.slice(2), 'hex'), Buffer.from(privateKeyOwner.slice(2), 'hex'))
          const permitToPay: SignatureStruct = { v, r, s, token: AKREToken.address, value:expandTo18Decimals(1500*150), deadline: constants.MaxUint256 }      
                
          await expect(arkreenRECBank.connect(owner1).buyARTWithPermit( arkreenRECTokenESG.address, expandTo9Decimals(1500), false, permitToPay))    
                        .to.be.revertedWith("ARBK: Payment token not allowed")  

          await arkreenRECBank.connect(maker2).changeSalePrice( arkreenRECTokenESG.address, AKREToken.address, expandTo18Decimals(150))    // 100 AKRE                
          await expect(arkreenRECBank.connect(owner1).buyARTWithPermit( arkreenRECTokenESG.address, expandTo9Decimals(1500).add(1), false, permitToPay))    
                        .to.be.revertedWith("ARBK: Pay Less")  

          const ARTBalance = await arkreenRECTokenESG.balanceOf(owner1.address)               
          await expect(arkreenRECBank.connect(owner1).buyARTWithPermit( arkreenRECTokenESG.address, expandTo9Decimals(1500), false, permitToPay))
                  .to.emit(arkreenRECBank, "ARTSold")
                  .withArgs(arkreenRECTokenESG.address, AKREToken.address, expandTo9Decimals(1500), expandTo18Decimals(1500*150))

          expect(await arkreenRECTokenESG.balanceOf(owner1.address)).to.eq(ARTBalance.add(expandTo9Decimals(1500)))

          const saleIncome0 = await arkreenRECBank.saleIncome(arkreenRECTokenESG.address, AKREToken.address)
          expect(saleIncome0.amountReceived).to.equal(expandTo18Decimals(1500*150))

          const artSaleInfo0 = await arkreenRECBank.artSaleInfo(arkreenRECTokenESG.address)
          expect(artSaleInfo0.amountSold).to.equal(expandTo9Decimals(1500))

          {
            const nonce1 = await AKREToken.nonces(owner1.address)
            const digest1 = await getApprovalDigest( AKREToken,
                                    { owner: owner1.address, spender: arkreenRECBank.address, value: expandTo18Decimals(2500*150) },
                                    nonce1,
                                    constants.MaxUint256
                                  )
            const { v,r,s } = ecsign(Buffer.from(digest1.slice(2), 'hex'), Buffer.from(privateKeyOwner.slice(2), 'hex'))
            const permitToPay: SignatureStruct = { v, r, s, token: AKREToken.address, value:expandTo18Decimals(2500*150), deadline: constants.MaxUint256 }      

            await arkreenRECBank.connect(owner1).buyARTWithPermit( arkreenRECTokenESG.address, expandTo9Decimals(2500), false, permitToPay)    
            expect(await arkreenRECTokenESG.balanceOf(owner1.address)).to.eq(ARTBalance.add(expandTo9Decimals(1500 + 2500)))   // 100 + 200

            const saleIncome1 = await arkreenRECBank.saleIncome(arkreenRECTokenESG.address, AKREToken.address)
            expect(saleIncome1.amountReceived).to.equal(expandTo18Decimals((1500+2500)*150))

            const artSaleInfo1 = await arkreenRECBank.artSaleInfo(arkreenRECTokenESG.address)
            expect(artSaleInfo1.amountSold).to.equal(expandTo9Decimals(1500 + 2500))

          }
        }
        
        // Test withdraw
        await expect(arkreenRECBank.connect(maker1).withdraw(arkreenRECTokenESG.address, AKREToken.address))
                  .to.be.revertedWith("ARBK: Not allowed")

        await arkreenRECBank.connect(maker2).setFundReceiver( arkreenRECTokenESG.address, owner2.address)                  
        await arkreenRECBank.connect(maker2).withdraw(arkreenRECTokenESG.address, AKREToken.address)          
        expect(await AKREToken.balanceOf(owner2.address)).to.eq(expandTo18Decimals((1500+2500)*150))
      })
    })  
});
