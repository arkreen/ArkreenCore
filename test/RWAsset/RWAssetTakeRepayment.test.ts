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
    let assetType:              AssetType 

    let amountRepayMonthly:     BigNumber
    let lastBlock:              any
    let timeOnboarding:         number 
    let timestampOnboarding:    number 
    let assetRepayStatusTarget: any

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
     
        await AKREToken.transfer(owner1.address, expandTo18Decimals(300_000_000))
        await AKREToken.transfer(user1.address, expandTo18Decimals(300_000_000))
         
        return { AKREToken, usdc, usdt, usdp, dai, rwAsset  }

    }

    describe('RWAsset test', () => {
      it("RWAsset Test: takeRepayment onboard", async function () {

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
          timesSlashTop:          20
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

      })

      it("RWAsset Test: takeRepayment (1-2 month)", async function () {
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
      })

      it("RWAsset Test: takeRepayment (3rd month)", async function () {

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
                                    numInvestTaken:     (600 - 20)
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
                                    numInvestTaken:     (600 - 20)
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

      })      
      
      it("RWAsset Test: takeRepayment (4th month)", async function () {

        ////////////// 4th Month //////////////////              
        // Set timestampNextDue to be same day in next month 
        timestampNextDue3 = DateTime.fromMillis(timeOnboarding * 1000).plus({"months": 3}).toSeconds() + 3600 * 24 -1         // 3rd month

        // 3rd Month: Repay all debt
        await rwAsset.connect(user1).repayMonthly(1, amountRepayMonthly.div(6))
        lastBlock = await ethers.provider.getBlock('latest')
        let interestRate = rpow(ratePerSecond, BigNumber.from(lastBlock.timestamp - timestampNextDue2))
        amountDebtWithInterest = interestRate.mul(assetRepayStatusTarget.amountDebt).div(rateBase)

        assetRepayStatusTarget.amountDebt = amountDebtWithInterest.toNumber() - amountRepayMonthly.div(6).toNumber()
        assetRepayStatusTarget.timestampDebt = lastBlock.timestamp

        expect(await rwAsset.assetRepayStatus(1)).to.deep.eq(Object.values(assetRepayStatusTarget));

        await rwAsset.connect(user1).repayMonthly(1, amountRepayMonthly.mul(2))

        await ethers.provider.send("evm_increaseTime", [3600 * 24 * 10 ])       // Skip 10 days
        lastBlock = await ethers.provider.getBlock('latest')
        interestRate = rpow(ratePerSecond, BigNumber.from(lastBlock.timestamp - assetRepayStatusTarget.timestampDebt))
        amountDebtWithInterest = interestRate.mul(assetRepayStatusTarget.amountDebt).div(rateBase)

        assetRepayStatusTarget.amountRepayDue = 0
        assetRepayStatusTarget.amountDebt = 0
        assetRepayStatusTarget.timestampDebt = 0
        assetRepayStatusTarget.amountPrePay = amountRepayMonthly.mul(2).sub(amountDebtWithInterest).sub(amountRepayMonthly)

        expect(await rwAsset.assetRepayStatus(1)).to.deep.eq(Object.values(assetRepayStatusTarget));

        // Move to 4th month 
        lastBlock = await ethers.provider.getBlock('latest')
        await ethers.provider.send("evm_increaseTime", [timestampNextDue3 - lastBlock.timestamp + 100 ])
        await ethers.provider.send("evm_increaseTime", [3600 * 24 * 10 ])       // Skip 10 days

        // Deployer take yield: one month
        await expect(rwAsset.takeYield(indexInvesting1))
                .to.emit(usdc, 'Transfer')
                .withArgs(rwAsset.address, deployer.address, amountYieldPerInvest * 150)
                .to.emit(rwAsset, 'InvestTakeYield')
                .withArgs(deployer.address, indexInvesting1, 1, usdc.address, amountYieldPerInvest * 150, 0)

        await expect(rwAsset.connect(user2).takeYield(indexInvesting2))
                .to.emit(usdc, 'Transfer')
                .withArgs(rwAsset.address, user2.address, amountYieldPerInvest * 350 * 1)
                .to.emit(rwAsset, 'InvestTakeYield')
                .withArgs(user2.address, indexInvesting2, 1, usdc.address, amountYieldPerInvest * 350 * 1, 0)

        await expect(rwAsset.connect(user3).takeYield(indexInvesting3))
                .to.emit(usdc, 'Transfer')
                .withArgs(rwAsset.address, user3.address, amountYieldPerInvest * 100 * 3)
                .to.emit(rwAsset, 'InvestTakeYield')
                .withArgs(user3.address, indexInvesting3, 3, usdc.address, amountYieldPerInvest * 100 * 3, 0)

        investing1A.monthTaken = 3
        expect(await rwAsset.investList(indexInvesting1)).to.deep.eq(Object.values(investing1A));

        investing2A.monthTaken = 3
        expect(await rwAsset.investList(indexInvesting2)).to.deep.eq(Object.values(investing2A));

        investing3A.monthTaken = 3
        expect(await rwAsset.investList(indexInvesting3)).to.deep.eq(Object.values(investing3A));

        assetDetails.sumAmountRepaid = amountRepayMonthly.mul(12 + 6 + 3 + 2 + 24).div(12)
        assetDetails.amountForInvestWithdraw = amountYieldPerInvest * totalInvestQuota * 3
        assetDetails.amountInvestWithdarwed = amountYieldPerInvest * totalInvestQuota * 3

        expect(await rwAsset.assetList(1)).to.deep.eq(Object.values(assetDetails));

        //*********************************************//
        const amountRepayAll3 = amountRepayMonthly.mul(12 + 6 + 3 + 2 + 24 ).div(12)
        amountTakable3 =   amountRepayAll3.toNumber() - 
                                      amountTakableFirst - 
                                      amountTakableSecond -
                                      assetRepayStatusTarget.amountPrePay -
                                      amountYieldPerInvest * totalInvestQuota * 4  // one extra month is kept

        await expect(rwAsset.connect(manager).takeRepayment(1))
                .to.emit(usdc, 'Transfer')
                .withArgs(rwAsset.address, manager.address, amountTakable3)
                .to.emit(rwAsset, 'TakeRepayment')
                .withArgs(1, usdc.address, amountTakable3)
      })

      it("RWAsset Test: takeRepayment (5-12 month), Last month not repaid", async function () {

        // 
        for (let months = 4; months <= 12; months++ ) {                                  
          // Set timestampNextDue to be same day in next month 
          let timestampNextDueX = DateTime.fromMillis(timeOnboarding * 1000).plus({"months": months}).toSeconds() + 3600 * 24 -1         // 3rd month

          // Repay
          if (months < 12) {
            await rwAsset.connect(user1).repayMonthly(1, amountRepayMonthly)
          } else {
            await rwAsset.connect(user1).repayMonthly(1, amountRepayMonthly.div(12))
          }

          // Move to next month 
          lastBlock = await ethers.provider.getBlock('latest')
          await ethers.provider.send("evm_increaseTime", [timestampNextDueX - lastBlock.timestamp + 100 ])
          await ethers.provider.send("evm_increaseTime", [3600 * 24 * 10 ])       // Skip 10 days
        }

        await expect(rwAsset.takeYield(indexInvesting1))
                .to.emit(usdc, 'Transfer')
                .withArgs(rwAsset.address, deployer.address, amountYieldPerInvest * 150 * 9)
                .to.emit(rwAsset, 'InvestTakeYield')
                .withArgs(deployer.address, indexInvesting1, 9, usdc.address, amountYieldPerInvest * 150 * 9, 0)
               
        await expect(rwAsset.connect(user2).takeYield(indexInvesting2))
                .to.emit(usdc, 'Transfer')
                .withArgs(rwAsset.address, user2.address, amountYieldPerInvest * 350 * 9)
                .to.emit(rwAsset, 'InvestTakeYield')
                .withArgs(user2.address, indexInvesting2, 9, usdc.address, amountYieldPerInvest * 350 * 9, 0)

        let takeYieldTx
        await expect(takeYieldTx = await rwAsset.connect(user3).takeYield(indexInvesting3))
                .to.emit(usdc, 'Transfer')
                .withArgs(rwAsset.address, user3.address, amountYieldPerInvest * 100 * 9)
                .to.emit(rwAsset, 'InvestTakeYield')
                .withArgs(user3.address, indexInvesting3, 9, usdc.address, amountYieldPerInvest * 100 * 9, 0)

        const receipt = await takeYieldTx.wait()
        console.log("takeRepayment Gas fee Usage:",  receipt.gasUsed)

        investing1A.monthTaken = 12
        investing1A.status = 4            // Complete
        expect(await rwAsset.investList(indexInvesting1)).to.deep.eq(Object.values(investing1A));

        investing2A.monthTaken = 12
        investing2A.status = 4            // Complete
        expect(await rwAsset.investList(indexInvesting2)).to.deep.eq(Object.values(investing2A));

        investing3A.monthTaken = 12
        investing3A.status = 4            // Complete
        expect(await rwAsset.investList(indexInvesting3)).to.deep.eq(Object.values(investing3A));

        await expect(rwAsset.takeYield(indexInvesting1)).to.be.revertedWith("RWA: Wrong status")
        await expect(rwAsset.connect(user2).takeYield(indexInvesting2)).to.be.revertedWith("RWA: Wrong status")
        await expect(rwAsset.connect(user3).takeYield(indexInvesting3)).to.be.revertedWith("RWA: Wrong status")

        //*********************************************//
        assetDetails.sumAmountRepaid = amountRepayMonthly.mul(12 + 6 + 3 + 2 + 24 + 12*8 + 1 ).div(12)
        assetDetails.amountForInvestWithdraw = amountYieldPerInvest * totalInvestQuota * 12
        assetDetails.amountInvestWithdarwed = amountYieldPerInvest * totalInvestQuota * 12

        //const assetDetailsChain =  await rwAsset.assetList(1)
        //console.log("QQQQQQQQQQQQQQ", assetDetailsChain)

        expect(await rwAsset.assetList(1)).to.deep.eq(Object.values(assetDetails));

        const amountRepayAll = amountRepayMonthly.mul(12 + 6 + 3 + 2 + 24 + 12*8 + 1).div(12)
        const amountTakableAll =   amountRepayAll.toNumber() - 
                                      amountTakableFirst - 
                                      amountTakableSecond -
                                      amountTakable3 -
                                      amountYieldPerInvest * totalInvestQuota * 12  // one extra month is kept

        const assetStatus1 = await rwAsset.assetRepayStatus(1)
        
        await expect(rwAsset.connect(manager).takeRepayment(1))
                .to.emit(usdc, 'Transfer')
                .withArgs(rwAsset.address, manager.address, amountTakableAll)
                .to.emit(rwAsset, 'TakeRepayment')
                .withArgs(1, usdc.address, amountTakableAll)

        await ethers.provider.send("evm_increaseTime", [3600 * 24 * 10 ])       // Skip 10 days

        // Test case: Cannot take Repayment again
        await expect(rwAsset.connect(manager).takeRepayment(1)).to.be.revertedWith("RWA: No mature repayment")

        // Test case: Cannot take Repayment again
        await expect(rwAsset.connect(user1).claimtDeposit(1)).to.be.revertedWith("RWA: Not allowed")

        await rwAsset.connect(user1).repayMonthly(1, amountRepayMonthly.div(2))

        lastBlock = await ethers.provider.getBlock('latest')
        let interestRate = rpow(ratePerSecond, BigNumber.from(lastBlock.timestamp - assetStatus1.timestampDebt))
        amountDebtWithInterest = interestRate.mul(assetStatus1.amountDebt).div(rateBase)

        await expect(rwAsset.connect(manager).takeRepayment(1))
                .to.emit(usdc, 'Transfer')
                .withArgs(rwAsset.address, manager.address, amountDebtWithInterest)
                .to.emit(rwAsset, 'TakeRepayment')
                .withArgs(1, usdc.address, amountDebtWithInterest)

        let timestampNextDue13 = DateTime.fromMillis(timeOnboarding * 1000).plus({"months": 13}).toSeconds() + 3600 * 24 -1         // 3rd month
        assetRepayStatusTarget.monthDueRepay = 13
        assetRepayStatusTarget.timestampNextDue = timestampNextDue13
        assetRepayStatusTarget.amountRepayDue = 0
        assetRepayStatusTarget.amountDebt = 0
        assetRepayStatusTarget.timestampDebt = 0
        assetRepayStatusTarget.amountPrePay = amountRepayMonthly.div(2).sub(amountDebtWithInterest)
        assetRepayStatusTarget.amountRepayTaken = amountTakableFirst + amountTakableSecond + 
                                                  amountTakable3 + amountTakableAll + amountDebtWithInterest.toNumber()

        expect(await rwAsset.assetRepayStatus(1)).to.deep.eq(Object.values(assetRepayStatusTarget));

        // const  assetStatus = await rwAsset.assetList(1)
        // console.log("DDDDDDDDDDDDDDDD", assetStatus)

        assetDetails.sumAmountRepaid = amountRepayMonthly.mul(12 + 6 + 3 + 2 + 24 + 12*8 + 1 + 6).div(12)
        assetDetails.status = 5

        expect(await rwAsset.assetList(1)).to.deep.eq(Object.values(assetDetails));
        
      })

      it("RWAsset Test: ClaimDeposit while asset repayment is completed", async function () {
        // Test case: Not owner
        await expect(rwAsset.connect(manager).claimtDeposit(1)).to.be.revertedWith("RWA: Not Owner")

        //*********************************************//
        // Test case: ClaimDeposit
        await expect(rwAsset.connect(user1).claimtDeposit(1))
                .to.emit(AKREToken, 'Transfer')
                .withArgs(rwAsset.address, user1.address, expandTo18Decimals(assetType.amountDeposit) )
                .to.emit(rwAsset, 'ClaimtDeposit')
                .withArgs(user1.address, 1, expandTo18Decimals(assetType.amountDeposit))
      })
  })
})
