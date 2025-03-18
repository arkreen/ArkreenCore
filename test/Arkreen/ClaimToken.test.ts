import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
const {ethers, upgrades} =  require("hardhat");
import hre from 'hardhat'
import { ecsign, fromRpcSig, ecrecover } from 'ethereumjs-util'
import { getPermitDigest, getDomainSeparator, expandTo18Decimals, randomAddresses } from '../utils/utilities'
import { constants, BigNumber, } from 'ethers'

import {
    ArkreenToken,
    ClaimToken,
    ClaimToken__factory,
    ArkreenToken__factory,
    ArkreenTokenTest__factory
    // ArkreenTokenV2,
    // ArkreenTokenV2__factory
} from "../../typechain";

describe("test ClaimToken", ()=>{

    async function deployFixture() {
        const [deployer, manager, user1, user2] = await ethers.getSigners();

        const ArkreenTokenFactory = await ethers.getContractFactory("ArkreenToken")
        const arkreenToken: ArkreenToken = await upgrades.deployProxy(
                                ArkreenTokenFactory, [10000000000, deployer.address, '', ''])
  
        await arkreenToken.deployed()

        const ClaimTokenFactory = await ethers.getContractFactory("ClaimToken")
//      const claimToken: ClaimToken = await ClaimTokenFactory.deploy(arkreenToken.address, manager.address, constants.AddressZero)

        const claimToken: ClaimToken = await upgrades.deployProxy(
                                          ClaimTokenFactory, [arkreenToken.address, manager.address, constants.AddressZero])
        await claimToken.deployed()

        return {arkreenToken, claimToken, deployer, manager, user1, user2}
    }

    describe('ClaimToken test', () => {
      it("ClaimToken basics test", async function () {
        const {arkreenToken, claimToken, deployer, manager, user1, user2} = await loadFixture(deployFixture)

        await arkreenToken.transfer(claimToken.address, expandTo18Decimals(100000000))

        await expect(claimToken.changeManager(user1.address)).to.be.revertedWith("CLAIM: Not Manager")

        await expect(claimToken.connect(manager).changeManager(constants.AddressZero)).to.be.revertedWith("CLAIM: Zero Address")

        await claimToken.connect(manager).changeManager(user1.address)
        expect(await claimToken.manager()).to.equal(user1.address)   
        
        await claimToken.connect(user1).changeManager(manager.address)

        await expect(claimToken.connect(manager).changeFrom(user1.address)).to.be.revertedWith("Ownable: caller is not the owner")

        await claimToken.changeFrom(user1.address)
        expect(await claimToken.from()).to.deep.equal(user1.address)

        await expect(claimToken.connect(manager).withdraw(expandTo18Decimals(10000)))
                          .to.be.revertedWith("Ownable: caller is not the owner")

        const balanceBefore = await arkreenToken.balanceOf(deployer.address)                           
        await claimToken.withdraw(expandTo18Decimals(10000))

        expect(await arkreenToken.balanceOf(deployer.address)).to.equal(balanceBefore.add(expandTo18Decimals(10000)))
        
      });

      it("ClaimToken test", async function () {
        const {arkreenToken, claimToken, deployer, manager, user1, user2} = await loadFixture(deployFixture)

        await arkreenToken.transfer(claimToken.address, expandTo18Decimals(100000000))

        await expect(claimToken.increase(user1.address, expandTo18Decimals(30)))
                        .to.be.revertedWith("CLAIM: Not Manager")

        // await expect(claimToken.connect(manager).increase(user1.address, expandTo18Decimals(100000000+1)))
        //                .to.be.revertedWith("CLAIM: Low Balance")

        await claimToken.connect(manager).increase(user1.address, expandTo18Decimals(30))

        await expect(claimToken.connect(user1).claim(expandTo18Decimals(30).add(1)))
                      .to.be.reverted

        const user1Status1 = [0, expandTo18Decimals(30)]
        expect(await claimToken.users(user1.address)).to.deep.equal(user1Status1)

        expect(await claimToken.allClaimed()).to.deep.equal(0)
        expect(await claimToken.allClaimable()).to.deep.equal(expandTo18Decimals(30))

        await claimToken.connect(manager).increase(user1.address, expandTo18Decimals(50))
        
        const user1Status2 = [0, expandTo18Decimals(80)]
        expect(await claimToken.users(user1.address)).to.deep.equal(user1Status2)

        expect(await claimToken.allClaimed()).to.deep.equal(0)
        expect(await claimToken.allClaimable()).to.deep.equal(expandTo18Decimals(80))

        await expect(claimToken.connect(user1).claim(expandTo18Decimals(20)))
                      .to.emit(claimToken, 'Claimed')
                      .withArgs(user1.address, expandTo18Decimals(20))    

        const user1Status3 = [expandTo18Decimals(20), expandTo18Decimals(60)]
        expect(await claimToken.users(user1.address)).to.deep.equal(user1Status3)
        expect(await arkreenToken.balanceOf(user1.address)).to.equal(expandTo18Decimals(20))

        expect(await claimToken.allClaimed()).to.deep.equal(expandTo18Decimals(20))
        expect(await claimToken.allClaimable()).to.deep.equal(expandTo18Decimals(60))

        await expect(claimToken.connect(user1).claimAll())
                                .to.emit(claimToken, 'Claimed')
                                .withArgs(user1.address, expandTo18Decimals(60))    

        const user1Status = [expandTo18Decimals(80), 0]
        expect(await claimToken.users(user1.address)).to.deep.equal(user1Status)
        expect(await arkreenToken.balanceOf(user1.address)).to.equal(expandTo18Decimals(80))

        expect(await claimToken.allClaimed()).to.deep.equal(expandTo18Decimals(80))
        expect(await claimToken.allClaimable()).to.deep.equal(expandTo18Decimals(0))
      });

      it("ClaimToken test: transferFrom", async function () {
        const {arkreenToken, claimToken, deployer, manager, user1, user2} = await loadFixture(deployFixture)

        await arkreenToken.approve(claimToken.address, expandTo18Decimals(100000000))
        await claimToken.changeFrom(deployer.address)

        // await expect(claimToken.connect(manager).increase(user1.address, expandTo18Decimals(100000000+1)))
        //                  .to.be.revertedWith("CLAIM: Low Allowance")

        await claimToken.connect(manager).increase(user1.address, expandTo18Decimals(30))

        const user1Status1 = [0, expandTo18Decimals(30)]
        expect(await claimToken.users(user1.address)).to.deep.equal(user1Status1)

        expect(await claimToken.allClaimed()).to.deep.equal(0)
        expect(await claimToken.allClaimable()).to.deep.equal(expandTo18Decimals(30))

        await claimToken.connect(manager).increase(user1.address, expandTo18Decimals(50))
        
        const user1Status2 = [0, expandTo18Decimals(80)]
        expect(await claimToken.users(user1.address)).to.deep.equal(user1Status2)

        expect(await claimToken.allClaimed()).to.deep.equal(0)
        expect(await claimToken.allClaimable()).to.deep.equal(expandTo18Decimals(80))

        await expect(claimToken.connect(user1).claim(expandTo18Decimals(20)))
                      .to.emit(claimToken, 'Claimed')
                      .withArgs(user1.address, expandTo18Decimals(20))    

        const user1Status3 = [expandTo18Decimals(20), expandTo18Decimals(60)]
        expect(await claimToken.users(user1.address)).to.deep.equal(user1Status3)
        expect(await arkreenToken.balanceOf(user1.address)).to.equal(expandTo18Decimals(20))

        expect(await claimToken.allClaimed()).to.deep.equal(expandTo18Decimals(20))
        expect(await claimToken.allClaimable()).to.deep.equal(expandTo18Decimals(60))

        await expect(claimToken.connect(user1).claimAll())
                                .to.emit(claimToken, 'Claimed')
                                .withArgs(user1.address, expandTo18Decimals(60))    

        const user1Status = [expandTo18Decimals(80), 0]
        expect(await claimToken.users(user1.address)).to.deep.equal(user1Status)
        expect(await arkreenToken.balanceOf(user1.address)).to.equal(expandTo18Decimals(80))

        expect(await claimToken.allClaimed()).to.deep.equal(expandTo18Decimals(80))
        expect(await claimToken.allClaimable()).to.deep.equal(expandTo18Decimals(0))
      });

      it("ClaimToken test: two users", async function () {
        const {arkreenToken, claimToken, deployer, manager, user1, user2} = await loadFixture(deployFixture)

        await arkreenToken.transfer(claimToken.address, expandTo18Decimals(100000000))

        await claimToken.connect(manager).increase(user1.address, expandTo18Decimals(30))
        await claimToken.connect(manager).increase(user2.address, expandTo18Decimals(80))

        expect(await claimToken.allClaimed()).to.deep.equal(expandTo18Decimals(0))
        expect(await claimToken.allClaimable()).to.deep.equal(expandTo18Decimals(110))

        await claimToken.connect(user1).claimAll()
        await claimToken.connect(user2).claim(expandTo18Decimals(30))

        const user1Status = [expandTo18Decimals(30), 0]
        const user2Status = [expandTo18Decimals(30), expandTo18Decimals(50)]
        expect(await claimToken.users(user1.address)).to.deep.equal(user1Status)
        expect(await claimToken.users(user2.address)).to.deep.equal(user2Status)

        expect(await claimToken.allClaimed()).to.deep.equal(expandTo18Decimals(60))
        expect(await claimToken.allClaimable()).to.deep.equal(expandTo18Decimals(50))
      });

      it("decrease test", async function () {
        const {arkreenToken, claimToken, deployer, manager, user1, user2} = await loadFixture(deployFixture)

        await arkreenToken.transfer(claimToken.address, expandTo18Decimals(100000000))

        await claimToken.connect(manager).increase(user1.address, expandTo18Decimals(30))
        await claimToken.connect(manager).increase(user2.address, expandTo18Decimals(80))

        await claimToken.connect(user1).claim(expandTo18Decimals(10))
        await claimToken.connect(user2).claim(expandTo18Decimals(30))

        await expect(claimToken.decrease(user1.address, expandTo18Decimals(10))).to.be.revertedWith("CLAIM: Not Manager")

        await expect(claimToken.connect(manager).decrease(user1.address, expandTo18Decimals(30)))
                      .to.be.revertedWith("CLAIM: Too More Value")

        await claimToken.connect(manager).decrease(user1.address, expandTo18Decimals(15))
        await claimToken.connect(manager).decrease(user2.address, expandTo18Decimals(20))
        
        const user1Status = [expandTo18Decimals(10), expandTo18Decimals(5)]
        const user2Status = [expandTo18Decimals(30), expandTo18Decimals(30)]
        expect(await claimToken.users(user1.address)).to.deep.equal(user1Status)
        expect(await claimToken.users(user2.address)).to.deep.equal(user2Status)

        expect(await claimToken.allClaimed()).to.deep.equal(expandTo18Decimals(40))
        expect(await claimToken.allClaimable()).to.deep.equal(expandTo18Decimals(35))
      });

      it("increaseBatch test", async function () {
        const {arkreenToken, claimToken, deployer, manager, user1, user2} = await loadFixture(deployFixture)

        await arkreenToken.transfer(claimToken.address, expandTo18Decimals(100000000))

        await expect(claimToken.increaseBatch([user1.address, user2.address], [expandTo18Decimals(30),expandTo18Decimals(80)]))
                                                  .to.be.revertedWith("CLAIM: Not Manager")

        await expect(claimToken.connect(manager).increaseBatch([user1.address, user2.address], [expandTo18Decimals(30)]))
                                .to.be.revertedWith("CLAIM: Wrong Length")

        await claimToken.connect(manager).increaseBatch([user1.address, user2.address], [expandTo18Decimals(30),expandTo18Decimals(80)] )

        expect(await claimToken.allClaimed()).to.deep.equal(expandTo18Decimals(0))
        expect(await claimToken.allClaimable()).to.deep.equal(expandTo18Decimals(110))

        await claimToken.connect(user1).claimAll()
        await claimToken.connect(user2).claim(expandTo18Decimals(30))

        const user1Status = [expandTo18Decimals(30), 0]
        const user2Status = [expandTo18Decimals(30), expandTo18Decimals(50)]
        expect(await claimToken.users(user1.address)).to.deep.equal(user1Status)
        expect(await claimToken.users(user2.address)).to.deep.equal(user2Status)

        expect(await claimToken.allClaimed()).to.deep.equal(expandTo18Decimals(60))
        expect(await claimToken.allClaimable()).to.deep.equal(expandTo18Decimals(50))
      });


    })
})