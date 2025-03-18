import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import { loadFixture, mine } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";

import { ethers, network, upgrades } from "hardhat";

import { constants, BigNumber, } from 'ethers'
import { expandTo18Decimals, getPlantUnstakingDigest, getPlantStakingDigest, randomAddresses } from "../utils/utilities"
import { ecsign } from 'ethereumjs-util'
import { ArkreenToken, MinerStaking } from "../../typechain";

describe("MinerStaking test", ()=> {

    let deployer: SignerWithAddress
    let manager:  SignerWithAddress
    let user1:  SignerWithAddress
    let user2: SignerWithAddress
    let user3: SignerWithAddress

    let arkreenToken:             ArkreenToken
    let minerStaking:             MinerStaking
    let privateKeyManager:        string

    let allStakeAmount    = BigNumber.from(0)
    let allRewardAmount    = BigNumber.from(0)

    async function deployFixture() {
        const [deployer, manager, user1, user2, user3] = await ethers.getSigners();

        const ArkreenTokenFactory = await ethers.getContractFactory("ArkreenToken")
        const arkreenToken: ArkreenToken = await upgrades.deployProxy(
                                ArkreenTokenFactory, [10000000000, deployer.address, '', '']) as ArkreenToken
  
        await arkreenToken.deployed()

        const minerStakingFactory = await ethers.getContractFactory("MinerStaking")
        const minerStaking = await upgrades.deployProxy(minerStakingFactory,
                                            [arkreenToken.address, deployer.address, manager.address]) as MinerStaking
        await minerStaking.deployed()

        await arkreenToken.transfer(user1.address, expandTo18Decimals(100000000))
        await arkreenToken.transfer(user2.address, expandTo18Decimals(200000000))
        await arkreenToken.transfer(user3.address, expandTo18Decimals(500000000))
     
        return {arkreenToken, minerStaking, deployer, manager, user1, user2, user3}
    }

    describe('MinerStaking test', () => {
      beforeEach(async () => {
        const fixture = await loadFixture(deployFixture)
        privateKeyManager = process.env.MANAGER_TEST_PRIVATE_KEY as string

        arkreenToken = fixture.arkreenToken
        minerStaking = fixture.minerStaking
        
        deployer = fixture.deployer
        manager = fixture.manager
        user1 = fixture.user1
        user2 = fixture.user2
        user3 = fixture.user3

        await arkreenToken.connect(user1).approve(minerStaking.address, constants.MaxUint256)
        await arkreenToken.connect(user2).approve(minerStaking.address, constants.MaxUint256)
        await arkreenToken.connect(user3).approve(minerStaking.address, constants.MaxUint256)

        allStakeAmount    = BigNumber.from(0)
        allRewardAmount   = BigNumber.from(0)
      })

      it("MinerStaking Test: Deposit", async function () {
        // Normal
        const cspminer = randomAddresses(10)

        const amount1 = expandTo18Decimals(100)
        for (let index = 1; index <= 3; index++) {
          await minerStaking.connect(user1).deposit(cspminer[index], amount1.mul(index))
        }
        for (let index = 1; index <= 3; index++) {
          await minerStaking.connect(user1).deposit(cspminer[index], amount1.mul(index))
        }

        const amount2 = expandTo18Decimals(200)
        for (let index = 1; index <= 4; index++) {
          await minerStaking.connect(user2).deposit(cspminer[index], amount2.mul(index))
        }
        for (let index = 1; index <= 4; index++) {
          await minerStaking.connect(user2).deposit(cspminer[index], amount2.mul(index))
        }

        const amount3 = expandTo18Decimals(300)
        for (let index = 1; index <= 5; index++) {
          await minerStaking.connect(user3).deposit(cspminer[index], amount3.mul(index))
        }
        for (let index = 1; index <= 5; index++) {
          await minerStaking.connect(user3).deposit(cspminer[index], amount3.mul(index))
        }

        //////// Check /////////////////////
        const userStakeMiners1 = await minerStaking.getUserStakeMiners(user1.address)
        expect(userStakeMiners1).to.deep.eq([cspminer[1], cspminer[2], cspminer[3]])

        const userStakeMiners2 = await minerStaking.getUserStakeMiners(user2.address)
        expect(userStakeMiners2).to.deep.eq([cspminer[1], cspminer[2], cspminer[3], cspminer[4]])

        const userStakeMiners3 = await minerStaking.getUserStakeMiners(user3.address)
        expect(userStakeMiners3).to.deep.eq([cspminer[1], cspminer[2], cspminer[3], cspminer[4], cspminer[5]])

        const allUserStakeInfo1 = await minerStaking.allUserStakeInfo(user1.address)
        expect(allUserStakeInfo1.timesStake).to.eq(3*2)
        expect(allUserStakeInfo1.amountStake).to.eq(expandTo18Decimals(100+200+300).mul(2))

        const allUserStakeInfo2 = await minerStaking.allUserStakeInfo(user2.address)
        expect(allUserStakeInfo2.timesStake).to.eq(4*2)
        expect(allUserStakeInfo2.amountStake).to.eq(expandTo18Decimals(200+400+600+800).mul(2))

        const allUserStakeInfo3 = await minerStaking.allUserStakeInfo(user3.address)
        expect(allUserStakeInfo3.timesStake).to.eq(5*2)
        expect(allUserStakeInfo3.amountStake).to.eq(expandTo18Decimals(300+600+900+1200+1500).mul(2))

        for (let index = 1; index <= 3; index++) {
          const userStakeInfo = await minerStaking.userStakeInfo(user1.address, cspminer[index])
          expect(userStakeInfo.timesStake).to.eq(2)
          expect(userStakeInfo.amountStake).to.eq(expandTo18Decimals(100).mul(index).mul(2))
        }

        for (let index = 1; index <= 4; index++) {
          const userStakeInfo = await minerStaking.userStakeInfo(user2.address, cspminer[index])
          expect(userStakeInfo.timesStake).to.eq(2)
          expect(userStakeInfo.amountStake).to.eq(expandTo18Decimals(200).mul(index).mul(2))
        }

        for (let index = 1; index <= 5; index++) {
          const userStakeInfo = await minerStaking.userStakeInfo(user3.address, cspminer[index])
          expect(userStakeInfo.timesStake).to.eq(2)
          expect(userStakeInfo.amountStake).to.eq(expandTo18Decimals(300).mul(index).mul(2))
        }

        const minerStakers1 = await minerStaking.getMinerStakers(cspminer[1])
        expect(minerStakers1).to.deep.eq([user1.address, user2.address, user3.address])

        const minerStakers2 = await minerStaking.getMinerStakers(cspminer[2])
        expect(minerStakers2).to.deep.eq([user1.address, user2.address, user3.address])

        const minerStakers3 = await minerStaking.getMinerStakers(cspminer[3])
        expect(minerStakers3).to.deep.eq([user1.address, user2.address, user3.address])

        const minerStakers4 = await minerStaking.getMinerStakers(cspminer[4])
        expect(minerStakers4).to.deep.eq([user2.address, user3.address])

        const minerStakers5 = await minerStaking.getMinerStakers(cspminer[5])
        expect(minerStakers5).to.deep.eq([user3.address])

        const allMinerStakeInfo1 = await minerStaking.allMinerStakeInfo(cspminer[1])
        expect(allMinerStakeInfo1.timesStake).to.eq(2*3)
        expect(allMinerStakeInfo1.amountStake).to.eq(expandTo18Decimals(100+200+300).mul(2))

        const allMinerStakeInfo2 = await minerStaking.allMinerStakeInfo(cspminer[2])
        expect(allMinerStakeInfo2.timesStake).to.eq(2*3)
        expect(allMinerStakeInfo2.amountStake).to.eq(expandTo18Decimals(200+400+600).mul(2))

        const allMinerStakeInfo3 = await minerStaking.allMinerStakeInfo(cspminer[3])
        expect(allMinerStakeInfo3.timesStake).to.eq(2*3)
        expect(allMinerStakeInfo3.amountStake).to.eq(expandTo18Decimals(300+600+900).mul(2))

        const allMinerStakeInfo4 = await minerStaking.allMinerStakeInfo(cspminer[4])
        expect(allMinerStakeInfo4.timesStake).to.eq(2*2)
        expect(allMinerStakeInfo4.amountStake).to.eq(expandTo18Decimals(800+1200).mul(2))

        const allMinerStakeInfo5 = await minerStaking.allMinerStakeInfo(cspminer[5])
        expect(allMinerStakeInfo5.timesStake).to.eq(2*1)
        expect(allMinerStakeInfo5.amountStake).to.eq(expandTo18Decimals(1500).mul(2))

        const totalDeposit = expandTo18Decimals(100+200+300)
                              .add(expandTo18Decimals(200+400+600+800))
                              .add(expandTo18Decimals(300+600+900+1200+1500))
                              .mul(2)

        const totalStakeInfo = await minerStaking.totalStakeInfo()
        expect(totalStakeInfo.timesStake).to.eq((3+4+5)*2)
        expect(totalStakeInfo.amountStake).to.eq(totalDeposit)

        expect(await arkreenToken.balanceOf(minerStaking.address)).to.eq(totalDeposit)

        //// Abnormal test ////////////
        await expect(minerStaking.connect(user1).deposit(cspminer[1], 0))
                .to.be.revertedWith("Zero Stake")


        const balanceBefore = await arkreenToken.balanceOf(user1.address)
        await expect(minerStaking.connect(user1).deposit(cspminer[1], expandTo18Decimals(150)))
                .to.emit(minerStaking, 'Deposit')
                .withArgs(user1.address, cspminer[1], expandTo18Decimals(150))    

        expect(await arkreenToken.balanceOf(user1.address)).to.eq(balanceBefore.sub(expandTo18Decimals(150)))
        
      });

      it("MinerStaking Test: Withdraw", async function () {
        // Normal
        const cspminer = randomAddresses(10)

        const amount1 = expandTo18Decimals(100)
        for (let index = 1; index <= 3; index++) {
          await minerStaking.connect(user1).deposit(cspminer[index], amount1.mul(index))
        }
        for (let index = 1; index <= 3; index++) {
          await minerStaking.connect(user1).deposit(cspminer[index], amount1.mul(index))
        }

        const amount2 = expandTo18Decimals(200)
        for (let index = 1; index <= 4; index++) {
          await minerStaking.connect(user2).deposit(cspminer[index], amount2.mul(index))
        }
        for (let index = 1; index <= 4; index++) {
          await minerStaking.connect(user2).deposit(cspminer[index], amount2.mul(index))
        }

        const amount3 = expandTo18Decimals(300)
        for (let index = 1; index <= 5; index++) {
          await minerStaking.connect(user3).deposit(cspminer[index], amount3.mul(index))
        }
        for (let index = 1; index <= 5; index++) {
          await minerStaking.connect(user3).deposit(cspminer[index], amount3.mul(index))
        }

        //////// Withdraw ////////////////////////
        const amountWithdraw1 = expandTo18Decimals(100)
        for (let index = 1; index <= 3; index++) {
          await minerStaking.connect(user1).withdraw(cspminer[index], amountWithdraw1.mul(index))
        }

        const amountWithdraw2 = expandTo18Decimals(200)
        for (let index = 1; index <= 4; index++) {
          await minerStaking.connect(user2).withdraw(cspminer[index], amountWithdraw2.mul(index))
        }

        const amountWithdraw3 = expandTo18Decimals(300)
        for (let index = 1; index <= 5; index++) {
          await minerStaking.connect(user3).withdraw(cspminer[index], amountWithdraw3.mul(index))
        }

        /////////// Withdraw Check ////////////////
        const userStakeMiners1 = await minerStaking.getUserStakeMiners(user1.address)
        expect(userStakeMiners1).to.deep.eq([cspminer[1], cspminer[2], cspminer[3]])

        const userStakeMiners2 = await minerStaking.getUserStakeMiners(user2.address)
        expect(userStakeMiners2).to.deep.eq([cspminer[1], cspminer[2], cspminer[3], cspminer[4]])

        const userStakeMiners3 = await minerStaking.getUserStakeMiners(user3.address)
        expect(userStakeMiners3).to.deep.eq([cspminer[1], cspminer[2], cspminer[3], cspminer[4], cspminer[5]])

        const allUserStakeInfo1 = await minerStaking.allUserStakeInfo(user1.address)
        expect(allUserStakeInfo1.timesStake).to.eq(3*2)
        expect(allUserStakeInfo1.timesUnstake).to.eq(3)
        expect(allUserStakeInfo1.amountStake).to.eq(expandTo18Decimals(100+200+300))

        const allUserStakeInfo2 = await minerStaking.allUserStakeInfo(user2.address)
        expect(allUserStakeInfo2.timesStake).to.eq(4*2)
        expect(allUserStakeInfo2.timesUnstake).to.eq(4)
        expect(allUserStakeInfo2.amountStake).to.eq(expandTo18Decimals(200+400+600+800))

        const allUserStakeInfo3 = await minerStaking.allUserStakeInfo(user3.address)
        expect(allUserStakeInfo3.timesStake).to.eq(5*2)
        expect(allUserStakeInfo3.timesUnstake).to.eq(5)
        expect(allUserStakeInfo3.amountStake).to.eq(expandTo18Decimals(300+600+900+1200+1500))

        for (let index = 1; index <= 3; index++) {
          const userStakeInfo = await minerStaking.userStakeInfo(user1.address, cspminer[index])
          expect(userStakeInfo.timesStake).to.eq(2)
          expect(userStakeInfo.timesUnstake).to.eq(1)
          expect(userStakeInfo.amountStake).to.eq(expandTo18Decimals(100).mul(index))
        }

        for (let index = 1; index <= 4; index++) {
          const userStakeInfo = await minerStaking.userStakeInfo(user2.address, cspminer[index])
          expect(userStakeInfo.timesStake).to.eq(2)
          expect(userStakeInfo.timesUnstake).to.eq(1)
          expect(userStakeInfo.amountStake).to.eq(expandTo18Decimals(200).mul(index))
        }

        for (let index = 1; index <= 5; index++) {
          const userStakeInfo = await minerStaking.userStakeInfo(user3.address, cspminer[index])
          expect(userStakeInfo.timesStake).to.eq(2)
          expect(userStakeInfo.timesUnstake).to.eq(1)
          expect(userStakeInfo.amountStake).to.eq(expandTo18Decimals(300).mul(index))
        }

        const minerStakers1 = await minerStaking.getMinerStakers(cspminer[1])
        expect(minerStakers1).to.deep.eq([user1.address, user2.address, user3.address])

        const minerStakers2 = await minerStaking.getMinerStakers(cspminer[2])
        expect(minerStakers2).to.deep.eq([user1.address, user2.address, user3.address])

        const minerStakers3 = await minerStaking.getMinerStakers(cspminer[3])
        expect(minerStakers3).to.deep.eq([user1.address, user2.address, user3.address])

        const minerStakers4 = await minerStaking.getMinerStakers(cspminer[4])
        expect(minerStakers4).to.deep.eq([user2.address, user3.address])

        const minerStakers5 = await minerStaking.getMinerStakers(cspminer[5])
        expect(minerStakers5).to.deep.eq([user3.address])

        const allMinerStakeInfo1 = await minerStaking.allMinerStakeInfo(cspminer[1])
        expect(allMinerStakeInfo1.timesStake).to.eq(2*3)
        expect(allMinerStakeInfo1.timesUnstake).to.eq(1*3)
        expect(allMinerStakeInfo1.amountStake).to.eq(expandTo18Decimals(100+200+300))

        const allMinerStakeInfo2 = await minerStaking.allMinerStakeInfo(cspminer[2])
        expect(allMinerStakeInfo2.timesStake).to.eq(2*3)
        expect(allMinerStakeInfo2.timesUnstake).to.eq(1*3)
        expect(allMinerStakeInfo2.amountStake).to.eq(expandTo18Decimals(200+400+600))

        const allMinerStakeInfo3 = await minerStaking.allMinerStakeInfo(cspminer[3])
        expect(allMinerStakeInfo3.timesStake).to.eq(2*3)
        expect(allMinerStakeInfo3.timesUnstake).to.eq(1*3)
        expect(allMinerStakeInfo3.amountStake).to.eq(expandTo18Decimals(300+600+900))

        const allMinerStakeInfo4 = await minerStaking.allMinerStakeInfo(cspminer[4])
        expect(allMinerStakeInfo4.timesStake).to.eq(2*2)
        expect(allMinerStakeInfo4.timesUnstake).to.eq(1*2)
        expect(allMinerStakeInfo4.amountStake).to.eq(expandTo18Decimals(800+1200))

        const allMinerStakeInfo5 = await minerStaking.allMinerStakeInfo(cspminer[5])
        expect(allMinerStakeInfo5.timesStake).to.eq(2*1)
        expect(allMinerStakeInfo5.timesUnstake).to.eq(1*1)
        expect(allMinerStakeInfo5.amountStake).to.eq(expandTo18Decimals(1500))

        const totalDeposit = expandTo18Decimals(100+200+300)
                              .add(expandTo18Decimals(200+400+600+800))
                              .add(expandTo18Decimals(300+600+900+1200+1500))

        const totalStakeInfo = await minerStaking.totalStakeInfo()
        expect(totalStakeInfo.timesStake).to.eq((3+4+5)*2)
        expect(totalStakeInfo.timesUnstake).to.eq((3+4+5))
        expect(totalStakeInfo.amountStake).to.eq(totalDeposit)

        expect(await arkreenToken.balanceOf(minerStaking.address)).to.eq(totalDeposit)

        //// Abnormal test ////////////
        await expect(minerStaking.connect(user1).withdraw(cspminer[1], 0))
                .to.be.revertedWith("Zero Stake")

        // Check overflow                
        // Panic code 0x11 (Arithmetic operation underflowed or overflowed outside of an unchecked block)
        await expect(minerStaking.connect(user1).withdraw(cspminer[1], expandTo18Decimals(150)))
                .to.be.reverted

        const balanceBefore = await arkreenToken.balanceOf(user1.address)
        await expect(minerStaking.connect(user1).withdraw(cspminer[1], expandTo18Decimals(50)))
                .to.emit(minerStaking, 'Withdraw')
                .withArgs(user1.address, cspminer[1], expandTo18Decimals(50))    

        expect(await arkreenToken.balanceOf(user1.address)).to.eq(balanceBefore.add(expandTo18Decimals(50)))

      });

      
      it("MinerStaking Test: Slash", async function () {
        // Normal
        const cspminer = randomAddresses(10)

        const amount1 = expandTo18Decimals(100)
        for (let index = 1; index <= 3; index++) {
          await minerStaking.connect(user1).deposit(cspminer[index], amount1.mul(index))
        }
        for (let index = 1; index <= 3; index++) {
          await minerStaking.connect(user1).deposit(cspminer[index], amount1.mul(index))
        }

        const amount2 = expandTo18Decimals(200)
        for (let index = 1; index <= 4; index++) {
          await minerStaking.connect(user2).deposit(cspminer[index], amount2.mul(index))
        }
        for (let index = 1; index <= 4; index++) {
          await minerStaking.connect(user2).deposit(cspminer[index], amount2.mul(index))
        }

        const amount3 = expandTo18Decimals(300)
        for (let index = 1; index <= 5; index++) {
          await minerStaking.connect(user3).deposit(cspminer[index], amount3.mul(index))
        }
        for (let index = 1; index <= 5; index++) {
          await minerStaking.connect(user3).deposit(cspminer[index], amount3.mul(index))
        }

        //////// Slash ////////////////////////
        const amountWithdraw1 = expandTo18Decimals(100)
        for (let index = 1; index <= 3; index++) {
          await minerStaking.slash(cspminer[0], cspminer[index], user1.address, amountWithdraw1.mul(index), constants.MaxUint256)
        }

        const amountWithdraw2 = expandTo18Decimals(200)
        for (let index = 1; index <= 4; index++) {
          await minerStaking.slash(cspminer[0], cspminer[index], user2.address, amountWithdraw2.mul(index), constants.MaxUint256)
        }

        const amountWithdraw3 = expandTo18Decimals(300)
        for (let index = 1; index <= 5; index++) {
          await minerStaking.slash(cspminer[0], cspminer[index], user3.address, amountWithdraw3.mul(index), constants.MaxUint256)
        }

        /////////// Slash Check ////////////////
        const userStakeMiners1 = await minerStaking.getUserStakeMiners(user1.address)
        expect(userStakeMiners1).to.deep.eq([cspminer[1], cspminer[2], cspminer[3]])

        const userStakeMiners2 = await minerStaking.getUserStakeMiners(user2.address)
        expect(userStakeMiners2).to.deep.eq([cspminer[1], cspminer[2], cspminer[3], cspminer[4]])

        const userStakeMiners3 = await minerStaking.getUserStakeMiners(user3.address)
        expect(userStakeMiners3).to.deep.eq([cspminer[1], cspminer[2], cspminer[3], cspminer[4], cspminer[5]])

        const allUserStakeInfo1 = await minerStaking.allUserStakeInfo(user1.address)
        expect(allUserStakeInfo1.timesStake).to.eq(3*2)
        expect(allUserStakeInfo1.timesSlash).to.eq(3)
        expect(allUserStakeInfo1.amountStake).to.eq(expandTo18Decimals(100+200+300))
        expect(allUserStakeInfo1.amountSlash).to.eq(expandTo18Decimals(100+200+300))

        const allUserStakeInfo2 = await minerStaking.allUserStakeInfo(user2.address)
        expect(allUserStakeInfo2.timesStake).to.eq(4*2)
        expect(allUserStakeInfo2.timesSlash).to.eq(4)
        expect(allUserStakeInfo2.amountStake).to.eq(expandTo18Decimals(200+400+600+800))
        expect(allUserStakeInfo2.amountSlash).to.eq(expandTo18Decimals(200+400+600+800))

        const allUserStakeInfo3 = await minerStaking.allUserStakeInfo(user3.address)
        expect(allUserStakeInfo3.timesStake).to.eq(5*2)
        expect(allUserStakeInfo3.timesSlash).to.eq(5)
        expect(allUserStakeInfo3.amountStake).to.eq(expandTo18Decimals(300+600+900+1200+1500))
        expect(allUserStakeInfo3.amountSlash).to.eq(expandTo18Decimals(300+600+900+1200+1500))

        for (let index = 1; index <= 3; index++) {
          const userStakeInfo = await minerStaking.userStakeInfo(user1.address, cspminer[index])
          expect(userStakeInfo.timesStake).to.eq(2)
          expect(userStakeInfo.timesSlash).to.eq(1)
          expect(userStakeInfo.amountStake).to.eq(expandTo18Decimals(100).mul(index))
          expect(userStakeInfo.amountSlash).to.eq(expandTo18Decimals(100).mul(index))
        }

        for (let index = 1; index <= 4; index++) {
          const userStakeInfo = await minerStaking.userStakeInfo(user2.address, cspminer[index])
          expect(userStakeInfo.timesStake).to.eq(2)
          expect(userStakeInfo.timesSlash).to.eq(1)
          expect(userStakeInfo.amountStake).to.eq(expandTo18Decimals(200).mul(index))
          expect(userStakeInfo.amountSlash).to.eq(expandTo18Decimals(200).mul(index))
        }

        for (let index = 1; index <= 5; index++) {
          const userStakeInfo = await minerStaking.userStakeInfo(user3.address, cspminer[index])
          expect(userStakeInfo.timesStake).to.eq(2)
          expect(userStakeInfo.timesSlash).to.eq(1)
          expect(userStakeInfo.amountStake).to.eq(expandTo18Decimals(300).mul(index))
          expect(userStakeInfo.amountSlash).to.eq(expandTo18Decimals(300).mul(index))
        }

        const minerStakers1 = await minerStaking.getMinerStakers(cspminer[1])
        expect(minerStakers1).to.deep.eq([user1.address, user2.address, user3.address])

        const minerStakers2 = await minerStaking.getMinerStakers(cspminer[2])
        expect(minerStakers2).to.deep.eq([user1.address, user2.address, user3.address])

        const minerStakers3 = await minerStaking.getMinerStakers(cspminer[3])
        expect(minerStakers3).to.deep.eq([user1.address, user2.address, user3.address])

        const minerStakers4 = await minerStaking.getMinerStakers(cspminer[4])
        expect(minerStakers4).to.deep.eq([user2.address, user3.address])

        const minerStakers5 = await minerStaking.getMinerStakers(cspminer[5])
        expect(minerStakers5).to.deep.eq([user3.address])

        const allMinerStakeInfo1 = await minerStaking.allMinerStakeInfo(cspminer[1])
        expect(allMinerStakeInfo1.timesStake).to.eq(2*3)
        expect(allMinerStakeInfo1.timesSlash).to.eq(1*3)
        expect(allMinerStakeInfo1.amountStake).to.eq(expandTo18Decimals(100+200+300))
        expect(allMinerStakeInfo1.amountSlash).to.eq(expandTo18Decimals(100+200+300))

        const allMinerStakeInfo2 = await minerStaking.allMinerStakeInfo(cspminer[2])
        expect(allMinerStakeInfo2.timesStake).to.eq(2*3)
        expect(allMinerStakeInfo2.timesSlash).to.eq(1*3)
        expect(allMinerStakeInfo2.amountStake).to.eq(expandTo18Decimals(200+400+600))
        expect(allMinerStakeInfo2.amountSlash).to.eq(expandTo18Decimals(200+400+600))

        const allMinerStakeInfo3 = await minerStaking.allMinerStakeInfo(cspminer[3])
        expect(allMinerStakeInfo3.timesStake).to.eq(2*3)
        expect(allMinerStakeInfo3.timesSlash).to.eq(1*3)
        expect(allMinerStakeInfo3.amountStake).to.eq(expandTo18Decimals(300+600+900))
        expect(allMinerStakeInfo3.amountSlash).to.eq(expandTo18Decimals(300+600+900))

        const allMinerStakeInfo4 = await minerStaking.allMinerStakeInfo(cspminer[4])
        expect(allMinerStakeInfo4.timesStake).to.eq(2*2)
        expect(allMinerStakeInfo4.timesSlash).to.eq(1*2)
        expect(allMinerStakeInfo4.amountStake).to.eq(expandTo18Decimals(800+1200))
        expect(allMinerStakeInfo4.amountSlash).to.eq(expandTo18Decimals(800+1200))

        const allMinerStakeInfo5 = await minerStaking.allMinerStakeInfo(cspminer[5])
        expect(allMinerStakeInfo5.timesStake).to.eq(2*1)
        expect(allMinerStakeInfo5.timesSlash).to.eq(1*1)
        expect(allMinerStakeInfo5.amountStake).to.eq(expandTo18Decimals(1500))
        expect(allMinerStakeInfo5.amountSlash).to.eq(expandTo18Decimals(1500))

        const totalDeposit = expandTo18Decimals(100+200+300)
                              .add(expandTo18Decimals(200+400+600+800))
                              .add(expandTo18Decimals(300+600+900+1200+1500))

        const totalStakeInfo = await minerStaking.totalStakeInfo()
        expect(totalStakeInfo.timesStake).to.eq((3+4+5)*2)
        expect(totalStakeInfo.timesSlash).to.eq((3+4+5))
        expect(totalStakeInfo.amountStake).to.eq(totalDeposit)
        expect(totalStakeInfo.amountSlash).to.eq(totalDeposit)

        expect(await arkreenToken.balanceOf(minerStaking.address)).to.eq(totalDeposit)
        expect(await arkreenToken.balanceOf(manager.address)).to.eq(totalDeposit)

        //// Abnormal test ////////////
        await expect(minerStaking.connect(user1).withdraw(cspminer[1], 0))
                .to.be.revertedWith("Zero Stake")

        const balanceBefore = await arkreenToken.balanceOf(manager.address)
        await expect(minerStaking.slash(cspminer[0], cspminer[1], user1.address, expandTo18Decimals(50), constants.MaxUint256))
                .to.emit(minerStaking, 'Slash')
                .withArgs(cspminer[0], cspminer[1], user1.address, expandTo18Decimals(50), expandTo18Decimals(50))    

        expect(await arkreenToken.balanceOf(manager.address)).to.eq(balanceBefore.add(expandTo18Decimals(50)))

        // All stake are slashed
        await expect(minerStaking.slash(cspminer[0], cspminer[1], user1.address, expandTo18Decimals(150), constants.MaxUint256))
                .to.emit(minerStaking, 'Slash')
                .withArgs(cspminer[0], cspminer[1], user1.address, expandTo18Decimals(150), expandTo18Decimals(50))    

        expect(await arkreenToken.balanceOf(manager.address)).to.eq(balanceBefore.add(expandTo18Decimals(50+50)))

        const allUserStakeInfo = await minerStaking.allUserStakeInfo(user1.address)
        expect(allUserStakeInfo.amountStake).to.eq(expandTo18Decimals(100+200+300-50-50))
        expect(allUserStakeInfo.amountSlash).to.eq(expandTo18Decimals(100+200+300+50+50))

        const userStakeInfo = await minerStaking.userStakeInfo(user1.address, cspminer[1])
        expect(userStakeInfo.amountStake).to.eq(expandTo18Decimals(100-50-50))
        expect(userStakeInfo.amountSlash).to.eq(expandTo18Decimals(100+50+50))

        const slashTx = await minerStaking.slash(cspminer[0], cspminer[2], user1.address, expandTo18Decimals(100), constants.MaxUint256)
        const receipt = await slashTx.wait()
        console.log("receipt",  receipt.gasUsed)

      });
    })
})