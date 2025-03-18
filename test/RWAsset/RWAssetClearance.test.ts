import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import { loadFixture, mine } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
const {ethers, upgrades} =  require("hardhat");
import hre from 'hardhat'
import { ecsign, fromRpcSig, ecrecover, zeroAddress } from 'ethereumjs-util'
import { getApprovalDigest, expandTo18Decimals, randomAddresses, expandTo9Decimals } from '../utils/utilities'
import { PlugActionInfo, OffsetActionBatch, getWithdrawDepositDigest, rpow } from '../utils/utilities'

import { constants, BigNumber, utils} from 'ethers'
import { DateTime } from 'luxon'

import {
    ArkreenToken,
    USDS,
    RWAsset,
    UniTool
} from "../../typechain";

export interface AssetType {
  typeAsset:              number
  tenure:                 number
  //remoteQuota:          number
  investQuota:            number
  valuePerInvest:         number
  amountRepayMonthly:     number
  amountYieldPerInvest:   number
  amountDeposit:          number
  //numSoldAssets:        number
  investTokenType:        number
  maxInvestOverdue:       number
  minInvestExit:          number
  interestId:             number
  paramsClearance:        number
  timesSlashTop:          number
}

export interface GlobalStatus {
  numAssetType:         number
  numAssets:            number
  numCancelled:         number
  numDelivered:         number
  numOnboarded:         number
  numTokenAdded:         number
  numInvest:            number
}

