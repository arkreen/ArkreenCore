import { ArkreenGovernor, ArkreenToken, ArkreenTokenTest, ArkreenTimeLock } from "../../typechain"

import { ethers, upgrades } from "hardhat"
import { assert, expect } from "chai"
import { mine } from "@nomicfoundation/hardhat-network-helpers";
import { expandTo18Decimals } from "../utils/utilities"

// Governor Values
export const QUORUM_PERCENTAGE = 4 // Need 4% of voters to pass
export const MIN_DELAY = 60*60*24*1 // 1 days - after a vote passes, you have 1 hour before you can enact
export const VOTING_PERIOD = 50400 // 1 week - how long the vote lasts. This is pretty long even for local tests
export const VOTING_DELAY = 1 // 1 Block - How many blocks till a proposal vote becomes active
export const ADDRESS_ZERO = "0x0000000000000000000000000000000000000000"

export const PROPOSAL_DESCRIPTION = "Arkreen Proposal #1"

enum ProposalState {
  Pending,
  Active,
  Canceled,
  Defeated,
  Succeeded,
  Queued,
  Expired,
  Executed
}

describe("Governor Flow", async () => {
    let arkreenGovernor: ArkreenGovernor
    let AKREToken: ArkreenToken
    let arkreenTimeLock: ArkreenTimeLock
    const voteWay = 1 // for
    const reason = "My reason"

    beforeEach(async () => {
        const [owner, user1, user2] = await ethers.getSigners();

        // Contract factories
        const ArkreenGovernorFactory = await ethers.getContractFactory("ArkreenGovernor")
        const ArkreenTimeLockFactory = await ethers.getContractFactory("ArkreenTimeLock")
        const ArkreenTokenFactory = await ethers.getContractFactory("ArkreenToken")
        
        // Dimo Token version 01 (without ERC20VotesUpgradeable)
        AKREToken = await upgrades.deployProxy(
                            ArkreenTokenFactory, [10000000000, owner.address, '', '']) as ArkreenToken

        // Deploy TimeLock
        arkreenTimeLock = await upgrades.deployProxy(ArkreenTimeLockFactory, 
                      [MIN_DELAY, [], []]) as ArkreenTimeLock;

        // Deploy Governor
        arkreenGovernor = await upgrades.deployProxy(ArkreenGovernorFactory, 
                      [AKREToken.address, arkreenTimeLock.address]) as ArkreenGovernor;

        await AKREToken.delegate(owner.address);                      

        const PROPOSER_ROLE = await arkreenTimeLock.PROPOSER_ROLE();
        const EXECUTOR_ROLE = await arkreenTimeLock.EXECUTOR_ROLE();

        // Granting roles
        await arkreenTimeLock.grantRole(PROPOSER_ROLE, arkreenGovernor.address);
        await arkreenTimeLock.grantRole(EXECUTOR_ROLE, arkreenGovernor.address);
    })
    
    it("proposes, votes, waits, queues, and then executes transferring proposal", async () => {
        const [owner, user1] = await ethers.getSigners();
        const amountToMint = expandTo18Decimals(123);

        await AKREToken.transfer(arkreenTimeLock.address, expandTo18Decimals(10000))

        // propose
        console.log("Proposing...")
        const encodedFunctionCall = AKREToken.interface.encodeFunctionData("transfer", [user1.address, amountToMint])
        const proposeTx = await arkreenGovernor.propose(
            [AKREToken.address],
            [0],
            [encodedFunctionCall],
            PROPOSAL_DESCRIPTION
        )
        const proposeReceipt = await proposeTx.wait(1)
        const proposalId = proposeReceipt.events![0].args!.proposalId
        let proposalState = await arkreenGovernor.state(proposalId)

        expect(proposalState).to.eq(ProposalState.Pending)

        await mine(VOTING_DELAY + 1)
        await ethers.provider.send("evm_increaseTime", [VOTING_DELAY + 1]);

        // vote
        console.log("Voting...")
        const voteTx = await arkreenGovernor.castVoteWithReason(proposalId, voteWay, reason)
        await voteTx.wait(1)
        proposalState = await arkreenGovernor.state(proposalId)
        expect(proposalState).to.eq(ProposalState.Active)

        await mine(VOTING_PERIOD + 1)

        // queue
        console.log("Queueing...")
        const descriptionHash = ethers.utils.id(PROPOSAL_DESCRIPTION)
        const queueTx = await arkreenGovernor.connect(owner).queue([AKREToken.address], [0], [encodedFunctionCall], descriptionHash)
        await queueTx.wait(1)
        await ethers.provider.send("evm_increaseTime", [MIN_DELAY + 1]);
        await mine(1)

        // execute
        console.log("Executing...")
        const exTx = await arkreenGovernor.execute([AKREToken.address], [0], [encodedFunctionCall], descriptionHash)
        await exTx.wait(1)

        expect(await AKREToken.balanceOf(user1.address)).to.eq(amountToMint)
    })

    it("proposes, votes, waits, queues, and then executes transferring from proposal", async () => {
      const [owner, user1] = await ethers.getSigners();
      const amountToMint = expandTo18Decimals(123);

      await AKREToken.approve(arkreenTimeLock.address, expandTo18Decimals(10000000000))

      // propose
      console.log("Proposing...")
      const encodedFunctionCall = AKREToken.interface.encodeFunctionData("transferFrom", [owner.address, user1.address, amountToMint])
      const proposeTx = await arkreenGovernor.propose(
          [AKREToken.address],
          [0],
          [encodedFunctionCall],
          PROPOSAL_DESCRIPTION
      )
      const proposeReceipt = await proposeTx.wait(1)
      const proposalId = proposeReceipt.events![0].args!.proposalId
      let proposalState = await arkreenGovernor.state(proposalId)

      expect(proposalState).to.eq(ProposalState.Pending)

      await mine(VOTING_DELAY + 1)
      await ethers.provider.send("evm_increaseTime", [VOTING_DELAY + 1]);

      // vote
      console.log("Voting...")
      const voteTx = await arkreenGovernor.castVoteWithReason(proposalId, voteWay, reason)
      await voteTx.wait(1)
      proposalState = await arkreenGovernor.state(proposalId)
      expect(proposalState).to.eq(ProposalState.Active)

      await mine(VOTING_PERIOD + 1)

      // queue
      console.log("Queueing...")
      const descriptionHash = ethers.utils.id(PROPOSAL_DESCRIPTION)
      const queueTx = await arkreenGovernor.connect(owner).queue([AKREToken.address], [0], [encodedFunctionCall], descriptionHash)
      await queueTx.wait(1)
      await ethers.provider.send("evm_increaseTime", [MIN_DELAY + 1]);
      await mine(1)

      // execute
      console.log("Executing...")
      const exTx = await arkreenGovernor.execute([AKREToken.address], [0], [encodedFunctionCall], descriptionHash)
      await exTx.wait(1)

      expect(await AKREToken.balanceOf(user1.address)).to.eq(amountToMint)
    })
    
    it("proposes, votes, waits, queues, and then executes updateDelay proposal", async () => {
        const [owner] = await ethers.getSigners();

        expect(await arkreenTimeLock.getMinDelay()).to.eq(MIN_DELAY)
      
        // propose
        console.log("Proposing...")
        const newDelay = 60 *60 *24 *2
        const encodedFunctionCall = arkreenTimeLock.interface.encodeFunctionData("updateDelay", [newDelay])
        const proposeTx = await arkreenGovernor.propose(
            [arkreenTimeLock.address],
            [0],
            [encodedFunctionCall],
            PROPOSAL_DESCRIPTION
        )
        const proposeReceipt = await proposeTx.wait(1)
        const proposalId = proposeReceipt.events![0].args!.proposalId
        let proposalState = await arkreenGovernor.state(proposalId)
        expect(proposalState).to.eq(ProposalState.Pending)

        await mine(VOTING_DELAY + 1)
        await ethers.provider.send("evm_increaseTime", [VOTING_DELAY + 1]);

        // vote
        console.log("Voting...")
        const voteTx = await arkreenGovernor.castVoteWithReason(proposalId, voteWay, reason)
        await voteTx.wait(1)
        proposalState = await arkreenGovernor.state(proposalId)
        expect(proposalState).to.eq(ProposalState.Active)

        await mine(VOTING_PERIOD + 1)

        // queue
        console.log("Queueing...")
        const descriptionHash = ethers.utils.id(PROPOSAL_DESCRIPTION)
        const queueTx = await arkreenGovernor.connect(owner).queue([arkreenTimeLock.address], [0], [encodedFunctionCall], descriptionHash)
        await queueTx.wait(1)
        await ethers.provider.send("evm_increaseTime", [MIN_DELAY + 1]);
        await mine(1)

        // execute
        console.log("Executing...")
        const exTx = await arkreenGovernor.execute([arkreenTimeLock.address], [0], [encodedFunctionCall], descriptionHash)
        await exTx.wait(1)

        expect(await arkreenTimeLock.getMinDelay()).to.eq(newDelay)
    })

    it("proposes, votes, waits, queues, and then executes updateQuorumNumerator proposal", async () => {
        const [owner] = await ethers.getSigners();
        expect(await arkreenGovernor["quorumNumerator()"]()).to.eq(4)
        expect(await arkreenGovernor.token()).to.eq(AKREToken.address)
        expect(await AKREToken.delegates(owner.address)).to.eq(owner.address)

        // propose
        console.log("Propose...")
        const encodedFunctionCall = arkreenGovernor.interface.encodeFunctionData("updateQuorumNumerator", [6])
        const proposeTx = await arkreenGovernor.propose(
            [arkreenGovernor.address],
            [0],
            [encodedFunctionCall],
            PROPOSAL_DESCRIPTION
        )
        const proposeReceipt = await proposeTx.wait()
        const proposalId = proposeReceipt.events![0].args!.proposalId
        let proposalState = await arkreenGovernor.state(proposalId)

        expect(proposalState).to.eq(ProposalState.Pending)

        await mine(VOTING_DELAY + 1)
        await ethers.provider.send("evm_increaseTime", [VOTING_DELAY + 1]);
        await mine(1)

        // vote
        console.log("Voting...")
        await expect(arkreenGovernor.castVoteWithReason(proposalId, voteWay, reason))
                    .to.emit(arkreenGovernor, "VoteCast")
                    .withArgs(owner.address, proposalId, 1, expandTo18Decimals(10000000000), 'My reason')

        proposalState = await arkreenGovernor.state(proposalId)
        expect(proposalState).to.eq(ProposalState.Active)
   
        await mine(VOTING_PERIOD + 1)
        proposalState = await arkreenGovernor.state(proposalId)
        expect(proposalState).to.eq(ProposalState.Succeeded)
  
        // queue
        console.log("Queueing...")
        const descriptionHash = ethers.utils.id(PROPOSAL_DESCRIPTION)
        const queueTx = await arkreenGovernor.connect(owner).queue([arkreenGovernor.address], [0], [encodedFunctionCall], descriptionHash)
        await queueTx.wait(1)
        await ethers.provider.send("evm_increaseTime", [MIN_DELAY + 1]);
        await mine(1)
        proposalState = await arkreenGovernor.state(proposalId)
        assert.equal(proposalState.toString(), "5")

        // execute
        console.log("Executing...")
        const exTx = await arkreenGovernor.execute([arkreenGovernor.address], [0], [encodedFunctionCall], descriptionHash)
        await exTx.wait(1)

        expect(await arkreenGovernor["quorumNumerator()"]()).to.eq(6)
    })
})