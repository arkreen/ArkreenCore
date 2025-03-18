import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import { loadFixture, mine } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";

import { ethers, network, upgrades } from "hardhat";

import { constants, BigNumber, } from 'ethers'
import { expandTo18Decimals, getPlantUnstakingDigest, getPlantStakingDigest, randomAddresses } from "../utils/utilities"
import { ecsign } from 'ethereumjs-util'
import { ArkreenToken, ArkreenPromotion, StakingRewards, ArkreenMiner } from "../../typechain";

describe("ArkreenPromotion test", ()=> {

    let deployer: SignerWithAddress
    let manager:  SignerWithAddress
    let user1:  SignerWithAddress
    let user2: SignerWithAddress
    let user3: SignerWithAddress

    let arkreenToken:             ArkreenToken
    let artToken:                 ArkreenToken
    let arkreenPromotion:         ArkreenPromotion
    let stakingRewards:           StakingRewards
    let arkreenMiner:             ArkreenMiner
    let privateKeyManager:        string

    let allStakeAmount    = BigNumber.from(0)
    let allRewardAmount    = BigNumber.from(0)

    async function deployFixture() {
        const [deployer, manager, user1, user2, user3] = await ethers.getSigners();

        const ArkreenTokenFactory = await ethers.getContractFactory("ArkreenToken")
        const arkreenToken: ArkreenToken = await upgrades.deployProxy(
                                ArkreenTokenFactory, [10000000000, deployer.address, '', '']) as ArkreenToken
          await arkreenToken.deployed()

        const artToken: ArkreenToken = await upgrades.deployProxy(
                                ArkreenTokenFactory, [10000000000, deployer.address, 'ART Token', 'ART']) as ArkreenToken
        await artToken.deployed()

        const ArkreenMinerFactory = await ethers.getContractFactory("ArkreenMiner")
        arkreenMiner = await upgrades.deployProxy(ArkreenMinerFactory, 
                                [arkreenToken.address, user3.address, user1.address, user2.address]) as ArkreenMiner

        await arkreenMiner.deployed()

        const stakingRewardsFactory = await ethers.getContractFactory("StakingRewards")
        stakingRewards = await upgrades.deployProxy(stakingRewardsFactory, 
                                        [arkreenToken.address, artToken.address, arkreenMiner.address, deployer.address]) as StakingRewards

        await stakingRewards.deployed()
        await stakingRewards.setStakeParameter(expandTo18Decimals(10000) , 200)
        await stakingRewards.changeUnstakeLock(true)

        const arkreenPromotionFactory = await ethers.getContractFactory("ArkreenPromotion")
        const arkreenPromotion = await upgrades.deployProxy(arkreenPromotionFactory,
                                            [stakingRewards.address, arkreenToken.address, artToken.address, arkreenMiner.address]) as ArkreenPromotion
        await arkreenPromotion.deployed()

        await arkreenToken.transfer(user1.address, expandTo18Decimals(100000000))
        await arkreenToken.transfer(user2.address, expandTo18Decimals(200000000))
        await arkreenToken.transfer(user3.address, expandTo18Decimals(500000000))
     
        return {arkreenToken, artToken, arkreenMiner, stakingRewards, arkreenPromotion, deployer, manager, user1, user2, user3}
    }

    describe('ArkreenPromotion test', () => {
      beforeEach(async () => {
        const fixture = await loadFixture(deployFixture)
        privateKeyManager = process.env.MANAGER_TEST_PRIVATE_KEY as string

        arkreenToken = fixture.arkreenToken
        artToken = fixture.artToken
        arkreenPromotion = fixture.arkreenPromotion
        stakingRewards = fixture.stakingRewards
        arkreenMiner = fixture.arkreenMiner
        
        deployer = fixture.deployer
        manager = fixture.manager
        user1 = fixture.user1
        user2 = fixture.user2
        user3 = fixture.user3

        await arkreenToken.connect(user1).approve(arkreenPromotion.address, constants.MaxUint256)
        await arkreenToken.connect(user2).approve(arkreenPromotion.address, constants.MaxUint256)
        await arkreenToken.connect(user3).approve(arkreenPromotion.address, constants.MaxUint256)

        allStakeAmount    = BigNumber.from(0)
        allRewardAmount   = BigNumber.from(0)
      })


      it("ArkreenPromotion Test", async function () {


      });

    })
})