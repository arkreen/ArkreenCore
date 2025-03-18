import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import { loadFixture, mine } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
//const {ethers, upgrades} =  require("hardhat");

import { ethers, network, upgrades } from "hardhat";
import { Block } from "@ethersproject/abstract-provider";

import { constants, BigNumber, } from 'ethers'
import { expandTo9Decimals, randomAddresses, MinerType } from "../utils/utilities"
import { getOnboardingRemoteMinerDigest, getOnboardingRemoteMinerBatchDigest, getPermitDigest, expandTo18Decimals } from "../utils/utilities"

import { SignatureStruct } from "../../typechain/contracts/ArkreenMiner";

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
const PREMIUN_PER_MINER =  expandTo18Decimals(10000)

const Miner_Manager       = 0         
const Register_Authority  = 1    
const Payment_Receiver    = 2

interface stakeStatus {
  stakeAmount:          BigNumber
  rewardStakesAmount:   BigNumber
  lastTimeStamp:        number
  rewardsPerStakePaid:  BigNumber
  earnStored:           BigNumber
  miners:               number
}

const initStatus: stakeStatus = { stakeAmount: BigNumber.from(0), rewardStakesAmount: BigNumber.from(0),
                                  lastTimeStamp: 0, miners: 0,
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

    let privateKeyRegister:       string

    let allStakeAmount    = BigNumber.from(0)
    let allReswardStakeAmount    = BigNumber.from(0)
    let lastRewardsPerStakePaid = BigNumber.from(0)

    let user1StakeStatus: stakeStatus 
    let user2StakeStatus: stakeStatus
    let user3StakeStatus: stakeStatus

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

        const miners3 = randomAddresses(3)
        await arkreenMiner.connect(user1).RemoteMinerOnboardInBatch([user1.address, user2.address, user3.address] , miners3)

        const miners2 = randomAddresses(2)
        await arkreenMiner.connect(user1).RemoteMinerOnboardInBatch([user1.address, user2.address] , miners2)

        const miners1 = randomAddresses(1)
        await arkreenMiner.connect(user1).RemoteMinerOnboardInBatch([user1.address] , miners1)

        const stakingRewardsFactory = await ethers.getContractFactory("StakingRewards")
        const stakingRewards = await upgrades.deployProxy(stakingRewardsFactory, 
                                        [arkreenToken.address, artToken.address, arkreenMiner.address, deployer.address]) as StakingRewards

        await stakingRewards.deployed()
        await stakingRewards.setStakeParameter(expandTo18Decimals(10000) , 200)

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
                                      allReswardStakeAmount.eq(0) ||
                                      lastTimeRewardApplicable <= lastUpdateTimeForReward
                                      ? BigNumber.from(0)
                                      : rewardRate.mul(lastTimeRewardApplicable-lastUpdateTimeForReward).div(allReswardStakeAmount)

      return lastRewardsPerStakePaid.add(rewardsPerStakeIncrease)
    }                                    

    async function updatStakeStatus() {
      lastBlockN = await ethers.provider.getBlock('latest')
       lastRewardsPerStakePaid = getLastRewardsPerStake()
      lastUpdateTime = lastBlockN.timestamp
    }

    async function userStake(walletIndex: number, amount: BigNumber) {

      const wallet = (walletIndex==1) ? user1 : (walletIndex==2) ? user2 : user3
      const userStakeStatus = (walletIndex==1) ? user1StakeStatus : (walletIndex==2) ? user2StakeStatus : user3StakeStatus

      await stakingRewards.connect(wallet).stake(amount)
      lastBlockN = await ethers.provider.getBlock('latest')

      lastRewardsPerStakePaid = getLastRewardsPerStake()
      const newRewards = userStakeStatus.rewardStakesAmount.mul(lastRewardsPerStakePaid.sub(userStakeStatus.rewardsPerStakePaid))

      allStakeAmount = allStakeAmount.add(amount)
      userStakeStatus.stakeAmount = userStakeStatus.stakeAmount.add(amount)

      allReswardStakeAmount = allReswardStakeAmount.sub(userStakeStatus.rewardStakesAmount)
      userStakeStatus.rewardStakesAmount = userStakeStatus.stakeAmount.lte(PREMIUN_PER_MINER.mul(userStakeStatus.miners))
                                      ? userStakeStatus.stakeAmount.mul(2)
                                      : userStakeStatus.stakeAmount.sub(PREMIUN_PER_MINER.mul(userStakeStatus.miners))
                                        .add(PREMIUN_PER_MINER.mul(userStakeStatus.miners).mul(2)) 
      allReswardStakeAmount = allReswardStakeAmount.add(userStakeStatus.rewardStakesAmount)                                        
                                      
      userStakeStatus.lastTimeStamp = lastBlockN.timestamp
      userStakeStatus.rewardsPerStakePaid = lastRewardsPerStakePaid
      userStakeStatus.earnStored = userStakeStatus.earnStored.add(newRewards.div(expandTo18Decimals(1)).div(expandTo18Decimals(1)))

      lastUpdateTime = lastBlockN.timestamp
    }

    async function updateUserStakeInfo(walletIndex: number, amount: BigNumber) {
      const userStakeStatus = (walletIndex==1) ? user1StakeStatus : (walletIndex==2) ? user2StakeStatus : user3StakeStatus
  
      lastBlockN = await ethers.provider.getBlock('latest')

      lastRewardsPerStakePaid = getLastRewardsPerStake()
      const newRewards = userStakeStatus.rewardStakesAmount.mul(lastRewardsPerStakePaid.sub(userStakeStatus.rewardsPerStakePaid))

      allStakeAmount = allStakeAmount.add(amount)
      userStakeStatus.stakeAmount = userStakeStatus.stakeAmount.add(amount)

      allReswardStakeAmount = allReswardStakeAmount.sub(userStakeStatus.rewardStakesAmount)
      userStakeStatus.rewardStakesAmount = userStakeStatus.stakeAmount.lte(PREMIUN_PER_MINER.mul(userStakeStatus.miners))
                                      ? userStakeStatus.stakeAmount.mul(2)
                                      : userStakeStatus.stakeAmount.sub(PREMIUN_PER_MINER.mul(userStakeStatus.miners))
                                        .add(PREMIUN_PER_MINER.mul(userStakeStatus.miners).mul(2)) 
      allReswardStakeAmount = allReswardStakeAmount.add(userStakeStatus.rewardStakesAmount)                                        
                                      
      userStakeStatus.lastTimeStamp = lastBlockN.timestamp
      userStakeStatus.rewardsPerStakePaid = lastRewardsPerStakePaid
      userStakeStatus.earnStored = userStakeStatus.earnStored.add(newRewards.div(expandTo18Decimals(1)).div(expandTo18Decimals(1)))

      lastUpdateTime = lastBlockN.timestamp
    }

    async function userUnstake(walletIndex: number, amount: BigNumber) {
      const wallet = (walletIndex==1) ? user1 : (walletIndex==2) ? user2 : user3
      const userStakeStatus = (walletIndex==1) ? user1StakeStatus : (walletIndex==2) ? user2StakeStatus : user3StakeStatus

      await stakingRewards.connect(wallet).unstake(amount)
      lastBlockN = await ethers.provider.getBlock('latest')

      lastRewardsPerStakePaid = getLastRewardsPerStake()
      const newRewards = userStakeStatus.rewardStakesAmount.mul(lastRewardsPerStakePaid.sub(userStakeStatus.rewardsPerStakePaid))

      allStakeAmount = allStakeAmount.sub(amount)
      userStakeStatus.stakeAmount = userStakeStatus.stakeAmount.sub(amount)

      allReswardStakeAmount = allReswardStakeAmount.sub(userStakeStatus.rewardStakesAmount)
      userStakeStatus.rewardStakesAmount = userStakeStatus.stakeAmount.lte(PREMIUN_PER_MINER.mul(userStakeStatus.miners))
                                      ? userStakeStatus.stakeAmount.mul(2)
                                      : userStakeStatus.stakeAmount.sub(PREMIUN_PER_MINER.mul(userStakeStatus.miners))
                                        .add(PREMIUN_PER_MINER.mul(userStakeStatus.miners).mul(2)) 

      allReswardStakeAmount = allReswardStakeAmount.add(userStakeStatus.rewardStakesAmount)                                        
                                      
      userStakeStatus.lastTimeStamp = lastBlockN.timestamp
      userStakeStatus.rewardsPerStakePaid = lastRewardsPerStakePaid
      userStakeStatus.earnStored = userStakeStatus.earnStored.add(newRewards.div(expandTo18Decimals(1)).div(expandTo18Decimals(1)))

      lastUpdateTime = lastBlockN.timestamp
    }

    async function userExitStaking(walletIndex: number) {
      const wallet = (walletIndex==1) ? user1 : (walletIndex==2) ? user2 : user3
      const userStakeStatus = (walletIndex==1) ? user1StakeStatus : (walletIndex==2) ? user2StakeStatus : user3StakeStatus

      const amount = await stakingRewards.myStakes(wallet.address)
      await stakingRewards.connect(wallet).exitStaking()
      lastBlockN = await ethers.provider.getBlock('latest')

      lastRewardsPerStakePaid = getLastRewardsPerStake()
      const newRewards = userStakeStatus.rewardStakesAmount.mul(lastRewardsPerStakePaid.sub(userStakeStatus.rewardsPerStakePaid))

      allStakeAmount = allStakeAmount.sub(amount)
      userStakeStatus.stakeAmount = userStakeStatus.stakeAmount.sub(amount)

      allReswardStakeAmount = allReswardStakeAmount.sub(userStakeStatus.rewardStakesAmount)
      userStakeStatus.rewardStakesAmount = BigNumber.from(0)
                                      
      userStakeStatus.lastTimeStamp = lastBlockN.timestamp
      userStakeStatus.rewardsPerStakePaid = lastRewardsPerStakePaid
      const earnStored = userStakeStatus.earnStored.add(newRewards.div(expandTo18Decimals(1)).div(expandTo18Decimals(1)))

      userStakeStatus.earnStored = BigNumber.from(0)
      lastUpdateTime = lastBlockN.timestamp
      return earnStored
    }

    async function userCollectReward(walletIndex: number): Promise<BigNumber> {
      const wallet = (walletIndex==1) ? user1 : (walletIndex==2) ? user2 : user3
      const userStakeStatus = (walletIndex==1) ? user1StakeStatus : (walletIndex==2) ? user2StakeStatus : user3StakeStatus

      await stakingRewards.connect(wallet).collectReward()
      lastBlockN = await ethers.provider.getBlock('latest')

      lastRewardsPerStakePaid = getLastRewardsPerStake()
      const newRewards = userStakeStatus.rewardStakesAmount.mul(lastRewardsPerStakePaid.sub(userStakeStatus.rewardsPerStakePaid))
                                      
      userStakeStatus.lastTimeStamp = lastBlockN.timestamp
      userStakeStatus.rewardsPerStakePaid = lastRewardsPerStakePaid
      const earnStored = userStakeStatus.earnStored.add(newRewards.div(expandTo18Decimals(1)).div(expandTo18Decimals(1)))

      userStakeStatus.earnStored = BigNumber.from(0)
      lastUpdateTime = lastBlockN.timestamp
      return earnStored
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
      const newRewards = user1StakeStatus.rewardStakesAmount.mul(lastRewardsPerStakePaid.sub(user1StakeStatus.rewardsPerStakePaid))

      allStakeAmount = allStakeAmount.add(amount)
      user1StakeStatus.stakeAmount = user1StakeStatus.stakeAmount.add(amount)
      allReswardStakeAmount = allReswardStakeAmount.sub(user1StakeStatus.rewardStakesAmount)

      user1StakeStatus.rewardStakesAmount = user1StakeStatus.stakeAmount.lte(PREMIUN_PER_MINER.mul(user1StakeStatus.miners))
                                      ? user1StakeStatus.stakeAmount.mul(2)
                                      : user1StakeStatus.stakeAmount.sub(PREMIUN_PER_MINER.mul(user1StakeStatus.miners))
                                        .add(PREMIUN_PER_MINER.mul(user1StakeStatus.miners).mul(2)) 

      allReswardStakeAmount = allReswardStakeAmount.add(user1StakeStatus.rewardStakesAmount)                                        

      user1StakeStatus.lastTimeStamp = lastBlockN.timestamp
      user1StakeStatus.rewardsPerStakePaid = lastRewardsPerStakePaid
      user1StakeStatus.earnStored = user1StakeStatus.earnStored.add(newRewards.div(expandTo18Decimals(1)).div(expandTo18Decimals(1)))

      lastUpdateTime = lastBlockN.timestamp

    }

    async function checkEarnedUser(walletIndex: number) {
      const wallet = (walletIndex==1) ? user1 : (walletIndex==2) ? user2 : user3
      const userStakeStatus = (walletIndex==1) ? user1StakeStatus : (walletIndex==2) ? user2StakeStatus : user3StakeStatus

      lastBlockN = await ethers.provider.getBlock('latest')
      const lastRewardsPerStakePaidTemp = getLastRewardsPerStake()
      const newRewards = userStakeStatus.rewardStakesAmount
                            .mul(lastRewardsPerStakePaidTemp.sub(userStakeStatus.rewardsPerStakePaid))
                            .div(expandTo18Decimals(1)).div(expandTo18Decimals(1))

      expect(await stakingRewards.earned(wallet.address)).to.eq(userStakeStatus.earnStored.add(newRewards))
      return userStakeStatus.earnStored.add(newRewards)
    }

    describe('StakingRewards test', () => {
      beforeEach(async () => {
        const fixture = await loadFixture(deployFixture)
        privateKeyRegister = process.env.REGISTER_TEST_PRIVATE_KEY as string

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

        user1StakeStatus = {...initStatus, miners: 3}
        user2StakeStatus = {...initStatus, miners: 2}
        user3StakeStatus  = {...initStatus, miners: 1}

        allStakeAmount    = BigNumber.from(0)
        allReswardStakeAmount = BigNumber.from(0)
        lastRewardsPerStakePaid = BigNumber.from(0)
   
      })

      it("StakingRewards basics", async function () {
   
        const lastBlock = await ethers.provider.getBlock('latest')
        startTimestamp = lastBlock.timestamp + startTime
        endTimestamp = lastBlock.timestamp + endTime

        amountReward = expandTo9Decimals(20000)                       // 9408471
        rewardRate = amountReward.mul(expandTo18Decimals(1)).mul(expandTo18Decimals(1)).div(endTime-startTime)

        const stake1 = expandTo18Decimals(100000)
        const stake2 = expandTo18Decimals(400000)
        const stake3 = expandTo18Decimals(500000)

        await userStake(1, stake1)
        await userStake(2, stake2)
        await userStake(3, stake3)

        expect(await checkEarnedUser(1)).to.eq(BigNumber.from(0))
        expect(await checkEarnedUser(2)).to.eq(BigNumber.from(0))
        expect(await checkEarnedUser(3)).to.eq(BigNumber.from(0))

        await stakingRewards.depolyRewards(startTimestamp, endTimestamp, amountReward )

        await ethers.provider.send("evm_increaseTime", [startTime + 100]);
        await mine(1)

        // Reward started
        await userStake(1, stake1)
        await userStake(2, stake2)
        await userStake(3, stake3)

        expect(await checkEarnedUser(1)).to.gt(BigNumber.from(0))
        expect(await checkEarnedUser(2)).to.gt(BigNumber.from(0))
        expect(await checkEarnedUser(3)).to.gt(BigNumber.from(0))

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

        await updateUserStakeInfo(1, stake1)

        expect(await stakingRewards.totalStakes()).to.eq(stakeBefore.add(stake1))  
        expect(await stakingRewards.myStakes(user1.address)).to.eq(myStakesBefore.add(stake1))  
        expect(await arkreenToken.balanceOf(user1.address)).to.eq(mybalance.sub(stake1))  

        // collectReward
        let mybalanceReward1 = await artToken.balanceOf(user1.address)
        let mybalanceReward2 = await artToken.balanceOf(user2.address)
        let mybalanceReward3 = await artToken.balanceOf(user3.address)

        const reward1 = await userCollectReward(1)

        const mybalanceReward1A = await artToken.balanceOf(user1.address)
        const reward1Real = mybalanceReward1A.sub(mybalanceReward1)
        expect(reward1).to.eq(reward1Real)

        expect(await artToken.balanceOf(user2.address)).to.eq(mybalanceReward2)
        expect(await artToken.balanceOf(user3.address)).to.eq(mybalanceReward3)
        expect(await stakingRewards.earned(user1.address)).to.eq(0)

        mybalanceReward1 = await artToken.balanceOf(user1.address)

        const reward2 = await userCollectReward(2)

        const mybalanceReward2A = await artToken.balanceOf(user2.address)
        const earned2Real = mybalanceReward2A.sub(mybalanceReward2)
        expect(reward2).to.gte(earned2Real)

        expect(await artToken.balanceOf(user1.address)).to.eq(mybalanceReward1)
        expect(await artToken.balanceOf(user3.address)).to.eq(mybalanceReward3)
        expect(await stakingRewards.earned(user2.address)).to.eq(0)

        mybalanceReward2 = await artToken.balanceOf(user2.address)

        const reward3 = await userCollectReward(3)

        const mybalanceReward3A = await artToken.balanceOf(user3.address)
        const earned3Real = mybalanceReward3A.sub(mybalanceReward3)
        expect(reward3).to.gte(earned3Real)

        expect(await artToken.balanceOf(user1.address)).to.eq(mybalanceReward1)
        expect(await artToken.balanceOf(user2.address)).to.eq(mybalanceReward2)
        expect(await stakingRewards.earned(user3.address)).to.eq(0)

        //  Unstake 
        await ethers.provider.send("evm_increaseTime", [60*60*24]);
        await mine(1)
        const stake1A  = await stakingRewards.myStakes(user1.address)
        const totalStakes1A  = await stakingRewards.totalStakes()

        await expect(stakingRewards.connect(user1).unstake(stake1A.add(1))).to.be.reverted

        await userUnstake(1, stake1)
        
        const stake1B  = await stakingRewards.myStakes(user1.address)
        const totalStakes1B  = await stakingRewards.totalStakes()
        expect(stake1B).to.eq(stake1A.sub(stake1))
        expect(totalStakes1B).to.eq(totalStakes1A.sub(stake1))
        await checkEarnedUser(1)
        await checkEarnedUser(2)
        await checkEarnedUser(3)

        await ethers.provider.send("evm_increaseTime", [60*60*24]);
        await mine(1)
        const stake2A  = await stakingRewards.myStakes(user2.address)
        const totalStakes2A  = await stakingRewards.totalStakes()
        await userUnstake(2, stake2)

        const stake2B  = await stakingRewards.myStakes(user2.address)
        const totalStakes2B  = await stakingRewards.totalStakes()
        expect(stake2B).to.eq(stake2A.sub(stake2))
        expect(totalStakes2B).to.eq(totalStakes2A.sub(stake2))
        await checkEarnedUser(1)

        await checkEarnedUser(2)
        await checkEarnedUser(3)

        await ethers.provider.send("evm_increaseTime", [60*60*24]);
        await mine(1)
        const stake3A  = await stakingRewards.myStakes(user3.address)
        const totalStakes3A  = await stakingRewards.totalStakes()
        await userUnstake(3, stake3)
        const stake3B  = await stakingRewards.myStakes(user3.address)
        const totalStakes3B  = await stakingRewards.totalStakes()
        expect(stake3B).to.eq(stake3A.sub(stake3))
        expect(totalStakes3B).to.eq(totalStakes3A.sub(stake3))

        await checkEarnedUser(1)
        await checkEarnedUser(2)
        await checkEarnedUser(3)

        // exitStaking
        await ethers.provider.send("evm_increaseTime", [60*60*24]);
        await mine(1)

        await userExitStaking(1)
        await userExitStaking(2)
        await userExitStaking(3)

        await ethers.provider.send("evm_increaseTime", [60*60*24]);
        await mine(1)

        await checkEarnedUser(1)
        await checkEarnedUser(2)
        await checkEarnedUser(3)

        expect(await stakingRewards.earned(user1.address)).to.eq(BigNumber.from(0))
        expect(await stakingRewards.earned(user2.address)).to.eq(BigNumber.from(0))
        expect(await stakingRewards.earned(user3.address)).to.eq(BigNumber.from(0))

      });

      it("StakingRewards Unstake lock test", async function () {
   
        const lastBlock = await ethers.provider.getBlock('latest')
        startTimestamp = lastBlock.timestamp + startTime
        endTimestamp = lastBlock.timestamp + endTime

        amountReward = expandTo9Decimals(20000)                       // 9408471
        rewardRate = amountReward.mul(expandTo18Decimals(1)).mul(expandTo18Decimals(1)).div(endTime-startTime)

        await stakingRewards.changeUnstakeLock(true)

        const stake1 = expandTo18Decimals(100000)
        const stake2 = expandTo18Decimals(400000)
        const stake3 = expandTo18Decimals(500000)

        await userStake(1, stake1)
        await userStake(2, stake2)
        await userStake(3, stake3)

        expect(await checkEarnedUser(1)).to.eq(BigNumber.from(0))
        expect(await checkEarnedUser(2)).to.eq(BigNumber.from(0))
        expect(await checkEarnedUser(3)).to.eq(BigNumber.from(0))

        // unstaking is allowed before starting 
        await userUnstake(1, stake1.div(2))
        await userUnstake(2, stake2.div(2))
        await userUnstake(3, stake3.div(2))

        await ethers.provider.send("evm_increaseTime", [100]);
        await mine(1)

        await userStake(1, stake1.div(2))
        await userStake(2, stake2.div(2))
        await userStake(3, stake3.div(2))

        expect(await checkEarnedUser(1)).to.eq(BigNumber.from(0))
        expect(await checkEarnedUser(2)).to.eq(BigNumber.from(0))
        expect(await checkEarnedUser(3)).to.eq(BigNumber.from(0))

        await stakingRewards.depolyRewards(startTimestamp, endTimestamp, amountReward )

        await ethers.provider.send("evm_increaseTime", [startTime + 100]);
        await mine(1)

        // Reward started
        await userStake(1, stake1)
        await userStake(2, stake2)
        await userStake(3, stake3)

        expect(await checkEarnedUser(1)).to.gt(BigNumber.from(0))   // not 0
        expect(await checkEarnedUser(2)).to.gt(BigNumber.from(0))   // not 0
        expect(await checkEarnedUser(3)).to.gt(BigNumber.from(0))   // not 0

        await ethers.provider.send("evm_increaseTime", [60*60*24*40]);
        await mine(1)

        await expect(userUnstake(1, stake1)).to.be.revertedWith("Unstake not opened")
        await expect(userUnstake(2, stake2)).to.be.revertedWith("Unstake not opened")
        await expect(userUnstake(3, stake3)).to.be.revertedWith("Unstake not opened")

        //  Unstake 
        await ethers.provider.send("evm_increaseTime", [60*60*24*20]);    // Finish the staking
        await mine(1)

        const stake1A  = await stakingRewards.myStakes(user1.address)
        const totalStakes1A  = await stakingRewards.totalStakes()

        await userUnstake(1, stake1.div(2))
        
        const stake1B  = await stakingRewards.myStakes(user1.address)
        const totalStakes1B  = await stakingRewards.totalStakes()
        expect(stake1B).to.eq(stake1A.sub(stake1.div(2)))
        expect(totalStakes1B).to.eq(totalStakes1A.sub(stake1.div(2)))
        await checkEarnedUser(1)
        await checkEarnedUser(2)
        await checkEarnedUser(3)

        // exitStaking
        await ethers.provider.send("evm_increaseTime", [60*60*24]);
        await mine(1)

        await userExitStaking(1)
        await userExitStaking(2)
        await userExitStaking(3)

        await ethers.provider.send("evm_increaseTime", [60*60*24]);
        await mine(1)

        await checkEarnedUser(1)
        await checkEarnedUser(2)
        await checkEarnedUser(3)

        expect(await stakingRewards.earned(user1.address)).to.eq(BigNumber.from(0))
        expect(await stakingRewards.earned(user2.address)).to.eq(BigNumber.from(0))
        expect(await stakingRewards.earned(user3.address)).to.eq(BigNumber.from(0))

        //////// 2nd ///////////////////
        {

          await updatStakeStatus()

          let lastBlock = await ethers.provider.getBlock('latest')

          startTimestamp = lastBlock.timestamp + startTime
          endTimestamp = lastBlock.timestamp + endTime

          amountReward = expandTo9Decimals(80000)                      
          rewardRate = amountReward.mul(expandTo18Decimals(1)).mul(expandTo18Decimals(1)).div(endTime-startTime)

          await stakingRewards.depolyRewards(startTimestamp, endTimestamp, amountReward )

          // Period ended, Reward stopped
          await ethers.provider.send("evm_increaseTime", [100]);
          await mine(1)

          await userStake(1, stake1)
          await userStake(2, stake2)
          await userStake(3, stake3)
  
          expect(await checkEarnedUser(1)).to.eq(BigNumber.from(0))
          expect(await checkEarnedUser(2)).to.eq(BigNumber.from(0))
          expect(await checkEarnedUser(3)).to.eq(BigNumber.from(0))
  
          // unstaking is allowed before starting 
          await userUnstake(1, stake1.div(2))
          await userUnstake(2, stake2.div(2))
          await userUnstake(3, stake3.div(2))
 
          await userStake(1, stake1.div(2))
          await userStake(2, stake2.div(2))
          await userStake(3, stake3.div(2))
  
          await ethers.provider.send("evm_increaseTime", [startTime]);
          await mine(1)

          await expect(userUnstake(1, stake1)).to.be.revertedWith("Unstake not opened")
          await expect(userUnstake(2, stake2)).to.be.revertedWith("Unstake not opened")
          await expect(userUnstake(3, stake3)).to.be.revertedWith("Unstake not opened")

          await ethers.provider.send("evm_increaseTime", [endTime]);
          await mine(1)

          await userUnstake(1, stake1)
          await userUnstake(2, stake2)
          await userUnstake(3, stake3)

          await checkEarnedUser(1)
          await checkEarnedUser(2)
          await checkEarnedUser(3)
        }
      });

      it("StakingRewards: Miner onboard", async function () {

        await arkreenToken.connect(user1).approve(arkreenMiner.address, constants.MaxUint256)
        await arkreenToken.connect(user2).approve(arkreenMiner.address, constants.MaxUint256)
        await arkreenToken.connect(user3).approve(arkreenMiner.address, constants.MaxUint256)
   
        const lastBlock = await ethers.provider.getBlock('latest')
        startTimestamp = lastBlock.timestamp + startTime
        endTimestamp = lastBlock.timestamp + endTime

        amountReward = expandTo9Decimals(20000)                       // 9408471
        rewardRate = amountReward.mul(expandTo18Decimals(1)).mul(expandTo18Decimals(1)).div(endTime-startTime)

        const stake1 = expandTo18Decimals(100000)
        const stake2 = expandTo18Decimals(400000)
        const stake3 = expandTo18Decimals(500000)
        
        await userStake(1, stake1)
        await userStake(2, stake2)
        await userStake(3, stake3)

        const rewardStakes1 = await stakingRewards.myRewardStakes(user1.address)
        const rewardStakes2 = await stakingRewards.myRewardStakes(user2.address)
        const rewardStakes3 = await stakingRewards.myRewardStakes(user3.address)

        expect(rewardStakes1).to.eq(stake1.add(PREMIUN_PER_MINER.mul(3)))
        expect(rewardStakes2).to.eq(stake2.add(PREMIUN_PER_MINER.mul(2)))
        expect(rewardStakes3).to.eq(stake3.add(PREMIUN_PER_MINER.mul(1)))

        await stakingRewards.depolyRewards(startTimestamp, endTimestamp, amountReward )

        await ethers.provider.send("evm_increaseTime", [startTime + 100]);
        await mine(1)

        // Reward started
        await userStake(1, stake1)
        await userStake(2, stake2)
        await userStake(3, stake3)

        expect(await stakingRewards.myRewardStakes(user1.address)).to.eq(stake1.mul(2).add(PREMIUN_PER_MINER.mul(3)))
        expect(await stakingRewards.myRewardStakes(user2.address)).to.eq(stake2.mul(2).add(PREMIUN_PER_MINER.mul(2)))
        expect(await stakingRewards.myRewardStakes(user3.address)).to.eq(stake3.mul(2).add(PREMIUN_PER_MINER.mul(1)))

        await ethers.provider.send("evm_increaseTime", [60*60*24*40]);
        await mine(1)

        await checkEarnedUser(1)
        await checkEarnedUser(2)
        await checkEarnedUser(3)
        
        // Onboarding a new remote miner
        const miners = randomAddresses(10)
        await arkreenMiner.connect(user1).UpdateMinerWhiteList(MinerType.RemoteMiner, miners) 
        const minerPrice = expandTo18Decimals(2000)
  
        const register_digest = getOnboardingRemoteMinerDigest(
                        'Arkreen Miner',
                        arkreenMiner.address,
                        { owner: user2.address, miner: miners[1], 
                          token: arkreenToken.address, price: minerPrice, deadline: constants.MaxUint256 }
                      )
        await arkreenMiner.setManager(Register_Authority, user2.address)

        const {v,r,s} = ecsign( Buffer.from(register_digest.slice(2), 'hex'), 
                                              Buffer.from(privateKeyRegister.slice(2), 'hex'))           
        const signature: SignatureStruct = { v, r, s, token: arkreenToken.address, value:minerPrice, deadline: constants.MaxUint256 } 
    
        await arkreenMiner.connect(user2).RemoteMinerOnboardApproved(user2.address,  miners[1], signature)

        expect(await stakingRewards.myRewardStakes(user1.address)).to.eq(stake1.mul(2).add(PREMIUN_PER_MINER.mul(3)))
        expect(await stakingRewards.myRewardStakes(user2.address)).to.eq(stake2.mul(2).add(PREMIUN_PER_MINER.mul(3))) // one miner added
        user2StakeStatus.miners = 3
        await updateUserStakeInfo(2, BigNumber.from(0))
       
        expect(await stakingRewards.myRewardStakes(user3.address)).to.eq(stake3.mul(2).add(PREMIUN_PER_MINER.mul(1)))

        await ethers.provider.send("evm_increaseTime", [60*60*24*10]);
        await mine(1)

        await checkEarnedUser(1)
        await checkEarnedUser(2)
        await checkEarnedUser(3)

        ////////////////////////////////
        {
          const miners = randomAddresses(10)
          await arkreenMiner.connect(user1).UpdateMinerWhiteListBatch(miners) 
          const minerValue = expandTo18Decimals(2000).mul(3)

          const receiver = user3.address
          const register_digest = getOnboardingRemoteMinerBatchDigest(
                          'Arkreen Miner',
                          arkreenMiner.address,
                          { owner: user3.address, quantity: BigNumber.from(3),
                            token: arkreenToken.address, price: minerValue, deadline: constants.MaxUint256 }
                        )
          await arkreenMiner.setManager(Register_Authority, user2.address)
          const {v,r,s} = ecsign( Buffer.from(register_digest.slice(2), 'hex'), 
                                                Buffer.from(privateKeyRegister.slice(2), 'hex'))           
          const signature: SignatureStruct = { v, r, s, token: arkreenToken.address, value:minerValue, deadline: constants.MaxUint256 } 
    
          await arkreenMiner.connect(user3).RemoteMinerOnboardApprovedBatch(receiver, 3, signature)

          expect(await stakingRewards.myRewardStakes(user1.address)).to.eq(stake1.mul(2).add(PREMIUN_PER_MINER.mul(3)))
          expect(await stakingRewards.myRewardStakes(user2.address)).to.eq(stake2.mul(2).add(PREMIUN_PER_MINER.mul(3)))
          expect(await stakingRewards.myRewardStakes(user3.address)).to.eq(stake3.mul(2).add(PREMIUN_PER_MINER.mul(4)))   // 3 miners added
          user3StakeStatus.miners = 4
          await updateUserStakeInfo(3, BigNumber.from(0))

          await ethers.provider.send("evm_increaseTime", [60*60*24*10]);
          await mine(1)

          await checkEarnedUser(1)
          await checkEarnedUser(2)
          await checkEarnedUser(3)
         }
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

        await userStake(1, stake1)
        await userStake(2, stake2)
        await userStake(3, stake3)

        // Staking reward not started
        expect(await stakingRewards.earned(user1.address)).to.equal(BigNumber.from(0))
        expect(await stakingRewards.earned(user2.address)).to.equal(BigNumber.from(0))
        expect(await stakingRewards.earned(user3.address)).to.equal(BigNumber.from(0))

        await stakingRewards.depolyRewards(startTimestamp, endTimestamp, amountReward )

        // Reward deployed, but not started
        await userStake(1, stake1)
        await userStake(2, stake2)
        await userStake(3, stake3)

        await ethers.provider.send("evm_increaseTime", [startTime -100]);
        await mine(1)

        // Reward not started
        expect(await stakingRewards.earned(user1.address)).to.equal(BigNumber.from(0))
        expect(await stakingRewards.earned(user2.address)).to.equal(BigNumber.from(0))
        expect(await stakingRewards.earned(user3.address)).to.equal(BigNumber.from(0))

        await ethers.provider.send("evm_increaseTime", [100]);
        await mine(1)

        // Reward started
        await checkEarnedUser(1)
        await checkEarnedUser(2)
        await checkEarnedUser(3)

        await ethers.provider.send("evm_increaseTime", [60*60*24*10]);
        await mine(1)

        // Stake again
        await userStake(1, stake1)
        const reward1A = await checkEarnedUser(1)
        const reward2A = await checkEarnedUser(2)
        const reward3A = await checkEarnedUser(3)

        await userStake(2, stake2)
        await checkEarnedUser(1)
        await checkEarnedUser(2)
        await checkEarnedUser(3)

        await userStake(3, stake3)
        const reward1B = await checkEarnedUser(1)
        const reward2B = await checkEarnedUser(2)
        const reward3B = await checkEarnedUser(3)

        expect(reward1B).to.gt(reward1A)
        expect(reward2B).to.gt(reward2A)
        expect(reward3B).to.gt(reward3A)

        await ethers.provider.send("evm_increaseTime", [60*60*24*2]);
        await mine(1)

        await userStake(1, stake1)
        const reward1C = await checkEarnedUser(1)
        const reward2C = await checkEarnedUser(2)
        const reward3C = await checkEarnedUser(3)

        await ethers.provider.send("evm_increaseTime", [60*60*24*4]);
        await mine(1)
        await userStake(2, stake2)
        await checkEarnedUser(1)
        await checkEarnedUser(2)
        await checkEarnedUser(3)
        
        await ethers.provider.send("evm_increaseTime", [60*60*24*4]);
        await mine(1)
        await userStake(3, stake3)
        const reward1D = await checkEarnedUser(1)
        const reward2D = await checkEarnedUser(2)
        const reward3D = await checkEarnedUser(3)

        expect(reward1D).to.gt(reward1C)
        expect(reward2D).to.gt(reward2C)
        expect(reward3D).to.gt(reward3C)

        // Period ended
        await ethers.provider.send("evm_increaseTime", [60*60*24*40]);
        await mine(1)

        const reward1E = await checkEarnedUser(1)
        const reward2E = await checkEarnedUser(2)
        const reward3E = await checkEarnedUser(3)

        // Period ended, Reward stopped
        await ethers.provider.send("evm_increaseTime", [60*60*24*5]);
        await mine(1)

        const reward1F = await checkEarnedUser(1)
        const reward2F = await checkEarnedUser(2)
        const reward3F = await checkEarnedUser(3)

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
        await userStake(2, stake2)
        await userStake(3, stake3)

        // Staking reward not started
        expect(await stakingRewards.earned(user1.address)).to.equal(BigNumber.from(0))
        expect(await stakingRewards.earned(user2.address)).to.equal(BigNumber.from(0))
        expect(await stakingRewards.earned(user3.address)).to.equal(BigNumber.from(0))

        await stakingRewards.depolyRewards(startTimestamp, endTimestamp, amountReward )

        // Reward deployed, but not started
        await user1StakeWithPermit(stake1)
        await userStake(2, stake2)
        await userStake(3, stake3)

        await ethers.provider.send("evm_increaseTime", [startTime -100]);
        await mine(1)

        // Reward not started
        expect(await stakingRewards.earned(user1.address)).to.equal(BigNumber.from(0))
        expect(await stakingRewards.earned(user2.address)).to.equal(BigNumber.from(0))
        expect(await stakingRewards.earned(user3.address)).to.equal(BigNumber.from(0))

        await ethers.provider.send("evm_increaseTime", [100]);
        await mine(1)

        // Reward started
        await checkEarnedUser(1)
        await checkEarnedUser(2)
        await checkEarnedUser(3)

        await ethers.provider.send("evm_increaseTime", [60*60*24*10]);
        await mine(1)

        // Stake again
        await user1StakeWithPermit(stake1)
        const reward1A = await checkEarnedUser(1)
        const reward2A = await checkEarnedUser(2)
        const reward3A = await checkEarnedUser(3)

        await userStake(2, stake2)
        await checkEarnedUser(1)
        await checkEarnedUser(2)
        await checkEarnedUser(3)

        await userStake(3, stake3)
        const reward1B = await checkEarnedUser(1)
        const reward2B = await checkEarnedUser(2)
        const reward3B = await checkEarnedUser(3)

        expect(reward1B).to.gt(reward1A)
        expect(reward2B).to.gt(reward2A)
        expect(reward3B).to.gt(reward3A)

        await ethers.provider.send("evm_increaseTime", [60*60*24*2]);
        await mine(1)

        await user1StakeWithPermit(stake1)
        const reward1C = await checkEarnedUser(1)
        const reward2C = await checkEarnedUser(2)
        const reward3C = await checkEarnedUser(3)

        await ethers.provider.send("evm_increaseTime", [60*60*24*4]);
        await mine(1)
        await userStake(2, stake2)
        await checkEarnedUser(1)
        await checkEarnedUser(2)
        await checkEarnedUser(3)

        
        await ethers.provider.send("evm_increaseTime", [60*60*24*4]);
        await mine(1)
        await userStake(3, stake3)
        const reward1D = await checkEarnedUser(1)
        const reward2D = await checkEarnedUser(2)
        const reward3D = await checkEarnedUser(3)

        expect(reward1D).to.gt(reward1C)
        expect(reward2D).to.gt(reward2C)
        expect(reward3D).to.gt(reward3C)

        // Period ended
        await ethers.provider.send("evm_increaseTime", [60*60*24*40]);
        await mine(1)

        const reward1E = await checkEarnedUser(1)
        const reward2E = await checkEarnedUser(2)
        const reward3E = await checkEarnedUser(3)

        // Period ended, Reward stopped
        await ethers.provider.send("evm_increaseTime", [60*60*24*5]);
        await mine(1)

        const reward1F = await checkEarnedUser(1)
        const reward2F = await checkEarnedUser(2)
        const reward3F = await checkEarnedUser(3)

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

        await userStake(1, stake1)
        await userStake(2, stake2)
        await userStake(3, stake3)

        // Staking reward not started
        expect(await stakingRewards.earned(user1.address)).to.equal(BigNumber.from(0))
        expect(await stakingRewards.earned(user2.address)).to.equal(BigNumber.from(0))
        expect(await stakingRewards.earned(user3.address)).to.equal(BigNumber.from(0))

        startTimestamp = lastBlock.timestamp + startTime
        endTimestamp = lastBlock.timestamp + endTime

        await stakingRewards.depolyRewards(startTimestamp, endTimestamp, amountReward )

        // Reward deployed, but not started
        await userStake(1, stake1)
        await userStake(2, stake2)
        await userStake(3, stake3)

        await checkEarnedUser(1)
        await checkEarnedUser(2)
        await checkEarnedUser(3)

        await ethers.provider.send("evm_increaseTime", [startTime + 100]);
        await mine(1)

        // Reward started
        await checkEarnedUser(1)
        await checkEarnedUser(2)
        await checkEarnedUser(3)
        
        await ethers.provider.send("evm_increaseTime", [60*60*24*10]);
        await mine(1)

        await userStake(1, stake1)
        await userStake(2, stake2)
        await userStake(3, stake3)

        await checkEarnedUser(1)
        await checkEarnedUser(2)
        await checkEarnedUser(3)

        // Period ended
        await ethers.provider.send("evm_increaseTime", [60 *60 * 24 * 50 - 100]);
        await mine(1)

        const reward1D = await checkEarnedUser(1)
        const reward2D = await checkEarnedUser(2)
        const reward3D = await checkEarnedUser(3)

        await ethers.provider.send("evm_increaseTime", [60 *60 * 24 * 50 - 100]);
        await mine(1)

        const reward1E = await checkEarnedUser(1)
        const reward2E = await checkEarnedUser(2)
        const reward3E = await checkEarnedUser(3)

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

        const reward1F = await checkEarnedUser(1)
        const reward2F = await checkEarnedUser(2)
        const reward3F = await checkEarnedUser(3)

        // Check reward stopped
        expect(reward1F).to.eq(reward1E)
        expect(reward2F).to.eq(reward2E)
        expect(reward3F).to.eq(reward3E)

        // Start 2nd-round staking 
        await ethers.provider.send("evm_increaseTime", [startTime - 60*60*5]);
        await mine(1)

        await userStake(1, stake1)
        await userStake(2, stake2)
        await userStake(3, stake3)

        await checkEarnedUser(1)
        await checkEarnedUser(2)
        await checkEarnedUser(3)

        await ethers.provider.send("evm_increaseTime", [60*60*24*30]);
        await mine(1)

        await userStake(1, stake1)
        await userStake(2, stake2)
        await userStake(3, stake3)

        await checkEarnedUser(1)
        await checkEarnedUser(2)
        await checkEarnedUser(3)

        // 2nd-round ended
        await ethers.provider.send("evm_increaseTime", [60*60*24*30]);
        await mine(1)

        const reward1G = await checkEarnedUser(1)
        const reward2G = await checkEarnedUser(2)
        const reward3G = await checkEarnedUser(3)

        await userStake(1, stake1)
        await userStake(2, stake2)
        await userStake(3, stake3)

        await checkEarnedUser(1)
        await checkEarnedUser(2)
        await checkEarnedUser(3)

        console.log("2nd Round:", reward1G.toString(), reward2G.toString(), reward3G.toString(),
                                              reward1G.add(reward2G).add(reward3G).toString())

        expect(reward1G.add(reward2G).add(reward3G)).to.gte(expandTo9Decimals(20000 + 50000).sub(100))

        await ethers.provider.send("evm_increaseTime", [60*60*24]);
        await mine(1)

        const reward1H = await checkEarnedUser(1)
        const reward2H = await checkEarnedUser(2)
        const reward3H = await checkEarnedUser(3)

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

        const reward1J = await checkEarnedUser(1)
        const reward2J = await checkEarnedUser(2)
        const reward3J = await checkEarnedUser(3)

        console.log("3rd Round", reward1J.toString(), reward2J.toString(), reward3J.toString(),
                                  reward1J.add(reward2J).add(reward3J).toString())

        expect(reward1J.add(reward2J).add(reward3J)).to.gte(expandTo9Decimals(20000 + 50000 + 80000).sub(100))

        await userStake(1, stake1)
        await userStake(2, stake2)
        await userStake(3, stake3)

        await checkEarnedUser(1)
        await checkEarnedUser(2)
        await checkEarnedUser(3)
        

        await ethers.provider.send("evm_increaseTime", [60*60*24]);
        await mine(1)

        const reward1K = await checkEarnedUser(1)
        const reward2K = await checkEarnedUser(2)
        const reward3K = await checkEarnedUser(3)

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