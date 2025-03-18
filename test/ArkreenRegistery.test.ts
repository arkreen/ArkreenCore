import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import { expect } from "chai";
import { constants, utils, BigNumber, Contract } from 'ethers'
import { ethers, network, upgrades } from "hardhat";

import {
    ArkreenToken,
    ArkreenToken__factory,
    ArkreenRegistry,
    ArkreenRECToken,
} from "../typechain";

describe("ArkreenRegistry", () => {
    let deployer:           SignerWithAddress
    let bob:                SignerWithAddress
    let alice:              SignerWithAddress
    let AKREToken:          ArkreenToken
    let arkreenRegistry:   ArkreenRegistry
    let arkreenRECToken:    ArkreenRECToken

    beforeEach(async () => {
        [deployer, bob, alice] = await ethers.getSigners();
        const AKRETokenFactory = await ethers.getContractFactory("ArkreenToken");
        AKREToken = await upgrades.deployProxy(AKRETokenFactory, [10_000_000_000, deployer.address,'','']) as ArkreenToken
        await AKREToken.deployed();

        const ArkreenRegistryFactory = await ethers.getContractFactory("ArkreenRegistry")
        arkreenRegistry = await upgrades.deployProxy(ArkreenRegistryFactory,[]) as ArkreenRegistry
        await arkreenRegistry.deployed()

        const ArkreenRECTokenFactory = await ethers.getContractFactory("ArkreenRECToken")
        arkreenRECToken = await upgrades.deployProxy(ArkreenRECTokenFactory,[arkreenRegistry.address, bob.address, '', '']) as ArkreenRECToken
        await arkreenRECToken.deployed()        
    });

    it("ArkreenRegistry: pause & unpause", async () => {
      await arkreenRegistry.pause()
      expect( await arkreenRegistry.paused()).to.equals(true)

      await arkreenRegistry.unpause()
      expect( await arkreenRegistry.paused()).to.equals(false)    

//      let PAUSER = utils.keccak256(utils.toUtf8Bytes('PAUSER_ROLE')
//      await arkreenRegistry.grantRole(PAUSER, bob.address)
    })

    it("ArkreenRegistry: addRECIssuer", async () => {
        await expect(arkreenRegistry.connect(bob).addRECIssuer(bob.address, arkreenRECToken.address, "Arkreen Issuer"))
                .to.be.revertedWith("Ownable: caller is not the owner")      

        await expect(arkreenRegistry.addRECIssuer(constants.AddressZero, arkreenRECToken.address, "Arkreen Issuer"))
                .to.be.revertedWith("Arkreen: Zero Address")

        await arkreenRegistry.addRECIssuer(bob.address, arkreenRECToken.address, "Arkreen Issuer")
        expect(await arkreenRegistry.numIssuers()).to.equal(1);

        let lastBlock = await ethers.provider.getBlock('latest')
        let recIssuers = [true, lastBlock.timestamp, 0, arkreenRECToken.address, "Arkreen Issuer"]
        expect(await arkreenRegistry.recIssuers(bob.address)).to.deep.equal(recIssuers);

        await expect(arkreenRegistry.addRECIssuer(bob.address, arkreenRECToken.address, "Arkreen Issuer"))
                      .to.be.revertedWith("Arkreen: Issuer Already Added")    

        await arkreenRegistry.addRECIssuer(alice.address, arkreenRECToken.address, "Arkreen Issuer")
        expect(await arkreenRegistry.numIssuers()).to.equal(2);

        lastBlock = await ethers.provider.getBlock('latest')
        recIssuers = [true, lastBlock.timestamp, 0, arkreenRECToken.address, "Arkreen Issuer"]
        expect(await arkreenRegistry.recIssuers(alice.address)).to.deep.equal(recIssuers);
    });

    it("ArkreenRegistry: removeRECIssuer", async () => {
      await expect(arkreenRegistry.connect(bob).removeRECIssuer(bob.address))
              .to.be.revertedWith("Ownable: caller is not the owner")      

      await arkreenRegistry.addRECIssuer(bob.address, arkreenRECToken.address, "Arkreen Issuer")

      await expect(arkreenRegistry.removeRECIssuer(constants.AddressZero))
              .to.be.revertedWith("Arkreen: Zero Address")

      await expect(arkreenRegistry.removeRECIssuer(alice.address))
              .to.be.revertedWith("Arkreen: Issuer Not Added")  

      await arkreenRegistry.addRECIssuer(alice.address, arkreenRECToken.address, "Arkreen Issuer")        
      expect(await arkreenRegistry.numIssuers()).to.equal(2);  

      let { addTime: bobAddTime } = await arkreenRegistry.recIssuers(bob.address)
      await arkreenRegistry.removeRECIssuer(bob.address)
      expect(await arkreenRegistry.numIssuers()).to.equal(2);  

      let lastBlock = await ethers.provider.getBlock('latest')
      let recIssuers = [false, bobAddTime, lastBlock.timestamp, arkreenRECToken.address, "Arkreen Issuer"]
      expect(await arkreenRegistry.recIssuers(bob.address)).to.deep.equal(recIssuers);      
  
      let { addTime: aliceAddTime } = await arkreenRegistry.recIssuers(alice.address)
      await arkreenRegistry.removeRECIssuer(alice.address)
      lastBlock = await ethers.provider.getBlock('latest')
      recIssuers = [false, aliceAddTime, lastBlock.timestamp, arkreenRECToken.address, "Arkreen Issuer"]

      expect(await arkreenRegistry.numIssuers()).to.equal(2);  
      expect(await arkreenRegistry.recIssuers(alice.address)).to.deep.equal(recIssuers);              
  });

});