describe("GreenPower Test Campaign", ()=>{

    let deployer: SignerWithAddress;
    let manager: SignerWithAddress;
    let authority: SignerWithAddress;
    let fund_receiver: SignerWithAddress;

    let owner1: SignerWithAddress;
    let maker1: SignerWithAddress;
    let user1:  SignerWithAddress
    let user2:  SignerWithAddress
    let user3:  SignerWithAddress

    let privateKeyManager:      string
    let privateKeyAuthority:     string
    let privateKeyOwner:        string
    let privateKeyMaker:        string

    let AKREToken:              ArkreenToken
    let usdc:                   USDS
    let usdt:                   USDS
    let usdp:                   USDS
    let dai:                    USDS

    let rwAsset:                RWAsset
    let uniTool:                UniTool
    let assetType:              AssetType 

    let amountRepayMonthly:     BigNumber
    let lastBlock:              any
    let timeOnboarding:         number 
    let timestampOnboarding:    number 
    let assetRepayStatusTarget: any
    let assetClearance:         any

    const indexInvesting1 = (1<<16) +1
    const indexInvesting2 = (1<<16) + 2
    const indexInvesting3 = (1<<16) + 3

    let investing1A : any
    let investing2A : any
    let investing3A : any

    let tokenType = 1
 
    let amountTakableFirst : number
    let amountTakableSecond:  number
    let amountTakable3: number

    const amountYieldPerInvest = 80_000
    let totalInvestQuota: number

    let assetDetails: any

    let timestampNextDue1: number
    let timestampNextDue2: number
    let timestampNextDue3: number
    let amountDebtWithInterest: BigNumber

    const ratePerSecond = BigNumber.from("1000000006341958396752917301")
    const rateBase = BigNumber.from("10").pow(27)

    const Bytes32_Zero = "0x0000000000000000000000000000000000000000000000000000000000000000"

    async function deployFixture() {
        const AKRETokenFactory = await ethers.getContractFactory("ArkreenToken");
        const AKREToken = await upgrades.deployProxy(AKRETokenFactory, [10_000_000_000, deployer.address,'','']) as ArkreenToken
        await AKREToken.deployed();
  
        const USDSFactory = await ethers.getContractFactory("USDS");
        const usdc = await upgrades.deployProxy(USDSFactory, [100_000_000, deployer.address,'USDC','usdc']) as ArkreenToken
        await usdc.deployed();

        const usdt = await upgrades.deployProxy(USDSFactory, [100_000_000, deployer.address,'USDT','usdt']) as ArkreenToken
        await usdt.deployed();

        const usdp = await upgrades.deployProxy(USDSFactory, [100_000_000, deployer.address,'USDP','usdp']) as ArkreenToken
        await usdp.deployed();

        const dai = await upgrades.deployProxy(USDSFactory, [100_000_000, deployer.address,'DAI','dai']) as ArkreenToken
        await dai.deployed();

        const RWAssetFactory = await ethers.getContractFactory("RWAsset");
        const rwAsset = await upgrades.deployProxy(RWAssetFactory, [AKREToken.address, authority.address, manager.address]);
        await rwAsset.deployed();

        const RWAssetProFactory = await ethers.getContractFactory("RWAssetPro")
        const rwaPro = await RWAssetProFactory.deploy()
        await rwAsset.setRWAPro(rwaPro.address);

        const uniV3OracleSimu = await ethers.getContractFactory("UniV3OracleSimu")
        const uniV3Oracle = await uniV3OracleSimu.deploy()
        await rwAsset.setOracleSwapPair(uniV3Oracle.address);

        const uniToolFactory = await ethers.getContractFactory("UniTool")
        const uniTool = await uniToolFactory.deploy()
     
        await AKREToken.transfer(owner1.address, expandTo18Decimals(300_000_000))
        await AKREToken.transfer(user1.address, expandTo18Decimals(300_000_000))
         
        return { AKREToken, usdc, usdt, usdp, dai, rwAsset, uniTool }

    }

    describe('RWAsset test', () => {
      it("RWAsset Test: slash in consecutive way to cause entering clearance status", async function () {

        [deployer, manager, authority, fund_receiver, owner1, user1, user2, user3, maker1] = await ethers.getSigners();

        privateKeyManager = process.env.MANAGER_TEST_PRIVATE_KEY as string
        privateKeyAuthority = process.env.REGISTER_TEST_PRIVATE_KEY as string
        privateKeyOwner = process.env.OWNER_TEST_PRIVATE_KEY as string
        privateKeyMaker = process.env.MAKER_TEST_PRIVATE_KEY as string
    
        const fixture = await loadFixture(deployFixture)
        AKREToken = fixture.AKREToken
        usdc = fixture.usdc
        usdt = fixture.usdt
        usdp = fixture.usdp
        dai = fixture.dai
        rwAsset = fixture.rwAsset
        uniTool = fixture.uniTool

        await AKREToken.connect(owner1).approve(rwAsset.address, constants.MaxUint256)
        await AKREToken.connect(user1).approve(rwAsset.address, constants.MaxUint256)
        await AKREToken.connect(user2).approve(rwAsset.address, constants.MaxUint256)
        await AKREToken.connect(user3).approve(rwAsset.address, constants.MaxUint256)

        assetType = {
          typeAsset:            1,
          tenure:               12,
          //remoteQuota:        25,
          investQuota:          800,
          valuePerInvest:       1_000_000,
          amountRepayMonthly:   150_000_000,
          amountYieldPerInvest: 80_000,
          amountDeposit:        1_500_000,
          //numSoldAssets:        0,
          investTokenType:      1,
          maxInvestOverdue:     15,
          minInvestExit:        7,
          interestId:           1,
          paramsClearance:      20 + (20<<8), 
          timesSlashTop:          20 + (10<<8)
        }

        await rwAsset.connect(manager).addNewInvestToken(tokenType, [usdc.address, usdt.address, usdp.address, dai.address])
        await rwAsset.connect(manager).addNewAssetType(assetType)

        await rwAsset.connect(manager).setInterestRate(1, BigNumber.from("1000000006341958396752917301"))
        
        // depositForAsset (uint16 typeAsset, uint16 tokenId)
        await rwAsset.connect(user1).depositForAsset(1, 1)

        const deliveryProof = "0x7120dcbcda0d9da55bc291bf4aaee8f691a0dcfbd4ad634017bb6f5686d92d74"     // Just for test
        await rwAsset.connect(manager).deliverAsset(1, deliveryProof)

        await usdc.transfer(user1.address, 10000 * 1000_000)
        await usdc.transfer(user2.address, 10000 * 1000_000)
        await usdc.transfer(user3.address, 10000 * 1000_000)

        await usdc.approve(rwAsset.address, constants.MaxUint256)
        await usdc.connect(user1).approve(rwAsset.address, constants.MaxUint256)
        await usdc.connect(user2).approve(rwAsset.address, constants.MaxUint256)
        await usdc.connect(user3).approve(rwAsset.address, constants.MaxUint256)

        const investingT = {
          invester: deployer.address,
          timestamp: 0,
          status: 1,
          numQuota: 150,
          monthTaken: 0
        }

        // Test case: Normal investing
        await rwAsset.investAsset(1, 150)
        lastBlock = await ethers.provider.getBlock('latest')
        investing1A = {...investingT}
        investing1A.timestamp = lastBlock.timestamp 

        await rwAsset.connect(user2).investAsset(1, 350)
        lastBlock = await ethers.provider.getBlock('latest')
        investing2A = {...investingT}
        investing2A.invester = user2.address 
        investing2A.timestamp = lastBlock.timestamp 
        investing2A.numQuota = 350

        await rwAsset.connect(user3).investAsset(1, 100)
        lastBlock = await ethers.provider.getBlock('latest')
        investing3A = {...investingT}
        investing3A.invester = user3.address 
        investing3A.timestamp = lastBlock.timestamp 
        investing3A.numQuota = 100

        totalInvestQuota = 600

        expect(await rwAsset.investList(indexInvesting1)).to.deep.eq(Object.values(investing1A));
        expect(await rwAsset.investList(indexInvesting2)).to.deep.eq(Object.values(investing2A));
        expect(await rwAsset.investList(indexInvesting3)).to.deep.eq(Object.values(investing3A));

        // Test Case: Must be manager
        await expect(rwAsset.takeRepayment(1)).to.be.revertedWith("RWA: Not manager")

        // Test Case: Must be manager
        await expect(rwAsset.connect(manager).takeRepayment(1)).to.be.revertedWith("RWA: Status not allowed")

        amountRepayMonthly = BigNumber.from("150000000")
        await rwAsset.connect(manager).onboardAsset(1)

        lastBlock = await ethers.provider.getBlock('latest')
        timestampOnboarding = lastBlock.timestamp
        timeOnboarding = Math.floor(lastBlock.timestamp /(3600*24)) * 3600 * 24

        const amountToken = (600 - 20) * (assetType.valuePerInvest)
        await expect(rwAsset.connect(manager).takeInvest(1))
                .to.emit(usdc, 'Transfer')
                .withArgs(rwAsset.address, manager.address, amountToken)
                .to.emit(rwAsset, 'TakeInvest')
                .withArgs(manager.address, 1, usdc.address, amountToken)

        // "RWAsset Test: takeRepayment (1-2 month)",
        // Check timestampNextDue to be same day in next month 
        timestampNextDue1 = DateTime.fromMillis(timeOnboarding * 1000).plus({"months": 1}).toSeconds() + 3600 * 24 -1

        // 1st month:   10 days later
        await ethers.provider.send("evm_increaseTime", [3600 * 24 * 10 ])

        // First month repay                
        await rwAsset.connect(user1).repayMonthly(1, amountRepayMonthly)

        // Test Case: Must be manager
        await expect(rwAsset.takeRepayment(1)).to.be.revertedWith("RWA: Not manager")

        // Test Case: Can not take in 1st month
        await expect(rwAsset.connect(manager).takeRepayment(1)).to.be.revertedWith("RWA: Not available")

        // Move to 2nd month
        lastBlock = await ethers.provider.getBlock('latest')
        await ethers.provider.send("evm_increaseTime", [timestampNextDue1 - lastBlock.timestamp + 100 ])

        // 10 days later
        await ethers.provider.send("evm_increaseTime", [3600 * 24 * 10 ])

        await expect(rwAsset.takeYield(indexInvesting1))
                .to.emit(usdc, 'Transfer')
                .withArgs(rwAsset.address, deployer.address, amountYieldPerInvest * 150)
                .to.emit(rwAsset, 'InvestTakeYield')
                .withArgs(deployer.address, indexInvesting1, 1, usdc.address, amountYieldPerInvest * 150, 0)

        assetDetails =  {
          assetOwner:       user1.address,
          status:           4,  //Onboarded,
          tokenId:          1,
          typeAsset:        1,
          numInvestings:    3,
          numQuotaTotal:    totalInvestQuota,
          amountDeposit:    assetType.amountDeposit,
          deliverProofId:   1,
          onboardTimestamp: timestampOnboarding,
          sumAmountRepaid:  amountRepayMonthly,
          amountForInvestWithdraw: amountYieldPerInvest * totalInvestQuota,
          amountInvestWithdarwed: amountYieldPerInvest * 150
        }

        expect(await rwAsset.assetList(1)).to.deep.eq(Object.values(assetDetails));

        investing1A.monthTaken = 1
        expect(await rwAsset.investList(indexInvesting1)).to.deep.eq(Object.values(investing1A));

        // Take yield again
        await expect(rwAsset.takeYield(indexInvesting1)).to.be.revertedWith("RWA: Not mature")

        // Test Case: take payment in 2nd month
        amountTakableFirst =  amountRepayMonthly.toNumber() - amountYieldPerInvest * totalInvestQuota * 2  // one extra month is kept

        let takeRepaymentTx
        await expect(takeRepaymentTx = await rwAsset.connect(manager).takeRepayment(1))
                .to.emit(usdc, 'Transfer')
                .withArgs(rwAsset.address, manager.address, amountTakableFirst)
                .to.emit(rwAsset, 'TakeRepayment')
                .withArgs(1, usdc.address, amountTakableFirst)

        const receipt = await takeRepaymentTx.wait()
        console.log("takeRepayment Gas fee Usage:",  receipt.gasUsed)
      
        // "RWAsset Test: takeRepayment (3rd month)"

        ////////////// 2nd Month //////////////////                                  
        // Second month, partially repayment 
        timestampNextDue2 = DateTime.fromMillis(timeOnboarding * 1000).plus({"months": 2}).toSeconds() + 3600 * 24 -1         // 2nd month

        // 2nd month:  Repay half
        await rwAsset.connect(user1).repayMonthly(1, amountRepayMonthly.div(2))

        assetRepayStatusTarget =  {
                                    monthDueRepay:      2,
                                    timestampNextDue:   timestampNextDue2,
                                    amountRepayDue:     150_000_000,
                                    amountDebt:         0,
                                    timestampDebt:      0,
                                    amountPrePay:       0,
                                    amountRepayTaken:   amountTakableFirst,
                                    numInvestTaken:     600 -20 
                                  }

        assetRepayStatusTarget.amountRepayDue -= amountRepayMonthly.div(2).toNumber()
        expect(await rwAsset.assetRepayStatus(1)).to.deep.eq(Object.values(assetRepayStatusTarget));

        //*********************************************//
        // Test case: Cannot take Repayment again
        await expect(rwAsset.connect(manager).takeRepayment(1)).to.be.revertedWith("RWA: No mature repayment")

        // Repay again
        await rwAsset.connect(user1).repayMonthly(1, amountRepayMonthly.div(4))       // amountRepayMonthly.div(4) unpaid

        assetRepayStatusTarget.amountRepayDue -= amountRepayMonthly.div(4).toNumber()
        expect(await rwAsset.assetRepayStatus(1)).to.deep.eq(Object.values(assetRepayStatusTarget));

        //*********************************************//
        // Test case: Cannot take Repayment again
        await expect(rwAsset.connect(manager).takeRepayment(1)).to.be.revertedWith("RWA: No mature repayment")

        ///////////////////////////////////////////////////////////
        // Move to 3rd month
        ///////////////////////////////////////////////////////////

        lastBlock = await ethers.provider.getBlock('latest')
        await ethers.provider.send("evm_increaseTime", [timestampNextDue2 - lastBlock.timestamp + 100 ])

        // 10 days later
        await ethers.provider.send("evm_increaseTime", [3600 * 24 * 10 ])

        // Deployer take yield: one month
        await expect(rwAsset.takeYield(indexInvesting1))
                .to.emit(usdc, 'Transfer')
                .withArgs(rwAsset.address, deployer.address, amountYieldPerInvest * 150)
                .to.emit(rwAsset, 'InvestTakeYield')
                .withArgs(deployer.address, indexInvesting1, 1, usdc.address, amountYieldPerInvest * 150, 0)

        timestampNextDue3 = DateTime.fromMillis(timeOnboarding * 1000).plus({"months": 3}).toSeconds() + 3600 * 24 -1         // 3rd month
        assetRepayStatusTarget =  {
                                    monthDueRepay:      3,
                                    timestampNextDue:   timestampNextDue3,
                                    amountRepayDue:     150_000_000,
                                    amountDebt:         amountRepayMonthly.mul(12-6-3).div(12).toNumber(),
                                    timestampDebt:      timestampNextDue2,
                                    amountPrePay:       0,
                                    amountRepayTaken:   amountTakableFirst,
                                    numInvestTaken:     600 - 20
                                  }

        expect(await rwAsset.assetRepayStatus(1)).to.deep.eq(Object.values(assetRepayStatusTarget));

        await expect(rwAsset.connect(user2).takeYield(indexInvesting2))
                .to.emit(usdc, 'Transfer')
                .withArgs(rwAsset.address, user2.address, amountYieldPerInvest * 350 * 2)
                .to.emit(rwAsset, 'InvestTakeYield')
                .withArgs(user2.address, indexInvesting2, 2, usdc.address, amountYieldPerInvest * 350 * 2, 0)

        investing1A.monthTaken = 2
        expect(await rwAsset.investList(indexInvesting1)).to.deep.eq(Object.values(investing1A));

        investing2A.monthTaken = 2
        expect(await rwAsset.investList(indexInvesting2)).to.deep.eq(Object.values(investing2A));

        //*********************************************//
        const amountRepayAll = amountRepayMonthly.mul(12 + 6 + 3).div(12)
        amountTakableSecond =   amountRepayAll.toNumber() - 
                                      amountTakableFirst -
                                      amountYieldPerInvest * totalInvestQuota * 3  // one extra month is kept

        await expect(rwAsset.connect(manager).takeRepayment(1))
                .to.emit(usdc, 'Transfer')
                .withArgs(rwAsset.address, manager.address, amountTakableSecond)
                .to.emit(rwAsset, 'TakeRepayment')
                .withArgs(1, usdc.address, amountTakableSecond)

        assetRepayStatusTarget.amountRepayTaken = amountTakableFirst + amountTakableSecond
        expect(await rwAsset.assetRepayStatus(1)).to.deep.eq(Object.values(assetRepayStatusTarget));
      
        //  "RWAsset Test: slash"
        await rwAsset.setSlashReceiver(fund_receiver.address)

        assetClearance = {
          productToTriggerClearance: BigNumber.from("259200000000000"),
          amountDebtOverdueProduct: BigNumber.from("0"),
          amountAKREAvailable: expandTo18Decimals(1_500_000),
          amountAKREForInvester: BigNumber.from("0"),
          timesSlashTop: 20 + (10<<8),
          timesSlashed: 0,
          timesLineSlashed: 0,
          timestampLastSlash: 0,
          amountSlashed: BigNumber.from("0"),
          priceTickOnClearance: BigNumber.from("0"),
          timestampClearance: 0
        }

        expect(await rwAsset.assetClearance(1)).to.deep.eq(Object.values(assetClearance))

        const amountSlash = expandTo18Decimals(3750)
        await expect(rwAsset.executeSlash(1, amountSlash))
                .to.be.revertedWith("RWA: Not manager")

        await expect(rwAsset.connect(manager).executeSlash(1, expandTo18Decimals(200_0000)))    // Max 150_0000
                .to.be.revertedWith("RWA: Amount not enough")

        await expect(rwAsset.connect(manager).executeSlash(1, amountSlash)) 
                .to.emit(AKREToken, 'Transfer')
                .withArgs(rwAsset.address, fund_receiver.address, amountSlash)
                .to.emit(rwAsset, 'ExecuteSlash')
                .withArgs(1, amountSlash)

        lastBlock = await ethers.provider.getBlock('latest')

        assetClearance.amountAKREAvailable = assetClearance.amountAKREAvailable.sub(amountSlash)
        assetClearance.amountSlashed = amountSlash
        assetClearance.timesSlashed = 1
        assetClearance.timesLineSlashed = 1
        assetClearance.timestampLastSlash = lastBlock.timestamp

        //        const assetClearanceStatus = await rwAsset.assetClearance(1) 
        //        console.log("QQQQQQQQQQQQQQ", assetClearanceStatus)
        expect(await rwAsset.assetClearance(1)).to.deep.eq(Object.values(assetClearance))

        await expect(rwAsset.connect(manager).executeSlash(1, amountSlash)) 
                .to.be.revertedWith("RWA: Cannot slash twice")

        for (let index = 0; index <9; index ++) {
            await ethers.provider.send("evm_increaseTime", [3600 * 24])       // Skip 10 days
            await rwAsset.connect(manager).executeSlash(1, amountSlash)
        }

        lastBlock = await ethers.provider.getBlock('latest')

        assetClearance.amountAKREAvailable = assetClearance.amountAKREAvailable.sub(amountSlash.mul(9))
        assetClearance.amountSlashed = assetClearance.amountSlashed.add(amountSlash.mul(9))
        assetClearance.timesSlashed = 10
        assetClearance.timesLineSlashed = 10
        assetClearance.timestampLastSlash = lastBlock.timestamp

        expect(await rwAsset.assetClearance(1)).to.deep.eq(Object.values(assetClearance))

        const assetStatus = await rwAsset.assetList(1)
        expect(assetStatus.status).to.deep.eq(6);      // Clearing status

      })

      it("RWAsset Test: slash times reach top to cause entering clearance status", async function () {

        [deployer, manager, authority, fund_receiver, owner1, user1, user2, user3, maker1] = await ethers.getSigners();

        privateKeyManager = process.env.MANAGER_TEST_PRIVATE_KEY as string
        privateKeyAuthority = process.env.REGISTER_TEST_PRIVATE_KEY as string
        privateKeyOwner = process.env.OWNER_TEST_PRIVATE_KEY as string
        privateKeyMaker = process.env.MAKER_TEST_PRIVATE_KEY as string
    
        const fixture = await loadFixture(deployFixture)
        AKREToken = fixture.AKREToken
        usdc = fixture.usdc
        usdt = fixture.usdt
        usdp = fixture.usdp
        dai = fixture.dai
        rwAsset = fixture.rwAsset
        uniTool = fixture.uniTool


        await AKREToken.connect(owner1).approve(rwAsset.address, constants.MaxUint256)
        await AKREToken.connect(user1).approve(rwAsset.address, constants.MaxUint256)
        await AKREToken.connect(user2).approve(rwAsset.address, constants.MaxUint256)
        await AKREToken.connect(user3).approve(rwAsset.address, constants.MaxUint256)

        assetType = {
          typeAsset:            1,
          tenure:               12,
          //remoteQuota:        25,
          investQuota:          800,
          valuePerInvest:       1_000_000,
          amountRepayMonthly:   150_000_000,
          amountYieldPerInvest: 80_000,
          amountDeposit:        1_500_000,
          //numSoldAssets:        0,
          investTokenType:      1,
          maxInvestOverdue:     15,
          minInvestExit:        7,
          interestId:           1,
          paramsClearance:      20 + (20<<8), 
          timesSlashTop:          20 + (10<<8)
        }

        await rwAsset.connect(manager).addNewInvestToken(tokenType, [usdc.address, usdt.address, usdp.address, dai.address])
        await rwAsset.connect(manager).addNewAssetType(assetType)

        await rwAsset.connect(manager).setInterestRate(1, BigNumber.from("1000000006341958396752917301"))
        
        // depositForAsset (uint16 typeAsset, uint16 tokenId)
        await rwAsset.connect(user1).depositForAsset(1, 1)

        const deliveryProof = "0x7120dcbcda0d9da55bc291bf4aaee8f691a0dcfbd4ad634017bb6f5686d92d74"     // Just for test
        await rwAsset.connect(manager).deliverAsset(1, deliveryProof)

        await usdc.transfer(user1.address, 10000 * 1000_000)
        await usdc.transfer(user2.address, 10000 * 1000_000)
        await usdc.transfer(user3.address, 10000 * 1000_000)

        await usdc.approve(rwAsset.address, constants.MaxUint256)
        await usdc.connect(user1).approve(rwAsset.address, constants.MaxUint256)
        await usdc.connect(user2).approve(rwAsset.address, constants.MaxUint256)
        await usdc.connect(user3).approve(rwAsset.address, constants.MaxUint256)

        // Test case: Normal investing
        await rwAsset.investAsset(1, 150)
        await rwAsset.connect(user2).investAsset(1, 350)
        await rwAsset.connect(user3).investAsset(1, 100)

        totalInvestQuota = 600
        amountRepayMonthly = BigNumber.from("150000000")
        await rwAsset.connect(manager).onboardAsset(1)

        lastBlock = await ethers.provider.getBlock('latest')
        timestampOnboarding = lastBlock.timestamp
        timeOnboarding = Math.floor(lastBlock.timestamp /(3600*24)) * 3600 * 24

        const amountToken = (600 - 20) * (assetType.valuePerInvest)
        await expect(rwAsset.connect(manager).takeInvest(1))
                .to.emit(usdc, 'Transfer')
                .withArgs(rwAsset.address, manager.address, amountToken)
                .to.emit(rwAsset, 'TakeInvest')
                .withArgs(manager.address, 1, usdc.address, amountToken)


        // "RWAsset Test: takeRepayment (1-2 month)",
        // Check timestampNextDue to be same day in next month 
        timestampNextDue1 = DateTime.fromMillis(timeOnboarding * 1000).plus({"months": 1}).toSeconds() + 3600 * 24 -1

        // 1st month:   10 days later
        await ethers.provider.send("evm_increaseTime", [3600 * 24 * 10 ])

        // First month repay                
        await rwAsset.connect(user1).repayMonthly(1, amountRepayMonthly)
        assetDetails.onboardTimestamp = lastBlock.timestamp 
        assetDetails.sumAmountRepaid =  amountRepayMonthly

        // Move to 2nd month
        lastBlock = await ethers.provider.getBlock('latest')
        await ethers.provider.send("evm_increaseTime", [timestampNextDue1 - lastBlock.timestamp + 100 ])
        await ethers.provider.send("evm_increaseTime", [3600 * 24 * 10 ])

        await rwAsset.takeYield(indexInvesting1)                  // 2nd month: 1st time take 
        await rwAsset.connect(manager).takeRepayment(1)
     
        // "RWAsset Test: takeRepayment (3rd month)"

        ////////////// 2nd Month //////////////////                                  
        // Second month, partially repayment 
        timestampNextDue2 = DateTime.fromMillis(timeOnboarding * 1000).plus({"months": 2}).toSeconds() + 3600 * 24 -1         // 2nd month

        // 2nd month:  Repay half
        await rwAsset.connect(user1).repayMonthly(1, amountRepayMonthly.div(2))
        await rwAsset.connect(user1).repayMonthly(1, amountRepayMonthly.div(4))       // amountRepayMonthly.div(4) unpaid
        assetDetails.sumAmountRepaid =  assetDetails.sumAmountRepaid.add(amountRepayMonthly.div(2)).add(amountRepayMonthly.div(4))

        ///////////////////////////////////////////////////////////
        // Move to 3rd month
        ///////////////////////////////////////////////////////////

        lastBlock = await ethers.provider.getBlock('latest')
        await ethers.provider.send("evm_increaseTime", [timestampNextDue2 - lastBlock.timestamp + 100 ])
        await ethers.provider.send("evm_increaseTime", [3600 * 24 * 10 ])

        // Deployer take yield: one month
        await rwAsset.takeYield(indexInvesting1)                        // 3rd month: 2nd time take
        await rwAsset.connect(user2).takeYield(indexInvesting2)         // 3rd month: 1nd time take, take 2 month
        await rwAsset.connect(manager).takeRepayment(1)

        ///////////////////////////////////////////////////////////////////
        //  "RWAsset Test: slash"
        await rwAsset.setSlashReceiver(fund_receiver.address)

        assetClearance = {
          productToTriggerClearance: BigNumber.from("259200000000000"),
          amountDebtOverdueProduct: BigNumber.from("0"),
          amountAKREAvailable: expandTo18Decimals(1_500_000),
          amountAKREForInvester: BigNumber.from("0"),
          timesSlashTop: 20 + (10<<8),
          timesSlashed: 0,
          timesLineSlashed: 0,
          timestampLastSlash: 0,
          amountSlashed: BigNumber.from("0"),
          priceTickOnClearance: BigNumber.from("0"),
          timestampClearance: 0
        }

        expect(await rwAsset.assetClearance(1)).to.deep.eq(Object.values(assetClearance))

        const amountSlash = expandTo18Decimals(3750)
        await expect(rwAsset.executeSlash(1, amountSlash))
                .to.be.revertedWith("RWA: Not manager")

        await expect(rwAsset.connect(manager).executeSlash(1, expandTo18Decimals(200_0000)))    // Max 150_0000
                .to.be.revertedWith("RWA: Amount not enough")

        let executeSlashTx 
        await expect(executeSlashTx = await rwAsset.connect(manager).executeSlash(1, amountSlash)) 
                .to.emit(AKREToken, 'Transfer')
                .withArgs(rwAsset.address, fund_receiver.address, amountSlash)
                .to.emit(rwAsset, 'ExecuteSlash')
                .withArgs(1, amountSlash)

        const receipt = await executeSlashTx.wait()
        console.log("executeSlash Gas fee Usage:",  receipt.gasUsed)

        lastBlock = await ethers.provider.getBlock('latest')

        assetClearance.amountAKREAvailable = assetClearance.amountAKREAvailable.sub(amountSlash)
        assetClearance.amountSlashed = amountSlash
        assetClearance.timesSlashed = 1
        assetClearance.timesLineSlashed = 1
        assetClearance.timestampLastSlash = lastBlock.timestamp

        expect(await rwAsset.assetClearance(1)).to.deep.eq(Object.values(assetClearance))

        await expect(rwAsset.connect(manager).executeSlash(1, amountSlash)) 
                .to.be.revertedWith("RWA: Cannot slash twice")

        // 2-19th Slash
        for (let index = 0; index <18; index ++) {
            await ethers.provider.send("evm_increaseTime", [3600 * 24])       // Skip 10 days

            if (index % 6 == 0) {
              await ethers.provider.send("evm_increaseTime", [3600 * 24 * 2])     // Skip 2 days per 6 days to avoid consecutive slash
            }
            await rwAsset.connect(manager).executeSlash(1, amountSlash)
        }

        lastBlock = await ethers.provider.getBlock('latest')

        assetClearance.amountAKREAvailable = assetClearance.amountAKREAvailable.sub(amountSlash.mul(18))
        assetClearance.amountSlashed = assetClearance.amountSlashed.add(amountSlash.mul(18))
        assetClearance.timesSlashed = 19
        assetClearance.timesLineSlashed = 6
        assetClearance.timestampLastSlash = lastBlock.timestamp
        if ( lastBlock.timestamp > timestampNextDue3) {
          assetClearance.amountDebtOverdueProduct = amountRepayMonthly.div(4).mul((timestampNextDue3 - timestampNextDue2))
        }

        expect(await rwAsset.assetClearance(1)).to.deep.eq(Object.values(assetClearance))

        // Test case: Not in clearing state
        await expect(rwAsset.connect(user2).executeInvestClearance(1))
                .to.be.revertedWith("RWA: Not feasible")

        // the 20th Slash 
        await ethers.provider.send("evm_increaseTime", [3600 * 24 * 10])       // Skip 10 days
        await rwAsset.connect(manager).executeSlash(1, amountSlash)
        lastBlock = await ethers.provider.getBlock('latest')

        timestampNextDue3 = DateTime.fromMillis(timeOnboarding * 1000).plus({"months": 3}).toSeconds() + 3600 * 24 -1         // 2nd month

        let interestRate = rpow(ratePerSecond, BigNumber.from(lastBlock.timestamp - timestampNextDue3))
        amountDebtWithInterest = interestRate.mul(amountRepayMonthly.div(4)).div(rateBase)

        assetClearance.amountAKREAvailable = assetClearance.amountAKREAvailable.sub(amountSlash)
        assetClearance.amountSlashed = assetClearance.amountSlashed.add(amountSlash)
        assetClearance.timesSlashed = 20
        assetClearance.timesLineSlashed = 1
        assetClearance.timestampLastSlash = lastBlock.timestamp
        assetClearance.amountDebtOverdueProduct = amountRepayMonthly.div(4).mul((timestampNextDue3 - timestampNextDue2))

        expect(await rwAsset.assetClearance(1)).to.deep.eq(Object.values(assetClearance))

        // Check clearing status
        const assetStatus = await rwAsset.assetList(1)
        expect(assetStatus.status).to.deep.eq(6);      // Clearing status
      })

      it("RWAsset Test: executeInvestClearance", async function () {

        const assetRepayStatus = await rwAsset.assetRepayStatus(1)

        const tickTest = 343509
        const sqrtPriceX96 = await uniTool.getSqrtRatioAtTick(tickTest)
        const amountAKREClearedPerInvest = sqrtPriceX96
                                            .mul(sqrtPriceX96)
                                            .mul(amountYieldPerInvest)
                                            .div(BigNumber.from(2).pow(192)) 
                                            
        const amountAKREClearedAll = amountAKREClearedPerInvest.mul(600).mul(13 - assetRepayStatus.monthDueRepay)
        const amountAKREClearFee = sqrtPriceX96.mul(sqrtPriceX96).mul(20_000_000).div(BigNumber.from(2).pow(192)) 

        await rwAsset.takeYield(indexInvesting1)  

        await ethers.provider.send("evm_increaseTime", [3600 * 24 * 2])       // Skip 10 days

        let executeInvestClearanceTx 
        await expect(executeInvestClearanceTx = await rwAsset.connect(user2).executeInvestClearance(1))
                .to.emit(AKREToken, 'Transfer')
                .withArgs(rwAsset.address, user2.address, amountAKREClearFee)
                .to.emit(rwAsset, 'InvestClearance')
                .withArgs(1, 13 - assetRepayStatus.monthDueRepay, amountAKREClearedAll, amountAKREClearFee)      // No usdc, only AKRE

        const receipt = await executeInvestClearanceTx.wait()
        console.log("executeInvestClearance Gas fee Usage:",  receipt.gasUsed)

        lastBlock = await ethers.provider.getBlock('latest')

        assetClearance.amountAKREAvailable = assetClearance.amountAKREAvailable.sub(amountAKREClearedAll).sub(amountAKREClearFee)
        assetClearance.amountAKREForInvester = amountAKREClearedAll
        assetClearance.amountDebtOverdueProduct = amountRepayMonthly.div(4).mul((timestampNextDue3 - timestampNextDue2))
        assetClearance.priceTickOnClearance = BigNumber.from(tickTest)
        assetClearance.timestampClearance = lastBlock.timestamp

        expect(await rwAsset.assetClearance(1)).to.deep.eq(Object.values(assetClearance))

        const amountAKRECleared1 =  amountAKREClearedAll.mul(150).div(600)
        await expect(rwAsset.takeYield(indexInvesting1))                        // 3rd month: 2nd time take
                .to.emit(AKREToken, 'Transfer')
                .withArgs(rwAsset.address, deployer.address, amountAKRECleared1)
                .to.emit(rwAsset, 'InvestTakeYield')
                .withArgs(deployer.address, indexInvesting1, 0, usdc.address, 0, amountAKRECleared1)      // No usdc, only AKRE

        expect(await rwAsset.assetClearance(1)).to.deep.eq(Object.values(assetClearance))

        const amountAKRECleared2 =  amountAKREClearedAll.mul(350).div(600)          
        await expect(rwAsset.connect(user2).takeYield(indexInvesting2))                        // 3rd month: 2nd time take
                .to.emit(usdc, 'Transfer')
                .withArgs(rwAsset.address, user2.address, amountYieldPerInvest * 350 * (3-2))
                .to.emit(AKREToken, 'Transfer')
                .withArgs(rwAsset.address, user2.address, amountAKRECleared2)
                .to.emit(rwAsset, 'InvestTakeYield')
                .withArgs(user2.address, indexInvesting2, 1, usdc.address, amountYieldPerInvest * 350 * (3-2), amountAKRECleared2)

        const amountAKRECleared3 =  amountAKREClearedAll.mul(100).div(600)       
        await expect(rwAsset.connect(user3).takeYield(indexInvesting3))                        // 3rd month: 2nd time take
                .to.emit(usdc, 'Transfer')
                .withArgs(rwAsset.address, user3.address, amountYieldPerInvest * 100 * 3)
                .to.emit(AKREToken, 'Transfer')
                .withArgs(rwAsset.address, user3.address, amountAKRECleared3)
                .to.emit(rwAsset, 'InvestTakeYield')
                .withArgs(user3.address, indexInvesting3, 3, usdc.address, amountYieldPerInvest * 100 * 3, amountAKRECleared3)

        expect(await rwAsset.assetClearance(1)).to.deep.eq(Object.values(assetClearance))
        expect(await AKREToken.balanceOf(rwAsset.address)).to.deep.eq(assetClearance.amountAKREAvailable)

      })

      it("RWAsset Test: executeFinalClearance from clearing status", async function () {

        const amountAKRESlash = expandTo18Decimals(300_000)
        const amountAKREFund = expandTo18Decimals(500_000)
        const amountAKREReturnBack = assetClearance.amountAKREAvailable.sub(amountAKRESlash).sub(amountAKREFund)

        await rwAsset.setFundReceiver(authority.address)

        let executeFinalClearanceTx: any
        await expect(executeFinalClearanceTx = await rwAsset.connect(manager).executeFinalClearance(1, amountAKRESlash, amountAKREFund ))
                .to.emit(AKREToken, 'Transfer')
                .withArgs(rwAsset.address, fund_receiver.address, amountAKRESlash)
                .to.emit(AKREToken, 'Transfer')
                .withArgs(rwAsset.address, authority.address, amountAKREFund)
                .to.emit(AKREToken, 'Transfer')
                .withArgs(rwAsset.address, user1.address, amountAKREReturnBack)
                .to.emit(rwAsset, 'ExecuteFinalClearance')
                .withArgs(1, amountAKRESlash, amountAKREFund, amountAKREReturnBack)

        const receipt = await executeFinalClearanceTx.wait()
        console.log("executeFinalClearance Gas fee Usage:",  receipt.gasUsed)

        assetDetails.status = 8         // ClearedFinal
        assetDetails.amountForInvestWithdraw = 3 * 600 * amountYieldPerInvest
        assetDetails.amountInvestWithdarwed = 3 * 600 * amountYieldPerInvest

        expect(await rwAsset.assetList(1)).to.deep.eq(Object.values(assetDetails));

        assetClearance.amountAKREAvailable = 0
        expect(await rwAsset.assetClearance(1)).to.deep.eq(Object.values(assetClearance))
          
      })

      it("RWAsset Test: executeFinalClearance in one step", async function () {

        [deployer, manager, authority, fund_receiver, owner1, user1, user2, user3, maker1] = await ethers.getSigners();

        privateKeyManager = process.env.MANAGER_TEST_PRIVATE_KEY as string
        privateKeyAuthority = process.env.REGISTER_TEST_PRIVATE_KEY as string
        privateKeyOwner = process.env.OWNER_TEST_PRIVATE_KEY as string
        privateKeyMaker = process.env.MAKER_TEST_PRIVATE_KEY as string
    
        const fixture = await loadFixture(deployFixture)
        AKREToken = fixture.AKREToken
        usdc = fixture.usdc
        usdt = fixture.usdt
        usdp = fixture.usdp
        dai = fixture.dai
        rwAsset = fixture.rwAsset
        uniTool = fixture.uniTool


        await AKREToken.connect(owner1).approve(rwAsset.address, constants.MaxUint256)
        await AKREToken.connect(user1).approve(rwAsset.address, constants.MaxUint256)
        await AKREToken.connect(user2).approve(rwAsset.address, constants.MaxUint256)
        await AKREToken.connect(user3).approve(rwAsset.address, constants.MaxUint256)

        assetType = {
          typeAsset:            1,
          tenure:               12,
          //remoteQuota:        25,
          investQuota:          800,
          valuePerInvest:       1_000_000,
          amountRepayMonthly:   150_000_000,
          amountYieldPerInvest: 80_000,
          amountDeposit:        1_500_000,
          //numSoldAssets:        0,
          investTokenType:      1,
          maxInvestOverdue:     15,
          minInvestExit:        7,
          interestId:           1,
          paramsClearance:      20 + (20<<8), 
          timesSlashTop:          20 + (10<<8)
        }

        await rwAsset.connect(manager).addNewInvestToken(tokenType, [usdc.address, usdt.address, usdp.address, dai.address])
        await rwAsset.connect(manager).addNewAssetType(assetType)

        await rwAsset.connect(manager).setInterestRate(1, BigNumber.from("1000000006341958396752917301"))
        
        // depositForAsset (uint16 typeAsset, uint16 tokenId)
        await rwAsset.connect(user1).depositForAsset(1, 1)

        const deliveryProof = "0x7120dcbcda0d9da55bc291bf4aaee8f691a0dcfbd4ad634017bb6f5686d92d74"     // Just for test
        await rwAsset.connect(manager).deliverAsset(1, deliveryProof)

        await usdc.transfer(user1.address, 10000 * 1000_000)
        await usdc.transfer(user2.address, 10000 * 1000_000)
        await usdc.transfer(user3.address, 10000 * 1000_000)

        await usdc.approve(rwAsset.address, constants.MaxUint256)
        await usdc.connect(user1).approve(rwAsset.address, constants.MaxUint256)
        await usdc.connect(user2).approve(rwAsset.address, constants.MaxUint256)
        await usdc.connect(user3).approve(rwAsset.address, constants.MaxUint256)

        // Test case: Normal investing
        await rwAsset.investAsset(1, 150)
        await rwAsset.connect(user2).investAsset(1, 350)
        await rwAsset.connect(user3).investAsset(1, 100)

        totalInvestQuota = 600
        amountRepayMonthly = BigNumber.from("150000000")
        await rwAsset.connect(manager).onboardAsset(1)

        lastBlock = await ethers.provider.getBlock('latest')
        timestampOnboarding = lastBlock.timestamp
        timeOnboarding = Math.floor(lastBlock.timestamp /(3600*24)) * 3600 * 24

        const amountToken = (600 - 20) * (assetType.valuePerInvest)
        await expect(rwAsset.connect(manager).takeInvest(1))
                .to.emit(usdc, 'Transfer')
                .withArgs(rwAsset.address, manager.address, amountToken)
                .to.emit(rwAsset, 'TakeInvest')
                .withArgs(manager.address, 1, usdc.address, amountToken)

        // "RWAsset Test: takeRepayment (1-2 month)",
        // Check timestampNextDue to be same day in next month 
        timestampNextDue1 = DateTime.fromMillis(timeOnboarding * 1000).plus({"months": 1}).toSeconds() + 3600 * 24 -1

        // 1st month:   10 days later
        await ethers.provider.send("evm_increaseTime", [3600 * 24 * 10 ])

        // First month repay                
        await rwAsset.connect(user1).repayMonthly(1, amountRepayMonthly)
        assetDetails.onboardTimestamp = lastBlock.timestamp 
        assetDetails.sumAmountRepaid =  amountRepayMonthly

        // Move to 2nd month
        lastBlock = await ethers.provider.getBlock('latest')
        await ethers.provider.send("evm_increaseTime", [timestampNextDue1 - lastBlock.timestamp + 100 ])
        await ethers.provider.send("evm_increaseTime", [3600 * 24 * 10 ])

        await rwAsset.takeYield(indexInvesting1)                  // 2nd month: 1st time take 
        await rwAsset.connect(manager).takeRepayment(1)
     
        // "RWAsset Test: takeRepayment (3rd month)"

        ////////////// 2nd Month //////////////////                                  
        // Second month, partially repayment 
        timestampNextDue2 = DateTime.fromMillis(timeOnboarding * 1000).plus({"months": 2}).toSeconds() + 3600 * 24 -1         // 2nd month

        // 2nd month:  Repay half
        await rwAsset.connect(user1).repayMonthly(1, amountRepayMonthly.div(2))
        await rwAsset.connect(user1).repayMonthly(1, amountRepayMonthly.div(4))       // amountRepayMonthly.div(4) unpaid
        assetDetails.sumAmountRepaid =  assetDetails.sumAmountRepaid.add(amountRepayMonthly.div(2)).add(amountRepayMonthly.div(4))

        ///////////////////////////////////////////////////////////
        // Move to 3rd month
        ///////////////////////////////////////////////////////////

        lastBlock = await ethers.provider.getBlock('latest')
        await ethers.provider.send("evm_increaseTime", [timestampNextDue2 - lastBlock.timestamp + 100 ])
        await ethers.provider.send("evm_increaseTime", [3600 * 24 * 10 ])

        // Deployer take yield: one month
        await rwAsset.takeYield(indexInvesting1)                        // 3rd month: 2nd time take
        await rwAsset.connect(user2).takeYield(indexInvesting2)         // 3rd month: 1nd time take, take 2 month
        await rwAsset.connect(manager).takeRepayment(1)

        ///////////////////////////////////////////////////////////////////
        //  "RWAsset Test: slash"
        await rwAsset.setSlashReceiver(fund_receiver.address)

        assetClearance = {
          productToTriggerClearance: BigNumber.from("259200000000000"),
          amountDebtOverdueProduct: BigNumber.from("0"),
          amountAKREAvailable: expandTo18Decimals(1_500_000),
          amountAKREForInvester: BigNumber.from("0"),
          timesSlashTop: 20 + (10<<8),
          timesSlashed: 0,
          timesLineSlashed: 0,
          timestampLastSlash: 0,
          amountSlashed: BigNumber.from("0"),
          priceTickOnClearance: BigNumber.from("0"),
          timestampClearance: 0
        }

        expect(await rwAsset.assetClearance(1)).to.deep.eq(Object.values(assetClearance))

        const amountSlash = expandTo18Decimals(3750)
        await expect(rwAsset.executeSlash(1, amountSlash))
                .to.be.revertedWith("RWA: Not manager")

        await expect(rwAsset.connect(manager).executeSlash(1, expandTo18Decimals(200_0000)))    // Max 150_0000
                .to.be.revertedWith("RWA: Amount not enough")

        let executeSlashTx 
        await expect(executeSlashTx = await rwAsset.connect(manager).executeSlash(1, amountSlash)) 
                .to.emit(AKREToken, 'Transfer')
                .withArgs(rwAsset.address, fund_receiver.address, amountSlash)
                .to.emit(rwAsset, 'ExecuteSlash')
                .withArgs(1, amountSlash)

        const receipt = await executeSlashTx.wait()
        console.log("executeSlash Gas fee Usage:",  receipt.gasUsed)

        lastBlock = await ethers.provider.getBlock('latest')

        assetClearance.amountAKREAvailable = assetClearance.amountAKREAvailable.sub(amountSlash)
        assetClearance.amountSlashed = amountSlash
        assetClearance.timesSlashed = 1
        assetClearance.timesLineSlashed = 1
        assetClearance.timestampLastSlash = lastBlock.timestamp

        expect(await rwAsset.assetClearance(1)).to.deep.eq(Object.values(assetClearance))

        await expect(rwAsset.connect(manager).executeSlash(1, amountSlash)) 
                .to.be.revertedWith("RWA: Cannot slash twice")

        // 2-19th Slash
        for (let index = 0; index <18; index ++) {
            await ethers.provider.send("evm_increaseTime", [3600 * 24])       // Skip 10 days

            if (index % 6 == 0) {
              await ethers.provider.send("evm_increaseTime", [3600 * 24 * 2])     // Skip 2 days per 6 days to avoid consecutive slash
            }
            await rwAsset.connect(manager).executeSlash(1, amountSlash)
        }

        lastBlock = await ethers.provider.getBlock('latest')

        assetClearance.amountAKREAvailable = assetClearance.amountAKREAvailable.sub(amountSlash.mul(18))
        assetClearance.amountSlashed = assetClearance.amountSlashed.add(amountSlash.mul(18))
        assetClearance.timesSlashed = 19
        assetClearance.timesLineSlashed = 6
        assetClearance.timestampLastSlash = lastBlock.timestamp
        if ( lastBlock.timestamp > timestampNextDue3) {
          assetClearance.amountDebtOverdueProduct = amountRepayMonthly.div(4).mul((timestampNextDue3 - timestampNextDue2))
        }

        expect(await rwAsset.assetClearance(1)).to.deep.eq(Object.values(assetClearance))

        // Test case: Not in clearing state
        await expect(rwAsset.connect(user2).executeInvestClearance(1))
                .to.be.revertedWith("RWA: Not feasible")

        // the 20th Slash 
        await ethers.provider.send("evm_increaseTime", [3600 * 24 * 10])       // Skip 10 days
        await rwAsset.connect(manager).executeSlash(1, amountSlash)
        lastBlock = await ethers.provider.getBlock('latest')

        timestampNextDue3 = DateTime.fromMillis(timeOnboarding * 1000).plus({"months": 3}).toSeconds() + 3600 * 24 -1         // 2nd month

        let interestRate = rpow(ratePerSecond, BigNumber.from(lastBlock.timestamp - timestampNextDue3))
        amountDebtWithInterest = interestRate.mul(amountRepayMonthly.div(4)).div(rateBase)

        assetClearance.amountAKREAvailable = assetClearance.amountAKREAvailable.sub(amountSlash)
        assetClearance.amountSlashed = assetClearance.amountSlashed.add(amountSlash)
        assetClearance.timesSlashed = 20
        assetClearance.timesLineSlashed = 1
        assetClearance.timestampLastSlash = lastBlock.timestamp
        assetClearance.amountDebtOverdueProduct = amountRepayMonthly.div(4).mul((timestampNextDue3 - timestampNextDue2))

        expect(await rwAsset.assetClearance(1)).to.deep.eq(Object.values(assetClearance))

        // Check clearing status
        const assetStatus = await rwAsset.assetList(1)
        expect(assetStatus.status).to.deep.eq(6);      // Clearing status

        const amountAKRESlash = expandTo18Decimals(300_000)
        const amountAKREFund = expandTo18Decimals(500_000)

        //////////////////////////////////////////////////////////////////////////////
        await rwAsset.setFundReceiver(authority.address)

        const assetRepayStatus = await rwAsset.assetRepayStatus(1)

        const tickTest = 343509
        const sqrtPriceX96 = await uniTool.getSqrtRatioAtTick(tickTest)
        const amountAKREClearedPerInvest = sqrtPriceX96
                                            .mul(sqrtPriceX96)
                                            .mul(amountYieldPerInvest)
                                            .div(BigNumber.from(2).pow(192)) 
                                            
        const amountAKREClearedAll = amountAKREClearedPerInvest.mul(600).mul(13 - assetRepayStatus.monthDueRepay)
        const amountAKREClearFee = sqrtPriceX96.mul(sqrtPriceX96).mul(20_000_000).div(BigNumber.from(2).pow(192)) 

        // substract 3 parts
        const amountAKREReturnBack = assetClearance.amountAKREAvailable.sub(amountAKREClearFee).sub(amountAKREClearedAll)
                                      .sub(amountAKRESlash).sub(amountAKREFund)

        let executeFinalClearanceTx: any
        await expect(executeFinalClearanceTx = await rwAsset.connect(manager).executeFinalClearance(1, amountAKRESlash, amountAKREFund ))
                .to.emit(AKREToken, 'Transfer')
                .withArgs(rwAsset.address, manager.address, amountAKREClearFee)
                .to.emit(rwAsset, 'InvestClearance')
                .withArgs(1, 13 - assetRepayStatus.monthDueRepay, amountAKREClearedAll, amountAKREClearFee)      // No usdc, only AKRE
                .to.emit(AKREToken, 'Transfer')
                .withArgs(rwAsset.address, fund_receiver.address, amountAKRESlash)
                .to.emit(AKREToken, 'Transfer')
                .withArgs(rwAsset.address, authority.address, amountAKREFund)
                .to.emit(AKREToken, 'Transfer')
                .withArgs(rwAsset.address, user1.address, amountAKREReturnBack)
                .to.emit(rwAsset, 'ExecuteFinalClearance')
                .withArgs(1, amountAKRESlash, amountAKREFund, amountAKREReturnBack)

        const receiptTx = await executeFinalClearanceTx.wait()
        console.log("executeFinalClearance Gas fee Usage:",  receiptTx.gasUsed)

        lastBlock = await ethers.provider.getBlock('latest')

        assetDetails.status = 8         // ClearedFinal
        assetDetails.amountForInvestWithdraw = 3 * 600 * amountYieldPerInvest
        assetDetails.amountInvestWithdarwed = (1*150 + 1*150 + 2*350) * amountYieldPerInvest

        expect(await rwAsset.assetList(1)).to.deep.eq(Object.values(assetDetails));

        assetClearance.amountAKREAvailable = assetClearance.amountAKREAvailable.sub(amountAKREClearedAll)
        assetClearance.amountAKREForInvester = amountAKREClearedAll
        assetClearance.amountDebtOverdueProduct = amountRepayMonthly.div(4).mul((timestampNextDue3 - timestampNextDue2))
        assetClearance.priceTickOnClearance = BigNumber.from(tickTest)
        assetClearance.timestampClearance = lastBlock.timestamp

        assetClearance.amountAKREAvailable = 0
        expect(await rwAsset.assetClearance(1)).to.deep.eq(Object.values(assetClearance))

      })

  })
})