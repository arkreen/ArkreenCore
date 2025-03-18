import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import { loadFixture, mine } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
//const {ethers, upgrades} =  require("hardhat");

import { ethers, network, upgrades } from "hardhat";
import { Block } from "@ethersproject/abstract-provider";

import { constants, BigNumber, } from 'ethers'
import { getPermitDigest, expandTo18Decimals, expandTo9Decimals, randomAddresses } from "../utils/utilities"

import { ecsign } from 'ethereumjs-util'

import {
    ArkreenToken,
    StakingRewards,
    ArkreenMiner
} from "../../typechain";

const startTime = 60 * 60 * 24                        // start 1 days later
const endTime =  startTime + 60 * 60 * 24 * 60        // 2 month
let amountReward: BigNumber
let rewardRate: BigNumber

interface stakeStatus {
  stakeAmount:          BigNumber,
  lastTimeStamp:        number,
  rewardsPerStakePaid:  BigNumber
  earnStored:           BigNumber
}

const initStatus: stakeStatus = { stakeAmount: BigNumber.from(0), lastTimeStamp: 0, 
                                  rewardsPerStakePaid:BigNumber.from(0), earnStored: BigNumber.from(0) } 

describe("StakingRewards test", ()=> {

    let deployer: SignerWithAddress
    let user1:  SignerWithAddress
    let user2: SignerWithAddress
    let user3: SignerWithAddress

    let lastBlockN:   Block
    let startTimestamp = 0 
    let endTimestamp = 0
    let lastUpdateTime = 0 

    let arkreenToken:             ArkreenToken
    let artToken:                 ArkreenToken
    let stakingRewards:           StakingRewards
    let arkreenMiner:             ArkreenMiner

    let allStakeAmount    = BigNumber.from(0)
    let lastRewardsPerStakePaid = BigNumber.from(0)

    let user1StakeStatus: stakeStatus = {...initStatus}
    let user2StakeStatus: stakeStatus = {...initStatus}
    let user3StakeStatus: stakeStatus = {...initStatus}

    async function deployFixture() {
        const [deployer, user1, user2, user3] = await ethers.getSigners();

        const ArkreenTokenFactory = await ethers.getContractFactory("ArkreenToken")
        const arkreenToken: ArkreenToken = await upgrades.deployProxy(
                                ArkreenTokenFactory, [10000000000, deployer.address, '', '']) as ArkreenToken
  
        await arkreenToken.deployed()

        const artToken: ArkreenToken = await upgrades.deployProxy(
                                ArkreenTokenFactory, [10000000000, deployer.address, 'ART Token', 'ART']) as ArkreenToken

        await artToken.deployed()

        const ArkreenMinerProFactory = await ethers.getContractFactory("ArkreenMinerPro")
        const ArkreenMinerPro = await ArkreenMinerProFactory.deploy()

        const ArkreenMinerFactory = await ethers.getContractFactory("ArkreenMiner")
        arkreenMiner = await upgrades.deployProxy(ArkreenMinerFactory, 
                                [arkreenToken.address, user3.address, user1.address, user2.address]) as ArkreenMiner
        await arkreenMiner.deployed()

        await arkreenMiner.setArkreenMinerPro(ArkreenMinerPro.address);

        const miners = randomAddresses(3)
        await arkreenMiner.connect(user1).RemoteMinerOnboardInBatch([user1.address, user2.address, user3.address] , miners)

        const stakingRewardsFactory = await ethers.getContractFactory("StakingRewards")
        const stakingRewards = await upgrades.deployProxy(stakingRewardsFactory, 
                                        [arkreenToken.address, artToken.address, arkreenMiner.address, deployer.address]) as StakingRewards

        await stakingRewards.deployed()
        await stakingRewards.setStakeParameter(expandTo18Decimals(10000) , 100)

        await arkreenMiner.registerListenApps(1 , stakingRewards.address)

        await artToken.approve(stakingRewards.address, constants.MaxUint256)

        await arkreenToken.transfer(user1.address, expandTo18Decimals(100000000))
        await arkreenToken.transfer(user2.address, expandTo18Decimals(200000000))
        await arkreenToken.transfer(user3.address, expandTo18Decimals(500000000))
   
  
        return {arkreenToken, artToken, stakingRewards, arkreenMiner, deployer, user1, user2, user3}
    }

    function getLastRewardsPerStake() {
      const lastTimeRewardApplicable = lastBlockN.timestamp < endTimestamp ? lastBlockN.timestamp : endTimestamp
      const lastUpdateTimeForReward = lastUpdateTime < startTimestamp ? startTimestamp : lastUpdateTime

      const rewardsPerStakeIncrease = startTimestamp == 0  || 
                                      lastBlockN.timestamp <= startTimestamp || 
                                      allStakeAmount.eq(0) ||
                                      lastTimeRewardApplicable <= lastUpdateTimeForReward
                                      ? BigNumber.from(0)
                                      : rewardRate.mul(lastTimeRewardApplicable-lastUpdateTimeForReward).div(allStakeAmount)

      return lastRewardsPerStakePaid.add(rewardsPerStakeIncrease)
    }                                    

    async function updatStakeStatus() {
      lastBlockN = await ethers.provider.getBlock('latest')
       lastRewardsPerStakePaid = getLastRewardsPerStake()
      lastUpdateTime = lastBlockN.timestamp
    }

    async function user1Stake(amount: BigNumber) {
      await stakingRewards.connect(user1).stake(amount)
      lastBlockN = await ethers.provider.getBlock('latest')

      lastRewardsPerStakePaid = getLastRewardsPerStake()
      const newRewards = user1StakeStatus.stakeAmount.mul(lastRewardsPerStakePaid.sub(user1StakeStatus.rewardsPerStakePaid))

      allStakeAmount = allStakeAmount.add(amount)
      user1StakeStatus.stakeAmount = user1StakeStatus.stakeAmount.add(amount)
      user1StakeStatus.lastTimeStamp = lastBlockN.timestamp
      user1StakeStatus.rewardsPerStakePaid = lastRewardsPerStakePaid
      user1StakeStatus.earnStored = user1StakeStatus.earnStored.add(newRewards.div(expandTo18Decimals(1)).div(expandTo18Decimals(1)))

      lastUpdateTime = lastBlockN.timestamp
    }

    async function user1StakeWithPermit(amount: BigNumber) {

      const nonces = await arkreenToken.nonces(user1.address)
      const domainName = await arkreenToken.name()
      const user1_key = "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d"

      const digest = getPermitDigest(user1.address, stakingRewards.address, amount, nonces,
                                      constants.MaxUint256, arkreenToken.address, domainName)

      const {v,r,s} = ecsign(Buffer.from(digest.slice(2), 'hex'), Buffer.from(user1_key.slice(2), 'hex'))

      await stakingRewards.connect(user1).stakeWithPermit(amount, constants.MaxUint256, v, r, s)
      lastBlockN = await ethers.provider.getBlock('latest')

      lastRewardsPerStakePaid = getLastRewardsPerStake()
      const newRewards = user1StakeStatus.stakeAmount.mul(lastRewardsPerStakePaid.sub(user1StakeStatus.rewardsPerStakePaid))

      allStakeAmount = allStakeAmount.add(amount)
      user1StakeStatus.stakeAmount = user1StakeStatus.stakeAmount.add(amount)
      user1StakeStatus.lastTimeStamp = lastBlockN.timestamp
      user1StakeStatus.rewardsPerStakePaid = lastRewardsPerStakePaid
      user1StakeStatus.earnStored = user1StakeStatus.earnStored.add(newRewards.div(expandTo18Decimals(1)).div(expandTo18Decimals(1)))

      lastUpdateTime = lastBlockN.timestamp

    }

    async function user2Stake(amount: BigNumber) {
      await stakingRewards.connect(user2).stake(amount)
      lastBlockN = await ethers.provider.getBlock('latest')

      lastRewardsPerStakePaid = getLastRewardsPerStake()
      const newRewards = user2StakeStatus.stakeAmount.mul(lastRewardsPerStakePaid.sub(user2StakeStatus.rewardsPerStakePaid))

      allStakeAmount = allStakeAmount.add(amount)
      user2StakeStatus.stakeAmount = user2StakeStatus.stakeAmount.add(amount)
      user2StakeStatus.lastTimeStamp = lastBlockN.timestamp
      user2StakeStatus.rewardsPerStakePaid = lastRewardsPerStakePaid
      user2StakeStatus.earnStored = user2StakeStatus.earnStored.add(newRewards.div(expandTo18Decimals(1)).div(expandTo18Decimals(1)))

      lastUpdateTime = lastBlockN.timestamp
    }

    async function user3Stake(amount: BigNumber) {
      await stakingRewards.connect(user3).stake(amount)
      lastBlockN = await ethers.provider.getBlock('latest')

      lastRewardsPerStakePaid = getLastRewardsPerStake()
      const newRewards = user3StakeStatus.stakeAmount.mul(lastRewardsPerStakePaid.sub(user3StakeStatus.rewardsPerStakePaid))

      allStakeAmount = allStakeAmount.add(amount)
      user3StakeStatus.stakeAmount = user3StakeStatus.stakeAmount.add(amount)
      user3StakeStatus.lastTimeStamp = lastBlockN.timestamp
      user3StakeStatus.rewardsPerStakePaid = lastRewardsPerStakePaid
      user3StakeStatus.earnStored = user3StakeStatus.earnStored.add(newRewards.div(expandTo18Decimals(1)).div(expandTo18Decimals(1)))

      lastUpdateTime = lastBlockN.timestamp
    }

    async function checkEarnedUser1() {
      lastBlockN = await ethers.provider.getBlock('latest')
      const lastRewardsPerStakePaidTemp = getLastRewardsPerStake()
      const newRewards = user1StakeStatus.stakeAmount
                            .mul(lastRewardsPerStakePaidTemp.sub(user1StakeStatus.rewardsPerStakePaid))
                            .div(expandTo18Decimals(1)).div(expandTo18Decimals(1))

      expect(await stakingRewards.earned(user1.address)).to.eq(user1StakeStatus.earnStored.add(newRewards))
      return user1StakeStatus.earnStored.add(newRewards)
    }

    async function checkEarnedUser2() {
      lastBlockN = await ethers.provider.getBlock('latest')
      const lastRewardsPerStakePaidTemp = getLastRewardsPerStake()

      const newRewards = user2StakeStatus.stakeAmount
                        .mul(lastRewardsPerStakePaidTemp.sub(user2StakeStatus.rewardsPerStakePaid))
                        .div(expandTo18Decimals(1)).div(expandTo18Decimals(1))

      expect(await stakingRewards.earned(user2.address)).to.eq(user2StakeStatus.earnStored.add(newRewards))
      return user2StakeStatus.earnStored.add(newRewards)
    }

    async function checkEarnedUser3() {
      lastBlockN = await ethers.provider.getBlock('latest')
      const lastRewardsPerStakePaidTemp = getLastRewardsPerStake()
      const newRewards = user3StakeStatus.stakeAmount
                          .mul(lastRewardsPerStakePaidTemp.sub(user3StakeStatus.rewardsPerStakePaid))
                          .div(expandTo18Decimals(1)).div(expandTo18Decimals(1))

      expect(await stakingRewards.earned(user3.address)).to.eq(user3StakeStatus.earnStored.add(newRewards))
      return user3StakeStatus.earnStored.add(newRewards)
    }

    describe('StakingRewards test', () => {
      beforeEach(async () => {
        const fixture = await loadFixture(deployFixture)
        arkreenToken = fixture.arkreenToken
        artToken = fixture.artToken        
        stakingRewards = fixture.stakingRewards
        arkreenMiner = fixture.arkreenMiner
        
        deployer = fixture.deployer
        user1 = fixture.user1
        user2 = fixture.user2
        user3 = fixture.user3

        await arkreenToken.connect(user1).approve(stakingRewards.address, constants.MaxUint256)
        await arkreenToken.connect(user2).approve(stakingRewards.address, constants.MaxUint256)
        await arkreenToken.connect(user3).approve(stakingRewards.address, constants.MaxUint256)

        user1StakeStatus = {...initStatus}
        user2StakeStatus = {...initStatus}
        user3StakeStatus  = {...initStatus}

        allStakeAmount    = BigNumber.from(0)
        lastRewardsPerStakePaid = BigNumber.from(0)
   
      })

      function APR() {
        //const times = expandTo18Decimals(1).mul(expandTo9Decimals(10))
        const times = expandTo18Decimals(1).mul(expandTo18Decimals(1))  
       
        const ARTAmout = expandTo9Decimals(500) // 400

        //const duration = BigNumber.from(3600 *24 *60)
        const duration = BigNumber.from(1717061400).sub(BigNumber.from(1716802200))

        //const allRewardStakeAmount = expandTo18Decimals(6000 * 10000)

        // rewardPerStake   uint256 :  380320236109359866310152
        //allNormalStakes   uint256 :  3216850123449999983222784
        //allBoostStakes   uint256 :  1765450740389541292991808

        //allStakes   uint256 :  4982300863839541276214592
        //allNormalStakes   uint256 :  3216850123449999983222784
        //allBoostStakes   uint256 :  1765450740389541292991808

        //allStakes   uint256 :  4982300863839541276214592
        //allNormalStakes   uint256 :  3096850123449999983222784
        //allBoostStakes   uint256 :  1885450740389541292991808

        /*
        startTime   uint256 :  1716802200
        endTime   uint256 :  1717061400
        allMiners   uint256 :  1319
        allStakes   uint256 :  11601692078853375393185964
        allNormalStakes   uint256 :  9594100246450000000000000
        allBoostStakes   uint256 :  2007591832403375393185964
        capMinerBoost   uint256 :  6000000000000000000000
        rateBoost   uint256 :  200
        rewardRateSecond   uint256 :  1929012345679012345679012345679012345679012
        rewardPerStake   uint256 :  409752293654193077102188
        */

        const allNormalStakes = BigNumber.from("9594100246450000000000000") 
        const allBoostStakes = BigNumber.from("2007591832403375393185964") 
        const allRewardStakeAmount = allNormalStakes.add(allBoostStakes.mul(2))

        // const allRewardStakeAmount = BigNumber.from("380320236109359866310152")  // 

        //   60200.000000000000000000
        // 4758949.999999999983222784 uint256

        const unitStakeAmount = expandTo18Decimals(1)
        const accuracy = BigNumber.from("1000000")   // xxxxx.yyyy %

        const priceAKRE = BigNumber.from(8000)
        const priceART = BigNumber.from(10 * 1000 * 1000)

        const valueAKRE = allRewardStakeAmount.mul(priceAKRE).div(expandTo18Decimals(1))

        const valueARTOneYear = ARTAmout.mul(priceART).mul(3600 *24 * 365).div(duration.mul(expandTo9Decimals(1)))

        const APR1 = valueARTOneYear.mul(accuracy).div(valueAKRE)

        console.log("APR1: ", allNormalStakes.toString(), allBoostStakes.toString(), allRewardStakeAmount.toString(), APR1.toString()) 

        const rewardRate = ARTAmout.mul(times).div(duration)

        const rewardPerStake = ARTAmout.mul(times)
                                .div(duration.mul(allRewardStakeAmount))

        const rewardOneYear = rewardPerStake.mul(3600 *24 * 365).mul(unitStakeAmount)

        const valueRewardOneYear = rewardOneYear.mul(priceART).div(expandTo9Decimals(1))

        const APR2 = valueRewardOneYear.mul(accuracy)
                        .div(priceAKRE.mul(times))

        const APR3 = rewardPerStake.mul(3600 *24 * 365).mul(expandTo18Decimals(1)).mul(priceART).mul(accuracy)
                              .div(expandTo9Decimals(1).mul(priceAKRE).mul(times))

        const APR4 = ARTAmout.mul(times).mul(3600 *24 * 365).mul(unitStakeAmount).mul(priceART).mul(accuracy)
                                .div(expandTo9Decimals(1).mul(duration).mul(allRewardStakeAmount).mul(priceAKRE).mul(times))

        console.log("APR: ", rewardRate.toString(), rewardPerStake.toString(),
                    rewardOneYear.div(times).toString(), valueRewardOneYear.toString(),
                    APR2.toString(), APR3.toString(), APR4.toString()) 

      }
  
      it("StakingRewards basics", async function () {

        APR()
   
        const lastBlock = await ethers.provider.getBlock('latest')

        startTimestamp = lastBlock.timestamp + startTime
        endTimestamp = lastBlock.timestamp + endTime

        amountReward = expandTo9Decimals(20000)                      // 9408471
        rewardRate = amountReward.mul(expandTo18Decimals(1)).mul(expandTo18Decimals(1)).div(endTime-startTime)

        console.log('QQQQQQQQQQQQ', rewardRate.toString())

        const stake1 = expandTo18Decimals(100000)
        const stake2 = expandTo18Decimals(400000)
        const stake3 = expandTo18Decimals(500000)

        await user1Stake(stake1)
        await user2Stake(stake2)
        await user3Stake(stake3)

        await stakingRewards.depolyRewards(startTimestamp, endTimestamp, amountReward )

        await ethers.provider.send("evm_increaseTime", [startTime + 100]);
        await mine(1)

        // Reward started
        await user1Stake(stake1)
        await user2Stake(stake2)
        await user3Stake(stake3)
        await checkEarnedUser1()
        await checkEarnedUser2()
        await checkEarnedUser3()

        await ethers.provider.send("evm_increaseTime", [60*60*24*40]);
        await mine(1)

        // stake basics
        await expect(stakingRewards.connect(user1).stake(0)).to.be.revertedWith("Cannot stake 0")

        const stakeBefore = await stakingRewards.totalStakes()
        const myStakesBefore = await stakingRewards.myStakes(user1.address)
        const mybalance = await arkreenToken.balanceOf(user1.address)

        await expect(stakingRewards.connect(user1).stake(stake1))
                .to.emit(stakingRewards, "Staked")
                .withArgs(user1.address, stake1);

        expect(await stakingRewards.totalStakes()).to.eq(stakeBefore.add(stake1))  
        expect(await stakingRewards.myStakes(user1.address)).to.eq(myStakesBefore.add(stake1))  
        expect(await arkreenToken.balanceOf(user1.address)).to.eq(mybalance.sub(stake1))  

        let mybalanceReward1 = await artToken.balanceOf(user1.address)
        let earned1 = await stakingRewards.earned(user1.address)

        let mybalanceReward2 = await artToken.balanceOf(user2.address)
        let earned2 = await stakingRewards.earned(user2.address)

        let mybalanceReward3 = await artToken.balanceOf(user3.address)
        let earned3 = await stakingRewards.earned(user3.address)

        // console.log("\r\n AAAAAAAAAAAA", mybalanceReward1.toString(), earned1.toString())

        await stakingRewards.connect(user1).collectReward()
        expect(await artToken.balanceOf(user1.address)).to.gte(mybalanceReward1.add(earned1))
        expect(await artToken.balanceOf(user2.address)).to.gte(mybalanceReward2)
        expect(await artToken.balanceOf(user3.address)).to.gte(mybalanceReward3)
        expect(await stakingRewards.earned(user1.address)).to.eq(0)

        mybalanceReward1 = await artToken.balanceOf(user1.address)
        earned1 = await stakingRewards.earned(user1.address)

        await stakingRewards.connect(user2).collectReward()

        expect(await artToken.balanceOf(user1.address)).to.gte(mybalanceReward1)
        expect(await artToken.balanceOf(user2.address)).to.gte(mybalanceReward2.add(earned2))
        expect(await artToken.balanceOf(user3.address)).to.gte(mybalanceReward3)
        expect(await stakingRewards.earned(user2.address)).to.eq(0)

        mybalanceReward2 = await artToken.balanceOf(user2.address)
        earned2 = await stakingRewards.earned(user2.address)
        await stakingRewards.connect(user3).collectReward()

        expect(await artToken.balanceOf(user1.address)).to.gte(mybalanceReward1)
        expect(await artToken.balanceOf(user2.address)).to.gte(mybalanceReward2)
        expect(await artToken.balanceOf(user3.address)).to.gte(mybalanceReward3.add(earned3))
        expect(await stakingRewards.earned(user3.address)).to.eq(0)

      });

      it("StakingRewards before stake deposit", async function () {
   
        const lastBlock = await ethers.provider.getBlock('latest')

        startTimestamp = lastBlock.timestamp + startTime
        endTimestamp = lastBlock.timestamp + endTime

        amountReward = expandTo9Decimals(20000)                      // 9408471
        rewardRate = amountReward.mul(expandTo18Decimals(1)).mul(expandTo18Decimals(1)).div(endTime-startTime)

        const stake1 = expandTo18Decimals(100000)
        const stake2 = expandTo18Decimals(400000)
        const stake3 = expandTo18Decimals(500000)

        await user1Stake(stake1)
        await user2Stake(stake2)
        await user3Stake(stake3)

        // Staking reward not started
        expect(await stakingRewards.earned(user1.address)).to.equal(BigNumber.from(0))
        expect(await stakingRewards.earned(user2.address)).to.equal(BigNumber.from(0))
        expect(await stakingRewards.earned(user3.address)).to.equal(BigNumber.from(0))

        await stakingRewards.depolyRewards(startTimestamp, endTimestamp, amountReward )

        // Reward deployed, but not started
        await user1Stake(stake1)
        await user2Stake(stake2)
        await user3Stake(stake3)

        await ethers.provider.send("evm_increaseTime", [startTime -100]);
        await mine(1)

        // Reward not started
        expect(await stakingRewards.earned(user1.address)).to.equal(BigNumber.from(0))
        expect(await stakingRewards.earned(user2.address)).to.equal(BigNumber.from(0))
        expect(await stakingRewards.earned(user3.address)).to.equal(BigNumber.from(0))

        await ethers.provider.send("evm_increaseTime", [100]);
        await mine(1)

        // Reward started
        await checkEarnedUser1()
        await checkEarnedUser2()
        await checkEarnedUser3()

        await ethers.provider.send("evm_increaseTime", [60*60*24*10]);
        await mine(1)

        // Stake again
        await user1Stake(stake1)
        const reward1A = await checkEarnedUser1()
        const reward2A = await checkEarnedUser2()
        const reward3A = await checkEarnedUser3()

        await user2Stake(stake2)
        await checkEarnedUser1()
        await checkEarnedUser2()
        await checkEarnedUser3()

        await user3Stake(stake3)
        const reward1B = await checkEarnedUser1()
        const reward2B = await checkEarnedUser2()
        const reward3B = await checkEarnedUser3()

        expect(reward1B).to.gt(reward1A)
        expect(reward2B).to.gt(reward2A)
        expect(reward3B).to.gt(reward3A)

        await ethers.provider.send("evm_increaseTime", [60*60*24*2]);
        await mine(1)

        await user1Stake(stake1)
        const reward1C = await checkEarnedUser1()
        const reward2C = await checkEarnedUser2()
        const reward3C = await checkEarnedUser3()

        await ethers.provider.send("evm_increaseTime", [60*60*24*4]);
        await mine(1)
        await user2Stake(stake2)
        await checkEarnedUser1()
        await checkEarnedUser2()
        await checkEarnedUser3()

        
        await ethers.provider.send("evm_increaseTime", [60*60*24*4]);
        await mine(1)
        await user3Stake(stake3)
        const reward1D = await checkEarnedUser1()
        const reward2D = await checkEarnedUser2()
        const reward3D = await checkEarnedUser3()

        expect(reward1D).to.gt(reward1C)
        expect(reward2D).to.gt(reward2C)
        expect(reward3D).to.gt(reward3C)

        // Period ended
        await ethers.provider.send("evm_increaseTime", [60*60*24*40]);
        await mine(1)

        const reward1E = await checkEarnedUser1()
        const reward2E = await checkEarnedUser2()
        const reward3E = await checkEarnedUser3()

        // Period ended, Reward stopped
        await ethers.provider.send("evm_increaseTime", [60*60*24*5]);
        await mine(1)

        const reward1F = await checkEarnedUser1()
        const reward2F = await checkEarnedUser2()
        const reward3F = await checkEarnedUser3()

        // Check reward stopped
        expect(reward1F).to.eq(reward1E)
        expect(reward2F).to.eq(reward2E)
        expect(reward3F).to.eq(reward3E)
      });

      it("StakingRewards deposit with permit", async function () {
   
        const lastBlock = await ethers.provider.getBlock('latest')

        startTimestamp = lastBlock.timestamp + startTime
        endTimestamp = lastBlock.timestamp + endTime

        amountReward = expandTo9Decimals(20000)                      // 9408471
        rewardRate = amountReward.mul(expandTo18Decimals(1)).mul(expandTo18Decimals(1)).div(endTime-startTime)

        const stake1 = expandTo18Decimals(100000)
        const stake2 = expandTo18Decimals(400000)
        const stake3 = expandTo18Decimals(500000)

        await user1StakeWithPermit(stake1)
        await user2Stake(stake2)
        await user3Stake(stake3)

        // Staking reward not started
        expect(await stakingRewards.earned(user1.address)).to.equal(BigNumber.from(0))
        expect(await stakingRewards.earned(user2.address)).to.equal(BigNumber.from(0))
        expect(await stakingRewards.earned(user3.address)).to.equal(BigNumber.from(0))

        await stakingRewards.depolyRewards(startTimestamp, endTimestamp, amountReward )

        // Reward deployed, but not started
        await user1StakeWithPermit(stake1)
        await user2Stake(stake2)
        await user3Stake(stake3)

        await ethers.provider.send("evm_increaseTime", [startTime -100]);
        await mine(1)

        // Reward not started
        expect(await stakingRewards.earned(user1.address)).to.equal(BigNumber.from(0))
        expect(await stakingRewards.earned(user2.address)).to.equal(BigNumber.from(0))
        expect(await stakingRewards.earned(user3.address)).to.equal(BigNumber.from(0))

        await ethers.provider.send("evm_increaseTime", [100]);
        await mine(1)

        // Reward started
        await checkEarnedUser1()
        await checkEarnedUser2()
        await checkEarnedUser3()

        await ethers.provider.send("evm_increaseTime", [60*60*24*10]);
        await mine(1)

        // Stake again
        await user1StakeWithPermit(stake1)
        const reward1A = await checkEarnedUser1()
        const reward2A = await checkEarnedUser2()
        const reward3A = await checkEarnedUser3()

        await user2Stake(stake2)
        await checkEarnedUser1()
        await checkEarnedUser2()
        await checkEarnedUser3()

        await user3Stake(stake3)
        const reward1B = await checkEarnedUser1()
        const reward2B = await checkEarnedUser2()
        const reward3B = await checkEarnedUser3()

        expect(reward1B).to.gt(reward1A)
        expect(reward2B).to.gt(reward2A)
        expect(reward3B).to.gt(reward3A)

        await ethers.provider.send("evm_increaseTime", [60*60*24*2]);
        await mine(1)

        await user1StakeWithPermit(stake1)
        const reward1C = await checkEarnedUser1()
        const reward2C = await checkEarnedUser2()
        const reward3C = await checkEarnedUser3()

        await ethers.provider.send("evm_increaseTime", [60*60*24*4]);
        await mine(1)
        await user2Stake(stake2)
        await checkEarnedUser1()
        await checkEarnedUser2()
        await checkEarnedUser3()

        
        await ethers.provider.send("evm_increaseTime", [60*60*24*4]);
        await mine(1)
        await user3Stake(stake3)
        const reward1D = await checkEarnedUser1()
        const reward2D = await checkEarnedUser2()
        const reward3D = await checkEarnedUser3()

        expect(reward1D).to.gt(reward1C)
        expect(reward2D).to.gt(reward2C)
        expect(reward3D).to.gt(reward3C)

        // Period ended
        await ethers.provider.send("evm_increaseTime", [60*60*24*40]);
        await mine(1)

        const reward1E = await checkEarnedUser1()
        const reward2E = await checkEarnedUser2()
        const reward3E = await checkEarnedUser3()

        // Period ended, Reward stopped
        await ethers.provider.send("evm_increaseTime", [60*60*24*5]);
        await mine(1)

        const reward1F = await checkEarnedUser1()
        const reward2F = await checkEarnedUser2()
        const reward3F = await checkEarnedUser3()

        // Check reward stopped
        expect(reward1F).to.eq(reward1E)
        expect(reward2F).to.eq(reward2E)
        expect(reward3F).to.eq(reward3E)
      });


      it("StakingRewards stake 3 rounds", async function () {
   
        let lastBlock = await ethers.provider.getBlock('latest')

        startTimestamp = lastBlock.timestamp + startTime
        endTimestamp = lastBlock.timestamp + endTime

        amountReward = expandTo9Decimals(20000)                      // 9408471
        rewardRate = amountReward.mul(expandTo18Decimals(1)).mul(expandTo18Decimals(1)).div(endTime-startTime)

        const stake1 = expandTo18Decimals(100000)
        const stake2 = expandTo18Decimals(400000)
        const stake3 = expandTo18Decimals(500000)

        await user1Stake(stake1)
        await user2Stake(stake2)
        await user3Stake(stake3)

        // Staking reward not started
        expect(await stakingRewards.earned(user1.address)).to.equal(BigNumber.from(0))
        expect(await stakingRewards.earned(user2.address)).to.equal(BigNumber.from(0))
        expect(await stakingRewards.earned(user3.address)).to.equal(BigNumber.from(0))

        startTimestamp = lastBlock.timestamp + startTime
        endTimestamp = lastBlock.timestamp + endTime

        await stakingRewards.depolyRewards(startTimestamp, endTimestamp, amountReward )

        // Reward deployed, but not started
        await user1Stake(stake1)
        await user2Stake(stake2)
        await user3Stake(stake3)

        await checkEarnedUser1()
        await checkEarnedUser2()
        await checkEarnedUser3()

        await ethers.provider.send("evm_increaseTime", [startTime + 100]);
        await mine(1)

        // Reward started
        await checkEarnedUser1()
        await checkEarnedUser2()
        await checkEarnedUser3()
        
        await ethers.provider.send("evm_increaseTime", [60*60*24*10]);
        await mine(1)

        await user1Stake(stake1)
        await user2Stake(stake2)
        await user3Stake(stake3)

        await checkEarnedUser1()
        await checkEarnedUser2()
        await checkEarnedUser3()

        // Period ended
        await ethers.provider.send("evm_increaseTime", [60 *60 * 24 * 50 - 100]);
        await mine(1)

        const reward1D = await checkEarnedUser1()
        const reward2D = await checkEarnedUser2()
        const reward3D = await checkEarnedUser3()

        await ethers.provider.send("evm_increaseTime", [60 *60 * 24 * 50 - 100]);
        await mine(1)

        const reward1E = await checkEarnedUser1()
        const reward2E = await checkEarnedUser2()
        const reward3E = await checkEarnedUser3()

        // Check reward stopped
        expect(reward1D).to.eq(reward1E)
        expect(reward2D).to.eq(reward2E)
        expect(reward3D).to.eq(reward3E)

        console.log("1st Round:", reward1E.toString(), reward2E.toString(), reward3E.toString(),
                                    reward1E.add(reward2E).add(reward3E).toString())

        expect(reward1E.add(reward2E).add(reward3E)).to.gte(expandTo9Decimals(20000).sub(100))

        // ######### 2nd Round staking ######################### //

        await updatStakeStatus()

        lastBlock = await ethers.provider.getBlock('latest')

        startTimestamp = lastBlock.timestamp + startTime
        endTimestamp = lastBlock.timestamp + endTime

        amountReward = expandTo9Decimals(50000)                      
        rewardRate = amountReward.mul(expandTo18Decimals(1)).mul(expandTo18Decimals(1)).div(endTime-startTime)

        await stakingRewards.depolyRewards(startTimestamp, endTimestamp, amountReward )

        // Period ended, Reward stopped
        await ethers.provider.send("evm_increaseTime", [60*60*5]);
        await mine(1)

        const reward1F = await checkEarnedUser1()
        const reward2F = await checkEarnedUser2()
        const reward3F = await checkEarnedUser3()

        // Check reward stopped
        expect(reward1F).to.eq(reward1E)
        expect(reward2F).to.eq(reward2E)
        expect(reward3F).to.eq(reward3E)

        // Start 2nd-round staking 
        await ethers.provider.send("evm_increaseTime", [startTime - 60*60*5]);
        await mine(1)

        await user1Stake(stake1)
        await user2Stake(stake2)
        await user3Stake(stake3)

        await checkEarnedUser1()
        await checkEarnedUser2()
        await checkEarnedUser3()

        await ethers.provider.send("evm_increaseTime", [60*60*24*30]);
        await mine(1)

        await user1Stake(stake1)
        await user2Stake(stake2)
        await user3Stake(stake3)

        await checkEarnedUser1()
        await checkEarnedUser2()
        await checkEarnedUser3()

        // 2nd-round ended
        await ethers.provider.send("evm_increaseTime", [60*60*24*30]);
        await mine(1)

        const reward1G = await checkEarnedUser1()
        const reward2G = await checkEarnedUser2()
        const reward3G = await checkEarnedUser3()

        await user1Stake(stake1)
        await user2Stake(stake2)
        await user3Stake(stake3)

        await checkEarnedUser1()
        await checkEarnedUser2()
        await checkEarnedUser3()

        console.log("2nd Round:", reward1G.toString(), reward2G.toString(), reward3G.toString(),
                                              reward1G.add(reward2G).add(reward3G).toString())

        expect(reward1G.add(reward2G).add(reward3G)).to.gte(expandTo9Decimals(20000 + 50000).sub(100))

        await ethers.provider.send("evm_increaseTime", [60*60*24]);
        await mine(1)

        const reward1H = await checkEarnedUser1()
        const reward2H = await checkEarnedUser2()
        const reward3H = await checkEarnedUser3()

        // Check reward stopped
        expect(reward1H).to.eq(reward1G)
        expect(reward2H).to.eq(reward2G)
        expect(reward3H).to.eq(reward3G)

        // #################################
        // 3rd-round staking 
        await updatStakeStatus()

        lastBlock = await ethers.provider.getBlock('latest')

        startTimestamp = lastBlock.timestamp + startTime
        endTimestamp = lastBlock.timestamp + endTime

        amountReward = expandTo9Decimals(80000)                      
        rewardRate = amountReward.mul(expandTo18Decimals(1)).mul(expandTo18Decimals(1)).div(endTime-startTime)

        await stakingRewards.depolyRewards(startTimestamp, endTimestamp, amountReward )

        // Period ended, Reward stopped
        await ethers.provider.send("evm_increaseTime", [endTime]);
        await mine(1)

        const reward1J = await checkEarnedUser1()
        const reward2J = await checkEarnedUser2()
        const reward3J = await checkEarnedUser3()

        console.log("3rd Round", reward1J.toString(), reward2J.toString(), reward3J.toString(),
                                  reward1J.add(reward2J).add(reward3J).toString())

        expect(reward1J.add(reward2J).add(reward3J)).to.gte(expandTo9Decimals(20000 + 50000 + 80000).sub(100))

        await user1Stake(stake1)
        await user2Stake(stake2)
        await user3Stake(stake3)

        await checkEarnedUser1()
        await checkEarnedUser2()
        await checkEarnedUser3()
        

        await ethers.provider.send("evm_increaseTime", [60*60*24]);
        await mine(1)

        const reward1K = await checkEarnedUser1()
        const reward2K = await checkEarnedUser2()
        const reward3K = await checkEarnedUser3()

        // Check reward stopped
        expect(reward1J).to.eq(reward1K)
        expect(reward2J).to.eq(reward2K)
        expect(reward3J).to.eq(reward3K)

        await stakingRewards.connect(user1).collectReward()
        await stakingRewards.connect(user2).collectReward()
        await stakingRewards.connect(user3).collectReward()
        const reward1 = await artToken.balanceOf(user1.address)
        const reward2 = await artToken.balanceOf(user2.address)
        const reward3 = await artToken.balanceOf(user3.address)

        expect(reward1.add(reward2).add(reward3)).to.gte(reward1K.add(reward2K).add(reward3K))
      });

    })
})