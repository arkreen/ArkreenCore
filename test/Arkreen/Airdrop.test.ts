import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
const {ethers, upgrades} =  require("hardhat");
import hre from 'hardhat'
import { ecsign, fromRpcSig, ecrecover } from 'ethereumjs-util'
import { getPermitDigest, getDomainSeparator, expandTo18Decimals, randomAddresses } from '../utils/utilities'
import { constants, BigNumber, } from 'ethers'

// console.log(upgrades)

import {
    ArkreenToken,
    Airdrop,
    Airdrop__factory,
    ArkreenToken__factory,
    ArkreenTokenTest__factory
    // ArkreenTokenV2,
    // ArkreenTokenV2__factory
} from "../../typechain";

describe("test ArkreenToken", ()=>{

    async function deployFixture() {
        const [deployer, user1, user2] = await ethers.getSigners();

        const ArkreenTokenFactory = await ethers.getContractFactory("ArkreenToken")
        const ArkreenToken : ArkreenToken = await upgrades.deployProxy(
            ArkreenTokenFactory, [10000000000, user1.address, '', ''])
  
        await ArkreenToken.deployed()

        const AirdropFactory = await ethers.getContractFactory("Airdrop")
        const airdrop = await AirdropFactory.deploy(ArkreenToken.address, constants.AddressZero, expandTo18Decimals(25))
        await airdrop.deployed()

        await ArkreenToken.connect(user1).approve(airdrop.address, expandTo18Decimals(10000000))

        return {ArkreenToken, airdrop, deployer, user1, user2}
    }

    describe('Airdrop test', () => {
      it("Airdrop test", async function () {
        const {ArkreenToken, airdrop, deployer, user1, user2} = await loadFixture(deployFixture)
        const addressToDrop = randomAddresses(50)

        await expect(airdrop.airdrop(addressToDrop)).to.be.revertedWith("ERC20: transfer amount exceeds balance")

        await ArkreenToken.connect(user1).transfer(airdrop.address, expandTo18Decimals(25 * 100))
        const balanceBefore = await ArkreenToken.balanceOf(airdrop.address)
        await airdrop.airdrop(addressToDrop)

        expect(await ArkreenToken.balanceOf(addressToDrop[0])).to.equal(expandTo18Decimals(25))
        expect(await ArkreenToken.balanceOf(addressToDrop[49])).to.equal(expandTo18Decimals(25))
        expect(await ArkreenToken.balanceOf(airdrop.address)).to.equal(balanceBefore.sub(expandTo18Decimals(25*50)))
      });

      it("airdropWithValue test", async function () {
        const {ArkreenToken, airdrop, deployer, user1, user2} = await loadFixture(deployFixture)
        const addressToDrop = randomAddresses(250)
        const values: BigNumber[] = []
        for (let i = 0; i < 250; i++) values.push(expandTo18Decimals(i+1))

        await ArkreenToken.connect(user1).transfer(airdrop.address, expandTo18Decimals(50000))
        const balanceBefore = await ArkreenToken.balanceOf(airdrop.address)

        await expect(airdrop.connect(user1).airdropWithValue(addressToDrop, values))
                    .to.be.revertedWith("Ownable: caller is not the owner")

        const airdropTx = await airdrop.airdropWithValue(addressToDrop, values)

        const receiptAirdrop = await airdropTx.wait()
        console.log("GasFee to airdrop 200 addesses:", receiptAirdrop.gasUsed)

        expect(await ArkreenToken.balanceOf(addressToDrop[0])).to.equal(expandTo18Decimals(1))
        expect(await ArkreenToken.balanceOf(addressToDrop[49])).to.equal(expandTo18Decimals(50))
        expect(await ArkreenToken.balanceOf(airdrop.address)).to.equal(balanceBefore.sub(expandTo18Decimals(251*250/2)))

      });

      it("airdropGeneric test", async function () {
        const {ArkreenToken, airdrop, deployer, user1, user2} = await loadFixture(deployFixture)
        const addressToDrop = randomAddresses(50)

        const balanceBefore = await ArkreenToken.balanceOf(user1.address)
        await airdrop.airdropGeneric(ArkreenToken.address, user1.address, expandTo18Decimals(30), addressToDrop )

        expect(await ArkreenToken.balanceOf(addressToDrop[0])).to.equal(expandTo18Decimals(30))
        expect(await ArkreenToken.balanceOf(addressToDrop[49])).to.equal(expandTo18Decimals(30))
        expect(await ArkreenToken.balanceOf(user1.address)).to.equal(balanceBefore.sub(expandTo18Decimals(1500)))        
      });      

      it("airdropGenericValue test", async function () {
        const {ArkreenToken, airdrop, deployer, user1, user2} = await loadFixture(deployFixture)
        const addressToDrop = randomAddresses(50)
        const values: BigNumber[] = []
        for (let i = 0; i < 50; i++) values.push(expandTo18Decimals(i+1))

        const balanceBefore = await ArkreenToken.balanceOf(user1.address)
        await airdrop.airdropGenericValue(ArkreenToken.address, user1.address, addressToDrop, values)

        expect(await ArkreenToken.balanceOf(addressToDrop[0])).to.equal(expandTo18Decimals(1))
        expect(await ArkreenToken.balanceOf(addressToDrop[49])).to.equal(expandTo18Decimals(50))
        expect(await ArkreenToken.balanceOf(user1.address)).to.equal(balanceBefore.sub(expandTo18Decimals(1275)))        
      });      
    })
})