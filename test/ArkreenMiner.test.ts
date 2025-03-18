import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import { expect } from "chai";
import { ethers, network, upgrades } from "hardhat";
import { getOnboardingRemoteMinerDigest, expandTo18Decimals, getOnboardingRemoteMinerBatchDigest,
        randomAddresses, MinerType, MinerStatus, getApprovalDigest, getOnboardingStandardMinerDigest } from "./utils/utilities";
import { constants, BigNumber, Contract } from 'ethers'
import { ecsign } from 'ethereumjs-util'
import { time, loadFixture } from "@nomicfoundation/hardhat-network-helpers";

import {
  ArkreenToken
} from "../typechain";

import {
  SignatureStruct,
  SigStruct,
} from "../typechain/contracts/ArkreenMiner";

describe("ArkreenMiner", () => {
  let deployer:               SignerWithAddress
  let manager:                SignerWithAddress
  let register_authority:     SignerWithAddress
  let fund_receiver:          SignerWithAddress
  let owner1:     SignerWithAddress
  let owner2:     SignerWithAddress
  let miner1:     SignerWithAddress
  let miner2:     SignerWithAddress
  let maker1:     SignerWithAddress
  let maker2:     SignerWithAddress

  let AKREToken:                      ArkreenToken
  let ArkreenMiner:        Contract
  let privateKeyManager:              string
  let privateKeyRegister:             string
  let privateKeyOwner:                string
  let privateKeyMaker:                string
  
  const Miner_Manager       = 0         
  const Register_Authority  = 1    
  const Payment_Receiver    = 2

  async function deployFixture() {
    const AKRETokenFactory = await ethers.getContractFactory("ArkreenToken");
    const AKREToken = await upgrades.deployProxy(AKRETokenFactory, [10_000_000_000, deployer.address,'','']) as ArkreenToken
    await AKREToken.deployed();

    const ArkreenMinerProFactory = await ethers.getContractFactory("ArkreenMinerPro")
    const ArkreenMinerPro = await ArkreenMinerProFactory.deploy()

    const ArkreenMinerFactory = await ethers.getContractFactory("ArkreenMiner")
    // _tokenNative is set as AKREToken just for testing
    ArkreenMiner = await upgrades.deployProxy(ArkreenMinerFactory,[AKREToken.address, owner2.address, manager.address, register_authority.address])
    await ArkreenMiner.deployed()
    await ArkreenMiner.setArkreenMinerPro(ArkreenMinerPro.address);

    await AKREToken.transfer(owner1.address, expandTo18Decimals(100000))
    await AKREToken.connect(owner1).approve(ArkreenMiner.address, expandTo18Decimals(100000))
    await AKREToken.transfer(maker1.address, expandTo18Decimals(100000))
    await AKREToken.connect(maker1).approve(ArkreenMiner.address, expandTo18Decimals(100000))

    return {AKREToken, ArkreenMiner}
  }

  beforeEach(async () => {
    [deployer, manager, register_authority, fund_receiver, owner1, owner2, miner1, miner2, maker1, maker2] = await ethers.getSigners()
    privateKeyManager = process.env.MANAGER_TEST_PRIVATE_KEY as string
    privateKeyRegister = process.env.REGISTER_TEST_PRIVATE_KEY as string
    privateKeyOwner = process.env.OWNER_TEST_PRIVATE_KEY as string
    privateKeyMaker = process.env.MAKER_TEST_PRIVATE_KEY as string

    const fixture = await loadFixture(deployFixture)
    AKREToken = fixture.AKREToken
    ArkreenMiner = fixture.ArkreenMiner
  });

  describe("ArkreenMiner: Basics", () => {
    it("ArkreenMiner Basics: isOwner ", async () => {
      const receivers = randomAddresses(10)
      const miners = randomAddresses(10)
      await ArkreenMiner.connect(manager).RemoteMinerOnboardInBatch(receivers, miners)
      expect(await ArkreenMiner.isOwner(owner1.address)).to.be.equal(false)
      expect(await ArkreenMiner.isOwner(receivers[0])).to.be.equal(true)
      expect(await ArkreenMiner.isOwner(receivers[9])).to.be.equal(true)
    })
    it("ArkreenMiner Basics: setManager ", async () => {
      await expect(ArkreenMiner.connect(owner1).setManager(Miner_Manager, manager.address))
              .to.be.revertedWith("Ownable: caller is not the owner")
      await ArkreenMiner.setManager(Miner_Manager, manager.address)
      await ArkreenMiner.setManager(Register_Authority, register_authority.address)
      await ArkreenMiner.setManager(Payment_Receiver, fund_receiver.address)      
      expect(await ArkreenMiner.AllManagers(Miner_Manager)).to.equal(manager.address)
      expect(await ArkreenMiner.AllManagers(Register_Authority)).to.equal(register_authority.address)
      expect(await ArkreenMiner.AllManagers(Payment_Receiver)).to.equal(fund_receiver.address)
    })
    it("ArkreenMiner Basics: Withdraw ", async () => {
      // Check only owner
      await expect(ArkreenMiner.connect(owner1).withdraw(AKREToken.address))
              .to.be.revertedWith("Ownable: caller is not the owner")
      // Withdraw to deployer        
      await AKREToken.connect(owner1).transfer(ArkreenMiner.address, expandTo18Decimals(10000))
      const balance0 = await AKREToken.balanceOf(deployer.address)
      await ArkreenMiner.withdraw(AKREToken.address)
      expect(await AKREToken.balanceOf(deployer.address)).to.equal(balance0.add(expandTo18Decimals(10000)));
      
      // withdraw to manager
      await ArkreenMiner.setManager(Payment_Receiver, fund_receiver.address)      
      expect(await AKREToken.balanceOf(fund_receiver.address)).to.equal(0);
      await AKREToken.transfer(ArkreenMiner.address, expandTo18Decimals(10000))
      await ArkreenMiner.withdraw(AKREToken.address)
      expect(await AKREToken.balanceOf(fund_receiver.address)).to.equal(expandTo18Decimals(10000));
      expect(await AKREToken.balanceOf(ArkreenMiner.address)).to.equal(BigNumber.from(0));
    })
    it("ArkreenMiner Basics: Get Miners (RemoteMinerOnboardInBatch)", async () => {
      const receivers = randomAddresses(10)
      const miners = randomAddresses(10)
      await ArkreenMiner.connect(manager).RemoteMinerOnboardInBatch(receivers, miners)
      const lastBlock = await ethers.provider.getBlock('latest')
      const timestamp = lastBlock.timestamp
      const minerInfo = [miners[9], MinerType.RemoteMiner, MinerStatus.Normal, timestamp]
      // ID starting from 1
      expect(await ArkreenMiner.AllMinerInfo(10)).to.deep.eq(minerInfo);
    })
    it("ArkreenMiner Basics: Get Miners Address (RemoteMinerOnboardInBatch)", async () => {
      const receivers = randomAddresses(10)
      const miners = randomAddresses(10)
      await ArkreenMiner.connect(manager).RemoteMinerOnboardInBatch(receivers, miners)
      const minerInfo = miners[9]
      expect(await ArkreenMiner.GetMinersAddr(receivers[9])).to.deep.eq([minerInfo]);
    })

    it("ArkreenMiner Basics: Manage Manufactures", async () => {
      const manufactuers = randomAddresses(10)
      await expect(ArkreenMiner.connect(owner1).ManageManufactures(manufactuers, true))
              .to.be.revertedWith("Ownable: caller is not the owner")        
      await ArkreenMiner.connect(deployer).ManageManufactures(manufactuers, true)
      expect(await ArkreenMiner.AllManufactures(manufactuers[0])).to.equal(true)
      expect(await ArkreenMiner.AllManufactures(manufactuers[9])).to.equal(true)        
      expect(await ArkreenMiner.AllManufactures(maker1.address)).to.equal(false)        
     })     
    
    it("ArkreenMiner Basics: Set Base URI and get token URI", async () => {
      const receivers = randomAddresses(10)
      const miners = randomAddresses(10)
      await ArkreenMiner.connect(manager).RemoteMinerOnboardInBatch(receivers, miners)
      let tokenURI
      tokenURI = await ArkreenMiner.tokenURI(9)
      console.log("tokenURI", tokenURI)
//        await ArkreenMiner.connect(deployer).setBaseURI("https://www.aitos.io/miners/")
//        tokenURI = await ArkreenMiner.tokenURI(9)
//        console.log("tokenURI", tokenURI)
    })  
  })

  describe("ArkreenMiner: Onbording a standard miner", () => {
    const receivers = randomAddresses(10)
    const miners = randomAddresses(10)

    it("Onboarding standard Miner Failed 1: Signature Deadline checking ", async () => {
      const receiver = receivers[9]
      const miner = miners[9]
      const lastBlock = await ethers.provider.getBlock('latest')
      const timestamp = lastBlock.timestamp
      const digest = getOnboardingStandardMinerDigest(
        'Arkreen Miner',
        ArkreenMiner.address,
        { owner: receiver, miner: miner },
         BigNumber.from(timestamp + 600)
      )
      await network.provider.send("evm_increaseTime", [601]);
      const {v,r,s} = ecsign(Buffer.from(digest.slice(2), 'hex'), Buffer.from(privateKeyManager.slice(2), 'hex'))        
      const signature: SigStruct = { v, r, s }  
     
      await expect(ArkreenMiner.connect(owner1).StandardMinerOnboard(receiver, miner, BigNumber.from(timestamp + 600), signature))
              .to.be.revertedWith("Arkreen Miner: EXPIRED")
    })

    it("Onboarding standard Miner Failed 2: standard miner address checking ", async () => {
      const receiver = receivers[9]
      const miner = AKREToken.address                   // wrong address
      const digest = getOnboardingStandardMinerDigest(
        'Arkreen Miner',
        ArkreenMiner.address,
        { owner: receiver, miner: miner},
        constants.MaxUint256
      )
      const {v,r,s} = ecsign(Buffer.from(digest.slice(2), 'hex'), Buffer.from(privateKeyManager.slice(2), 'hex'))        
      const signature: SigStruct = { v, r, s }  
      
      await expect(ArkreenMiner.connect(owner1).StandardMinerOnboard(receiver, miner, constants.MaxUint256, signature))
              .to.be.revertedWith("Arkreen Miner: Not EOA Address")
    })

    it("Onboarding standard Miner Failed 3: standard miner repeated", async () => {
      // Normal case 
      const owners = randomAddresses(5)
      const miners = randomAddresses(5)
      await ArkreenMiner.connect(manager).RemoteMinerOnboardInBatch(owners, miners)

      const receiver = receivers[9]
      const digest = getOnboardingStandardMinerDigest(
                      'Arkreen Miner',
                      ArkreenMiner.address,
                      { owner: receiver, miner: miners[4] },
                      constants.MaxUint256
                    )
      await ArkreenMiner.setManager(Register_Authority, register_authority.address)
      const {v,r,s} = ecsign(Buffer.from(digest.slice(2), 'hex'), Buffer.from(privateKeyRegister.slice(2), 'hex'))           
      const signature0: SigStruct = { v, r, s } 
      
      await expect(ArkreenMiner.connect(owner1).StandardMinerOnboard(receiver, miners[4], constants.MaxUint256, signature0))
              .to.be.revertedWith("Arkreen Miner: Miner Repeated")    
    })       

    it("Onboarding standard Miner Failed 4: Signature checking", async () => {
      const receiver = receivers[9]
      const miner = miners[9]
      const digest = getOnboardingStandardMinerDigest(
        'Arkreen Miner',
        ArkreenMiner.address,
        { owner: receiver, miner: miner },
        constants.MaxUint256
      )
      const {v,r,s} = ecsign(Buffer.from(digest.slice(2), 'hex'), Buffer.from(privateKeyManager.slice(2), 'hex'))
      const signature: SigStruct = { v, r, s }  
      
      await ArkreenMiner.connect(manager).UpdateMinerWhiteList(MinerType.StandardMiner, miners) 
      await expect(ArkreenMiner.connect(owner1).StandardMinerOnboard(receiver, miner, constants.MaxUint256, signature))
              .to.be.revertedWith("Arkreen Miner: INVALID_SIGNATURE")
    })

    it("Onboarding standard Miner: Onboarding an new standard miner", async () => {
      const receiver = receivers[3]
      const miner = miners[3]
      const digest = getOnboardingStandardMinerDigest(
        'Arkreen Miner',
        ArkreenMiner.address,
        { owner: receiver, miner: miner},
        constants.MaxUint256
      )
      await ArkreenMiner.setManager(Register_Authority, register_authority.address)
      const {v,r,s} = ecsign(Buffer.from(digest.slice(2), 'hex'), Buffer.from(privateKeyRegister.slice(2), 'hex'))
      const signature: SigStruct = { v, r, s }  
      
      await ArkreenMiner.connect(manager).UpdateMinerWhiteList(MinerType.StandardMiner, miners)  
      await expect(ArkreenMiner.connect(owner1).StandardMinerOnboard(receiver, miner, constants.MaxUint256, signature))
              .to.emit(ArkreenMiner, "StandardMinerOnboarded")
              .withArgs(receiver, miner);
      expect(await ArkreenMiner.totalStandardMiner()).to.equal(1);
      expect(await ArkreenMiner.totalSupply()).to.equal(1);
      expect(await ArkreenMiner.balanceOf(receiver)).to.equal(1);
      
      const lastBlock = await ethers.provider.getBlock('latest')
      const timestamp = lastBlock.timestamp
      const minerInfo = [miner, MinerType.StandardMiner, MinerStatus.Normal, timestamp]
      const minerNFT = await ArkreenMiner.tokenOfOwnerByIndex(receiver, 0)
      expect(await ArkreenMiner.AllMinerInfo(minerNFT)).to.deep.eq(minerInfo);
    })

    it("Onboarding standard Miner: Onboarding an new Socket Miner", async () => {
      const receiver = receivers[3]
      const miner = miners[3]
      const digest = getOnboardingStandardMinerDigest(
        'Arkreen Miner',
        ArkreenMiner.address,
        { owner: receiver, miner: miner},
        constants.MaxUint256
      )
      await ArkreenMiner.setManager(Register_Authority, register_authority.address)
      const {v,r,s} = ecsign(Buffer.from(digest.slice(2), 'hex'), Buffer.from(privateKeyRegister.slice(2), 'hex'))
      const signature: SigStruct = { v, r, s }  
      
      await ArkreenMiner.connect(manager).UpdateMinerWhiteList(MinerType.SocketMiner, miners)  
      await expect(ArkreenMiner.connect(owner1).StandardMinerOnboard(receiver, miner, constants.MaxUint256, signature))
              .to.emit(ArkreenMiner, "SocketMinerOnboarded")
              .withArgs(receiver, miner);
      expect(await ArkreenMiner.totalSocketMiner()).to.equal(1);
      expect(await ArkreenMiner.totalSupply()).to.equal(1);
      expect(await ArkreenMiner.balanceOf(receiver)).to.equal(1);
      
      const lastBlock = await ethers.provider.getBlock('latest')
      const timestamp = lastBlock.timestamp
      const minerInfo = [miner, MinerType.SocketMiner, MinerStatus.Normal, timestamp]
      const minerNFT = await ArkreenMiner.tokenOfOwnerByIndex(receiver, 0)
      expect(await ArkreenMiner.AllMinerInfo(minerNFT)).to.deep.eq(minerInfo);
    })

    it("Onboarding standard Miner: Onboarding an new Plant Miner", async () => {
      const receiver = receivers[3]
      const miner = miners[3]
      const digest = getOnboardingStandardMinerDigest(
        'Arkreen Miner',
        ArkreenMiner.address,
        { owner: receiver, miner: miner},
        constants.MaxUint256
      )
      await ArkreenMiner.setManager(Register_Authority, register_authority.address)
      const {v,r,s} = ecsign(Buffer.from(digest.slice(2), 'hex'), Buffer.from(privateKeyRegister.slice(2), 'hex'))
      const signature: SigStruct = { v, r, s }  
      
      await ArkreenMiner.connect(manager).UpdateMinerWhiteList(MinerType.PlantMiner, miners)  
      await expect(ArkreenMiner.connect(owner1).StandardMinerOnboard(receiver, miner, constants.MaxUint256, signature))
              .to.emit(ArkreenMiner, "PlantMinerOnboarded")
              .withArgs(receiver, miner);
      expect(await ArkreenMiner.totalPlantMiner()).to.equal(1);
      expect(await ArkreenMiner.totalSupply()).to.equal(1);
      expect(await ArkreenMiner.balanceOf(receiver)).to.equal(1);
      
      const lastBlock = await ethers.provider.getBlock('latest')
      const timestamp = lastBlock.timestamp
      const minerInfo = [miner, MinerType.PlantMiner, MinerStatus.Normal, timestamp]
      const minerNFT = await ArkreenMiner.tokenOfOwnerByIndex(receiver, 0)
      expect(await ArkreenMiner.AllMinerInfo(minerNFT)).to.deep.eq(minerInfo);
    })

    it("Onboarding standard Miner: Transfer checking", async () => {
      const receiver = receivers[3]
      const miner = miners[3]
      const digest = getOnboardingStandardMinerDigest(
        'Arkreen Miner',
        ArkreenMiner.address,
        { owner: owner1.address, miner: miner},
        constants.MaxUint256
      )
      await ArkreenMiner.setManager(Register_Authority, register_authority.address)
      const {v,r,s} = ecsign(Buffer.from(digest.slice(2), 'hex'), Buffer.from(privateKeyRegister.slice(2), 'hex'))
      const signature: SigStruct = { v, r, s }  
      
      await ArkreenMiner.connect(manager).UpdateMinerWhiteList(MinerType.PlantMiner, miners)  
      await expect(ArkreenMiner.connect(owner1).StandardMinerOnboard(owner1.address, miner, constants.MaxUint256, signature))
              .to.emit(ArkreenMiner, "PlantMinerOnboarded")
              .withArgs(owner1.address, miner);
      expect(await ArkreenMiner.totalPlantMiner()).to.equal(1);
      expect(await ArkreenMiner.totalSupply()).to.equal(1);
      expect(await ArkreenMiner.balanceOf(owner1.address)).to.equal(1);
      
      const lastBlock = await ethers.provider.getBlock('latest')
      const timestamp = lastBlock.timestamp
      const minerInfo = [miner, MinerType.PlantMiner, MinerStatus.Normal, timestamp]
      const minerNFT = await ArkreenMiner.tokenOfOwnerByIndex(owner1.address, 0)
      expect(await ArkreenMiner.AllMinerInfo(minerNFT)).to.deep.eq(minerInfo);
      
      await expect(ArkreenMiner.connect(owner1).transferFrom( owner1.address, receiver, 1)).
              to.be.revertedWith("Arkreen Miner: Transfer Not Allowed")       

      await ArkreenMiner.enableTransfer()                
      await ArkreenMiner.connect(owner1).transferFrom( owner1.address, receiver, 1)
    })
  })

  describe("ArkreenMiner: Update Miner White List", () => {
    it("UpdateMinerWhiteList: ", async () => {
      const miners = randomAddresses(10)
      await ArkreenMiner.connect(manager).UpdateMinerWhiteList(MinerType.RemoteMiner, miners) 
      expect(await ArkreenMiner.whiteListMiner(miners[1])).to.deep.eq(MinerType.RemoteMiner);
      expect(await ArkreenMiner.whiteListMiner(miners[9])).to.deep.eq(MinerType.RemoteMiner);

      await ArkreenMiner.connect(manager).UpdateMinerWhiteList(0xFF, [miners[5], miners[6]]) 
      expect(await ArkreenMiner.whiteListMiner(miners[4])).to.deep.eq(MinerType.RemoteMiner);
      expect(await ArkreenMiner.whiteListMiner(miners[5])).to.deep.eq(0);
      expect(await ArkreenMiner.whiteListMiner(miners[6])).to.deep.eq(0);
      expect(await ArkreenMiner.whiteListMiner(miners[7])).to.deep.eq(MinerType.RemoteMiner);   
      
      await expect(ArkreenMiner.connect(manager).UpdateMinerWhiteList(MinerType.RemoteMiner, [miners[5], constants.AddressZero])).
              to.be.revertedWith("Arkreen Miner: Wrong Address") 
      
      await expect(ArkreenMiner.connect(manager).UpdateMinerWhiteList(MinerType.RemoteMiner, [miners[5], AKREToken.address])).
              to.be.revertedWith("Arkreen Miner: Wrong Address") 

      await expect(ArkreenMiner.connect(manager).UpdateMinerWhiteList(MinerType.RemoteMiner, [miners[4], miners[5]])).
              to.be.revertedWith("Arkreen Miner: Miners Repeated") 
    }) 
  })

  describe("ArkreenMiner: Update Miner White List: LiteMiner", () => {
    it("UpdateMinerWhiteList: ", async () => {
      const miners = randomAddresses(10)
      await ArkreenMiner.connect(manager).UpdateMinerWhiteList(MinerType.LiteMiner, miners) 
      expect(await ArkreenMiner.whiteListMiner(miners[1])).to.deep.eq(MinerType.LiteMiner);
      expect(await ArkreenMiner.whiteListMiner(miners[9])).to.deep.eq(MinerType.LiteMiner);

      const minerPrice = expandTo18Decimals(2000)

      const receiver = owner1.address
      const register_digest = getOnboardingRemoteMinerDigest(
                      'Arkreen Miner',
                      ArkreenMiner.address,
                      { owner: owner1.address, miner: miners[1], 
                        token: owner2.address, price: minerPrice, deadline: constants.MaxUint256 }
                    )

      const {v,r,s} = ecsign( Buffer.from(register_digest.slice(2), 'hex'), 
                                            Buffer.from(privateKeyRegister.slice(2), 'hex'))           
      const signature: SignatureStruct = { v, r, s, token: owner2.address, value:minerPrice, deadline: constants.MaxUint256 } 

      await ArkreenMiner.connect(owner1).RemoteMinerOnboardNative(receiver,  miners[1], signature, {value: minerPrice})

      const lastBlock = await ethers.provider.getBlock('latest')
      const timestamp = lastBlock.timestamp
      const minerInfo = [miners[1], MinerType.LiteMiner, MinerStatus.Normal, timestamp]
      const minerNFT = await ArkreenMiner.tokenOfOwnerByIndex(receiver, 0)
      expect(await ArkreenMiner.AllMinerInfo(minerNFT)).to.deep.eq(minerInfo);
      expect(await ArkreenMiner.AllMinersToken(miners[1])).to.deep.eq(minerNFT);
      expect(await ArkreenMiner.whiteListMiner(miners[1])).to.deep.eq(0);
    }) 
  })

  describe("ArkreenMiner: Update Miner White List For Batch Sales", () => {
    it("UpdateMinerWhiteListBatch: ", async () => {

      expect(await ArkreenMiner.numberOfWhiteListBatch(0)).to.deep.eq(0);
      expect(await ArkreenMiner.numberOfWhiteListBatch(1)).to.deep.eq(0);

      const miners1 = randomAddresses(10)
      await ArkreenMiner.connect(manager).UpdateMinerWhiteListBatch(miners1) 
      expect(await ArkreenMiner.numberOfWhiteListBatch(0)).to.deep.eq(10);

      const miners2 = randomAddresses(20)
      await ArkreenMiner.connect(manager).UpdateMinerWhiteListBatch(miners2) 
      expect(await ArkreenMiner.numberOfWhiteListBatch(0)).to.deep.eq(30);

      const miners3 = randomAddresses(100)
      await ArkreenMiner.connect(manager).UpdateMinerWhiteListBatch(miners3) 

//    const tx = await ArkreenMiner.connect(manager).UpdateMinerWhiteListBatch(miners3) 
//    const receipt = await tx.wait()
//    expect(receipt.gasUsed).to.eq("2337646")

      expect(await ArkreenMiner.numberOfWhiteListBatch(0)).to.deep.eq(130);
    })
  })

  describe("ArkreenMiner: Onbording a Remote miner", () => {
    const miners = randomAddresses(10)
    const receiver = randomAddresses(1)[0]
    let DTUMiner = miners[9]
    let payer: string
    const feeRegister = expandTo18Decimals(100)
    let signature: SignatureStruct
    let sig: SigStruct

    beforeEach(async () => {
      payer = maker1.address
      const nonce = await AKREToken.nonces(payer)
      const lastBlock = await ethers.provider.getBlock('latest')
      const timestamp = lastBlock.timestamp
      const digest = await getApprovalDigest(
        AKREToken,
        { owner: payer, spender: ArkreenMiner.address, value: feeRegister },
        nonce,
        BigNumber.from(timestamp + 600)
      )
      const {v,r,s} = ecsign(Buffer.from(digest.slice(2), 'hex'), Buffer.from(privateKeyMaker.slice(2), 'hex'))
      signature = { v, r, s, token: AKREToken.address, value:feeRegister, deadline: BigNumber.from(timestamp + 600) } 
      sig = {v,r,s}

    });
    it("Onboarding Remote Miner Failed 1: Signature deadline checking ", async () => {
      await network.provider.send("evm_increaseTime", [601]);
      await expect(ArkreenMiner.connect(manager).RemoteMinerOnboard(receiver, DTUMiner, sig, signature))        
              .to.be.revertedWith("Arkreen Miner: EXPIRED")
    })      

    it("Onboarding Remote Miner Failed 2: Miner not white-listed ", async () => {
      await expect(ArkreenMiner.connect(manager).RemoteMinerOnboard(receiver, DTUMiner, sig, signature))        
              .to.be.revertedWith("Arkreen Miner: Wrong Miner")
    })

    it("Onboarding Remote Miner Failed 3: Manager Signature checking", async () => {
      const miners = randomAddresses(10)
      await ArkreenMiner.connect(manager).UpdateMinerWhiteList(MinerType.RemoteMiner, miners) 
      await expect(ArkreenMiner.connect(manager).RemoteMinerOnboard(receiver, miners[1], sig, signature))          
              .to.be.revertedWith("Arkreen Miner: INVALID_SIGNATURE")
    })

    it("Onboarding Remote Miner: Onboarding a Remote miner", async () => {
      const miners = randomAddresses(10)
      await ArkreenMiner.connect(manager).UpdateMinerWhiteList(MinerType.RemoteMiner, miners) 
      const minerPrice = expandTo18Decimals(2000)

      const receiver = owner1.address
      const register_digest = getOnboardingRemoteMinerDigest(
                      'Arkreen Miner',
                      ArkreenMiner.address,
                      { owner: owner1.address, miner: miners[1], 
                        token: AKREToken.address, price: minerPrice, deadline: constants.MaxUint256 }
                    )
      await ArkreenMiner.setManager(Register_Authority, register_authority.address)
      const {v: rv, r: rr, s: rs} = ecsign( Buffer.from(register_digest.slice(2), 'hex'), 
                                            Buffer.from(privateKeyRegister.slice(2), 'hex'))           
      const sig: SigStruct = { v: rv, r: rr, s: rs }

      const nonce = await AKREToken.nonces(receiver)
      const digest = await getApprovalDigest(
                              AKREToken,
                              { owner: receiver, spender: ArkreenMiner.address, value: minerPrice },
                              nonce,
                              constants.MaxUint256
                            )
      const { v,r,s } = ecsign(Buffer.from(digest.slice(2), 'hex'), Buffer.from(privateKeyOwner.slice(2), 'hex'))
      const signature: SignatureStruct = { v, r, s, token: AKREToken.address, value:minerPrice, deadline: constants.MaxUint256 } 

      const signature_err: SignatureStruct = { ...signature, s: rs } 
      await expect(ArkreenMiner.connect(manager).RemoteMinerOnboard(receiver, miners[1], sig, signature_err))          
              .to.be.revertedWith("ERC20Permit: invalid signature")

      const balanceARKE = await AKREToken.balanceOf(owner1.address)
      const balanceArkreenMiner = await AKREToken.balanceOf(ArkreenMiner.address)

      await expect(ArkreenMiner.connect(owner1).RemoteMinerOnboard(receiver,  miners[1], sig, signature))
              .to.emit(AKREToken, "Transfer")
              .withArgs(owner1.address, ArkreenMiner.address, minerPrice)
              .to.emit(ArkreenMiner, "MinerOnboarded")
              .withArgs(receiver, miners[1]);
      expect(await AKREToken.balanceOf(owner1.address)).to.equal(balanceARKE.sub(minerPrice));
      expect(await AKREToken.balanceOf(ArkreenMiner.address)).to.equal(balanceArkreenMiner.add(minerPrice));
      expect(await ArkreenMiner.totalSupply()).to.equal(1);
      expect(await ArkreenMiner.balanceOf(receiver)).to.equal(1);

      const lastBlock = await ethers.provider.getBlock('latest')
      const timestamp = lastBlock.timestamp
      const minerInfo = [miners[1], MinerType.RemoteMiner, MinerStatus.Normal, timestamp]
      const minerNFT = await ArkreenMiner.tokenOfOwnerByIndex(receiver, 0)
      expect(await ArkreenMiner.AllMinerInfo(minerNFT)).to.deep.eq(minerInfo);
      expect(await ArkreenMiner.AllMinersToken(miners[1])).to.deep.eq(minerNFT);
      expect(await ArkreenMiner.whiteListMiner(miners[1])).to.deep.eq(0);
    })
  })

  describe("ArkreenMiner: Onbording Remote miners in batch", () => {
    const miners = randomAddresses(10)
    const receiver = randomAddresses(1)[0]
    let payer: string
    const feeRegister = expandTo18Decimals(100)
    let signature: SignatureStruct
    let sig: SigStruct

    beforeEach(async () => {
      payer = maker1.address
      const nonce = await AKREToken.nonces(payer)
      const lastBlock = await ethers.provider.getBlock('latest')
      const timestamp = lastBlock.timestamp
      const digest = await getApprovalDigest(
        AKREToken,
        { owner: payer, spender: ArkreenMiner.address, value: feeRegister },
        nonce,
        BigNumber.from(timestamp + 600)
      )
      const {v,r,s} = ecsign(Buffer.from(digest.slice(2), 'hex'), Buffer.from(privateKeyMaker.slice(2), 'hex'))
      signature = { v, r, s, token: AKREToken.address, value:feeRegister, deadline: BigNumber.from(timestamp + 600) } 
      sig = {v,r,s}

    });
    it("Onboarding Remote Miner Batch Failed 1: Signature deadline checking ", async () => {
      await network.provider.send("evm_increaseTime", [601]);
      await expect(ArkreenMiner.connect(manager).RemoteMinerOnboardBatch(receiver, 3, sig, signature))        
              .to.be.revertedWith("Arkreen Miner: EXPIRED")
    })      

    it("Onboarding Remote Miner Batch Failed 2: Manager Signature checking", async () => {
      await ArkreenMiner.connect(manager).UpdateMinerWhiteListBatch(miners) 
      await expect(ArkreenMiner.connect(manager).RemoteMinerOnboardBatch(receiver, 3, sig, signature))          
              .to.be.revertedWith("Arkreen Miner: INVALID_SIGNATURE")
    })

    it("Onboarding Remote Miner: Onboarding Remote miners in Batch", async () => {
      const miners = randomAddresses(10)
      await ArkreenMiner.connect(manager).UpdateMinerWhiteListBatch(miners) 
      const minerValue = expandTo18Decimals(2000).mul(3)

      const receiver = owner1.address
      const register_digest = getOnboardingRemoteMinerBatchDigest(
                      'Arkreen Miner',
                      ArkreenMiner.address,
                      { owner: owner1.address, quantity: BigNumber.from(3),
                        token: AKREToken.address, price: minerValue, deadline: constants.MaxUint256 }
                    )
      await ArkreenMiner.setManager(Register_Authority, register_authority.address)
      const {v: rv, r: rr, s: rs} = ecsign( Buffer.from(register_digest.slice(2), 'hex'), 
                                            Buffer.from(privateKeyRegister.slice(2), 'hex'))           
      const sig: SigStruct = { v: rv, r: rr, s: rs }

      const nonce = await AKREToken.nonces(receiver)
      const digest = await getApprovalDigest(
                              AKREToken,
                              { owner: receiver, spender: ArkreenMiner.address, value: minerValue },
                              nonce,
                              constants.MaxUint256
                            )
      const { v,r,s } = ecsign(Buffer.from(digest.slice(2), 'hex'), Buffer.from(privateKeyOwner.slice(2), 'hex'))
      const signature: SignatureStruct = { v, r, s, token: AKREToken.address, value:minerValue, deadline: constants.MaxUint256 } 

      const signature_err: SignatureStruct = { ...signature, s: rs } 
      await expect(ArkreenMiner.connect(manager).RemoteMinerOnboardBatch(receiver, 3, sig, signature_err))          
              .to.be.revertedWith("ERC20Permit: invalid signature")

      const balanceARKE = await AKREToken.balanceOf(owner1.address)
      const balanceArkreenMiner = await AKREToken.balanceOf(ArkreenMiner.address)

      await expect(ArkreenMiner.connect(owner1).RemoteMinerOnboardBatch(receiver, 3, sig, signature))
              .to.emit(AKREToken, "Transfer")
              .withArgs(owner1.address, ArkreenMiner.address, minerValue)
              .to.emit(ArkreenMiner, "MinerOnboardedBatch")
              .withArgs(receiver, miners.slice(0, 3));
      expect(await AKREToken.balanceOf(owner1.address)).to.equal(balanceARKE.sub(minerValue));
      expect(await AKREToken.balanceOf(ArkreenMiner.address)).to.equal(balanceArkreenMiner.add(minerValue));
      expect(await ArkreenMiner.totalSupply()).to.equal(3);
      expect(await ArkreenMiner.balanceOf(receiver)).to.equal(3);

      const lastBlock = await ethers.provider.getBlock('latest')
      const timestamp = lastBlock.timestamp
      const minerInfo0 = [miners[0], MinerType.RemoteMiner, MinerStatus.Normal, timestamp]
      const minerNFT0 = await ArkreenMiner.tokenOfOwnerByIndex(receiver, 0)
      expect(await ArkreenMiner.AllMinerInfo(minerNFT0)).to.deep.eq(minerInfo0);
      expect(await ArkreenMiner.AllMinersToken(miners[0])).to.deep.eq(minerNFT0);
      expect(await ArkreenMiner.whiteListMiner(miners[0])).to.deep.eq(0);

      const minerInfo1 = [miners[1], MinerType.RemoteMiner, MinerStatus.Normal, timestamp]
      const minerNFT1 = await ArkreenMiner.tokenOfOwnerByIndex(receiver, 1)
      expect(await ArkreenMiner.AllMinerInfo(minerNFT1)).to.deep.eq(minerInfo1);
      expect(await ArkreenMiner.AllMinersToken(miners[1])).to.deep.eq(minerNFT1);
      expect(await ArkreenMiner.whiteListMiner(miners[1])).to.deep.eq(0);

      const minerInfo2 = [miners[2], MinerType.RemoteMiner, MinerStatus.Normal, timestamp]
      const minerNFT2 = await ArkreenMiner.tokenOfOwnerByIndex(receiver, 2)
      expect(await ArkreenMiner.AllMinerInfo(minerNFT2)).to.deep.eq(minerInfo2);
      expect(await ArkreenMiner.AllMinersToken(miners[2])).to.deep.eq(minerNFT2);
      expect(await ArkreenMiner.whiteListMiner(miners[2])).to.deep.eq(0);
    })
  })

  describe("ArkreenMiner: Onbording a Remote miner while payment has already been approved.", () => {
    const miners = randomAddresses(10)
    const receiver = randomAddresses(1)[0]
    let DTUMiner = miners[9]
    let payer: string
    let signature: SignatureStruct

    const minerPrice = expandTo18Decimals(2000)

    beforeEach(async () => {
      payer = maker1.address
      const lastBlock = await ethers.provider.getBlock('latest')
      const timestamp = lastBlock.timestamp

      const register_digest = getOnboardingRemoteMinerDigest(
                      'Arkreen Miner',
                      ArkreenMiner.address,
                      { owner: owner1.address, miner: miners[1], 
                        token: AKREToken.address, price: minerPrice, deadline: BigNumber.from(timestamp + 600) }
                    )
      await ArkreenMiner.setManager(Register_Authority, register_authority.address)
      const {v, r, s} = ecsign( Buffer.from(register_digest.slice(2), 'hex'), 
                                            Buffer.from(privateKeyRegister.slice(2), 'hex'))           
      signature = { v, r, s, token: AKREToken.address, value:minerPrice, deadline: BigNumber.from(timestamp + 600) } 

    });

    it("Onboarding Remote Miner Failed 1: Signature deadline checking ", async () => {
      await network.provider.send("evm_increaseTime", [601]);
      await expect(ArkreenMiner.connect(manager).RemoteMinerOnboardApproved(receiver, DTUMiner, signature))        
              .to.be.revertedWith("Arkreen Miner: EXPIRED")
    })      

    it("Onboarding Remote Miner Failed 2: Miner not white-listed ", async () => {
      await expect(ArkreenMiner.connect(manager).RemoteMinerOnboardApproved(receiver, DTUMiner, signature))        
              .to.be.revertedWith("Arkreen Miner: Wrong Miner")
    })

    it("Onboarding Remote Miner Failed 3: Manager Signature checking", async () => {
      const miners = randomAddresses(10)
      await ArkreenMiner.connect(manager).UpdateMinerWhiteList(MinerType.RemoteMiner, miners) 
      await expect(ArkreenMiner.connect(manager).RemoteMinerOnboardApproved(receiver, miners[1], signature))          
              .to.be.revertedWith("Arkreen Miner: INVALID_SIGNATURE")
    })

    it("Onboarding Remote Miner: Onboarding a Remote miner", async () => {
      const miners = randomAddresses(10)
      await ArkreenMiner.connect(manager).UpdateMinerWhiteList(MinerType.RemoteMiner, miners) 
      const minerPrice = expandTo18Decimals(2000)

      const receiver = owner1.address
      const register_digest = getOnboardingRemoteMinerDigest(
                      'Arkreen Miner',
                      ArkreenMiner.address,
                      { owner: owner1.address, miner: miners[1], 
                        token: AKREToken.address, price: minerPrice, deadline: constants.MaxUint256 }
                    )
      await ArkreenMiner.setManager(Register_Authority, register_authority.address)
      const {v,r,s} = ecsign( Buffer.from(register_digest.slice(2), 'hex'), 
                                            Buffer.from(privateKeyRegister.slice(2), 'hex'))           
      const signature: SignatureStruct = { v, r, s, token: AKREToken.address, value:minerPrice, deadline: constants.MaxUint256 } 

      const signature_err: SignatureStruct = { ...signature, s: r } 
      await expect(ArkreenMiner.connect(manager).RemoteMinerOnboardApproved(receiver, miners[1], signature_err))          
              .to.be.revertedWith("Arkreen Miner: INVALID_SIGNATURE")

      const balanceARKE = await AKREToken.balanceOf(owner1.address)
      const balanceArkreenMiner = await AKREToken.balanceOf(ArkreenMiner.address)

      await expect(ArkreenMiner.connect(owner1).RemoteMinerOnboardApproved(receiver,  miners[1], signature))
              .to.emit(AKREToken, "Transfer")
              .withArgs(owner1.address, ArkreenMiner.address, minerPrice)
              .to.emit(ArkreenMiner, "MinerOnboarded")
              .withArgs(receiver, miners[1]);

      expect(await AKREToken.balanceOf(owner1.address)).to.equal(balanceARKE.sub(minerPrice));
      expect(await AKREToken.balanceOf(ArkreenMiner.address)).to.equal(balanceArkreenMiner.add(minerPrice));
      expect(await ArkreenMiner.totalSupply()).to.equal(1);
      expect(await ArkreenMiner.balanceOf(receiver)).to.equal(1);

      const lastBlock = await ethers.provider.getBlock('latest')
      const timestamp = lastBlock.timestamp
      const minerInfo = [miners[1], MinerType.RemoteMiner, MinerStatus.Normal, timestamp]
      const minerNFT = await ArkreenMiner.tokenOfOwnerByIndex(receiver, 0)
      expect(await ArkreenMiner.AllMinerInfo(minerNFT)).to.deep.eq(minerInfo);
      expect(await ArkreenMiner.AllMinersToken(miners[1])).to.deep.eq(minerNFT);
      expect(await ArkreenMiner.whiteListMiner(miners[1])).to.deep.eq(0);
    })
  })

  describe("ArkreenMiner: Onbording Remote miners in Batch while payment has already been approved.", () => {
    const miners = randomAddresses(10)
    const receiver = randomAddresses(1)[0]
    let DTUMiner = miners[9]
    let payer: string
    let signature: SignatureStruct

    const minerValue = expandTo18Decimals(2000).mul(3)

    beforeEach(async () => {
      payer = maker1.address
      const lastBlock = await ethers.provider.getBlock('latest')
      const timestamp = lastBlock.timestamp

      const register_digest = getOnboardingRemoteMinerBatchDigest(
                      'Arkreen Miner',
                      ArkreenMiner.address,
                      { owner: owner1.address, quantity: BigNumber.from(3),
                        token: AKREToken.address, price: minerValue, deadline: BigNumber.from(timestamp + 600) }
                    )
      await ArkreenMiner.setManager(Register_Authority, register_authority.address)
      const {v, r, s} = ecsign( Buffer.from(register_digest.slice(2), 'hex'), 
                                            Buffer.from(privateKeyRegister.slice(2), 'hex'))           
      signature = { v, r, s, token: AKREToken.address, value:minerValue, deadline: BigNumber.from(timestamp + 600) } 

    });

    it("Onboarding Remote Miner Failed 1: Signature deadline checking ", async () => {
      await network.provider.send("evm_increaseTime", [601]);
      await expect(ArkreenMiner.connect(manager).RemoteMinerOnboardApprovedBatch(receiver, 3, signature))        
              .to.be.revertedWith("Arkreen Miner: EXPIRED")
    })      

    it("Onboarding Remote Miner Failed 2: Manager Signature checking", async () => {
      const miners = randomAddresses(10)
      await ArkreenMiner.connect(manager).UpdateMinerWhiteListBatch(miners) 
      await expect(ArkreenMiner.connect(manager).RemoteMinerOnboardApprovedBatch(receiver, 3, signature))          
              .to.be.revertedWith("Arkreen Miner: INVALID_SIGNATURE")
    })

    it("Onboarding Remote Miner: Onboarding a Remote miner", async () => {
      const miners = randomAddresses(10)
      await ArkreenMiner.connect(manager).UpdateMinerWhiteListBatch(miners) 
      const minerValue = expandTo18Decimals(2000).mul(3)

      const receiver = owner1.address
      const register_digest = getOnboardingRemoteMinerBatchDigest(
                      'Arkreen Miner',
                      ArkreenMiner.address,
                      { owner: owner1.address, quantity: BigNumber.from(3),
                        token: AKREToken.address, price: minerValue, deadline: constants.MaxUint256 }
                    )
      await ArkreenMiner.setManager(Register_Authority, register_authority.address)
      const {v,r,s} = ecsign( Buffer.from(register_digest.slice(2), 'hex'), 
                                            Buffer.from(privateKeyRegister.slice(2), 'hex'))           
      const signature: SignatureStruct = { v, r, s, token: AKREToken.address, value:minerValue, deadline: constants.MaxUint256 } 

      const signature_err: SignatureStruct = { ...signature, s: r } 
      await expect(ArkreenMiner.connect(manager).RemoteMinerOnboardApprovedBatch(receiver, 3, signature_err))          
              .to.be.revertedWith("Arkreen Miner: INVALID_SIGNATURE")

      const balanceARKE = await AKREToken.balanceOf(owner1.address)
      const balanceArkreenMiner = await AKREToken.balanceOf(ArkreenMiner.address)

      await expect(ArkreenMiner.connect(owner1).RemoteMinerOnboardApprovedBatch(receiver, 3, signature))
              .to.emit(AKREToken, "Transfer")
              .withArgs(owner1.address, ArkreenMiner.address, minerValue)
              .to.emit(ArkreenMiner, "MinerOnboardedBatch")
              .withArgs(receiver, miners.slice(0, 3));

      expect(await AKREToken.balanceOf(owner1.address)).to.equal(balanceARKE.sub(minerValue));
      expect(await AKREToken.balanceOf(ArkreenMiner.address)).to.equal(balanceArkreenMiner.add(minerValue));
      expect(await ArkreenMiner.totalSupply()).to.equal(3);
      expect(await ArkreenMiner.balanceOf(receiver)).to.equal(3);

      const lastBlock = await ethers.provider.getBlock('latest')
      const timestamp = lastBlock.timestamp
      const minerInfo0 = [miners[0], MinerType.RemoteMiner, MinerStatus.Normal, timestamp]
      const minerNFT0 = await ArkreenMiner.tokenOfOwnerByIndex(receiver, 0)
      expect(await ArkreenMiner.AllMinerInfo(minerNFT0)).to.deep.eq(minerInfo0);
      expect(await ArkreenMiner.AllMinersToken(miners[0])).to.deep.eq(minerNFT0);
      expect(await ArkreenMiner.whiteListMiner(miners[0])).to.deep.eq(0);

      const minerInfo1 = [miners[1], MinerType.RemoteMiner, MinerStatus.Normal, timestamp]
      const minerNFT1 = await ArkreenMiner.tokenOfOwnerByIndex(receiver, 1)
      expect(await ArkreenMiner.AllMinerInfo(minerNFT1)).to.deep.eq(minerInfo1);
      expect(await ArkreenMiner.AllMinersToken(miners[1])).to.deep.eq(minerNFT1);
      expect(await ArkreenMiner.whiteListMiner(miners[1])).to.deep.eq(0);

      const minerInfo2 = [miners[2], MinerType.RemoteMiner, MinerStatus.Normal, timestamp]
      const minerNFT2 = await ArkreenMiner.tokenOfOwnerByIndex(receiver, 2)
      expect(await ArkreenMiner.AllMinerInfo(minerNFT2)).to.deep.eq(minerInfo2);
      expect(await ArkreenMiner.AllMinersToken(miners[2])).to.deep.eq(minerNFT2);
      expect(await ArkreenMiner.whiteListMiner(miners[2])).to.deep.eq(0);
    })
  })

  describe("ArkreenMiner: Claiming Remote miners in Batch with the approval.", () => {
    const receiver = randomAddresses(1)[0]
    let payer: string
    let signature: SignatureStruct

    const minerValue = expandTo18Decimals(0)

    beforeEach(async () => {
      payer = maker1.address
      const lastBlock = await ethers.provider.getBlock('latest')
      const timestamp = lastBlock.timestamp

      const register_digest = getOnboardingRemoteMinerBatchDigest(
                      'Arkreen Miner',
                      ArkreenMiner.address,
                      { owner: owner1.address, quantity: BigNumber.from(3),
                        token: AKREToken.address, price: minerValue, deadline: BigNumber.from(timestamp + 600) }
                    )
      await ArkreenMiner.setManager(Register_Authority, register_authority.address)
      const {v, r, s} = ecsign( Buffer.from(register_digest.slice(2), 'hex'), 
                                            Buffer.from(privateKeyRegister.slice(2), 'hex'))           
      signature = { v, r, s, token: AKREToken.address, value:minerValue, deadline: BigNumber.from(timestamp + 600) } 

    });

    it("Onboarding Remote Miner Failed 1: Signature deadline checking ", async () => {
      await network.provider.send("evm_increaseTime", [601]);
      await expect(ArkreenMiner.connect(manager).RemoteMinerOnboardBatchClaim(receiver, 1, 3, signature))        
              .to.be.revertedWith("Arkreen Miner: EXPIRED")
    })      

    it("Onboarding Remote Miner Failed 2: Manager Signature checking", async () => {
      const miners = randomAddresses(10)
      await ArkreenMiner.connect(manager).UpdateMinerWhiteListBatchClaim(1, miners) 
      await expect(ArkreenMiner.connect(manager).RemoteMinerOnboardBatchClaim(receiver, 1, 3, signature))          
              .to.be.revertedWith("Arkreen Miner: INVALID_SIGNATURE")
    })

    it("Onboarding Remote Miner: Onboarding a Remote miner", async () => {
      const miners = randomAddresses(10)
      await ArkreenMiner.connect(manager).UpdateMinerWhiteListBatchClaim(1, miners) 
      const minerValue = expandTo18Decimals(0)

      const receiver = owner1.address
      const register_digest = getOnboardingRemoteMinerBatchDigest(
                      'Arkreen Miner',
                      ArkreenMiner.address,
                      { owner: owner1.address, quantity: BigNumber.from(1).shl(248).add(3),
                        token: AKREToken.address, price: minerValue, deadline: constants.MaxUint256 }
                    )
      await ArkreenMiner.setManager(Register_Authority, register_authority.address)
      const {v,r,s} = ecsign( Buffer.from(register_digest.slice(2), 'hex'), 
                                            Buffer.from(privateKeyRegister.slice(2), 'hex'))           
      const signature: SignatureStruct = { v, r, s, token: AKREToken.address, value:minerValue, deadline: constants.MaxUint256 } 

      const signature_err: SignatureStruct = { ...signature, s: r } 
      await expect(ArkreenMiner.connect(manager).RemoteMinerOnboardBatchClaim(receiver, 1, 3, signature_err))          
              .to.be.revertedWith("Arkreen Miner: INVALID_SIGNATURE")

      await expect(ArkreenMiner.connect(owner1).RemoteMinerOnboardBatchClaim(receiver, 1, 3, signature))
              .to.emit(ArkreenMiner, "MinerOnboardedBatch")
              .withArgs(receiver, miners.slice(0, 3));

      expect(await ArkreenMiner.totalSupply()).to.equal(3);
      expect(await ArkreenMiner.balanceOf(receiver)).to.equal(3);

      const lastBlock = await ethers.provider.getBlock('latest')
      const timestamp = lastBlock.timestamp
      const minerInfo0 = [miners[0], MinerType.LiteMiner, MinerStatus.Normal, timestamp]
      const minerNFT0 = await ArkreenMiner.tokenOfOwnerByIndex(receiver, 0)
      expect(await ArkreenMiner.AllMinerInfo(minerNFT0)).to.deep.eq(minerInfo0);
      expect(await ArkreenMiner.AllMinersToken(miners[0])).to.deep.eq(minerNFT0);
      expect(await ArkreenMiner.whiteListMiner(miners[0])).to.deep.eq(0);

      const minerInfo1 = [miners[1], MinerType.LiteMiner, MinerStatus.Normal, timestamp]
      const minerNFT1 = await ArkreenMiner.tokenOfOwnerByIndex(receiver, 1)
      expect(await ArkreenMiner.AllMinerInfo(minerNFT1)).to.deep.eq(minerInfo1);
      expect(await ArkreenMiner.AllMinersToken(miners[1])).to.deep.eq(minerNFT1);
      expect(await ArkreenMiner.whiteListMiner(miners[1])).to.deep.eq(0);

      const minerInfo2 = [miners[2], MinerType.LiteMiner, MinerStatus.Normal, timestamp]
      const minerNFT2 = await ArkreenMiner.tokenOfOwnerByIndex(receiver, 2)
      expect(await ArkreenMiner.AllMinerInfo(minerNFT2)).to.deep.eq(minerInfo2);
      expect(await ArkreenMiner.AllMinersToken(miners[2])).to.deep.eq(minerNFT2);
      expect(await ArkreenMiner.whiteListMiner(miners[2])).to.deep.eq(0);

      await expect(ArkreenMiner.connect(owner1).RemoteMinerOnboardBatchClaim(receiver, 1, 3, signature))
              .to.be.revertedWith("Arkreen Miner: Not Allowed")
    })

    it("Onboarding Remote Miner: Onboarding a Remote miner: (500W, Station ID)", async () => {

      const typeWithStationID = (0x1234 << 8) + 2
      const miners = randomAddresses(10)
      await ArkreenMiner.connect(manager).UpdateMinerWhiteListBatchClaim(typeWithStationID, miners) 
      const minerValue = expandTo18Decimals(0)

      const receiver = owner1.address
      const quantity = BigNumber.from((2<<16) + 0x1234).shl(232).add(3)
      const register_digest = getOnboardingRemoteMinerBatchDigest(
                      'Arkreen Miner',
                      ArkreenMiner.address,
                      { owner: owner1.address, quantity,
                        token: AKREToken.address, price: minerValue, deadline: constants.MaxUint256 }
                    )

      await ArkreenMiner.setManager(Register_Authority, register_authority.address)
      const {v,r,s} = ecsign( Buffer.from(register_digest.slice(2), 'hex'), 
                                            Buffer.from(privateKeyRegister.slice(2), 'hex'))           
      const signature: SignatureStruct = { v, r, s, token: AKREToken.address, value:minerValue, deadline: constants.MaxUint256 } 

      const signature_err: SignatureStruct = { ...signature, s: r } 
      await expect(ArkreenMiner.connect(manager).RemoteMinerOnboardBatchClaim(receiver, typeWithStationID, 3, signature_err))          
              .to.be.revertedWith("Arkreen Miner: INVALID_SIGNATURE")

      await expect(ArkreenMiner.connect(owner1).RemoteMinerOnboardBatchClaim(receiver, typeWithStationID, 3, signature))
              .to.emit(ArkreenMiner, "MinerOnboardedBatch")
              .withArgs(receiver, miners.slice(0, 3));

      expect(await ArkreenMiner.totalSupply()).to.equal(3);
      expect(await ArkreenMiner.balanceOf(receiver)).to.equal(3);

      const lastBlock = await ethers.provider.getBlock('latest')
      const timestamp = lastBlock.timestamp
      const minerInfo0 = [miners[0], MinerType.RemoteMiner + (2<<4), MinerStatus.Normal, timestamp]
      const minerNFT0 = await ArkreenMiner.tokenOfOwnerByIndex(receiver, 0)
      expect(await ArkreenMiner.AllMinerInfo(minerNFT0)).to.deep.eq(minerInfo0);
      expect(await ArkreenMiner.AllMinersToken(miners[0])).to.deep.eq(minerNFT0);
      expect(await ArkreenMiner.whiteListMiner(miners[0])).to.deep.eq(0);

      const minerInfo1 = [miners[1], MinerType.RemoteMiner + (2<<4), MinerStatus.Normal, timestamp]
      const minerNFT1 = await ArkreenMiner.tokenOfOwnerByIndex(receiver, 1)
      expect(await ArkreenMiner.AllMinerInfo(minerNFT1)).to.deep.eq(minerInfo1);
      expect(await ArkreenMiner.AllMinersToken(miners[1])).to.deep.eq(minerNFT1);
      expect(await ArkreenMiner.whiteListMiner(miners[1])).to.deep.eq(0);

      const minerInfo2 = [miners[2], MinerType.RemoteMiner + (2<<4), MinerStatus.Normal, timestamp]
      const minerNFT2 = await ArkreenMiner.tokenOfOwnerByIndex(receiver, 2)
      expect(await ArkreenMiner.AllMinerInfo(minerNFT2)).to.deep.eq(minerInfo2);
      expect(await ArkreenMiner.AllMinersToken(miners[2])).to.deep.eq(minerNFT2);
      expect(await ArkreenMiner.whiteListMiner(miners[2])).to.deep.eq(0);

      await expect(ArkreenMiner.connect(owner1).RemoteMinerOnboardBatchClaim(receiver, typeWithStationID, 3, signature))
              .to.be.revertedWith("Arkreen Miner: Not Allowed")

    })

    it("Onboarding Remote Miner: Onboarding a Remote miner: (500W, Station ID, paid in native)", async () => {

      const typeWithStationID = (0x2345 << 8) + 3
      const miners = randomAddresses(10)
      await ArkreenMiner.connect(manager).UpdateMinerWhiteListBatchClaim(typeWithStationID, miners) 
      const minerValue = expandTo18Decimals(2).mul(5)

      const receiver = owner1.address
      const quantity = BigNumber.from((3<<16) + 0x2345).shl(232).add(5)
      const register_digest = getOnboardingRemoteMinerBatchDigest(
                      'Arkreen Miner',
                      ArkreenMiner.address,
                      { owner: owner1.address, quantity,
                        token: owner2.address, price: minerValue, deadline: constants.MaxUint256 }
                    )
      await ArkreenMiner.setManager(Register_Authority, register_authority.address)
      const {v,r,s} = ecsign( Buffer.from(register_digest.slice(2), 'hex'), 
                                            Buffer.from(privateKeyRegister.slice(2), 'hex'))           
      const signature: SignatureStruct = { v, r, s, token: owner2.address, value:minerValue, deadline: constants.MaxUint256 } 

      const signature_err: SignatureStruct = { ...signature, s: r } 
      await expect(ArkreenMiner.connect(manager).RemoteMinerOnboardNativeBatchClaim(receiver, typeWithStationID, 5, signature_err, {value: minerValue}))          
              .to.be.revertedWith("Arkreen Miner: INVALID_SIGNATURE")

      await expect(ArkreenMiner.connect(owner1).RemoteMinerOnboardNativeBatchClaim(receiver, typeWithStationID, 5, signature, {value: minerValue}))
              .to.emit(ArkreenMiner, "MinerOnboardedBatch")
              .withArgs(receiver, miners.slice(0, 5));

      expect(await ArkreenMiner.totalSupply()).to.equal(5);
      expect(await ArkreenMiner.balanceOf(receiver)).to.equal(5);

      const lastBlock = await ethers.provider.getBlock('latest')
      const timestamp = lastBlock.timestamp
      const minerInfo0 = [miners[0], MinerType.RemoteMiner + (3<<4), MinerStatus.Normal, timestamp]
      const minerNFT0 = await ArkreenMiner.tokenOfOwnerByIndex(receiver, 0)
      expect(await ArkreenMiner.AllMinerInfo(minerNFT0)).to.deep.eq(minerInfo0);
      expect(await ArkreenMiner.AllMinersToken(miners[0])).to.deep.eq(minerNFT0);
      expect(await ArkreenMiner.whiteListMiner(miners[0])).to.deep.eq(0);

      const minerInfo1 = [miners[1], MinerType.RemoteMiner + (3<<4), MinerStatus.Normal, timestamp]
      const minerNFT1 = await ArkreenMiner.tokenOfOwnerByIndex(receiver, 1)
      expect(await ArkreenMiner.AllMinerInfo(minerNFT1)).to.deep.eq(minerInfo1);
      expect(await ArkreenMiner.AllMinersToken(miners[1])).to.deep.eq(minerNFT1);
      expect(await ArkreenMiner.whiteListMiner(miners[1])).to.deep.eq(0);

      const minerInfo2 = [miners[2], MinerType.RemoteMiner + (3<<4), MinerStatus.Normal, timestamp]
      const minerNFT2 = await ArkreenMiner.tokenOfOwnerByIndex(receiver, 2)
      expect(await ArkreenMiner.AllMinerInfo(minerNFT2)).to.deep.eq(minerInfo2);
      expect(await ArkreenMiner.AllMinersToken(miners[2])).to.deep.eq(minerNFT2);
      expect(await ArkreenMiner.whiteListMiner(miners[2])).to.deep.eq(0);

      await expect(ArkreenMiner.connect(owner1).RemoteMinerOnboardNativeBatchClaim(receiver, typeWithStationID, 5, signature, {value: minerValue}))
              .to.be.revertedWith("Arkreen Miner: Not Allowed")

    })

  })



  
  describe("ArkreenMiner: Onbording a Remote miner paying with MATIC", () => {
    const miners = randomAddresses(10)
    const receiver = randomAddresses(1)[0]
    let DTUMiner = miners[9]
    let payer: string
    let signature: SignatureStruct

    const minerPrice = expandTo18Decimals(10)

    beforeEach(async () => {
      payer = maker1.address
      const lastBlock = await ethers.provider.getBlock('latest')
      const timestamp = lastBlock.timestamp

      await ArkreenMiner.setNativeToken(owner2.address)                          // Just for test 
      const register_digest = getOnboardingRemoteMinerDigest(
                      'Arkreen Miner',
                      ArkreenMiner.address,
                      { owner: owner1.address, miner: miners[1], 
                        token: owner2.address, price: minerPrice, deadline: BigNumber.from(timestamp + 600) }
                    )
      await ArkreenMiner.setManager(Register_Authority, register_authority.address)
      const {v, r, s} = ecsign( Buffer.from(register_digest.slice(2), 'hex'), 
                                            Buffer.from(privateKeyRegister.slice(2), 'hex'))           
      signature = { v, r, s, token: owner2.address, value: minerPrice, deadline: BigNumber.from(timestamp + 600) } 
    });

    it("Onboarding Remote Miner Failed 1: Signature deadline checking ", async () => {
      await network.provider.send("evm_increaseTime", [601]);
      await expect(ArkreenMiner.connect(manager).RemoteMinerOnboardNative(receiver, DTUMiner, signature))        
              .to.be.revertedWith("Arkreen Miner: EXPIRED")
    })      

    it("Onboarding Remote Miner Failed 2: Arkreen Miner: Payment error", async () => {
      await expect(ArkreenMiner.connect(manager).RemoteMinerOnboardNative(receiver, DTUMiner, signature, {value: minerPrice.div(2)}))        
              .to.be.revertedWith("Arkreen Miner: Payment error")
    })

    it("Onboarding Remote Miner Failed 3: Miner not white-listed ", async () => {
      await expect(ArkreenMiner.connect(manager).RemoteMinerOnboardNative(receiver, DTUMiner, signature, {value: minerPrice}))        
              .to.be.revertedWith("Arkreen Miner: Wrong Miner")
    })

    it("Onboarding Remote Miner Failed 4: Manager Signature checking", async () => {
      const miners = randomAddresses(10)
      await ArkreenMiner.connect(manager).UpdateMinerWhiteList(MinerType.RemoteMiner, miners) 
      await expect(ArkreenMiner.connect(manager).RemoteMinerOnboardNative(receiver, miners[1], signature, {value: minerPrice}))          
              .to.be.revertedWith("Arkreen Miner: INVALID_SIGNATURE")
    })

    it("Onboarding Remote Miner: Onboarding a Remote miner", async () => {
      const miners = randomAddresses(10)
      await ArkreenMiner.connect(manager).UpdateMinerWhiteList(MinerType.RemoteMiner, miners) 
      const minerPrice = expandTo18Decimals(2000)

      const receiver = owner1.address
      const register_digest = getOnboardingRemoteMinerDigest(
                      'Arkreen Miner',
                      ArkreenMiner.address,
                      { owner: owner1.address, miner: miners[1], 
                        token: owner2.address, price: minerPrice, deadline: constants.MaxUint256 }
                    )

      const {v,r,s} = ecsign( Buffer.from(register_digest.slice(2), 'hex'), 
                                            Buffer.from(privateKeyRegister.slice(2), 'hex'))           
      const signature: SignatureStruct = { v, r, s, token: owner2.address, value:minerPrice, deadline: constants.MaxUint256 } 

      const signature_err: SignatureStruct = { ...signature, s: r } 
      await expect(ArkreenMiner.connect(manager).RemoteMinerOnboardNative(receiver, miners[1], signature_err, {value: minerPrice}))          
              .to.be.revertedWith("Arkreen Miner: INVALID_SIGNATURE")

      const balanceArkreenMiner = await ethers.provider.getBalance(ArkreenMiner.address)

      const balanceMatic = await ethers.provider.getBalance(owner1.address)
      await expect(ArkreenMiner.connect(owner1).RemoteMinerOnboardNative(receiver,  miners[1], signature, {value: minerPrice}))
              .to.emit(ArkreenMiner, "MinerOnboarded")
              .withArgs(receiver, miners[1]);

      expect(await ethers.provider.getBalance(owner1.address)).to.lt(balanceMatic.sub(minerPrice));
      expect(await ethers.provider.getBalance(ArkreenMiner.address)).to.equal(balanceArkreenMiner.add(minerPrice));
      expect(await ArkreenMiner.totalSupply()).to.equal(1);
      expect(await ArkreenMiner.balanceOf(receiver)).to.equal(1);

      const lastBlock = await ethers.provider.getBlock('latest')
      const timestamp = lastBlock.timestamp
      const minerInfo = [miners[1], MinerType.RemoteMiner, MinerStatus.Normal, timestamp]
      const minerNFT = await ArkreenMiner.tokenOfOwnerByIndex(receiver, 0)
      expect(await ArkreenMiner.AllMinerInfo(minerNFT)).to.deep.eq(minerInfo);
      expect(await ArkreenMiner.AllMinersToken(miners[1])).to.deep.eq(minerNFT);
      expect(await ArkreenMiner.whiteListMiner(miners[1])).to.deep.eq(0);

      // Withdraw 
      const balanceBefore = await ethers.provider.getBalance(ArkreenMiner.address)
      await ArkreenMiner.withdraw(owner2.address) // Native token address is fake
      expect(balanceBefore).to.eq(minerPrice)
      expect(await ethers.provider.getBalance(ArkreenMiner.address)).to.eq(0)
    })
  })

  describe("ArkreenMiner: Onbording a Remote miner paying with MATIC in Batch mode", () => {
    const miners = randomAddresses(10)
    const receiver = randomAddresses(1)[0]
    let DTUMiner = miners[9]
    let payer: string
    let signature: SignatureStruct

    const minerValue = expandTo18Decimals(30)

    beforeEach(async () => {
      payer = maker1.address
      const lastBlock = await ethers.provider.getBlock('latest')
      const timestamp = lastBlock.timestamp

      await ArkreenMiner.setNativeToken(owner2.address)                          // Just for test 
      const register_digest = getOnboardingRemoteMinerBatchDigest(
                      'Arkreen Miner',
                      ArkreenMiner.address,
                      { owner: owner1.address, quantity: BigNumber.from(3),
                        token: owner2.address, price: minerValue, deadline: BigNumber.from(timestamp + 600) }
                    )
      await ArkreenMiner.setManager(Register_Authority, register_authority.address)
      const {v, r, s} = ecsign( Buffer.from(register_digest.slice(2), 'hex'), 
                                            Buffer.from(privateKeyRegister.slice(2), 'hex'))           
      signature = { v, r, s, token: owner2.address, value: minerValue, deadline: BigNumber.from(timestamp + 600) } 
    });

    it("Onboarding Remote Miner MATIC Batch Failed 1: Signature deadline checking ", async () => {
      await network.provider.send("evm_increaseTime", [601]);
      await expect(ArkreenMiner.connect(manager).RemoteMinerOnboardNativeBatch(receiver, 1, signature))        
              .to.be.revertedWith("Arkreen Miner: EXPIRED")
    })      

    it("Onboarding Remote Miner MATIC Batch Failed 2: Arkreen Miner: Payment error", async () => {
      const miners = randomAddresses(10)
      await ArkreenMiner.connect(manager).UpdateMinerWhiteListBatch(miners) 
      await expect(ArkreenMiner.connect(manager).RemoteMinerOnboardNativeBatch(receiver, 3, signature, {value: minerValue.div(2)}))        
              .to.be.revertedWith("Arkreen Miner: Payment error")
    })

    it("Onboarding Remote Miner MATIC Batch Failed 3: Manager Signature checking", async () => {
      const miners = randomAddresses(10)
      await ArkreenMiner.connect(manager).UpdateMinerWhiteListBatch(miners) 
      await expect(ArkreenMiner.connect(manager).RemoteMinerOnboardNativeBatch(receiver, 3, signature, {value: minerValue}))          
              .to.be.revertedWith("Arkreen Miner: INVALID_SIGNATURE")
    })

    it("Onboarding Remote Miner MATIC Batch: Onboarding a Remote miner", async () => {
      const miners = randomAddresses(10)
      await ArkreenMiner.connect(manager).UpdateMinerWhiteListBatch(miners) 
      const minerValue = expandTo18Decimals(2).mul(3)

      const receiver = owner1.address
      const register_digest = getOnboardingRemoteMinerBatchDigest(
                      'Arkreen Miner',
                      ArkreenMiner.address,
                      { owner: owner1.address, quantity: BigNumber.from(3),
                        token: owner2.address, price: minerValue, deadline: constants.MaxUint256 }
                    )

      const {v,r,s} = ecsign( Buffer.from(register_digest.slice(2), 'hex'), 
                                            Buffer.from(privateKeyRegister.slice(2), 'hex'))           
      const signature: SignatureStruct = { v, r, s, token: owner2.address, value:minerValue, deadline: constants.MaxUint256 } 

      const signature_err: SignatureStruct = { ...signature, s: r } 
      await expect(ArkreenMiner.connect(manager).RemoteMinerOnboardNativeBatch(receiver, 3 , signature_err, {value: minerValue}))          
              .to.be.revertedWith("Arkreen Miner: INVALID_SIGNATURE")

      await expect(ArkreenMiner.connect(manager).RemoteMinerOnboardNativeBatch(receiver, 30 , signature, {value: minerValue}))          
              .to.be.revertedWith("Arkreen Miner: Wrong Miner Number")

      const balanceArkreenMiner = await ethers.provider.getBalance(ArkreenMiner.address)

      const balanceMatic = await ethers.provider.getBalance(owner1.address)
      await expect(ArkreenMiner.connect(owner1).RemoteMinerOnboardNativeBatch(receiver, 3, signature, {value: minerValue}))
              .to.emit(ArkreenMiner, "MinerOnboardedBatch")
              .withArgs(receiver, miners.slice(0, 3));

      expect(await ethers.provider.getBalance(owner1.address)).to.lt(balanceMatic.sub(minerValue));
      expect(await ethers.provider.getBalance(ArkreenMiner.address)).to.equal(balanceArkreenMiner.add(minerValue));
      expect(await ArkreenMiner.totalSupply()).to.equal(3);
      expect(await ArkreenMiner.balanceOf(receiver)).to.equal(3);

      const lastBlock = await ethers.provider.getBlock('latest')
      const timestamp = lastBlock.timestamp
      const minerInfo0 = [miners[0], MinerType.RemoteMiner, MinerStatus.Normal, timestamp]
      const minerNFT0 = await ArkreenMiner.tokenOfOwnerByIndex(receiver, 0)
      expect(await ArkreenMiner.AllMinerInfo(minerNFT0)).to.deep.eq(minerInfo0);
      expect(await ArkreenMiner.AllMinersToken(miners[0])).to.deep.eq(minerNFT0);
      expect(await ArkreenMiner.whiteListMiner(miners[0])).to.deep.eq(0);

      const minerInfo1 = [miners[1], MinerType.RemoteMiner, MinerStatus.Normal, timestamp]
      const minerNFT1 = await ArkreenMiner.tokenOfOwnerByIndex(receiver, 1)
      expect(await ArkreenMiner.AllMinerInfo(minerNFT1)).to.deep.eq(minerInfo1);
      expect(await ArkreenMiner.AllMinersToken(miners[1])).to.deep.eq(minerNFT1);
      expect(await ArkreenMiner.whiteListMiner(miners[1])).to.deep.eq(0);

      const minerInfo2 = [miners[2], MinerType.RemoteMiner, MinerStatus.Normal, timestamp]
      const minerNFT2 = await ArkreenMiner.tokenOfOwnerByIndex(receiver, 2)
      expect(await ArkreenMiner.AllMinerInfo(minerNFT2)).to.deep.eq(minerInfo2);
      expect(await ArkreenMiner.AllMinersToken(miners[2])).to.deep.eq(minerNFT2);
      expect(await ArkreenMiner.whiteListMiner(miners[2])).to.deep.eq(0);
    })

    it("Onboarding Remote Miner MATIC Batch: Onboarding a Remote miners: 50 ", async () => {
      const minerValue = expandTo18Decimals(2).mul(5)

      const receiver = owner1.address
      const register_digest = getOnboardingRemoteMinerBatchDigest(
                      'Arkreen Miner',
                      ArkreenMiner.address,
                      { owner: owner1.address, quantity: BigNumber.from(5),
                        token: owner2.address, price: minerValue, deadline: constants.MaxUint256 }
                    )

      const {v,r,s} = ecsign( Buffer.from(register_digest.slice(2), 'hex'), 
                                            Buffer.from(privateKeyRegister.slice(2), 'hex'))           
      const signature: SignatureStruct = { v, r, s, token: owner2.address, value:minerValue, deadline: constants.MaxUint256 } 

      const miners1 = randomAddresses(10)
      await ArkreenMiner.connect(manager).UpdateMinerWhiteListBatch(miners1) 

      await ArkreenMiner.connect(owner1).RemoteMinerOnboardNativeBatch(receiver, 5, signature, {value: minerValue})

      let lastBlock = await ethers.provider.getBlock('latest')
      let timestamp = lastBlock.timestamp

      const minerInfo1 = [miners1[0], MinerType.RemoteMiner, MinerStatus.Normal, timestamp]
      expect(await ArkreenMiner.AllMinerInfo(1)).to.deep.eq(minerInfo1);
      
      const minerInfo5 = [miners1[4], MinerType.RemoteMiner, MinerStatus.Normal, timestamp]
      expect(await ArkreenMiner.AllMinerInfo(5)).to.deep.eq(minerInfo5);

      const miners2 = randomAddresses(15)
      await ArkreenMiner.connect(manager).UpdateMinerWhiteListBatch(miners2) 

      const miners3 = randomAddresses(25)
      await ArkreenMiner.connect(manager).UpdateMinerWhiteListBatch(miners3) 

      const minerValue1 = expandTo18Decimals(2).mul(40)
      const register_digest1 = getOnboardingRemoteMinerBatchDigest(
        'Arkreen Miner',
        ArkreenMiner.address,
        { owner: owner1.address, quantity: BigNumber.from(40),
          token: owner2.address, price: minerValue1, deadline: constants.MaxUint256 }
      )

      const {v:v1, r:r1, s:s1} = ecsign( Buffer.from(register_digest1.slice(2), 'hex'), 
      Buffer.from(privateKeyRegister.slice(2), 'hex'))           
      const signature1: SignatureStruct = { v:v1, r:r1, s:s1, token: owner2.address, value:minerValue1, deadline: constants.MaxUint256 } 

      await ArkreenMiner.connect(owner1).RemoteMinerOnboardNativeBatch(receiver, 40, signature1, {value: minerValue1})

      lastBlock = await ethers.provider.getBlock('latest')
      timestamp = lastBlock.timestamp

      const minerInfo6 = [miners1[5], MinerType.RemoteMiner, MinerStatus.Normal, timestamp]
      expect(await ArkreenMiner.AllMinerInfo(6)).to.deep.eq(minerInfo6)

      const minerInfo10 = [miners1[9], MinerType.RemoteMiner, MinerStatus.Normal, timestamp]
      expect(await ArkreenMiner.AllMinerInfo(10)).to.deep.eq(minerInfo10)

      const minerInfo11 = [miners2[0], MinerType.RemoteMiner, MinerStatus.Normal, timestamp]
      expect(await ArkreenMiner.AllMinerInfo(11)).to.deep.eq(minerInfo11)

      const minerInfo25 = [miners2[14], MinerType.RemoteMiner, MinerStatus.Normal, timestamp]
      expect(await ArkreenMiner.AllMinerInfo(25)).to.deep.eq(minerInfo25)    

      const minerInfo26 = [miners3[0], MinerType.RemoteMiner, MinerStatus.Normal, timestamp]
      expect(await ArkreenMiner.AllMinerInfo(26)).to.deep.eq(minerInfo26)

      const minerInfo40 = [miners3[14], MinerType.RemoteMiner, MinerStatus.Normal, timestamp]
      expect(await ArkreenMiner.AllMinerInfo(40)).to.deep.eq(minerInfo40)
    })

    /*
    it("Onboarding Remote Miner MATIC Batch: Onboarding a Remote miners: Max checking ", async () => {
      const miners = randomAddresses(100)
      await ArkreenMiner.connect(manager).UpdateMinerWhiteListBatch(miners) 
      const minerValue = expandTo18Decimals(2).mul(51)

      const receiver = owner1.address
      const register_digest = getOnboardingRemoteMinerBatchDigest(
                      'Arkreen Miner',
                      ArkreenMiner.address,
                      { owner: owner1.address, quantity: BigNumber.from(51),
                        token: owner2.address, price: minerValue, deadline: constants.MaxUint256 }
                    )

      const {v,r,s} = ecsign( Buffer.from(register_digest.slice(2), 'hex'), 
                                            Buffer.from(privateKeyRegister.slice(2), 'hex'))           
      const signature: SignatureStruct = { v, r, s, token: owner2.address, value:minerValue, deadline: constants.MaxUint256 } 

      await expect(ArkreenMiner.connect(owner1).RemoteMinerOnboardNativeBatch(receiver, 51, signature, {value: minerValue}))
              .to.be.revertedWith("Arkreen Miner: Quantity Too More")
    })
    */

    it("Onboarding Remote Miner MATIC Batch: Onboarding a Remote miners: 50 ", async () => {
      const miners = randomAddresses(50)
      await ArkreenMiner.connect(manager).UpdateMinerWhiteListBatch(miners) 
      const minerValue = expandTo18Decimals(2).mul(50)

      const receiver = owner1.address
      const register_digest = getOnboardingRemoteMinerBatchDigest(
                      'Arkreen Miner',
                      ArkreenMiner.address,
                      { owner: owner1.address, quantity: BigNumber.from(50),
                        token: owner2.address, price: minerValue, deadline: constants.MaxUint256 }
                    )

      const {v,r,s} = ecsign( Buffer.from(register_digest.slice(2), 'hex'), 
                                            Buffer.from(privateKeyRegister.slice(2), 'hex'))           
      const signature: SignatureStruct = { v, r, s, token: owner2.address, value:minerValue, deadline: constants.MaxUint256 } 

      const tx = await ArkreenMiner.connect(owner1).RemoteMinerOnboardNativeBatch(receiver, 50, signature, {value: minerValue})

      expect(await ArkreenMiner.numberOfWhiteListBatch(0)).to.deep.eq(0);

      const receipt = await tx.wait()
      console.log("Gas fee of mining 50 remote miners:", receipt.gasUsed)
//    expect(receipt.gasUsed).to.eq("8162051")  // 8162051 8162039 8149734 8149722 8149630 8149648 8149715 8149747 8140408 8140420 8147392 8147392, 8147380  8121659 8121568 8122040

      await expect(ArkreenMiner.connect(owner1).RemoteMinerOnboardNativeBatch(receiver, 1, signature, {value: minerValue}))
              .to.be.revertedWith("Arkreen Miner: Wrong Miner Number")
    })
  })

  describe("ArkreenMiner: Virtual miner onboarding in batch", () => {
    it("ArkreenMiner Virtual Miner Batch Onboarding: Basic check", async () => {
      const owners_0 = randomAddresses(5)
      const miners_0 = randomAddresses(3)
      await ArkreenMiner.setManager(Miner_Manager, manager.address)
      // only manager accepted
      await expect(ArkreenMiner.connect(deployer).RemoteMinerOnboardInBatch(owners_0, miners_0))
              .to.be.revertedWith("Arkreen Miner: Not Miner Manager")    
      // list length not match
      await expect(ArkreenMiner.connect(manager).RemoteMinerOnboardInBatch(owners_0, miners_0))
              .to.be.revertedWith("Arkreen Miner: Wrong Address List")
      // Normal case 
      const owners = randomAddresses(5)
      const miners = randomAddresses(5)
      await ArkreenMiner.setManager(Miner_Manager, manager.address)
      await expect(ArkreenMiner.connect(manager).RemoteMinerOnboardInBatch(owners, miners))
            .to.emit(ArkreenMiner, "RemoteMinersInBatch")
            .withArgs(owners, miners);
      const lastBlock = await ethers.provider.getBlock('latest')
      const timestamp = lastBlock.timestamp
      const minerInfo_0 = [miners[0], MinerType.RemoteMiner, MinerStatus.Normal, timestamp]
      const minerInfo_1 = [miners[1], MinerType.RemoteMiner, MinerStatus.Normal, timestamp]
      const minerInfo_2 = [miners[2], MinerType.RemoteMiner, MinerStatus.Normal, timestamp]
      const minerNFT_0 = await ArkreenMiner.tokenOfOwnerByIndex(owners[0], 0)
      const minerNFT_1 = await ArkreenMiner.tokenOfOwnerByIndex(owners[1], 0)
      const minerNFT_2 = await ArkreenMiner.tokenOfOwnerByIndex(owners[2], 0)        
      expect(await ArkreenMiner.AllMinerInfo(minerNFT_0)).to.deep.eq(minerInfo_0);
      expect(await ArkreenMiner.AllMinerInfo(minerNFT_1)).to.deep.eq(minerInfo_1); 
      expect(await ArkreenMiner.AllMinerInfo(minerNFT_2)).to.deep.eq(minerInfo_2); 
    })
  })
  describe("ArkreenMiner: Upgrading test", () => {
    async function deployArkreenMinerFixture() {
      const ArkreenMinerFactoryV10U = await ethers.getContractFactory("ArkreenMinerU");
      const ArkreenMinerU = await upgrades.upgradeProxy(ArkreenMiner.address, ArkreenMinerFactoryV10U)
      await ArkreenMinerU.deployed()    
      return { ArkreenMinerU }
    }
    it("ArkreenMiner Upgrading: Basic check", async () => {
      const { ArkreenMinerU } = await loadFixture(deployArkreenMinerFixture);
      expect(await ArkreenMinerU.version()).to.equal('1.0.1');
      const receivers = randomAddresses(10)
      const miners = randomAddresses(10)
      await ArkreenMinerU.connect(manager).RemoteMinerOnboardInBatch(receivers, miners)
      expect(await ArkreenMinerU.tokenURI(9)).to.equal('https://www.arkreen.com/miners/9');
      await ArkreenMinerU.connect(deployer).updateMineMore(9, "Miner 9 more testing info")
      expect(await ArkreenMinerU.getMineMore(9)).to.equal('Miner 9 more testing info');
    })
  })
});
