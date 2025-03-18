import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import { loadFixture, mine } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
const {ethers, upgrades} =  require("hardhat");
import hre from 'hardhat'
import { ecsign, fromRpcSig, ecrecover } from 'ethereumjs-util'
import { getGreenBitcoinClaimGifts, getApprovalDigest, expandTo18Decimals, randomAddresses, expandTo9Decimals, expandTo6Decimals } from '../utils/utilities'
import { UtilCalculateGifts, ActionInfo, getGreenBTC2SLuckyDigest, getGreenBTC2SBuyNodeDigest } from '../utils/utilities'

import { constants, BigNumber, utils} from 'ethers'
import { anyValue } from "@nomicfoundation/hardhat-chai-matchers/withArgs";

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
    GreenBTC2S,
    GreenBTCGift,
    GreenBTCGift__factory,
    GreenBTC2__factory,
    ArkreenToken__factory,
    ArkreenTokenTest__factory
    // ArkreenTokenV2,
    // ArkreenTokenV2__factory
} from "../../typechain";

import { RECRequestStruct, SignatureStruct, RECDataStruct } from "../../typechain/contracts/ArkreenRECIssuance";
import Decimal from "decimal.js";
const constants_MaxDealine = BigNumber.from('0xFFFFFFFF')

describe("GreenBTC2S Test Campaign", ()=>{

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
    let greenBTC2S:                    GreenBTC2S
    
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
  
        const ArkreenBuilderFactory = await ethers.getContractFactory("ArkreenBuilder");
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

        const GreenBTC2Factory = await ethers.getContractFactory("GreenBTC2S")
        const greenBTC2S = await upgrades.deployProxy(GreenBTC2Factory, [kWhToken.address, manager.address]) as GreenBTC2S
        await greenBTC2S.deployed()

        await tokenA.transfer(greenBTC2S.address, expandTo18Decimals(30000000))
        await AKREToken.transfer(greenBTC2S.address, expandTo18Decimals(30000000))

        return { AKREToken, arkreenMiner, arkreenRegistry, arkreenRECIssuance, arkreenRECToken, 
          arkreenRetirement, arkreenRECIssuanceExt, arkreenRECBank, kWhToken, WETH, tokenA,
          greenBTC2S }
    }

    describe('GreenBTC2S test', () => {
      const domainInfo = {
                x: 5,  y: 6, w:  7, h: 8,
                boxTop: 200000,
                chance1: 15,   chance2: 200, chance3: 1000, chance4: 0,
                ratio1: 500,   ratio2: 1500, ratio3: 0,     ratio4: 0,
                decimal: 8,
                allchance: 0
              }
/*
      const domainInfo = {
                x: 0,  y: 20, w:  4, h: 4,
                boxTop: 669611,
                chance1: 1000,   chance2: 1500, chance3: 2500, chance4: 200,
                ratio1: 200,   ratio2: 1400, ratio3: 2200,     ratio4: 1000,
                decimal: 7,
                allchance: 0
              }
*/

      const ratiosSum = 15 + 200 + 1000 + 500 + 1500

      const convertRatio = (chance: number) => Math.floor((65536 * chance +5000) / 10000)

      const sum = convertRatio(15) + convertRatio(200) + convertRatio(1000) +
                  convertRatio(500) + convertRatio(1500)

      let domainInfoBigInt= BigNumber.from(domainInfo.x).shl(248)
                         .add(BigNumber.from(domainInfo.y).shl(240))
                         .add(BigNumber.from(domainInfo.w).shl(232))
                         .add(BigNumber.from(domainInfo.h).shl(224))
                         .add(BigNumber.from(domainInfo.boxTop).shl(192))
                         .add(BigNumber.from(convertRatio(domainInfo.chance1)).shl(176))
                         .add(BigNumber.from(convertRatio(domainInfo.chance2)).shl(160))
                         .add(BigNumber.from(convertRatio(domainInfo.chance3)).shl(144))
                         .add(BigNumber.from(convertRatio(domainInfo.chance4)).shl(128))
                         .add(BigNumber.from(convertRatio(domainInfo.ratio1)).shl(112))
                         .add(BigNumber.from(convertRatio(domainInfo.ratio2)).shl(96))
                         .add(BigNumber.from(convertRatio(domainInfo.ratio3)).shl(80))
                         .add(BigNumber.from(convertRatio(domainInfo.ratio4)).shl(64))
                         .add(BigNumber.from(domainInfo.decimal).shl(56))

      const chance1Converted =  convertRatio(domainInfo.chance1)
      const chance2Converted =  chance1Converted + convertRatio(domainInfo.chance2)
      const chance3Converted =  chance2Converted + convertRatio(domainInfo.chance3)
      const chance4Converted =  chance3Converted + convertRatio(domainInfo.chance4)
      const chance5Converted =  chance4Converted + convertRatio(domainInfo.ratio1)
      const chance6Converted =  chance5Converted + convertRatio(domainInfo.ratio2)
      const chance7Converted =  chance6Converted + convertRatio(domainInfo.ratio3)
      const chance8Converted =  chance7Converted + convertRatio(domainInfo.ratio4)

      const domainInfoBigIntConverted = BigNumber.from(domainInfo.x).shl(248)
                         .add(BigNumber.from(domainInfo.y).shl(240))
                         .add(BigNumber.from(domainInfo.w).shl(232))
                         .add(BigNumber.from(domainInfo.h).shl(224))
                         .add(BigNumber.from(domainInfo.boxTop).shl(192))
                         .add(BigNumber.from(chance1Converted).shl(176))
                         .add(BigNumber.from(chance2Converted).shl(160))
                         .add(BigNumber.from(chance3Converted).shl(144))
                         .add(BigNumber.from(chance4Converted).shl(128))
                         .add(BigNumber.from(chance5Converted).shl(112))
                         .add(BigNumber.from(chance6Converted).shl(96))
                         .add(BigNumber.from(chance7Converted).shl(80))
                         .add(BigNumber.from(chance8Converted).shl(64))
                         .add(BigNumber.from(domainInfo.decimal).shl(56))

      let actionInfo: ActionInfo = {
                        actionID:     BigNumber.from(1),
                        domainID:     BigNumber.from(1),
                        boxStart:     BigNumber.from(0),
                        boxAmount:    BigNumber.from(0),
                        actor:        '',
                        blockHash:    '',
                        blockHeigh:   BigNumber.from(0),
                        domainInfo:   domainInfoBigIntConverted,
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
        greenBTC2S = fixture.greenBTC2S

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
          await arkreenRECToken.setClimateBuilder(arkreenBuilder.address)
  
          const badgeInfo =  {
            beneficiary:    owner1.address,
            offsetEntityID: 'Owner1',
            beneficiaryID:  'Tester',
            offsetMessage:  "Just Testing"
          }    
  
          await kWhToken.setBadgeInfo(badgeInfo)
  
          // MintKWh with ART
          await arkreenRECToken.connect(owner1).transfer(kWhToken.address, expandTo9Decimals(20000))
          await arkreenRECToken.connect(owner1).transfer(deployer.address, expandTo9Decimals(5000))

          await kWhToken.changeSwapPrice(arkreenRECToken.address, expandTo9Decimals(1))

          // Normal MintKWh                         
          await kWhToken.MintKWh( arkreenRECToken.address, expandTo9Decimals(20000))

          await arkreenRECToken.approve(kWhToken.address, constants.MaxUint256)
          await kWhToken.convertKWh(arkreenRECToken.address, expandTo9Decimals(5000))

          await arkreenRECToken.connect(owner1).approve(kWhToken.address, constants.MaxUint256)
          await kWhToken.connect(owner1).convertKWh(arkreenRECToken.address, expandTo9Decimals(15000))

        }
      });

      it("GreenBTC2S basics test", async function () {
/*
        const domainInfo = BigNumber.from('0x0303060600000bb8006205811f1b1f1b2be8524e524e524e0800000000000065')

        let actionInfoTest: ActionInfo = {
          actionID:     BigNumber.from(4),
          domainID:     BigNumber.from(68),
          boxStart:     BigNumber.from(90),
          boxAmount:    BigNumber.from(11),
          actor:        '0x8746c91a1a9dE01c624df517BbD70E9FeEADE7af',
          blockHash:    '0x890238c78cd76ea2b86f340d7da89f3b02c4ca27436f444ba0de36ef17a4bab6',
          blockHeigh:   BigNumber.from(954010),
          domainInfo:   domainInfo,
        }

        const  { counters: countersCheckTest, wonList: wonListCheckTest } = UtilCalculateGifts(actionInfoTest)
        console.log("UtilCalculateGifts Test", countersCheckTest, wonListCheckTest, domainInfoBigIntConverted.toHexString())
*/

        const domainInfoString = utils.defaultAbiCoder.encode(['uint256'], [domainInfoBigInt])

        const domainID = 1
        await expect( await greenBTC2S.registerDomain(domainID, domainInfoString))
                .to.emit(greenBTC2S, 'DomainRegistered')
                .withArgs(domainID, domainInfoBigInt.toHexString())

        expect(await greenBTC2S.domains(1)).to.eq(domainInfoBigIntConverted)

        await kWhToken.connect(owner1).approve(greenBTC2S.address, constants.MaxUint256)

        const greenizetx = await  greenBTC2S.connect(owner1).makeGreenBox(1, 123)
//        await  greenBTC2S.connect(owner1).makeGreenBox(1, 123)

        const receipt = await greenizetx.wait()

        // console.log("AAAAAAAAAAAAAAA", domainInfoBigIntConverted.toHexString(), receipt)

        await mine(5)

        expect(await greenBTC2S.domains(1)).to.eq(domainInfoBigIntConverted.add(123))

        const greenActions = BigNumber.from(receipt.blockNumber).shl(224)
                                      .add(BigNumber.from(1).shl(208))
                                      .add(BigNumber.from(0).shl(176))
                                      .add(BigNumber.from(123).shl(160))
                                      .add(BigNumber.from(owner1.address))

        // blockHeight: MSB0:4; domainId: MSB4:2; boxStart: MSB6:4; boxAmount: MSB10: 2; Owner address: MSB12:20
        expect(await greenBTC2S.greenActions(1)).to.eq(greenActions)

        expect(await greenBTC2S.getUserActionIDs(owner1.address, 0 , 0)).to.deep.eq([BigNumber.from(1), '0x00000001'])
        expect(await greenBTC2S.getDomainActionIDs(1, 0 , 0)).to.deep.eq([BigNumber.from(1), '0x00000001'])

        actionInfo.boxAmount = BigNumber.from(123)
        actionInfo.actor = owner1.address
        actionInfo.blockHeigh = BigNumber.from(receipt.blockNumber)
        actionInfo.blockHash = receipt.blockHash

        let allCounters = new Array<number>(8).fill(0)
        const  { counters: countersCheck, wonList: wonListCheck } = UtilCalculateGifts(actionInfo)

        for (let index=0; index<8; index++ ) {
          allCounters[index] += (index==0) ? countersCheck[index] :  countersCheck[index] - countersCheck[index-1]
        }

/*
        const {actionID, actionResult, blockHeight, domainID: domainId, counters, wonList} = await greenBTC2S.checkIfShot(owner1.address, 1, Bytes32_Zero)

        expect(actionID).to.deep.eq(1)
        expect(actionResult).to.deep.eq(0)
        expect(blockHeight).to.deep.eq(receipt.blockNumber)
        expect(domainId).to.deep.eq(1)
        expect(counters).to.deep.eq(countersCheck)
        expect(wonList).to.deep.eq(wonListCheck)
*/      
      });

      it("GreenBTC2S Lucky Green Test", async function () {

        const GreenBTC2Factory = await ethers.getContractFactory("GreenBTC2S")
        const _IMPLEMENTATION_SLOT = "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc";
        const implementation  = await ethers.provider.getStorageAt(greenBTC2S.address, _IMPLEMENTATION_SLOT) 
        //console.log("whiteListMinerBatch in index:",  implementation, '0x'+ implementation.slice(26)  )

        // 0x84ea74d481ee0a5332c457a4d796187f6ba67feb
        const callData = GreenBTC2Factory.interface.encodeFunctionData("postUpdate")
        await greenBTC2S.upgradeToAndCall('0x'+ implementation.slice(26), callData)
        //console.log("postUpdate tx:",  updateTx  )

        await greenBTC2S.setLuckyManager(manager.address)

        const domainInfoString = utils.defaultAbiCoder.encode(['uint256'], [domainInfoBigInt])
        const domainID = 1
        await greenBTC2S.registerDomain(domainID, domainInfoString)

        await kWhToken.connect(owner1).approve(greenBTC2S.address, constants.MaxUint256)

        const boxSteps = BigNumber.from(123)
        const nonce = BigNumber.from(0)

        const digest = getGreenBTC2SLuckyDigest(
          'Green BTC Club',
          greenBTC2S.address,
          BigNumber.from(domainID), boxSteps, owner1.address, nonce, constants.MaxUint256
        )

        const {v,r,s} = ecsign(Buffer.from(digest.slice(2), 'hex'), Buffer.from(privateKeyManager.slice(2), 'hex'))   
        const signature: GreenBTC2S.SigStruct = { v, r, s }  

        //await kWhToken.connect(owner1).transfer(greenBTC2S.address, expandTo9Decimals(10000))
        await greenBTC2S.connect(owner1).depositkWh(expandTo9Decimals(10000))

        const greenizetx = await  greenBTC2S.connect(owner1).makeGreenBoxLucky(1, 123, owner1.address, nonce, constants.MaxUint256, signature)

        const receipt = await greenizetx.wait()

        await mine(5)

        expect(await greenBTC2S.domains(1)).to.eq(domainInfoBigIntConverted.add(123))

        const greenActions = BigNumber.from(receipt.blockNumber).shl(224)
                                      .add(BigNumber.from(1).shl(208))      // Domain id
                                      .add(BigNumber.from(0).shl(176))      // Start
                                      .add(BigNumber.from(123).shl(160))    // Amount
                                      .add(BigNumber.from(owner1.address))

        // blockHeight: MSB0:4; domainId: MSB4:2; boxStart: MSB6:4; boxAmount: MSB10: 2; Owner address: MSB12:20
        expect(await greenBTC2S.greenActions(1)).to.eq(greenActions)

        expect(await greenBTC2S.getUserActionIDs(owner1.address, 0 , 0)).to.deep.eq([BigNumber.from(1), '0x00000001'])
        expect(await greenBTC2S.getDomainActionIDs(1, 0 , 0)).to.deep.eq([BigNumber.from(1), '0x00000001'])

        actionInfo.boxAmount = BigNumber.from(123)
        actionInfo.actor = owner1.address
        actionInfo.blockHeigh = BigNumber.from(receipt.blockNumber)
        actionInfo.blockHash = receipt.blockHash

        let allCounters = new Array<number>(8).fill(0)
        const  { counters: countersCheck, wonList: wonListCheck } = UtilCalculateGifts(actionInfo)

        for (let index=0; index<8; index++ ) {
          allCounters[index] += (index==0) ? countersCheck[index] :  countersCheck[index] - countersCheck[index-1]
        }

/*
        const {actionID, actionResult, blockHeight, domainID: domainId, counters, wonList} = await greenBTC2S.checkIfShot(owner1.address, 1, Bytes32_Zero)

        expect(actionID).to.deep.eq(1)
        expect(actionResult).to.deep.eq(0)
        expect(blockHeight).to.deep.eq(receipt.blockNumber)
        expect(domainId).to.deep.eq(1)
        expect(counters).to.deep.eq(countersCheck)
        expect(wonList).to.deep.eq(wonListCheck)
*/      
        {
          const nonce = BigNumber.from(1)             // new nonce 
          const digest = getGreenBTC2SLuckyDigest(
            'Green BTC Club',
            greenBTC2S.address,
            BigNumber.from(domainID), boxSteps, owner1.address, nonce, constants.MaxUint256
          )

          const {v,r,s} = ecsign(Buffer.from(digest.slice(2), 'hex'), Buffer.from(privateKeyManager.slice(2), 'hex'))   
          const signature: GreenBTC2S.SigStruct = { v, r, s }  

          const balanceBefore = await kWhToken.balanceOf(greenBTC2S.address)
          await expect(greenBTC2S.connect(owner1).makeGreenBoxLucky(1, 123, owner1.address, nonce, constants.MaxUint256, signature))
                .to.emit(greenBTC2S, 'DomainGreenizedLucky')
                .withArgs(owner1.address, 2, anyValue, 1, BigNumber.from(123), BigNumber.from(123), nonce)

          const balanceAfter = await kWhToken.balanceOf(greenBTC2S.address)
          expect(balanceAfter).to.eq(balanceBefore.sub(BigNumber.from(123).mul(expandTo6Decimals(100))))
        }

        const luckyFundInfo = await greenBTC2S.luckyFundInfo()
        expect(luckyFundInfo.amountDeposit).to.eq(expandTo9Decimals(10000))
        expect(luckyFundInfo.amountDroped).to.eq(BigNumber.from(123).mul(expandTo6Decimals(100).mul(2)))

      });
      
/*      
      it("GreenBTC2S basics test: Check: getDomainActionIDs ", async function () {
        const domainInfoString = utils.defaultAbiCoder.encode(['uint256'], [domainInfoBigInt])

        const domainID = 1
        await greenBTC2S.registerDomain(domainID, domainInfoString)

        await kWhToken.connect(owner1).approve(greenBTC2S.address, constants.MaxUint256)

        let idString = ''
        {
          for (let index = 0; index < 5; index++) {
            const greenizetx = await  greenBTC2S.connect(owner1).makeGreenBox(1, 123)
            const receipt = await greenizetx.wait()
            idString = idString + (index+1).toString(16).padStart(8,'0')
            console.log("Gas fee:",  receipt.gasUsed, index)
          }
          
          for (let index = 0; index < 5; index++) {
            const [actionNumber, actionIDs] = await greenBTC2S.getDomainActionIDs(1, index, 5)
            expect(actionNumber.toNumber()).to.eq(5)
            expect(actionIDs).to.eq("0x" + idString.slice(8*index))
          }

          for (let index = 0; index < 5; index++) {
            const [actionNumber, actionIDs] = await greenBTC2S.getDomainActionIDs(1, 0, index)
            expect(actionNumber.toNumber()).to.eq(5)
            if(index ==0) expect(actionIDs).to.eq("0x" + idString)
            else expect(actionIDs).to.eq("0x" + idString.slice(0, 8*index))
          }
        }

        for (let index = 0; index <300; index++) {
          await  greenBTC2S.connect(owner1).makeGreenBox(1, 123)
          idString = idString + (index+6).toString(16).padStart(8,'0')
        }
        
        for (let index = 0; index < 100; index++) {
          const [actionNumber, actionIDs] = await greenBTC2S.getDomainActionIDs(1, index, 305)
          expect(actionNumber.toNumber()).to.eq(305)
          expect(actionIDs).to.eq("0x" + idString.slice(8*index))
        }

        for (let index = 0; index < 100; index++) {
          const [actionNumber, actionIDs] = await greenBTC2S.getDomainActionIDs(1, 0, index)
          expect(actionNumber.toNumber()).to.eq(305)
          if (index==0) expect(actionIDs).to.eq('0x' + idString)
          else expect(actionIDs).to.eq("0x" + idString.slice(0, 8*index))
        }

        for (let index = 0; index < 100; index++) {
          const [actionNumber, actionIDs] = await greenBTC2S.getUserActionIDs(owner1.address, index, 305)
          expect(actionNumber.toNumber()).to.eq(305)
          expect(actionIDs).to.eq("0x" + idString.slice(8*index))
        }

        for (let index = 0; index < 100; index++) {
          const [actionNumber, actionIDs] = await greenBTC2S.getUserActionIDs(owner1.address, 0, index)
          expect(actionNumber.toNumber()).to.eq(305)
          if (index==0) expect(actionIDs).to.eq('0x' + idString)
          else expect(actionIDs).to.eq("0x" + idString.slice(0, 8*index))
        }

        const [actionNumber, actionIDs] = await greenBTC2S.getDomainActionIDs(1, 0, 305)
        expect(actionIDs).to.eq('0x' +idString)
        expect(actionNumber.toNumber()).to.eq(305)
      });
*/

      it("GreenBTC2S makeGreenBox test", async function () {

        const domainID = 1
        const domainInfoString = utils.defaultAbiCoder.encode(['uint256'], [domainInfoBigInt])
        await greenBTC2S.connect(manager).registerDomain(domainID, domainInfoString)

        await kWhToken.connect(owner1).approve(greenBTC2S.address, constants.MaxUint256)

        //await expect(greenBTC2S.connect(owner1).makeGreenBox(0x10002, 123))
        //          .to.be.revertedWith("GBC2: Over Limit")

        //await expect(greenBTC2S.connect(owner1).makeGreenBox(1, 10001))
        //          .to.be.revertedWith("GBC2: Over Limit")

        await expect(greenBTC2S.connect(owner1).makeGreenBox(10, 123))
                  .to.be.revertedWith("GBC2: Empty Domain")

        const balancekWh = await kWhToken.balanceOf(owner1.address)        

        let greenizetx
        await expect(greenizetx = await greenBTC2S.connect(owner1).makeGreenBox(1,123))
                .to.emit(greenBTC2S, 'DomainGreenized')
                .withArgs(owner1.address, 1, anyValue, 1, BigNumber.from(0), BigNumber.from(123))
                
        const receipt = await greenizetx.wait()
        console.log('makeGreenBox gas usage:', receipt.gasUsed )

        expect(await kWhToken.balanceOf(owner1.address)).to.eq(balancekWh.sub(expandTo9Decimals(123).div(10)))  

        await greenBTC2S.connect(owner1).makeGreenBox(1,234)
        
        expect(await greenBTC2S.getUserActionIDs(owner1.address, 0, 0)).to.deep.eq([BigNumber.from(2), "0x0000000100000002"])
        expect(await greenBTC2S.getDomainActionIDs(1, 0, 0)).to.deep.eq([BigNumber.from(2), "0x0000000100000002"])

        const domainStatus = await greenBTC2S.domains(1)
        expect((BigNumber.from(domainStatus)).and(0xFFFFFFFF)).to.eq(BigNumber.from(123+234))

        expect(await kWhToken.balanceOf(owner1.address)).to.eq(balancekWh.sub(expandTo9Decimals(123+234).div(10)))


        // Seed mode:
        const amountWithMode = BigNumber.from(456).add(BigNumber.from(1).shl(255))
        await expect( greenBTC2S.connect(owner1).makeGreenBox(1, amountWithMode))
                .to.emit(greenBTC2S, 'DomainGreenized')
                .withArgs(owner1.address, 3, anyValue, 1, BigNumber.from(123+234), amountWithMode)
                .to.emit(kWhToken, 'Transfer')
                .withArgs(owner1.address, constants.AddressZero, expandTo9Decimals(456).div(10))

        /*
        {
          const  makeGreenBoxTx = await greenBTC2S.connect(owner1).makeGreenBox(1, 10000)
          const receipt = await makeGreenBoxTx.wait()

          await mine(5)

          actionInfo.actionID = BigNumber.from(3)
          actionInfo.boxStart = BigNumber.from(123+234)
          actionInfo.boxAmount = BigNumber.from(10000)
          actionInfo.actor = owner1.address
          actionInfo.blockHeigh = BigNumber.from(receipt.blockNumber)
          actionInfo.blockHash = receipt.blockHash
  
          const  {counters: countersCheck, wonList: wonListCheck} = UtilCalculateGifts(actionInfo)
          const {counters, wonList} = await greenBTC2S.checkIfShot(owner1.address, 3, Bytes32_Zero)

          console.log('counters, wonList:', counters, wonList )

          expect(counters).to.deep.eq(countersCheck)
          expect(wonList).to.deep.eq(wonListCheck)

          console.log('makeGreenBox gas usage of 10000 box:', receipt.gasUsed )
        }
        */
      });

      it("GreenBTC2S makeGreenBoxWithPixels test", async function () {

        const domainID = 1

        const domainInfoBigIntTmp = domainInfoBigInt.add(BigNumber.from(128).shl(56))
        const domainInfoString = utils.defaultAbiCoder.encode(['uint256'], [domainInfoBigIntTmp])
        await greenBTC2S.connect(manager).registerDomain(domainID, domainInfoString)

        await kWhToken.connect(owner1).approve(greenBTC2S.address, constants.MaxUint256)

        //await expect(greenBTC2S.connect(owner1).makeGreenBoxWithPixels(0x10002, 123))
        //          .to.be.revertedWith("GBC2: Over Limit")

        //await expect(greenBTC2S.connect(owner1).makeGreenBoxWithPixels(1, 10001))
        //          .to.be.revertedWith("GBC2: Over Limit")

        let pixels = new Array<number>(100).fill(0).map((_, index) => BigNumber.from(index + 100))
        await expect(greenBTC2S.connect(owner1).makeGreenBoxWithPixels(10, 123, pixels))
                  .to.be.revertedWith("GBC2: Empty Domain")

        const balancekWh = await kWhToken.balanceOf(owner1.address)        

        let greenizetx
        await expect(greenizetx = await greenBTC2S.connect(owner1).makeGreenBoxWithPixels(1, 123, pixels))
                .to.emit(greenBTC2S, 'DomainGreenizedWithPixels')
                .withArgs(owner1.address, 1, anyValue, 1, BigNumber.from(0), BigNumber.from(123), pixels)
                
        const receipt = await greenizetx.wait()
        console.log('makeGreenBoxWithPixels gas usage:', receipt.gasUsed )

        expect(await kWhToken.balanceOf(owner1.address)).to.eq(balancekWh.sub(expandTo9Decimals(123).div(10)))  

        await greenBTC2S.connect(owner1).makeGreenBoxWithPixels(1, 234, pixels)
         
        expect(await greenBTC2S.getUserActionIDs(owner1.address, 0, 0)).to.deep.eq([BigNumber.from(2), "0x0000000100000002"])
        expect(await greenBTC2S.getDomainActionIDs(1, 0, 0)).to.deep.eq([BigNumber.from(2), "0x0000000100000002"])

        const domainStatus = await greenBTC2S.domains(1)
        expect((BigNumber.from(domainStatus)).and(0xFFFFFFFF)).to.eq(BigNumber.from(123+234))

        expect(await kWhToken.balanceOf(owner1.address)).to.eq(balancekWh.sub(expandTo9Decimals(123+234).div(10)))

        // Seed mode:
        const amountWithMode = BigNumber.from(456).add(BigNumber.from(1).shl(255))
        await expect( greenBTC2S.connect(owner1).makeGreenBoxWithPixels(1, amountWithMode, pixels))
                .to.emit(greenBTC2S, 'DomainGreenizedWithPixels')
                .withArgs(owner1.address, 3, anyValue, 1, BigNumber.from(123+234), amountWithMode, pixels)
                .to.emit(kWhToken, 'Transfer')
                .withArgs(owner1.address, constants.AddressZero, expandTo9Decimals(456).div(10))

        /*
        {
          const  makeGreenBoxTx = await greenBTC2S.connect(owner1).makeGreenBoxWithPixels(1, 10000)
          const receipt = await makeGreenBoxTx.wait()

          await mine(5)

          actionInfo.actionID = BigNumber.from(3)
          actionInfo.boxStart = BigNumber.from(123+234)
          actionInfo.boxAmount = BigNumber.from(10000)
          actionInfo.actor = owner1.address
          actionInfo.blockHeigh = BigNumber.from(receipt.blockNumber)
          actionInfo.blockHash = receipt.blockHash
  
          const  {counters: countersCheck, wonList: wonListCheck} = UtilCalculateGifts(actionInfo)
          const {counters, wonList} = await greenBTC2S.checkIfShot(owner1.address, 3, Bytes32_Zero)

          console.log('counters, wonList:', counters, wonList )

          expect(counters).to.deep.eq(countersCheck)
          expect(wonList).to.deep.eq(wonListCheck)

          console.log('makeGreenBoxWithPixels gas usage of 10000 box:', receipt.gasUsed )
        }
        */
      });

      it("GreenBTC2S buyNode test", async function () {

        const GreenBTC2Factory = await ethers.getContractFactory("GreenBTC2S")
        const _IMPLEMENTATION_SLOT = "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc";
        const implementation  = await ethers.provider.getStorageAt(greenBTC2S.address, _IMPLEMENTATION_SLOT) 
        //console.log("whiteListMinerBatch in index:",  implementation, '0x'+ implementation.slice(26)  )

        // 0x84ea74d481ee0a5332c457a4d796187f6ba67feb
        const callData = GreenBTC2Factory.interface.encodeFunctionData("postUpdate")
        await greenBTC2S.upgradeToAndCall('0x'+ implementation.slice(26), callData)
        //console.log("postUpdate tx:",  updateTx  )

        await greenBTC2S.setLuckyManager(manager.address)

        const nodeId = BigNumber.from("0x12ABC")
        const percentage = BigNumber.from(20)
        const amountEnergy = expandTo6Decimals(1_000_000)

        const digest = getGreenBTC2SBuyNodeDigest(
          'Green BTC Club',
          greenBTC2S.address,
          owner1.address, nodeId, percentage, amountEnergy
        )

        await kWhToken.connect(owner1).approve(greenBTC2S.address, constants.MaxUint256)
        const balancekWhBefore = await kWhToken.balanceOf(owner1.address)        

        const {v,r,s} = ecsign(Buffer.from(digest.slice(2), 'hex'), Buffer.from(privateKeyManager.slice(2), 'hex'))   
        
        let buyNodeTx
        await expect(buyNodeTx = await greenBTC2S.connect(owner1).buyNode(nodeId, percentage, amountEnergy, {v,r,s}))
                .to.emit(greenBTC2S, 'BuyNode')
                .withArgs(nodeId, owner1.address, percentage, amountEnergy)
                
        const receipt = await buyNodeTx.wait()
        console.log('buyNode gas usage:', receipt.gasUsed )       
        
        {
          const nodeId = BigNumber.from("0x12ABC")
          await expect(greenBTC2S.connect(owner1).buyNode(nodeId, percentage, amountEnergy, {v,r,s}))
                  .to.be.revertedWith("GBC2: Node Sold")
        }

        {
          const nodeId = BigNumber.from("0x13ABC")
          const percentage = BigNumber.from(120)
          await expect(greenBTC2S.connect(owner1).buyNode(nodeId, percentage, amountEnergy, {v,r,s}))
                  .to.be.revertedWith("GBC2: Wrong percentage")
        }

        {
          const nodeId = BigNumber.from("0x13ABC")
          const percentage = BigNumber.from(20)
          await expect(greenBTC2S.connect(owner1).buyNode(nodeId, percentage, amountEnergy, {v,r,s}))
                  .to.be.revertedWith("Wrong Signature")
        }

        {
          const nodeId = BigNumber.from("0x13ABC")
          const percentage = BigNumber.from(20)
          const amountEnergy = expandTo6Decimals(1_000_000)

          const digest = getGreenBTC2SBuyNodeDigest(
            'Green BTC Club',
            greenBTC2S.address,
            owner1.address, nodeId, percentage, amountEnergy
          )

          await kWhToken.connect(owner1).approve(greenBTC2S.address, constants.MaxUint256)

          const {v,r,s} = ecsign(Buffer.from(digest.slice(2), 'hex'), Buffer.from(privateKeyManager.slice(2), 'hex'))   
          
          let buyNodeTx
          await expect(buyNodeTx = await greenBTC2S.connect(owner1).buyNode(nodeId, percentage, amountEnergy, {v,r,s}))
                  .to.emit(greenBTC2S, 'BuyNode')
                  .withArgs(nodeId, owner1.address, percentage, amountEnergy)
                  
          const receipt = await buyNodeTx.wait()
          console.log('buyNode gas usage:', receipt.gasUsed )    
        }    

        expect(await greenBTC2S.nodeSold()).to.eq(2)

        const nodeInfo12 = {
            owner: '0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65',
            nodeId: 0x12ABC,
            percentage: 20,
            amountEnergy: expandTo6Decimals(1_000_000)
          }

        const nodeInfo13 = {
            owner: '0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65',
            nodeId: 0x13ABC,
            percentage: 20,
            amountEnergy: expandTo6Decimals(1_000_000)
          }

        expect(await greenBTC2S.nodeInfo(0x12ABC)).to.deep.eq(Object.values(nodeInfo12));
        expect(await greenBTC2S.nodeInfo(0x13ABC)).to.deep.eq(Object.values(nodeInfo13));
        expect(await kWhToken.balanceOf(owner1.address)).to.deep.eq(balancekWhBefore.sub(expandTo6Decimals(1_000_000).mul(2)));
        expect(await greenBTC2S.getNodeIDs(0, 10)).to.deep.eq([BigNumber.from(2), "0x012ABC013ABC"])

      })

      it("GreenBTC2S makeGreenBox test With Node", async function () {

        const GreenBTC2Factory = await ethers.getContractFactory("GreenBTC2S")
        const _IMPLEMENTATION_SLOT = "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc";
        const implementation  = await ethers.provider.getStorageAt(greenBTC2S.address, _IMPLEMENTATION_SLOT) 
        //console.log("whiteListMinerBatch in index:",  implementation, '0x'+ implementation.slice(26)  )

        // 0x84ea74d481ee0a5332c457a4d796187f6ba67feb
        const callData = GreenBTC2Factory.interface.encodeFunctionData("postUpdate")
        await greenBTC2S.upgradeToAndCall('0x'+ implementation.slice(26), callData)
        //console.log("postUpdate tx:",  updateTx  )

        await greenBTC2S.setLuckyManager(manager.address)

        const nodeId = BigNumber.from("0x12ABC")
        const percentage = BigNumber.from(20)
        const amountEnergy = expandTo6Decimals(1_000_000)

        const digest = getGreenBTC2SBuyNodeDigest(
          'Green BTC Club',
          greenBTC2S.address,
          owner1.address, nodeId, percentage, amountEnergy
        )

        await kWhToken.connect(owner1).approve(greenBTC2S.address, constants.MaxUint256)

        const {v,r,s} = ecsign(Buffer.from(digest.slice(2), 'hex'), Buffer.from(privateKeyManager.slice(2), 'hex'))   
        
        await expect(greenBTC2S.connect(owner1).buyNode(nodeId, percentage, amountEnergy, {v,r,s}))
                .to.emit(greenBTC2S, 'BuyNode')
                .withArgs(nodeId, owner1.address, percentage, amountEnergy)

        const domainID = 1
        domainInfoBigInt = domainInfoBigInt.add(nodeId.shl(32))
        const domainInfoString = utils.defaultAbiCoder.encode(['uint256'], [domainInfoBigInt])

        // Register Domain with Node
        await greenBTC2S.connect(manager).registerDomain(domainID, domainInfoString)

        await kWhToken.connect(owner1).approve(greenBTC2S.address, constants.MaxUint256)

        await expect(greenBTC2S.connect(owner1).makeGreenBox(10, 123))
                  .to.be.revertedWith("GBC2: Empty Domain")

        const balancekWh = await kWhToken.balanceOf(owner1.address)        

        let greenizetx
        await expect(greenizetx = await greenBTC2S.connect(owner1).makeGreenBox(1,123))
                .to.emit(greenBTC2S, 'DomainGreenizedNode')
                .withArgs(owner1.address, 1, anyValue, 1, BigNumber.from(0), BigNumber.from(123), 0x12ABC, owner1.address, 20)
                
        const receipt = await greenizetx.wait()
        console.log('makeGreenBox gas usage:', receipt.gasUsed )

        expect(await kWhToken.balanceOf(owner1.address)).to.eq(balancekWh.sub(expandTo9Decimals(123).div(10).mul(80).div(100)))  

        await greenBTC2S.connect(owner1).makeGreenBox(1,234)
        
        expect(await greenBTC2S.getUserActionIDs(owner1.address, 0, 0)).to.deep.eq([BigNumber.from(2), "0x0000000100000002"])
        expect(await greenBTC2S.getDomainActionIDs(1, 0, 0)).to.deep.eq([BigNumber.from(2), "0x0000000100000002"])

        const domainStatus = await greenBTC2S.domains(1)
        expect((BigNumber.from(domainStatus)).and(0xFFFFFFFF)).to.eq(BigNumber.from(123+234))

        expect(await kWhToken.balanceOf(owner1.address)).to.eq(balancekWh.sub(expandTo9Decimals(123+234).div(10).mul(80).div(100)))

        // Seed mode:
        const amountWithMode = BigNumber.from(456).add(BigNumber.from(1).shl(255))
        await expect( greenBTC2S.connect(owner1).makeGreenBox(1, amountWithMode))
                .to.emit(greenBTC2S, 'DomainGreenizedNode')
                .withArgs(owner1.address, 3, anyValue, 1, BigNumber.from(123+234), amountWithMode, 0x12ABC, owner1.address, 20)
                .to.emit(kWhToken, 'Transfer')
                .withArgs(greenBTC2S.address, constants.AddressZero, expandTo9Decimals(456).div(10).mul(20).div(100))
                .to.emit(kWhToken, 'Transfer')
                .withArgs(owner1.address, constants.AddressZero, expandTo9Decimals(456).div(10).mul(80).div(100))

      });

      it("GreenBTC2S makeGreenBoxWithPixels test With Node", async function () {

        const GreenBTC2Factory = await ethers.getContractFactory("GreenBTC2S")
        const _IMPLEMENTATION_SLOT = "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc";
        const implementation  = await ethers.provider.getStorageAt(greenBTC2S.address, _IMPLEMENTATION_SLOT) 
        //console.log("whiteListMinerBatch in index:",  implementation, '0x'+ implementation.slice(26)  )

        // 0x84ea74d481ee0a5332c457a4d796187f6ba67feb
        const callData = GreenBTC2Factory.interface.encodeFunctionData("postUpdate")
        await greenBTC2S.upgradeToAndCall('0x'+ implementation.slice(26), callData)
        //console.log("postUpdate tx:",  updateTx  )

        await greenBTC2S.setLuckyManager(manager.address)

        const nodeId = BigNumber.from("0x12ABC")
        const percentage = BigNumber.from(20)
        const amountEnergy = expandTo6Decimals(1_000_000)

        const digest = getGreenBTC2SBuyNodeDigest(
          'Green BTC Club',
          greenBTC2S.address,
          owner1.address, nodeId, percentage, amountEnergy
        )

        await kWhToken.connect(owner1).approve(greenBTC2S.address, constants.MaxUint256)

        const {v,r,s} = ecsign(Buffer.from(digest.slice(2), 'hex'), Buffer.from(privateKeyManager.slice(2), 'hex'))   
        
        await expect(greenBTC2S.connect(owner1).buyNode(nodeId, percentage, amountEnergy, {v,r,s}))
                .to.emit(greenBTC2S, 'BuyNode')
                .withArgs(nodeId, owner1.address, percentage, amountEnergy)

        const domainID = 1

        // !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
        //domainInfoBigInt = domainInfoBigInt.add(nodeId.shl(32))           // Cannot add anymore
        const domainInfoBigIntTmp = domainInfoBigInt.add(BigNumber.from(128).shl(56))
        const domainInfoString = utils.defaultAbiCoder.encode(['uint256'], [domainInfoBigIntTmp])

        // Register Domain with Node
        await greenBTC2S.connect(manager).registerDomain(domainID, domainInfoString)

        await kWhToken.connect(owner1).approve(greenBTC2S.address, constants.MaxUint256)

        let pixels = new Array<number>(100).fill(0).map((_, index) => BigNumber.from(index + 100))

        await expect(greenBTC2S.connect(owner1).makeGreenBoxWithPixels(10, 123, pixels))
                  .to.be.revertedWith("GBC2: Empty Domain")

        const balancekWh = await kWhToken.balanceOf(owner1.address)        

        let greenizetx
        await expect(greenizetx = await greenBTC2S.connect(owner1).makeGreenBoxWithPixels(1,123, pixels))
                .to.emit(greenBTC2S, 'DomainGreenizedNodeWithPixels')
                .withArgs(owner1.address, 1, anyValue, 1, BigNumber.from(0), BigNumber.from(123), 0x12ABC, owner1.address, 20, pixels)
                
        const receipt = await greenizetx.wait()
        console.log('makeGreenBoxWithPixels gas usage:', receipt.gasUsed )

        expect(await kWhToken.balanceOf(owner1.address)).to.eq(balancekWh.sub(expandTo9Decimals(123).div(10).mul(80).div(100)))  

        await greenBTC2S.connect(owner1).makeGreenBoxWithPixels(1,234, pixels)
        
        expect(await greenBTC2S.getUserActionIDs(owner1.address, 0, 0)).to.deep.eq([BigNumber.from(2), "0x0000000100000002"])
        expect(await greenBTC2S.getDomainActionIDs(1, 0, 0)).to.deep.eq([BigNumber.from(2), "0x0000000100000002"])

        const domainStatus = await greenBTC2S.domains(1)
        expect((BigNumber.from(domainStatus)).and(0xFFFFFFFF)).to.eq(BigNumber.from(123+234))

        expect(await kWhToken.balanceOf(owner1.address)).to.eq(balancekWh.sub(expandTo9Decimals(123+234).div(10).mul(80).div(100)))

        // Seed mode:
        const amountWithMode = BigNumber.from(456).add(BigNumber.from(1).shl(255))
        await expect( greenBTC2S.connect(owner1).makeGreenBoxWithPixels(1, amountWithMode, pixels))
                .to.emit(greenBTC2S, 'DomainGreenizedNodeWithPixels')
                .withArgs(owner1.address, 3, anyValue, 1, BigNumber.from(123+234), amountWithMode, 0x12ABC, owner1.address, 20, pixels)
                .to.emit(kWhToken, 'Transfer')
                .withArgs(greenBTC2S.address, constants.AddressZero, expandTo9Decimals(456).div(10).mul(20).div(100))
                .to.emit(kWhToken, 'Transfer')
                .withArgs(owner1.address, constants.AddressZero, expandTo9Decimals(456).div(10).mul(80).div(100))

      });

    })
})