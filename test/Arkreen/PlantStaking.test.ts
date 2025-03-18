import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import { loadFixture, mine } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";

import { ethers, network, upgrades } from "hardhat";

import { constants, BigNumber, } from 'ethers'
import { expandTo18Decimals, getPlantUnstakingDigest, getPlantStakingDigest, randomAddresses } from "../utils/utilities"
import { ecsign } from 'ethereumjs-util'
import { ArkreenToken, PlantStaking } from "../../typechain";

describe("PlantStaking test", ()=> {

    let deployer: SignerWithAddress
    let manager:  SignerWithAddress
    let user1:  SignerWithAddress
    let user2: SignerWithAddress
    let user3: SignerWithAddress

    let arkreenToken:             ArkreenToken
    let plantStaking:             PlantStaking
    let privateKeyManager:        string

    let allStakeAmount    = BigNumber.from(0)
    let allRewardAmount    = BigNumber.from(0)

    async function deployFixture() {
        const [deployer, manager, user1, user2, user3] = await ethers.getSigners();

        const ArkreenTokenFactory = await ethers.getContractFactory("ArkreenToken")
        const arkreenToken: ArkreenToken = await upgrades.deployProxy(
                                ArkreenTokenFactory, [10000000000, deployer.address, '', '']) as ArkreenToken
  
        await arkreenToken.deployed()

        const plantStakingFactory = await ethers.getContractFactory("PlantStaking")
        const plantStaking = await upgrades.deployProxy(plantStakingFactory,
                                            [arkreenToken.address, deployer.address, manager.address]) as PlantStaking
        await plantStaking.deployed()

        await arkreenToken.transfer(user1.address, expandTo18Decimals(100000000))
        await arkreenToken.transfer(user2.address, expandTo18Decimals(200000000))
        await arkreenToken.transfer(user3.address, expandTo18Decimals(500000000))
     
        return {arkreenToken, plantStaking, deployer, manager, user1, user2, user3}
    }

    describe('PlantStaking test', () => {
      beforeEach(async () => {
        const fixture = await loadFixture(deployFixture)
        privateKeyManager = process.env.MANAGER_TEST_PRIVATE_KEY as string

        arkreenToken = fixture.arkreenToken
        plantStaking = fixture.plantStaking
        
        deployer = fixture.deployer
        manager = fixture.manager
        user1 = fixture.user1
        user2 = fixture.user2
        user3 = fixture.user3

        await arkreenToken.connect(user1).approve(plantStaking.address, constants.MaxUint256)
        await arkreenToken.connect(user2).approve(plantStaking.address, constants.MaxUint256)
        await arkreenToken.connect(user3).approve(plantStaking.address, constants.MaxUint256)

        allStakeAmount    = BigNumber.from(0)
        allRewardAmount   = BigNumber.from(0)
      })

      async function walletStake(wallet: SignerWithAddress, amount: BigNumber) {
        const {nonce}  = await plantStaking.stakeInfo(wallet.address)
        const txid =  BigNumber.from(1234)

        const cspminer = "0x280a7c4E032584F97E84eDd396a00799da8D061A"
  
        const digest = getPlantStakingDigest(
            'Plant Miner Staking',
            plantStaking.address,
            { txid, staker: wallet.address, cspminer: cspminer, amount: amount, nonce: nonce},
            constants.MaxUint256
          )

        const {v,r,s} = ecsign(Buffer.from(digest.slice(2), 'hex'), Buffer.from(privateKeyManager.slice(2), 'hex'))   
        const signature: PlantStaking.SigStruct = { v, r, s }  

        await plantStaking.connect(wallet).stake(txid, cspminer, amount, nonce, constants.MaxUint256, signature) 
      }

      async function walletUnstake(wallet: SignerWithAddress, amount: BigNumber, reward: BigNumber) {
        const {nonce}  = await plantStaking.stakeInfo(wallet.address)
        const txid = BigNumber.from(2345)
        const cspminer = "0x280a7c4E032584F97E84eDd396a00799da8D061A"
  
        const digest = getPlantUnstakingDigest(
            'Plant Miner Staking',
            plantStaking.address,
            {txid, staker: wallet.address, cspminer: cspminer, amount: amount, reward:reward, nonce: nonce},
            constants.MaxUint256
          )

        const {v,r,s} = ecsign(Buffer.from(digest.slice(2), 'hex'), Buffer.from(privateKeyManager.slice(2), 'hex'))   
        const signature: PlantStaking.SigStruct = { v, r, s }  

        await plantStaking.connect(wallet).unstakeWithReward(txid, cspminer, amount, reward, nonce, constants.MaxUint256, signature) 
      }

      it("PlantStaking Test", async function () {
        // Normal
        await walletStake(user1, expandTo18Decimals(10000))
        await walletStake(user2, expandTo18Decimals(30000))
        await walletStake(user3, expandTo18Decimals(50000))
        await walletStake(user2, expandTo18Decimals(70000))
        await walletStake(user3, expandTo18Decimals(90000))
        await walletStake(user2, expandTo18Decimals(110000))
        await walletStake(user2, expandTo18Decimals(130000))
        await walletStake(user1, expandTo18Decimals(150000))
        await walletStake(user3, expandTo18Decimals(170000))
        const stakeInfo1 = [ 2, expandTo18Decimals(10000 + 150000), 0]
        const stakeInfo2 = [ 4, expandTo18Decimals(30000 + 70000 + 110000 + 130000), 0]
        const stakeInfo3 = [ 3, expandTo18Decimals(50000 + 90000 + 170000), 0]

        expect(await plantStaking.stakeInfo(user1.address)).to.deep.equal(stakeInfo1)
        expect(await plantStaking.stakeInfo(user2.address)).to.deep.equal(stakeInfo2)
        expect(await plantStaking.stakeInfo(user3.address)).to.deep.equal(stakeInfo3)

        const stakeInfo1A = await plantStaking.stakeInfo(user1.address)
        const stakeInfo2A = await plantStaking.stakeInfo(user2.address)
        const stakeInfo3A = await plantStaking.stakeInfo(user3.address)

        expect(await plantStaking.totalStake()).to.equal(stakeInfo1A.amountStake
                          .add(stakeInfo2A.amountStake).add(stakeInfo3A.amountStake))

        expect(await plantStaking.totalReward()).to.equal(0)

        // Abnormal
        const amount= expandTo18Decimals(10000)
        const {nonce}  = await plantStaking.stakeInfo(user1.address)
        const txid = BigNumber.from(3456)

        const cspminer = randomAddresses(1)
  
        const digest = getPlantStakingDigest(
            'Plant Miner Staking',
            plantStaking.address,
            {txid, staker: user1.address, cspminer: cspminer[0], amount: amount, nonce: nonce},
            constants.MaxUint256,
          )

        const {v,r,s} = ecsign(Buffer.from(digest.slice(2), 'hex'), Buffer.from(privateKeyManager.slice(2), 'hex'))   
        const signature: PlantStaking.SigStruct = { v, r, s }  

        await expect(plantStaking.connect(user1).stake(txid, cspminer[0], 0, nonce, constants.MaxUint256, signature))
                      .to.be.revertedWith("Zero Stake")

        await expect(plantStaking.connect(user1).stake(txid, cspminer[0], amount, nonce.add(1), constants.MaxUint256, signature))
                      .to.be.revertedWith("Nonce Not Match")

        await expect(plantStaking.connect(user1).stake(txid, cspminer[0], amount.add(1), nonce, constants.MaxUint256, signature))
                      .to.be.revertedWith("Wrong Signature")

         // Event
         await expect(plantStaking.connect(user1).stake(txid, cspminer[0], amount, nonce, constants.MaxUint256, signature))
                      .to.emit(arkreenToken, 'Transfer')
                      .withArgs(user1.address, plantStaking.address, amount)    
                      .to.emit(plantStaking, 'Stake')
                      .withArgs(txid, user1.address, cspminer[0], amount)    
      });

      it("PlantStaking stakeSlash Test", async function () {
        // Normal
        await walletStake(user1, expandTo18Decimals(10000))
        await walletStake(user2, expandTo18Decimals(30000))
        await walletStake(user3, expandTo18Decimals(50000))

        const amount= expandTo18Decimals(10000)
        const txid = BigNumber.from(3456)
        //const cspminer = randomAddresses(1)
        const cspminer = "0x280a7c4E032584F97E84eDd396a00799da8D061A"     // Must use this address

        const {amountStake: amountStakeBefore} = await plantStaking.stakeInfo(user1.address)
        const {amountStake: amountStakeCSPBefore} = await plantStaking.minerStakeInfo(cspminer)
        const totalStakeBefore = await plantStaking.totalStake()

        // stakeSlash
        await expect(plantStaking.connect(manager).stakeSlash(txid, cspminer, user1.address, amount.div(2)))
                      .to.emit(plantStaking, 'StakeSlash')
                      .withArgs(txid, cspminer, user1.address, amount.div(2))    
             
        const {amountStake: amountStakeAfter} = await plantStaking.stakeInfo(user1.address)                      
        expect(amountStakeAfter).to.eq(amountStakeBefore.sub(amount.div(2)))    

        const {amountStake: amountStakeCSPAfter} = await plantStaking.minerStakeInfo(cspminer)
        expect(amountStakeCSPAfter).to.eq(amountStakeCSPBefore.sub(amount.div(2)))     

        const totalStakeAfter = await plantStaking.totalStake()
        expect(totalStakeAfter).to.eq(totalStakeBefore.sub(amount.div(2)))           

        // Abnormal 
        await expect(plantStaking.stakeSlash(txid, cspminer, user1.address, amount.div(2)))                    
                .to.be.revertedWith("Not Allowed")

        await expect(plantStaking.connect(manager).stakeSlash(txid, cspminer, user1.address, amount.add(1)))                    
                .to.be.revertedWith("Low stake")

      });


      it("PlantUnstaking Test", async function () {
        // Prepare
        await walletStake(user1, expandTo18Decimals(10000))
        await walletStake(user2, expandTo18Decimals(30000))
        await walletStake(user3, expandTo18Decimals(50000))
        await walletStake(user2, expandTo18Decimals(70000))
        await walletStake(user3, expandTo18Decimals(90000))
        await walletStake(user2, expandTo18Decimals(110000))
        await walletStake(user2, expandTo18Decimals(130000))
        await walletStake(user1, expandTo18Decimals(150000))
        await walletStake(user3, expandTo18Decimals(170000))

        // Abnormal
        const amount= expandTo18Decimals(10000)
        const reward= expandTo18Decimals(1000)
        const {nonce}  = await plantStaking.stakeInfo(user1.address)
        const txid = BigNumber.from(4567)

        const cspminer = "0x280a7c4E032584F97E84eDd396a00799da8D061A"
  
        const digest = getPlantUnstakingDigest(
            'Plant Miner Staking',
            plantStaking.address,
            {txid, staker: user1.address, cspminer: cspminer, amount, reward, nonce},
            constants.MaxUint256
          )

        const {v,r,s} = ecsign(Buffer.from(digest.slice(2), 'hex'), Buffer.from(privateKeyManager.slice(2), 'hex'))   
        const signature: PlantStaking.SigStruct = { v, r, s }  

        await expect(plantStaking.connect(user1).unstakeWithReward(txid, cspminer, 0, 0, nonce, constants.MaxUint256, signature))
                      .to.be.revertedWith("Zero Stake")

        await expect(plantStaking.connect(user1).unstakeWithReward(txid, cspminer, amount, reward, nonce.add(1), constants.MaxUint256, signature))
                      .to.be.revertedWith("Nonce Not Match")

        await expect(plantStaking.connect(user1).unstakeWithReward(txid, cspminer, expandTo18Decimals(150000+10000).add(1), reward, nonce, constants.MaxUint256, signature))
                      .to.be.revertedWith("Unstake Overflowed")

        await expect(plantStaking.connect(user1).unstakeWithReward(txid, cspminer, amount.add(1), reward, nonce, constants.MaxUint256, signature))
                      .to.be.revertedWith("Wrong Signature")

        // reward is changed to be deposited beforehand, not be transferred from rewarder 
//       await expect(plantStaking.connect(user1).unstakeWithReward(txid, cspminer, amount, reward, nonce, constants.MaxUint256, signature))
//                      .to.be.revertedWith("ERC20: insufficient allowance")

        await arkreenToken.approve(plantStaking.address, constants.MaxUint256)

         // Event
         await expect(plantStaking.connect(user1).unstakeWithReward(txid, cspminer, amount, reward, nonce, constants.MaxUint256, signature))
//                      .to.emit(arkreenToken, 'Transfer')
//                      .withArgs(deployer.address, plantStaking.address, reward)    
                      .to.emit(arkreenToken, 'Transfer')
                      .withArgs(plantStaking.address, user1.address, amount.add(reward))    
                      .to.emit(plantStaking, 'Unstake')
                      .withArgs(txid, user1.address, cspminer, amount, reward)   

        const stakeInfo1A = await plantStaking.stakeInfo(user1.address)
        const stakeInfo2A = await plantStaking.stakeInfo(user2.address)
        const stakeInfo3A = await plantStaking.stakeInfo(user3.address)

        await walletUnstake(user1, expandTo18Decimals(10000), expandTo18Decimals(1000))
        await walletUnstake(user2, expandTo18Decimals(50000), expandTo18Decimals(5000))
        await walletUnstake(user3, expandTo18Decimals(70000), expandTo18Decimals(7000))

        await walletUnstake(user1, expandTo18Decimals(30000), expandTo18Decimals(3000))
        await walletUnstake(user2, expandTo18Decimals(70000), expandTo18Decimals(7000))
        await walletUnstake(user3, expandTo18Decimals(90000), expandTo18Decimals(9000))

        expect((await plantStaking.stakeInfo(user1.address)).amountStake).to.eq(stakeInfo1A.amountStake.sub(expandTo18Decimals(10000+30000)))
        expect((await plantStaking.stakeInfo(user2.address)).amountStake).to.eq(stakeInfo2A.amountStake.sub(expandTo18Decimals(50000+70000)))
        expect((await plantStaking.stakeInfo(user3.address)).amountStake).to.eq(stakeInfo3A.amountStake.sub(expandTo18Decimals(70000+90000)))

        expect((await plantStaking.stakeInfo(user1.address)).rewardStake).to.eq(expandTo18Decimals(1000+3000 + 1000))  // 1000 comes from the abnormal test
        expect((await plantStaking.stakeInfo(user2.address)).rewardStake).to.eq(expandTo18Decimals(5000+7000))
        expect((await plantStaking.stakeInfo(user3.address)).rewardStake).to.eq(expandTo18Decimals(7000+9000))

        expect(await plantStaking.totalStake()).to.equal(stakeInfo1A.amountStake
                                        .add(stakeInfo2A.amountStake).add(stakeInfo3A.amountStake)
                                        .sub(expandTo18Decimals(10000+30000+50000+70000+70000+90000)))

        expect(await plantStaking.totalReward()).to.equal(expandTo18Decimals(1000+3000+5000+7000+7000+9000 + 1000))

      });

    })
})