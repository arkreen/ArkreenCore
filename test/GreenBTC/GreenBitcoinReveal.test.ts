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

describe("GreenBitcoinReveal Test Campaign", () => {
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

      await greenBitcoin.setNewCaps(200, 100, 800);
              
      const GreenBTCImageFactory = await ethers.getContractFactory("GreenBTCImage");
      greenBTCImage = await GreenBTCImageFactory.deploy()
      await greenBTCImage.deployed();  

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
        }

        {
          let signature: SignatureStruct
          const mintFee = expandTo18Decimals(20000 *1000)    
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
          
          await arkreenRECIssuanceExt.connect(owner1).mintESGBatch(1, expandTo9Decimals(20000), signature)
          tokenID = await arkreenRECIssuanceExt.totalSupply()

          await arkreenRECIssuanceExt.connect(owner1).updateRECDataExt(tokenID, startTime, endTime, cID, region, url, memo)                     
          await arkreenRECIssuance.connect(maker1).certifyRECRequest(tokenID, "Serial12345678")

          // Normal
          await arkreenRECIssuance.connect(owner1).liquidizeREC(tokenID)

          await arkreenRECTokenESG.connect(owner1).transfer(maker2.address, expandTo9Decimals(9000))
          await arkreenRECTokenESG.connect(maker2).approve(arkreenRECBank.address, expandTo9Decimals(9000))   

        }
      });

      ///////////////////////////////////////////
      // #############################
      it("GreenBTC Test: revealBoxes", async () => {

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
          
        await arkreenRECBank.connect(maker2).changeSalePrice( arkreenRECTokenESG.address, AKREToken.address, expandTo18Decimals(10))

        const amountPay = expandTo18Decimals(2)

        await arkreenBuilder.mangeTrustedForwarder(greenBitcoin.address, true)
        await AKREToken.connect(owner1).approve(greenBitcoin.address, constants.MaxUint256)      
 
         // 2nd Block: authMintGreenBTCWithApprove    
        let hashTable = new Array<string>(500)
        for (let index = 0; index < 500; index++) { 
          if ( (index % 100) == 0 ) {
            console.log("Buy GreenBTC block", index)
          }

          const greenBTCInfo =  {
            height: BigNumber.from(12345 + index),
            ARTCount: expandTo9Decimals(13).div(100),  // 13 HART
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

          const tx = await greenBitcoin.connect(owner1).authMintGreenBTCWithApprove( greenBTCInfo, {v,r,s}, badgeInfo, 
                                              {token: AKREToken.address, amount: amountPay}, constants_MaxDealine)  
          
          hashTable[index] = tx.hash

          await greenBitcoin.connect(owner2).openBox(12345 + index)
 
        }

        await mine(10)

        while(true) {
          const openingBoxListBefore = await greenBitcoin.getOpeningBoxList()
          const openingBoxListOvertimedBefore = await greenBitcoin.getOpeningOvertimed()
          const overtimeBoxListBefore = await greenBitcoin.getOvertimeBoxList()
          
          console.log("Reveal BeFore:", openingBoxListBefore.length, openingBoxListOvertimedBefore.toString(), overtimeBoxListBefore.length)

          const revealBoxesTx = await greenBitcoin.revealBoxes()
          const receipt = await revealBoxesTx.wait()
                  
          const openingBoxListAfter = await greenBitcoin.getOpeningBoxList()
          const openingBoxListOvertimedAfter = await greenBitcoin.getOpeningOvertimed()
          const overtimeBoxListAfter = await greenBitcoin.getOvertimeBoxList()
          console.log("Reveal After:", openingBoxListAfter.length, openingBoxListOvertimedAfter.toString(),  overtimeBoxListAfter.length, receipt.gasUsed)

          if(openingBoxListOvertimedAfter.eq(0)) break
        }

        const overtimeBoxListAfter = await greenBitcoin.getOvertimeBoxList()
        for (let index = 0; index < overtimeBoxListAfter.length; index++ ) {
          let length = overtimeBoxListAfter.length - index
          if(length > 100) length = 100

          const id: number[] = Array.from(Array(length).keys())
          const blockID = id.map(id => (12345 + index + id))

          const tx = await greenBitcoin.revealBoxesWithHash( blockID, hashTable.slice(0,length))

          const receipt = await tx.wait()
          console.log("revealBoxesWithHash gas price: ", receipt.gasUsed)

          index += length
        }

      });

      it("GreenBTC Test: authMintGreenBTCWithARTBatch", async () => {
        await arkreenRECBank.addNewART( arkreenRECToken.address,  maker1.address)
        await arkreenRECBank.addNewART( arkreenRECTokenESG.address,  maker2.address)  
        
        await arkreenRECBank.connect(maker1).depositART( arkreenRECToken.address,  expandTo9Decimals(9000))
        await arkreenRECBank.connect(maker2).depositART( arkreenRECTokenESG.address,  expandTo9Decimals(9000))

        await arkreenRECToken.setClimateBuilder(arkreenBuilder.address)
        await arkreenRECTokenESG.setClimateBuilder(arkreenBuilder.address)

        await greenBitcoin.mangeARTTokens([arkreenRECToken.address, arkreenRECTokenESG.address], true)   
        await greenBitcoin.approveBuilder([arkreenRECToken.address, arkreenRECTokenESG.address])

        await arkreenBuilder.mangeTrustedForwarder(greenBitcoin.address, true)
        await arkreenRECToken.connect(owner1).approve(greenBitcoin.address, constants.MaxUint256)  

        const badgeInfo =  {
          beneficiary:    owner1.address,
          offsetEntityID: 'Owner1',
          beneficiaryID:  'Tester',
          offsetMessage:  "Just Testing"
        }    

        // Normal: authMintGreenBTCWithARTBatch(Open): arkreenRECToken: Gasfee
        for( let batch = 0; batch < 62; batch++) {        // 99 Overtime + 199 releal + 500 remove

            let greenBTCInfoArray = new Array<GreenBTCInfo>(30)
            for( let index = 0; index < greenBTCInfoArray.length; index++) {
              greenBTCInfoArray[index]=  {
                height:     BigNumber.from(67890 + batch * 100 ).add(index),
                ARTCount:   expandTo9Decimals(12).div(10),  // 12 HART
                minter:     owner1.address,
                greenType:  0x12,
                blockTime:  'Apr 14, 2009 10:25 PM UTC',
                energyStr:  '45.234 MWh'
              }
            }

            let greenBTCInfoArrayX = new Array<GreenBTCInfo>(49)
            for( let index = 0; index < greenBTCInfoArrayX.length; index++) {
              greenBTCInfoArrayX[index]=  {
                height:     BigNumber.from(67890 + batch * 100 ).add(index),
                ARTCount:   expandTo9Decimals(12).div(10),  // 12 HART
                minter:     owner1.address,
                greenType:  0x12,
                blockTime:  'Apr 14, 2009 10:25 PM UTC',
                energyStr:  '45.234 MWh'
              }
            }

            // const receiver = owner1.address
            const register_digest = getGreenBitcoinDigestBatch(
                            'Green BTC Club',
                            greenBitcoin.address, (batch != 55 ) &&  (batch != 61 ) ? greenBTCInfoArray : greenBTCInfoArrayX
                          )
      
            const {v,r,s} = ecsign( Buffer.from(register_digest.slice(2), 'hex'), 
                                                  Buffer.from(privateKeyRegister.slice(2), 'hex'))  

            let tx
            let receipt                                                
            if((batch != 55 ) && (batch != 61 )) {
              tx = await greenBitcoin.connect(owner1).authMintGreenBTCWithARTBatch( 
                                greenBTCInfoArray, {v,r,s}, badgeInfo, arkreenRECToken.address, constants_MaxDealineAndOpen )  
              receipt = await tx.wait() 
            } else {
              tx = await greenBitcoin.connect(owner1).authMintGreenBTCWithARTBatch( 
                                greenBTCInfoArrayX, {v,r,s}, badgeInfo, arkreenRECToken.address, constants_MaxDealineAndOpen )  
              receipt = await tx.wait() 
            }

            if (batch == 55) await mine(233-97)

            const openingBoxList = await greenBitcoin.getOpeningBoxList() 
            console.log("AAAAAAAAAAA", batch, receipt.blockNumber, openingBoxList.length)
            if( ((batch % 5) ==0) && (batch < 70) ) {                         
              await mine(97)
            }
        }

        for (let index = 0; index < 30; index++ ) {
          const revealBoxesTx = await greenBitcoin.revealBoxes()
          const openingBoxList = await greenBitcoin.getOpeningBoxList() 
          const openingOvertimed = await greenBitcoin.getOpeningOvertimed() 
          const overtimeBoxList = await greenBitcoin.getOvertimeBoxList() 
          const receipt = await revealBoxesTx.wait()
          console.log("Index:", index, receipt.blockNumber, receipt.gasUsed, openingBoxList.length,  openingOvertimed, overtimeBoxList.length)
          if (openingBoxList.length == 0) break;
        }

      });     

/*
      it("GreenBTC Test: restoreOvertimeBoxList", async () => {

          const tokenIdList = Array.from(Array(256).keys())
          const openHeightList = Array.from(Array(256).keys()).map(i =>(i+1000))

          const tx = await greenBitcoin.restoreOvertimeBoxList(tokenIdList, openHeightList)

          const receipt = await tx.wait()
          console.log("restoreOvertimeBoxList gas price: ", receipt.gasUsed)

          const overtimeBoxList = await greenBitcoin.getOvertimeBoxList()

          console.log('overtimeBoxList:', overtimeBoxList, overtimeBoxList.length )

      })
*/

    })  

})
