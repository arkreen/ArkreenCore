import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
const {ethers, upgrades} =  require("hardhat");
import { providers, utils, BigNumber, Signer, Wallet} from 'ethers'
import hre from 'hardhat'
import { ecsign, fromRpcSig, ecrecover } from 'ethereumjs-util'
import { getWithdrawDigest, getWithdrawDigestExt } from "../utils/utilities";
import { constants } from 'ethers'

import {
    ArkreenReward,
    ArkreenReward__factory,
    ArkreenToken,
    ArkreenToken__factory,
} from "../../typechain";

describe("Test ArkreenReward Contract ", () => {

    let privateKeyManager:  string

    async function deployFixture() {
        const [deployer, foundation, user2] = await ethers.getSigners();
        privateKeyManager = process.env.MANAGER_TEST_PRIVATE_KEY as string

        const ArkreenTokenFactory = await ethers.getContractFactory("ArkreenToken");
        const AKREToken: ArkreenToken= await upgrades.deployProxy(ArkreenTokenFactory, [10_000_000_000, foundation.address,'','']);
        await AKREToken.deployed();
            
        const ArkreenRewardFactory = await ethers.getContractFactory("ArkreenReward")
        const ArkreenReward:ArkreenReward = await upgrades.deployProxy(ArkreenRewardFactory,[AKREToken.address, foundation.address])
        await ArkreenReward.deployed()
            
        await AKREToken.connect(foundation).transfer(ArkreenReward.address, 10000*10**8)
        
        return {AKREToken, ArkreenReward, deployer, foundation, user2}
    }

    describe('init test', ()=>{
        it("all argument should be set correctly", async ()=>{
            const {AKREToken, ArkreenReward, deployer, foundation, user2} = await loadFixture(deployFixture) 
            expect(await ArkreenReward.connect(deployer).validationAddress()).to.be.equal(foundation.address)
            expect(await ArkreenReward.connect(deployer).ERC20Contract()).to.be.equal(AKREToken.address)
        })

        it('function initialize() could be execute only onec',async () => {
            const {AKREToken, ArkreenReward, deployer, foundation, user2} = await loadFixture(deployFixture) 

            await expect(ArkreenReward.initialize(AKREToken.address, user2.address)).to.be.revertedWith("Initializable: contract is already initialized")
        })
    })

    describe("withdraw test", ()=>{

        it("foundation sign & user withdraw", async ()=>{
            const {AKREToken, ArkreenReward, deployer, foundation, user2} = await loadFixture(deployFixture) 
            const digest = getWithdrawDigest(
                user2.address,
                ethers.BigNumber.from(100*10**8),
                ethers.BigNumber.from(0),
                ArkreenReward.address,
                'Arkreen Reward'
              )

              const {v,r,s} = ecsign(Buffer.from(digest.slice(2), 'hex'), Buffer.from(privateKeyManager.slice(2), 'hex'))

              expect(await ArkreenReward.connect(user2).withdraw(
                user2.address, 
                ethers.BigNumber.from(100*10**8), 
                ethers.BigNumber.from(0), 
                v,r,s)).to.be.ok

              expect(await ArkreenReward.connect(deployer).nonces(user2.address)).to.be.equal(1)
              expect(await AKREToken.balanceOf(user2.address)).to.be.equal(100*10**8)
              expect(await AKREToken.balanceOf(ArkreenReward.address)).to.be.equal((10000-100)*10**8)           
        
        })

        it("receiver error should be reverted", async ()=>{
            const {AKREToken, ArkreenReward, deployer, foundation, user2} = await loadFixture(deployFixture) 

            const digest = getWithdrawDigest(
                user2.address,
                ethers.BigNumber.from(100*10**8),
                ethers.BigNumber.from(0),
                ArkreenReward.address,
                'Arkreen Reward'
              )

              const {v,r,s} = ecsign(Buffer.from(digest.slice(2), 'hex'), Buffer.from(privateKeyManager.slice(2), 'hex'))

              await expect( ArkreenReward.connect(deployer).withdraw(
                user2.address, 
                ethers.BigNumber.from(100*10**8), 
                ethers.BigNumber.from(0), 
                v,r,s)).to.be.revertedWith('only receiver can withdraw token')        
  
        })
        
        it("nonce error should be reverted", async ()=>{
            const {AKREToken, ArkreenReward, deployer, foundation, user2} = await loadFixture(deployFixture) 

            const digest = getWithdrawDigest(
                user2.address,
                ethers.BigNumber.from(100*10**8),
                ethers.BigNumber.from(0),
                ArkreenReward.address,
                'Arkreen Reward'
              )

              const {v,r,s} = ecsign(Buffer.from(digest.slice(2), 'hex'), Buffer.from(privateKeyManager.slice(2), 'hex'))

              await expect( ArkreenReward.connect(user2).withdraw(
                user2.address, 
                ethers.BigNumber.from(100*10**8), 
                ethers.BigNumber.from(99), 
                v,r,s)).to.be.revertedWith('nonce does not macth')        
  
        })

        it("sig error should be reverted", async ()=>{
            const {AKREToken, ArkreenReward, deployer, foundation, user2} = await loadFixture(deployFixture) 

            const digest = getWithdrawDigest(
                user2.address,
                ethers.BigNumber.from(100*10**8),
                ethers.BigNumber.from(0),
                ArkreenReward.address,
                'Arkreen RewardX'         // Wrong Name 
              )

              const {v,r,s} = ecsign(Buffer.from(digest.slice(2), 'hex'), Buffer.from(privateKeyManager.slice(2), 'hex'))

              await expect( ArkreenReward.connect(user2).withdraw(
                user2.address, 
                ethers.BigNumber.from(100*10**8), 
                ethers.BigNumber.from(0), 
                v,r,s)).to.be.revertedWith('signer doesn\'t not match or singature error')        
        })

        it("when paused , user can not withdraw", async ()=>{
            const {AKREToken, ArkreenReward, deployer, foundation, user2} = await loadFixture(deployFixture) 

            await ArkreenReward.connect(deployer).pause()//set pause

            const digest = getWithdrawDigest(
                user2.address,
                ethers.BigNumber.from(100*10**8),
                ethers.BigNumber.from(0),
                ArkreenReward.address,
                'Arkreen Reward'
              )

              const {v,r,s} = ecsign(Buffer.from(digest.slice(2), 'hex'), Buffer.from(privateKeyManager.slice(2), 'hex'))

              await expect(ArkreenReward.connect(user2).withdraw(
                user2.address, 
                ethers.BigNumber.from(100*10**8), 
                ethers.BigNumber.from(0), 
                v,r,s)).to.be.rejectedWith('Pausable: paused')   
        
                
        })

    })

    describe("withdrawExt test", ()=>{

      it("foundation sign & user withdrawExt", async ()=>{
          const {AKREToken, ArkreenReward, deployer, foundation, user2} = await loadFixture(deployFixture) 
          const digest = getWithdrawDigestExt(
              deployer.address,
              user2.address,
              ethers.BigNumber.from(100*10**8),
              ethers.BigNumber.from(0),
              ArkreenReward.address,
              'Arkreen Reward'
            )

            const {v,r,s} = ecsign(Buffer.from(digest.slice(2), 'hex'), Buffer.from(privateKeyManager.slice(2), 'hex'))

            expect(await ArkreenReward.withdrawExt(
              user2.address, 
              ethers.BigNumber.from(100*10**8), 
              ethers.BigNumber.from(0), 
              v,r,s)).to.be.ok

            expect(await ArkreenReward.nonces(deployer.address)).to.be.equal(1)
            expect(await AKREToken.balanceOf(user2.address)).to.be.equal(100*10**8)
            expect(await AKREToken.balanceOf(ArkreenReward.address)).to.be.equal((10000-100)*10**8)           
      
      })

/*      
      it("receiver error should be reverted", async ()=>{
          const {AKREToken, ArkreenReward, deployer, foundation, user2} = await loadFixture(deployFixture) 

          const digest = getWithdrawDigestExt(
              deployer.address,
              user2.address,
              ethers.BigNumber.from(100*10**8),
              ethers.BigNumber.from(0),
              ArkreenReward.address,
              'Arkreen Reward'
            )

            const {v,r,s} = ecsign(Buffer.from(digest.slice(2), 'hex'), Buffer.from(privateKeyManager.slice(2), 'hex'))

            await expect( ArkreenReward.connect(deployer).withdrawExt(
              user2.address, 
              ethers.BigNumber.from(100*10**8), 
              ethers.BigNumber.from(0), 
              v,r,s)).to.be.revertedWith('only receiver can withdraw token')        

      })
*/      
      it("nonce error should be reverted", async ()=>{
          const {AKREToken, ArkreenReward, deployer, foundation, user2} = await loadFixture(deployFixture) 

          const digest = getWithdrawDigestExt(
              deployer.address,
              user2.address,
              ethers.BigNumber.from(100*10**8),
              ethers.BigNumber.from(0),
              ArkreenReward.address,
              'Arkreen Reward'
            )

            const {v,r,s} = ecsign(Buffer.from(digest.slice(2), 'hex'), Buffer.from(privateKeyManager.slice(2), 'hex'))

            await expect( ArkreenReward.withdrawExt(
              user2.address, 
              ethers.BigNumber.from(100*10**8), 
              ethers.BigNumber.from(99), 
              v,r,s)).to.be.revertedWith('nonce does not macth')        

      })

      it("sig error should be reverted", async ()=>{
          const {AKREToken, ArkreenReward, deployer, foundation, user2} = await loadFixture(deployFixture) 

          const digest = getWithdrawDigestExt(
              deployer.address,
              user2.address,
              ethers.BigNumber.from(100*10**8),
              ethers.BigNumber.from(1),
              ArkreenReward.address,
              'Arkreen RewardX'         // Wrong Name 
            )

            const {v,r,s} = ecsign(Buffer.from(digest.slice(2), 'hex'), Buffer.from(privateKeyManager.slice(2), 'hex'))

            await expect( ArkreenReward.withdrawExt(
              user2.address, 
              ethers.BigNumber.from(100*10**8), 
              ethers.BigNumber.from(0), 
              v,r,s)).to.be.revertedWith('signer doesn\'t not match or singature error')        
      })

      it("when paused , user can not withdrawExt", async ()=>{
          const {AKREToken, ArkreenReward, deployer, foundation, user2} = await loadFixture(deployFixture) 

          await ArkreenReward.connect(deployer).pause()//set pause

          const digest = getWithdrawDigestExt(
              deployer.address,
              user2.address,
              ethers.BigNumber.from(100*10**8),
              ethers.BigNumber.from(1),
              ArkreenReward.address,
              'Arkreen Reward'
            )

            const {v,r,s} = ecsign(Buffer.from(digest.slice(2), 'hex'), Buffer.from(privateKeyManager.slice(2), 'hex'))

            await expect(ArkreenReward.withdrawExt(
              user2.address, 
              ethers.BigNumber.from(100*10**8), 
              ethers.BigNumber.from(0), 
              v,r,s)).to.be.rejectedWith('Pausable: paused')   
      })
  })


    describe("ownerable test" , ()=>{

        it('only owner could call pause',async () => {
            const {AKREToken, ArkreenReward, deployer, foundation, user2} = await loadFixture(deployFixture) 
            await expect(ArkreenReward.connect(user2).pause()).to.be.revertedWith('Ownable: caller is not the owner')
        })

        it('only owner could call unpause',async () => {
            const {AKREToken, ArkreenReward, deployer, foundation, user2} = await loadFixture(deployFixture) 
            await ArkreenReward.connect(deployer).pause()
            await expect(ArkreenReward.connect(user2).unpause()).to.be.revertedWith('Ownable: caller is not the owner')

        })

        it('only owner could call setERC20ContractAddress',async () => {
            const {AKREToken, ArkreenReward, deployer, foundation, user2} = await loadFixture(deployFixture) 
            await expect(ArkreenReward.connect(user2).setERC20ContractAddress(ArkreenReward.address)).to.be.revertedWith('Ownable: caller is not the owner')
            
        })

        it('only owner could call setValidationAddress',async () => {
            const {AKREToken, ArkreenReward, deployer, foundation, user2} = await loadFixture(deployFixture) 
            await expect(ArkreenReward.connect(user2).setValidationAddress(user2.address)).to.be.revertedWith('Ownable: caller is not the owner')
            
        })

        it('only owner can transfer ownership',async () => {
            const {ArkreenReward, deployer, foundation, user2} = await loadFixture(deployFixture)

            expect(await ArkreenReward.owner()).to.be.equal(deployer.address)
            await ArkreenReward.transferOwnership(foundation.address)
            expect(await ArkreenReward.owner()).to.be.equal(foundation.address)
            await expect(ArkreenReward.transferOwnership(user2.address)).to.be.revertedWith("Ownable: caller is not the owner")
            await ArkreenReward.connect(foundation).transferOwnership(user2.address)
            expect(await ArkreenReward.owner()).to.be.equal(user2.address)
        })

        it('transfer ownership to address 0 is not allowed',async () => {
            const {ArkreenReward, deployer, foundation, user2} = await loadFixture(deployFixture)
            await expect(ArkreenReward.transferOwnership(constants.AddressZero)).to.be.revertedWith("Ownable: new owner is the zero address")
        })

    })

    describe('set functions test',async () => {
        
        it('use setERC20ContractAddress func set ERC20 address',async () => {
            const {AKREToken, ArkreenReward, deployer, foundation, user2} = await loadFixture(deployFixture) 
            expect(await ArkreenReward.connect(deployer).setERC20ContractAddress(ArkreenReward.address)).to.be.ok
            expect(await ArkreenReward.connect(deployer).ERC20Contract()).to.be.equal(ArkreenReward.address)
        })

        it('setERC20ContractAddress: only contract address could be set to ERC20 address',async () => {
            const {AKREToken, ArkreenReward, deployer, foundation, user2} = await loadFixture(deployFixture) 
            await expect(ArkreenReward.connect(deployer).setERC20ContractAddress(user2.address)).to.be.revertedWith('is not a contract address')
        })

        it('setERC20ContractAddress: 0 address is forbidden',async () => {
            const {AKREToken, ArkreenReward, deployer, foundation, user2} = await loadFixture(deployFixture) 
            await expect(ArkreenReward.connect(deployer).setERC20ContractAddress(constants.AddressZero)).to.be.revertedWith('zero address is not allowed')
        })

        it('use setValidationAddress func set validator address',async () => {
            const {AKREToken, ArkreenReward, deployer, foundation, user2} = await loadFixture(deployFixture) 
            expect(await ArkreenReward.connect(deployer).setValidationAddress(user2.address)).to.be.ok
            expect(await ArkreenReward.connect(deployer).validationAddress()).to.be.equal(user2.address)
        })

        it('setValidationAddress: 0 address is forbidden',async () => {
            const {AKREToken, ArkreenReward, deployer, foundation, user2} = await loadFixture(deployFixture) 
            await expect(ArkreenReward.connect(deployer).setValidationAddress(constants.AddressZero)).to.be.revertedWith('zero address is not allowed')
        })
    })

    describe("upgrade test", ()=>{
        it("contract owner should be deployer", async () =>{
            const {ArkreenReward, deployer, foundation, user2} = await loadFixture(deployFixture)
            expect(await ArkreenReward.connect(deployer).owner()).to.be.equal(deployer.address)
        })

        it("upgrade and call function, use method 1", async ()=>{
            const {AKREToken, ArkreenReward: arkreenRewardV1, deployer, foundation, user2} = await loadFixture(deployFixture)

            let ArkreenRewardFactory = await ethers.getContractFactory("ArkreenReward")
            let ArkreenReward = await upgrades.upgradeProxy(arkreenRewardV1.address, ArkreenRewardFactory)
            expect(ArkreenReward.address).to.be.equal(arkreenRewardV1.address)

            // console.log(await upgrades.erc1967.getImplementationAddress(arkreenRewardV1.address)," getImplementationAddress")
            
            expect(await ArkreenReward.connect(deployer).ERC20Contract()).to.be.equal(AKREToken.address)
        })

        it("upgrade , use method 2", async ()=>{
            const {AKREToken, ArkreenReward: arkreenRewardV1, deployer, foundation, user2} = await loadFixture(deployFixture)

            let ArkreenRewardV2Factory = await ethers.getContractFactory("ArkreenReward")
            let AKRERewardV2 = await ArkreenRewardV2Factory.deploy()
            await AKRERewardV2.deployed()

            const ArkreenRewardV1Factory = ArkreenReward__factory.connect(arkreenRewardV1.address, deployer);
            const updateTx = await arkreenRewardV1.upgradeTo(AKRERewardV2.address)
            await updateTx.wait()

            expect(await upgrades.erc1967.getImplementationAddress(arkreenRewardV1.address)).to.be.equal(AKRERewardV2.address)
            
            const ARewardV2Factory = ArkreenReward__factory.connect(arkreenRewardV1.address, deployer);
            const arkreenRewardV2 = ARewardV2Factory.attach(arkreenRewardV1.address)  
            expect(await arkreenRewardV2.connect(deployer).ERC20Contract()).to.be.equal(AKREToken.address)
        })

        it('only owner could do upgrade',async () => {
            const {ArkreenReward: arkreenRewardV1, deployer, foundation, user2} = await loadFixture(deployFixture)

            let ArkreenRewardV2Factory = await ethers.getContractFactory("ArkreenReward")
            let AKRERewardV2 = await ArkreenRewardV2Factory.deploy()
            await AKRERewardV2.deployed()
            
            await expect(arkreenRewardV1.connect(user2).upgradeTo(AKRERewardV2.address)).to.be.revertedWith('Ownable: caller is not the owner')
        })
    })

    describe('event test',async () => {

        it("withdraw should emit event",async () => {
            const {ArkreenReward, deployer, foundation, user2} = await loadFixture(deployFixture)

            const digest = getWithdrawDigest(
                user2.address,
                ethers.BigNumber.from(100*10**8),
                ethers.BigNumber.from(0),
                ArkreenReward.address,
                'Arkreen Reward'
              )

              const {v,r,s} = ecsign(Buffer.from(digest.slice(2), 'hex'), Buffer.from(privateKeyManager.slice(2), 'hex'))

              await expect(ArkreenReward.connect(user2).withdraw(
                user2.address, 
                ethers.BigNumber.from(100*10**8), 
                ethers.BigNumber.from(0), 
                v,r,s))
                .to.emit(ArkreenReward, 'UserWithdraw')
                .withArgs(user2.address, ethers.BigNumber.from(100*10**8), ethers.BigNumber.from(0))
        })
    })

    describe('event test',async () => {

      it("withdrawExt should emit event",async () => {
          const {ArkreenReward, deployer, foundation, user2} = await loadFixture(deployFixture)

          const digest = getWithdrawDigestExt(
              deployer.address,
              user2.address,
              ethers.BigNumber.from(100*10**8),
              ethers.BigNumber.from(0),
              ArkreenReward.address,
              'Arkreen Reward'
            )

            const {v,r,s} = ecsign(Buffer.from(digest.slice(2), 'hex'), Buffer.from(privateKeyManager.slice(2), 'hex'))

            await expect(ArkreenReward.withdrawExt(
                user2.address, 
                ethers.BigNumber.from(100*10**8), 
                ethers.BigNumber.from(0), 
                v,r,s)
              )
              .to.emit(ArkreenReward, 'UserWithdrawExt')
              .withArgs(deployer.address, user2.address, ethers.BigNumber.from(100*10**8), ethers.BigNumber.from(0))
      })
  })

})