import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import { loadFixture, mine } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
const {ethers, upgrades} =  require("hardhat");
import hre from 'hardhat'
import { ecsign, } from 'ethereumjs-util'
import { expandTo18Decimals, randomAddresses } from '../utils/utilities'
import { OffsetActionBatch, getGreenPowerRewardDigest, getGreenPowerRewardDigestExt } from '../utils/utilities'


import { constants, BigNumber, utils} from 'ethers'
import { anyValue } from "@nomicfoundation/hardhat-chai-matchers/withArgs";

import {
    ArkreenToken,
    RwaCSP,
} from "../../typechain";

const constants_MaxDealine = BigNumber.from('0xFFFFFFFF')

describe("RwaCSP Test Campaign", ()=>{

    let deployer: SignerWithAddress;
    let manager: SignerWithAddress;
    let register_authority: SignerWithAddress;
    let fund_receiver: SignerWithAddress;

    let owner1: SignerWithAddress;
    let maker1: SignerWithAddress;
    let user1:  SignerWithAddress
    let user2:  SignerWithAddress
    let user3:  SignerWithAddress

    let privateKeyManager:      string
    let privateKeyRegister:     string
    let privateKeyOwner:        string
    let privateKeyMaker:        string

    let AKREToken:                    ArkreenToken

    let rwaCsp:                   RwaCSP

    const Bytes32_Zero = "0x0000000000000000000000000000000000000000000000000000000000000000"

    async function deployFixture() {
        const AKRETokenFactory = await ethers.getContractFactory("ArkreenToken");
        const AKREToken = await upgrades.deployProxy(AKRETokenFactory, [10_000_000_000, deployer.address,'','']) as ArkreenToken
        await AKREToken.deployed();
     
        await AKREToken.transfer(owner1.address, expandTo18Decimals(300_000_000))
        await AKREToken.transfer(maker1.address, expandTo18Decimals(300_000_000))

        const RwaCSPFactory = await ethers.getContractFactory("RwaCSP")
        const rwaCsp = await upgrades.deployProxy(RwaCSPFactory, [AKREToken.address, manager.address]) as RwaCSP
        await rwaCsp.deployed()
       
        return { AKREToken, rwaCsp }
    }

    describe('RwaCSP test', () => {

      beforeEach(async () => {

        [deployer, manager, register_authority, fund_receiver, owner1, user1, user2, user3, maker1] = await ethers.getSigners();

        privateKeyManager = process.env.MANAGER_TEST_PRIVATE_KEY as string
        privateKeyRegister = process.env.REGISTER_TEST_PRIVATE_KEY as string
        privateKeyOwner = process.env.OWNER_TEST_PRIVATE_KEY as string
        privateKeyMaker = process.env.MAKER_TEST_PRIVATE_KEY as string
    
        const fixture = await loadFixture(deployFixture)
        AKREToken = fixture.AKREToken
        rwaCsp = fixture.rwaCsp

        await AKREToken.connect(user1).approve(rwaCsp.address, constants.MaxUint256)
        await AKREToken.connect(user2).approve(rwaCsp.address, constants.MaxUint256)
        await AKREToken.connect(user3).approve(rwaCsp.address, constants.MaxUint256)

      });

      it("RwaCSP claimReward Test", async function () {
        // Normal
        await AKREToken.transfer(user1.address, expandTo18Decimals(100_000_000))
        await AKREToken.transfer(user2.address, expandTo18Decimals(100_000_000))
        await AKREToken.transfer(user3.address, expandTo18Decimals(100_000_000))
        await AKREToken.transfer(rwaCsp.address, expandTo18Decimals(100_000_000))

        const {nonce}  = await rwaCsp.getUserInfo(user1.address)

        const txid = randomAddresses(1)[0]
        const amount = expandTo18Decimals(12345)
  
        const digest = getGreenPowerRewardDigest(
            'RWA CSP',
            rwaCsp.address,
            { txid, greener: user1.address, amount, nonce},
            constants.MaxUint256
          )

        const {v,r,s} = ecsign(Buffer.from(digest.slice(2), 'hex'), Buffer.from(privateKeyManager.slice(2), 'hex'))   
        const signature: RwaCSP.SigStruct = { v, r, s }  

        const balanceBefore = await AKREToken.balanceOf(rwaCsp.address)
        const {amountClaimed: rewardAmountA, nonce: nonceA} = await rwaCsp.getUserInfo(user1.address)
        const totalReward = await rwaCsp.totalReward()
        const balanceAKRE = await AKREToken.balanceOf(user1.address)

        await expect(rwaCsp.connect(user1).claimReward(txid, amount, nonce, constants.MaxUint256, signature))
                      .to.emit(rwaCsp, 'ClaimReward')
                      .withArgs(txid, user1.address, amount,  nonce)

        // Check totalStake
        expect(await rwaCsp.totalReward()).to.eq(totalReward.add(expandTo18Decimals(12345)))

        const {amountClaimed: rewardAmountB, nonce: nonceB} = await rwaCsp.getUserInfo(user1.address)
        expect(nonceB).to.eq(nonceA.add(1))
        expect(rewardAmountB).to.eq(rewardAmountA.add(expandTo18Decimals(12345)))
        expect(await AKREToken.balanceOf(user1.address)).to.eq(balanceAKRE.add(expandTo18Decimals(12345)))
        expect(await AKREToken.balanceOf(rwaCsp.address)).to.eq(balanceBefore.sub(expandTo18Decimals(12345)))

        // Abnormal
        await expect(rwaCsp.connect(user1).claimReward(txid, amount, nonce.add(2), constants.MaxUint256, signature))
                    .to.be.revertedWith("Nonce Not Match")

        await expect(rwaCsp.connect(user1).claimReward(txid, amount, nonce.add(1), constants.MaxUint256, signature))
                    .to.be.revertedWith("Wrong Signature")
        
      });

      it("RwaCSP claimRewardExt Test", async function () {
        // Normal
        await AKREToken.transfer(user1.address, expandTo18Decimals(100_000_000))
        await AKREToken.transfer(user2.address, expandTo18Decimals(100_000_000))
        await AKREToken.transfer(user3.address, expandTo18Decimals(100_000_000))
        await AKREToken.transfer(rwaCsp.address, expandTo18Decimals(100_000_000))

        const {nonce}  = await rwaCsp.getUserInfo(user1.address)

        const txid = randomAddresses(1)[0]
        const amount = expandTo18Decimals(12345)
  
        const digest = getGreenPowerRewardDigestExt(
            'RWA CSP',
            rwaCsp.address,
            { txid, greener: user1.address, receiver: user2.address, amount, nonce},
            constants.MaxUint256
          )

        const {v,r,s} = ecsign(Buffer.from(digest.slice(2), 'hex'), Buffer.from(privateKeyManager.slice(2), 'hex'))   
        const signature: RwaCSP.SigStruct = { v, r, s }

        const balanceBefore = await AKREToken.balanceOf(rwaCsp.address)
        const {amountClaimed: rewardAmountA, nonce: nonceA} = await rwaCsp.getUserInfo(user1.address)
        const totalReward = await rwaCsp.totalReward()
        const balanceAKRE = await AKREToken.balanceOf(user2.address)

        await expect(rwaCsp.connect(user1).claimRewardExt(txid, user2.address, amount, nonce, constants.MaxUint256, signature))
                      .to.emit(rwaCsp, 'ClaimRewardExt')
                      .withArgs(txid, user1.address, user2.address, amount,  nonce)

        // Check totalStake
        expect(await rwaCsp.totalReward()).to.eq(totalReward.add(expandTo18Decimals(12345)))

        const {amountClaimed: rewardAmountB, nonce: nonceB} = await rwaCsp.getUserInfo(user1.address)
        expect(nonceB).to.eq(nonceA.add(1))
        expect(rewardAmountB).to.eq(rewardAmountA.add(expandTo18Decimals(12345)))
        expect(await AKREToken.balanceOf(user2.address)).to.eq(balanceAKRE.add(expandTo18Decimals(12345)))
        expect(await AKREToken.balanceOf(rwaCsp.address)).to.eq(balanceBefore.sub(expandTo18Decimals(12345)))

        // Abnormal
        await expect(rwaCsp.connect(user1).claimRewardExt(txid, user2.address, amount, nonce.add(2), constants.MaxUint256, signature))
                    .to.be.revertedWith("Nonce Not Match")

        await expect(rwaCsp.connect(user1).claimRewardExt(txid, user2.address, amount, nonce.add(1), constants.MaxUint256, signature))
                    .to.be.revertedWith("Wrong Signature")
        
      });

    })
})