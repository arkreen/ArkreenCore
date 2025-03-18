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

    let tokenType = 1
 
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

      beforeEach(async () => {

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
          timesSlashTop:        20
        }
      });


      it("RWAsset Test: addNewInvestToken", async function () {
        await expect(rwAsset.addNewInvestToken(tokenType, [usdc.address, usdt.address, usdp.address, dai.address]))
                .to.be.revertedWith("RWA: Not manager")

        await expect(rwAsset.connect(manager).addNewInvestToken(tokenType, [usdc.address, usdt.address, usdp.address, dai.address]))
                .to.emit(rwAsset, 'AddNewInvestToken')
                .withArgs(tokenType, [usdc.address, usdt.address, usdp.address, dai.address])

        expect(await rwAsset.globalStatus()).to.deep.eq([0, 0, 0, 0, 0, 4, 0]);
        expect(await rwAsset.allInvestTokens(1)).to.deep.eq([1, usdc.address]);
        expect(await rwAsset.allInvestTokens(2)).to.deep.eq([1, usdt.address]);
        expect(await rwAsset.allInvestTokens(3)).to.deep.eq([1, usdp.address]);
        expect(await rwAsset.allInvestTokens(4)).to.deep.eq([1, dai.address]);
      })

      it("RWAsset Test: addNewAssetType", async function () {

        await rwAsset.connect(manager).addNewInvestToken(tokenType, [usdc.address, usdt.address, usdp.address, dai.address])
        await expect(rwAsset.connect(manager).addNewAssetType(assetType))
                .to.emit(rwAsset, 'AddNewAssetType')
                .withArgs(Object.values(assetType))

        expect(await rwAsset.assetTypes(1)).to.deep.eq(Object.values(assetType));
        expect(await rwAsset.globalStatus()).to.deep.eq([1, 0, 0, 0, 0, 4, 0]);

        await expect(rwAsset.addNewAssetType(assetType))
                .to.be.revertedWith("RWA: Not manager")

        assetType.typeAsset = 3
        await expect(rwAsset.connect(manager).addNewAssetType(assetType))
                .to.be.revertedWith("RWA: Wrong asset type")
      })

      it("RWAsset Test: depositForAsset", async function () {

        await rwAsset.connect(manager).addNewInvestToken(tokenType, [usdc.address, usdt.address, usdp.address, dai.address])
        await rwAsset.connect(manager).addNewAssetType(assetType)

        const amountDeposit = expandTo18Decimals(assetType.amountDeposit)
        const balanceBefore = await AKREToken.balanceOf(user1.address)
 
        await expect(rwAsset.connect(user1).depositForAsset(1, 1))
          .to.emit(rwAsset, 'DepositForAsset')
          .withArgs(user1.address, 1, 1, 1, amountDeposit)

        expect(await AKREToken.balanceOf(user1.address)).to.eq(balanceBefore.sub(amountDeposit))

        let assetDetails =  {
          assetOwner:       user1.address,
          status:           1,
          tokenId:          1,
          typeAsset:        1,
          numInvestings:    0,
          numQuotaTotal:    0,
          amountDeposit:    assetType.amountDeposit,
          deliverProofId:   0,
          onboardTimestamp: 0,
          sumAmountRepaid: 0,
          amountForInvestWithdarw: 0,
          amountInvestWithdarwed: 0
        }
        expect(await rwAsset.assetList(1)).to.deep.eq(Object.values(assetDetails));
        expect(await rwAsset.globalStatus()).to.deep.eq([1, 1, 0, 0, 0, 4, 0]);
        expect(await rwAsset.userAssetList(user1.address, 0)).to.deep.eq(1);

        await expect(rwAsset.connect(user1).depositForAsset(3, 1))
            .to.be.revertedWith("RWA: Asset type not defined")
      })

      it("RWAsset Test: withdrawDeposit", async function () {

        await rwAsset.connect(manager).addNewInvestToken(tokenType, [usdc.address, usdt.address, usdp.address, dai.address])
        await rwAsset.connect(manager).addNewAssetType(assetType)
        await rwAsset.connect(user1).depositForAsset(1, 1)

        const digest = getWithdrawDepositDigest(
                  rwAsset.address,
                  'Arkreen RWA Fund',
                  1,
                  user1.address,
                  expandTo18Decimals(assetType.amountDeposit),
                  constants.MaxUint256
                )

        const signature = ecsign(Buffer.from(digest.slice(2), 'hex'), Buffer.from(privateKeyAuthority.slice(2), 'hex'))
  
        const amountDeposit = expandTo18Decimals(assetType.amountDeposit)
        const balanceBefore = await AKREToken.balanceOf(user1.address)

        await expect(rwAsset.withdrawDeposit(1, constants.MaxUint256, signature))
                .to.be.revertedWith("RWA: Not Owner")
 
        await expect(rwAsset.connect(user1).withdrawDeposit(1, constants.MaxUint256, signature))
                .to.emit(rwAsset, 'WithdrawDeposit')
                .withArgs(user1.address, 1, amountDeposit)

        let assetDetails =  {
          assetOwner:       user1.address,
          status:           2,
          tokenId:          1,
          typeAsset:        1,
          numInvestings:    0,
          numQuotaTotal:    0,
          amountDeposit:    assetType.amountDeposit,
          deliverProofId:   0,
          onboardTimestamp: 0,
          sumAmountRepaid:  0,
          amountForInvestWithdarw: 0,
          amountInvestWithdarwed: 0
        }
        expect(await rwAsset.assetList(1)).to.deep.eq(Object.values(assetDetails));
        expect(await AKREToken.balanceOf(user1.address)).to.eq(balanceBefore.add(amountDeposit))

        await expect(rwAsset.connect(user1).withdrawDeposit(1, constants.MaxUint256, signature))
                  .to.be.revertedWith("RWA: Not allowed")

      })

      it("RWAsset Test: deliverAsset", async function () {

        await rwAsset.connect(manager).addNewInvestToken(tokenType, [usdc.address, usdt.address, usdp.address, dai.address])
        await rwAsset.connect(manager).addNewAssetType(assetType)
        await rwAsset.connect(user1).depositForAsset(1, 1)

        const deliveryProof = "0x7120dcbcda0d9da55bc291bf4aaee8f691a0dcfbd4ad634017bb6f5686d92d74"     // Just for test

        await expect(rwAsset.connect(user1).deliverAsset(1, deliveryProof))
                .to.be.revertedWith("RWA: Not manager")

        await expect(rwAsset.connect(manager).deliverAsset(1, deliveryProof))
                .to.emit(rwAsset, 'DeliverAsset')
                .withArgs(1, deliveryProof)

        let assetDetails =  {
          assetOwner:       user1.address,
          status:           3,
          tokenId:          1,
          typeAsset:        1,
          numInvestings:     0,
          numQuotaTotal:      0,
          amountDeposit:    assetType.amountDeposit,
          deliverProofId:   1,
          onboardTimestamp: 0,
          sumAmountRepaid: 0,
          amountForInvestWithdarw: 0,
          amountInvestWithdarwed: 0
        }

        expect(await rwAsset.assetList(1)).to.deep.eq(Object.values(assetDetails));
        expect(await rwAsset.deliveryProofList(1)).to.deep.eq(deliveryProof);
        expect(await rwAsset.globalStatus()).to.deep.eq([1, 1, 0, 1, 0, 4, 0]);
       
        await expect(rwAsset.connect(manager).deliverAsset(1, deliveryProof))
                .to.be.revertedWith("RWA: Not allowed")

      })

      it("RWAsset Test: onboardAsset", async function () {

        await rwAsset.connect(manager).addNewInvestToken(tokenType, [usdc.address, usdt.address, usdp.address, dai.address])
        await rwAsset.connect(manager).addNewAssetType(assetType)
        await rwAsset.connect(user1).depositForAsset(1, 1)

        const deliveryProof = "0x7120dcbcda0d9da55bc291bf4aaee8f691a0dcfbd4ad634017bb6f5686d92d74"     // Just for test
        await rwAsset.connect(manager).deliverAsset(1, deliveryProof)

        await expect(rwAsset.connect(user1).onboardAsset(1))
                .to.be.revertedWith("RWA: Not manager")

        await expect(rwAsset.connect(manager).onboardAsset(1))
                .to.emit(rwAsset, 'OnboardAsset')
                .withArgs(1)

        const lastBlock = await ethers.provider.getBlock('latest')

        let assetDetails =  {
          assetOwner:       user1.address,
          status:           4,
          tokenId:          1,
          typeAsset:        1,
          numInvestings:     0,
          numQuotaTotal:      0,
          amountDeposit:    assetType.amountDeposit,
          deliverProofId:   1,
          onboardTimestamp: lastBlock.timestamp,
          sumAmountRepaid: 0,
          amountForInvestWithdarw: 0,
          amountInvestWithdarwed: 0
        }

        expect(await rwAsset.assetList(1)).to.deep.eq(Object.values(assetDetails));
        expect(await rwAsset.deliveryProofList(1)).to.deep.eq(deliveryProof);
        expect(await rwAsset.globalStatus()).to.deep.eq([1, 1, 0, 1, 1, 4, 0]);

        const timestampNextDue = DateTime.fromMillis(Math.floor(lastBlock.timestamp /(3600*24)) * 3600 * 24 * 1000)
              .plus({"months": 1}).toSeconds() + 3600 * 24 -1

        let assetRepayStatusTarget =  {
          monthDueRepay:      1,
          timestampNextDue:   timestampNextDue,
          amountRepayDue:     150_000_000,
          amountDebt:         0,
          timestampDebt:      0,
          amountPrePay:       0,
          amountRepayTaken:   0,
          numInvestTaken:     0
        }

        expect(await rwAsset.assetRepayStatus(1)).to.deep.eq(Object.values(assetRepayStatusTarget));
       
        await expect(rwAsset.connect(manager).onboardAsset(1))
                .to.be.revertedWith("RWA: Not allowed")

      })

      it("RWAsset Test: investAsset", async function () {

        await rwAsset.connect(manager).addNewInvestToken(tokenType, [usdc.address, usdt.address, usdp.address, dai.address])
        await rwAsset.connect(manager).addNewAssetType(assetType)

        // depositForAsset (uint16 typeAsset, uint16 tokenId)
        await rwAsset.connect(user1).depositForAsset(1, 1)

        // Test case 1:  revert "RWA: Status not allowed" before "Delivered" state
        await expect(rwAsset.investAsset(1, 5))
                .to.be.revertedWith("RWA: Status not allowed")

        const deliveryProof = "0x7120dcbcda0d9da55bc291bf4aaee8f691a0dcfbd4ad634017bb6f5686d92d74"     // Just for test
        await rwAsset.connect(manager).deliverAsset(1, deliveryProof)

        await usdc.approve(rwAsset.address, constants.MaxUint256)

        // Test case: Normal investing
        const amountToken = 150 * (assetType.valuePerInvest)
        const usdcBalanceBefore = await usdc.balanceOf(deployer.address)

        await expect(rwAsset.investAsset(1, 150))
                .to.emit(usdc, 'Transfer')
                .withArgs(deployer.address, rwAsset.address, amountToken)
                .to.emit(rwAsset, 'InvestAsset')
                .withArgs(deployer.address, 1, usdc.address, amountToken)

        expect(await usdc.balanceOf(deployer.address)).to.eq(usdcBalanceBefore.sub(amountToken))

        let assetDetails =  {
          assetOwner:       user1.address,
          status:           3,  //Delivered,
          tokenId:          1,
          typeAsset:        1,
          numInvestings:     1,
          numQuotaTotal:      150,
          amountDeposit:    assetType.amountDeposit,
          deliverProofId:   1,
          onboardTimestamp: 0,
          sumAmountRepaid: 0,
          amountForInvestWithdarw: 0,
          amountInvestWithdarwed: 0
        }
        expect(await rwAsset.assetList(1)).to.deep.eq(Object.values(assetDetails));

        let lastBlock = await ethers.provider.getBlock('latest')
        let investing = {
          invester: deployer.address,
          //assetId: 1,
          timestamp: lastBlock.timestamp,
          status: 1,
          numQuota: 150,
          monthTaken: 0
        }

        let indexInvesting = (1<<16) +1
        expect(await rwAsset.investList(indexInvesting)).to.deep.eq(Object.values(investing));
        
        // test case：second normal investing by owner1 
        await usdc.transfer(owner1.address, 1000 * 1000_000)
        await usdc.connect(owner1).approve(rwAsset.address, constants.MaxUint256)
        await rwAsset.connect(owner1).investAsset(1, 550)
        assetDetails.numInvestings = 2
        assetDetails.numQuotaTotal = 150 + 550
        expect(await rwAsset.assetList(1)).to.deep.eq(Object.values(assetDetails));

        lastBlock = await ethers.provider.getBlock('latest')

        investing = {
          invester: owner1.address,
          //assetId: 1,
          timestamp: lastBlock.timestamp,
          status: 1,
          numQuota: 550,
          monthTaken: 0
        }

        indexInvesting = (1<<16) + 2
        expect(await rwAsset.investList(indexInvesting)).to.deep.eq(Object.values(investing));

        expect(await rwAsset.globalStatus()).to.deep.eq([1, 1, 0, 1, 0, 4, 2]);

        // test case： RWA: Invest overflowed
        await expect(rwAsset.investAsset(1, 150))
                .to.be.revertedWith("RWA: Invest overflowed")

        // test case: Investing is still on-goling after asset is onboarded.
        await rwAsset.connect(manager).onboardAsset(1)
        lastBlock = await ethers.provider.getBlock('latest')

        await rwAsset.investAsset(1, 15)
        
        assetDetails.status = 4
        assetDetails.numInvestings = 3
        assetDetails.numQuotaTotal = 150 + 550 + 15
        assetDetails.onboardTimestamp = lastBlock.timestamp
        expect(await rwAsset.assetList(1)).to.deep.eq(Object.values(assetDetails));

        await ethers.provider.send("evm_increaseTime", [assetType.maxInvestOverdue * 3600 * 24])
        await expect(rwAsset.investAsset(1, 15))
                .to.be.revertedWith("RWA: Invest overdued")
                  
  //      // test case: All quotas are invested.
  //      await rwAsset.investAsset(1, 85)
  //
  //      assetDetails.numInvestings = 4
  //      assetDetails.numQuotaTotal = 150 + 550 + 15 + 85
  //      expect(await rwAsset.assetList(1)).to.deep.eq(Object.values(assetDetails));
      })

      it("RWAsset Test: investExit", async function () {

        await rwAsset.connect(manager).addNewInvestToken(tokenType, [usdc.address, usdt.address, usdp.address, dai.address])
        await rwAsset.connect(manager).addNewAssetType(assetType)
        await rwAsset.connect(user1).depositForAsset(1, 1)

        const deliveryProof = "0x7120dcbcda0d9da55bc291bf4aaee8f691a0dcfbd4ad634017bb6f5686d92d74"     // Just for test
        await rwAsset.connect(manager).deliverAsset(1, deliveryProof)

        await usdc.approve(rwAsset.address, constants.MaxUint256)

        const amountToken = 150 * (assetType.valuePerInvest)
        await rwAsset.investAsset(1, 150)

        let lastBlock = await ethers.provider.getBlock('latest')

        let indexInvesting = (1<<16) + 1

        // Abnormal Test case: Not owner
        await expect(rwAsset.connect(owner1).investExit(indexInvesting))
                .to.be.revertedWith("RWA: Not owner")

        // Abnormal test case: need to stay required days
        await expect(rwAsset.investExit(indexInvesting))
                .to.be.revertedWith("RWA: Need to stay")
       
        // Test case: Normal case
        await ethers.provider.send("evm_increaseTime", [assetType.minInvestExit * 3600 * 24])
        const usdcBalanceBefore = await usdc.balanceOf(deployer.address)

        let investExitTrx 
        await expect(investExitTrx = await rwAsset.investExit(indexInvesting))
                .to.emit(usdc, 'Transfer')
                .withArgs(rwAsset.address, deployer.address, amountToken)
                .to.emit(rwAsset, 'InvestExit')
                .withArgs(deployer.address, indexInvesting, usdc.address, amountToken)

        const receipt = await investExitTrx.wait()
        console.log("investExit Gas fee Usage:",  receipt.gasUsed)

        expect(await usdc.balanceOf(deployer.address)).to.eq(usdcBalanceBefore.add(amountToken))

        let assetDetails =  {
          assetOwner:       user1.address,
          status:           3,  //Delivered,
          tokenId:          1,
          typeAsset:        1,
          numInvestings:    1,
          numQuotaTotal:    150 - 150,            // Aborted
          amountDeposit:    assetType.amountDeposit,
          deliverProofId:   1,
          onboardTimestamp: 0,
          sumAmountRepaid: 0,
          amountForInvestWithdarw: 0,
          amountInvestWithdarwed: 0
        }
        expect(await rwAsset.assetList(1)).to.deep.eq(Object.values(assetDetails));                

        let investing = {
          invester: deployer.address,
          //assetId: 1,
          timestamp: lastBlock.timestamp,
          status: 2,                      // InvestAborted
          numQuota: 150,
          monthTaken: 0
        }

        expect(await rwAsset.investList(indexInvesting)).to.deep.eq(Object.values(investing));   
                
        // Abnormal test case: Exit twice
        await expect(rwAsset.investExit(indexInvesting))
                .to.be.revertedWith("RWA: Wrong status")

        // Abnormal test case: Exit not allowed while onboarded
        await usdc.transfer(owner1.address, 1000 * 1000_000)
        await usdc.connect(owner1).approve(rwAsset.address, constants.MaxUint256)
        await rwAsset.connect(owner1).investAsset(1, 550)
        
        await rwAsset.connect(manager).onboardAsset(1)
        lastBlock = await ethers.provider.getBlock('latest')

        indexInvesting = (1<<16) + 2
        await expect(rwAsset.connect(owner1).investExit(indexInvesting))
                .to.be.revertedWith("RWA: Status not allowed")

      })

      it("RWAsset Test: takeInvest", async function () {

        await rwAsset.connect(manager).addNewInvestToken(tokenType, [usdc.address, usdt.address, usdp.address, dai.address])
        await rwAsset.connect(manager).addNewAssetType(assetType)
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

        await rwAsset.investAsset(1, 15)

        // Abnormal Test case: Not manager
        await expect(rwAsset.takeInvest(1))
                  .to.be.revertedWith("RWA: Not manager")

        // Abnormal Test case: Status not allowed
        await expect(rwAsset.connect(manager).takeInvest(1))
                  .to.be.revertedWith("RWA: Status not allowed")

        await rwAsset.connect(manager).onboardAsset(1)

        let lastBlock = await ethers.provider.getBlock('latest')
        const timeOnboarding = Math.floor(lastBlock.timestamp /(3600*24)) * 3600 * 24

        // Abnormal Test case: Low investment
        await expect(rwAsset.connect(manager).takeInvest(1))
                  .to.be.revertedWith("RWA: Low investment")

        await rwAsset.investAsset(1, 160)

        const amountToken = (15 + 160 - 20) * (assetType.valuePerInvest)

        await expect(rwAsset.connect(manager).takeInvest(1))
                .to.emit(usdc, 'Transfer')
                .withArgs(rwAsset.address, manager.address, amountToken)
                .to.emit(rwAsset, 'TakeInvest')
                .withArgs(manager.address, 1, usdc.address, amountToken)

        await rwAsset.connect(user2).investAsset(1, 350)

        let takeInvestTrx
        await expect(takeInvestTrx = await rwAsset.connect(manager).takeInvest(1))
                .to.emit(usdc, 'Transfer')
                .withArgs(rwAsset.address, manager.address, 350 * (assetType.valuePerInvest) )
                .to.emit(rwAsset, 'TakeInvest')
                .withArgs(manager.address, 1, usdc.address, 350 * (assetType.valuePerInvest) )

        const receipt = await takeInvestTrx.wait()
        console.log("takeInvest Gas fee Usage:",  receipt.gasUsed)                

        // Check timestampNextDue to be same day in next month 
        let timestampNextDue1 = DateTime.fromMillis(timeOnboarding * 1000).plus({"months": 1}).toSeconds() + 3600 * 24 -1

        let assetRepayStatusTarget =  {
          monthDueRepay:      1,
          timestampNextDue:   timestampNextDue1,
          amountRepayDue:     150_000_000,
          amountDebt:         0,
          timestampDebt:      0,
          amountPrePay:       0,
          amountRepayTaken:   0,
          numInvestTaken:     15 + 160 + 350 - 20
        }

        expect(await rwAsset.assetRepayStatus(1)).to.deep.eq(Object.values(assetRepayStatusTarget));

      })

      it("RWAsset Test: repayMonthly", async function () {

        await rwAsset.connect(manager).addNewInvestToken(tokenType, [usdc.address, usdt.address, usdp.address, dai.address])
        await rwAsset.connect(manager).addNewAssetType(assetType)

        await rwAsset.connect(manager).setInterestRate(1, BigNumber.from("1000000006341958396752917301"))
        const ratePerSecond = BigNumber.from("1000000006341958396752917301")
        const rateBase = BigNumber.from("10").pow(27)
        
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
        await rwAsset.connect(user3).investAsset(1, 300)

        const amountRepayMonthly = BigNumber.from("150000000")

        // Abnormal: Not Onboarded
        await expect(rwAsset.connect(user1).repayMonthly(1, amountRepayMonthly))
                .to.be.revertedWith("RWA: Status not allowed")

        await rwAsset.connect(manager).onboardAsset(1)

        let lastBlock = await ethers.provider.getBlock('latest')
        const timeOnboarding = Math.floor(lastBlock.timestamp /(3600*24)) * 3600 * 24

        // Check timestampNextDue to be same day in next month 
        let timestampNextDue1 = DateTime.fromMillis(timeOnboarding * 1000).plus({"months": 1}).toSeconds() + 3600 * 24 -1

        let assetRepayStatusTarget =  {
          monthDueRepay:      1,
          timestampNextDue:   timestampNextDue1,
          amountRepayDue:     150_000_000,
          amountDebt:         0,
          timestampDebt:      0,
          amountPrePay:       0,
          amountRepayTaken:   0,
          numInvestTaken:     0
        }

        expect(await rwAsset.assetRepayStatus(1)).to.deep.eq(Object.values(assetRepayStatusTarget));

        await expect(rwAsset.repayMonthly(1, amountRepayMonthly))
                .to.be.revertedWith("RWA: Not asset owner")

        // First month repay                
        await expect(rwAsset.connect(user1).repayMonthly(1, amountRepayMonthly))
                .to.emit(usdc, 'Transfer')
                .withArgs(user1.address, rwAsset.address, amountRepayMonthly)
                .to.emit(rwAsset, 'RepayMonthly')
                .withArgs(user1.address, 1, usdc.address, amountRepayMonthly, 4)

        assetRepayStatusTarget.amountRepayDue = 0;
        expect(await rwAsset.assetRepayStatus(1)).to.deep.eq(Object.values(assetRepayStatusTarget));

        let assetDetails =  {
          assetOwner:       user1.address,
          status:           4,  //Onboarded,
          tokenId:          1,
          typeAsset:        1,
          numInvestings:    3,
          numQuotaTotal:    800,
          amountDeposit:    assetType.amountDeposit,
          deliverProofId:   1,
          onboardTimestamp: lastBlock.timestamp,
          sumAmountRepaid:  amountRepayMonthly,
          amountForInvestWithdarw: 0,
          amountInvestWithdarwed: 0
        }

        expect(await rwAsset.assetList(1)).to.deep.eq(Object.values(assetDetails));

        ////////////// 2nd Month //////////////////                                  
        // Second month, partially repayment 
        // Move to 2 month 
        let timestampNextDue2 = DateTime.fromMillis(timeOnboarding * 1000).plus({"months": 2}).toSeconds() + 3600 * 24 -1         // 2nd month
        await ethers.provider.send("evm_increaseTime", [timestampNextDue1 - timeOnboarding + 100 ])

        // 10 days later
        await ethers.provider.send("evm_increaseTime", [3600 * 24 * 10 ])

        // Repay half
        await rwAsset.connect(user1).repayMonthly(1, amountRepayMonthly.div(2))

        assetRepayStatusTarget =  {
                                    monthDueRepay:      2,
                                    timestampNextDue:   timestampNextDue2,
                                    amountRepayDue:     150_000_000,
                                    amountDebt:         0,
                                    timestampDebt:      0,
                                    amountPrePay:       0,
                                    amountRepayTaken:   0,
                                    numInvestTaken:     0
                                  }

        assetRepayStatusTarget.amountRepayDue -= amountRepayMonthly.div(2).toNumber()
        expect(await rwAsset.assetRepayStatus(1)).to.deep.eq(Object.values(assetRepayStatusTarget));

        // Repay again
        await rwAsset.connect(user1).repayMonthly(1, amountRepayMonthly.div(4))       // amountRepayMonthly.div(4) unpaid
        assetRepayStatusTarget.amountRepayDue -= amountRepayMonthly.div(4).toNumber()
        expect(await rwAsset.assetRepayStatus(1)).to.deep.eq(Object.values(assetRepayStatusTarget));

        ////////////// 3rd Month //////////////////                    
        // Set timestampNextDue to be same day in next month 
        let timestampNextDue3 = DateTime.fromMillis(timeOnboarding * 1000).plus({"months": 3}).toSeconds() + 3600 * 24 -1         // 3rd month

        // Move to 3rd month 
        lastBlock = await ethers.provider.getBlock('latest')
        await ethers.provider.send("evm_increaseTime", [timestampNextDue2 - lastBlock.timestamp + 100 ])
        await ethers.provider.send("evm_increaseTime", [3600 * 24 * 10 ])       // Skip 10 days

        // Repay not cover debt
        await rwAsset.connect(user1).repayMonthly(1, amountRepayMonthly.div(6))

        lastBlock = await ethers.provider.getBlock('latest')

        let interestRate = rpow(ratePerSecond, BigNumber.from(lastBlock.timestamp - timestampNextDue2))
        let amountDebtWithInterest = amountRepayMonthly.div(4).mul(interestRate).div(rateBase)  // // amountRepayMonthly.div(4) unpaid last month
        let amountDebtPending = amountDebtWithInterest.sub(amountRepayMonthly.div(6))
        let amountDebtStartTime = lastBlock.timestamp

        assetRepayStatusTarget =  {
          monthDueRepay:      3,
          timestampNextDue:   timestampNextDue3,
          amountRepayDue:     150_000_000,
          amountDebt:         amountDebtPending.toNumber(),
          timestampDebt:      amountDebtStartTime,  
          amountPrePay:       0,
          amountRepayTaken:   0,
          numInvestTaken:     0
        }

        expect(await rwAsset.assetRepayStatus(1)).to.deep.eq(Object.values(assetRepayStatusTarget));

        // Repay all debts
        await ethers.provider.send("evm_increaseTime", [3600 * 24 * 10 ])       // Skip 10 days
        await rwAsset.connect(user1).repayMonthly(1, amountRepayMonthly.div(2))

        lastBlock = await ethers.provider.getBlock('latest')
        interestRate = rpow(ratePerSecond, BigNumber.from(lastBlock.timestamp - amountDebtStartTime))
        amountDebtWithInterest = amountDebtPending.mul(interestRate).div(rateBase)
        let amountRepayLeft = amountRepayMonthly.div(2).sub(amountDebtWithInterest)

        assetRepayStatusTarget.amountRepayDue = amountRepayMonthly.sub(amountRepayLeft).toNumber()
        assetRepayStatusTarget.amountDebt = 0
        assetRepayStatusTarget.timestampDebt = 0
        expect(await rwAsset.assetRepayStatus(1)).to.deep.eq(Object.values(assetRepayStatusTarget));

        // Still some repay due pending
        await rwAsset.connect(user1).repayMonthly(1, amountRepayMonthly.div(3))

        assetRepayStatusTarget.amountRepayDue -= amountRepayMonthly.div(3).toNumber()
        expect(await rwAsset.assetRepayStatus(1)).to.deep.eq(Object.values(assetRepayStatusTarget));

        // Repay all due payment with some amount as pre-pay
        await rwAsset.connect(user1).repayMonthly(1, amountRepayMonthly.div(2))

        assetRepayStatusTarget.amountPrePay = amountRepayMonthly.div(2).sub(assetRepayStatusTarget.amountRepayDue).toNumber()
        assetRepayStatusTarget.amountRepayDue = 0
        expect(await rwAsset.assetRepayStatus(1)).to.deep.eq(Object.values(assetRepayStatusTarget));

        // Repay more as prepay
        await rwAsset.connect(user1).repayMonthly(1, amountRepayMonthly.div(3))

        assetRepayStatusTarget.amountPrePay = amountRepayMonthly.div(3).add(assetRepayStatusTarget.amountPrePay).toNumber()
        expect(await rwAsset.assetRepayStatus(1)).to.deep.eq(Object.values(assetRepayStatusTarget));

        ////////////// 4th Month //////////////////                    
        // Set timestampNextDue to be same day in next month 
        let timestampNextDue4 = DateTime.fromMillis(timeOnboarding * 1000).plus({"months": 4}).toSeconds() + 3600 * 24 -1         // 3rd month

        // Move to 4th month 
        lastBlock = await ethers.provider.getBlock('latest')
        await ethers.provider.send("evm_increaseTime", [timestampNextDue3 - lastBlock.timestamp + 100 ])
        await ethers.provider.send("evm_increaseTime", [3600 * 24 * 10 ])       // Skip 10 days

        // Repay not cover debt
        await rwAsset.connect(user1).repayMonthly(1, amountRepayMonthly.div(2))
        let amountPrePay = amountRepayMonthly.div(2).add(assetRepayStatusTarget.amountPrePay).sub(amountRepayMonthly)

        assetRepayStatusTarget =  {
          monthDueRepay:      4,
          timestampNextDue:   timestampNextDue4,
          amountRepayDue:     0,
          amountDebt:         0,
          timestampDebt:      0,  
          amountPrePay:       amountPrePay.toNumber(),
          amountRepayTaken:   0,
          numInvestTaken:     0
        }

        expect(await rwAsset.assetRepayStatus(1)).to.deep.eq(Object.values(assetRepayStatusTarget));
      })

      it("RWAsset Test: rpow", async function () {

        let rate = BigNumber.from("1000000593415115246806684338")
        let seconds = BigNumber.from(3600 *24)
        let base27 = BigNumber.from("10").pow(27)

        let result = await rwAsset.rpow(rate, seconds)
        let resultA = rpow(rate, seconds)

        //console.log("QQQQQQQQQQ", rate.toString(), result.toString(), resultA.toString())
        expect(result).to.deep.eq(resultA)
        
        //        rate = BigNumber.from("79228209529453526788445080146")
        //        let base96 = BigNumber.from("2").pow(96)
        //        result = await rwAsset.rpow(rate, seconds, base96)
        //        console.log("PPPPPPPPPPPPPPPPPPP", rate.toString(), result.toString(), result.mul(base27).div(base96).toString())

        // Yearly 20% : 1000000006341958396752917301    //
        rate = BigNumber.from("20").mul(base27).div(100).div(3600 *24 *365).add(base27)
        result = await rwAsset.rpow(rate, 3600 * 24 * 365)
        resultA = rpow(rate, BigNumber.from(3600 * 24 * 365))
        expect(result).to.deep.eq(resultA)

        // console.log("PPPPPPPPPPPPPPPPPPP", rate.toString(), result.toString(), resultA.toString())

      })

  })
})