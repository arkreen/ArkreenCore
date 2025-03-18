import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import { expect } from "chai"
import { ethers } from "hardhat"

import { AKREVesting, ERC20F } from "../../typechain"
import { createSnapshot, revertToSnapshot } from "../utils/snapshot"

import { expandTo18Decimals } from "../utils/utilities"

import { BigNumber } from "ethers"
import { anyValue } from "@nomicfoundation/hardhat-chai-matchers/withArgs";

export type VestingSchedule = {
  initialized: boolean
  cliffEnd: BigNumber
  start: BigNumber
  duration: BigNumber
  amountTotal: BigNumber
  released: BigNumber
  revoked: boolean
}

export interface VestingAddressToBeneficiaries {
  address: string
  beneficiaries: string[]
}

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000"

describe("akreVesting", function () {
  let snapshot: string
  let testToken: ERC20F
  let akreVesting: AKREVesting

  let owner: SignerWithAddress
  let nonOwner: SignerWithAddress
  let newOwner: SignerWithAddress
  let addr1: SignerWithAddress
  let addr2: SignerWithAddress

  let beneficiary1: string
  let beneficiary2: string

  const startTime = (+new Date() / 1000) | 0;   // Truncate 3 decimals
  const cliff = 60 * 60 * 24 * 365              // 1 year
  const duration = 60 * 60 * 24 * 365 * 5       // 5 years
  const amount = 567989733                      // 9408471

  before(async function () {
    
    [owner, nonOwner, newOwner, addr1, addr2] = await ethers.getSigners()

    beneficiary1 = addr1.address
    beneficiary2 = addr2.address

    const TestTokenFactory = await ethers.getContractFactory("ERC20F")
    const akreVestingFactory = await ethers.getContractFactory("AKREVesting")

    testToken = await TestTokenFactory.deploy(expandTo18Decimals(1000000000), "Test Token")
    await testToken.deployed()

    akreVesting = await akreVestingFactory.deploy(testToken.address)
    await akreVesting.deployed()
  })

  beforeEach(async () => {
    snapshot = await createSnapshot()
  })

  afterEach(async () => {
    await revertToSnapshot(snapshot)
  })

  describe("constructor", () => {
    it("Should revert if token is zero address", async () => {
      const akreVestingFactory = await ethers.getContractFactory("AKREVesting")
      await expect(akreVestingFactory.deploy(ZERO_ADDRESS)).to.be.revertedWith(
        "Token cannot be zero address"
      )
    })
    it("Should correctly set token address", async () => {
      expect((await akreVesting.getToken()).toString()).to.equal(
        testToken.address
      )
    })
    it("Should correctly set owner", async () => {
      expect(await akreVesting.owner()).to.equal(owner.address)
    })
  })

  describe("transferOwnership", async () => {
    it("Should revert if caller is not the owner", async () => {
      await expect(
        akreVesting.connect(nonOwner).transferOwnership(nonOwner.address)
      ).to.be.revertedWith("Only callable by owner")
    })
  })

  describe("acceptOwnership", async () => {
    it("Should revert if caller is not the pending owner", async () => {
      await akreVesting.connect(owner).transferOwnership(newOwner.address)

      await expect(
        akreVesting.connect(nonOwner).acceptOwnership()
      ).to.be.revertedWith("Must be proposed owner")
    })
    it("Should correctly transfer ownership", async () => {
      await akreVesting.connect(owner).transferOwnership(newOwner.address)

      await akreVesting.connect(newOwner).acceptOwnership()

      expect(await akreVesting.owner()).to.equal(newOwner.address)
    })
    it("Should emit OwnershipTransferred event with correct params", async () => {
      await akreVesting.connect(owner).transferOwnership(newOwner.address)

      await expect(akreVesting.connect(newOwner).acceptOwnership())
        .to.emit(akreVesting, "OwnershipTransferred")
        .withArgs(owner.address, newOwner.address)
    })
  })

  describe("createVestingSchedule", function () {
    it("Should revert if caller is not the owner", async () => {
      await expect(
        akreVesting
          .connect(nonOwner)
          .createVestingSchedule(
            beneficiary1,
            startTime,
            cliff,
            duration,
            amount
          )
      ).to.be.revertedWith("Only callable by owner")
    })
    it("Should revert if vesting schedule is already initialized", async () => {
      await testToken.transfer(akreVesting.address, amount)
      await akreVesting.createVestingSchedule(
        beneficiary1,
        startTime,
        cliff,
        duration,
        amount
      )

      await expect(
        akreVesting.createVestingSchedule(
          beneficiary1,
          startTime,
          cliff,
          duration,
          amount
        )
      ).to.be.revertedWith("Already initialized")
    })
    it("Should revert if duration is not greater than zero", async () => {
      await expect(
        akreVesting.createVestingSchedule(
          beneficiary1,
          startTime,
          cliff,
          0,
          amount
        )
      ).to.be.revertedWith("Duration must be > 0")
    })
    it("Should revert if amount is not greater than zero", async () => {
      await expect(
        akreVesting.createVestingSchedule(
          beneficiary1,
          startTime,
          cliff,
          duration,
          0
        )
      ).to.be.revertedWith("Amount must be > 0")
    })
    it("Should revert if cliff is not less than the duration", async () => {
      await expect(
        akreVesting.createVestingSchedule(
          beneficiary1,
          startTime,
          duration * 2,
          duration,
          amount
        )
      ).to.be.revertedWith("Cliff must be <= duration")
    })
    it("Should vest tokens gradually", async () => {
      await expect(
        akreVesting.createVestingSchedule(
          beneficiary1,
          startTime,
          cliff,
          duration,
          amount
        )
      ).to.be.revertedWith("Not sufficient tokens")
    })
    it("Should correctly update vesting schedules total amount", async () => {
      await testToken.transfer(akreVesting.address, amount)

      await akreVesting.createVestingSchedule(
        beneficiary1,
        startTime,
        cliff,
        duration,
        amount
      )
      expect(
        await akreVesting.getVestingSchedulesTotalAmount()
      ).to.equal(amount)
    })
    it("Should emit VestingScheduleCreated event with correct params", async () => {
      await testToken.transfer(akreVesting.address, amount)

      await expect(
        akreVesting.createVestingSchedule(
          beneficiary1,
          startTime,
          cliff,
          duration,
          amount
        )
      )
        .to.emit(akreVesting, "VestingScheduleCreated")
        .withArgs(beneficiary1, amount)
    })
  })

  describe("revoke", () => {
    beforeEach(async () => {
      await testToken.transfer(akreVesting.address, amount)
      await akreVesting.createVestingSchedule(
        beneficiary1,
        startTime,
        cliff,
        duration,
        amount
      )
    })

    it("Should revert if caller is not the owner", async () => {
      await expect(
        akreVesting.connect(nonOwner).revoke(beneficiary1)
      ).to.be.revertedWith("Only callable by owner")
    })
    it("Should revert if beneficiary is already revoked", async () => {
      await akreVesting.revoke(beneficiary1)

      await expect(akreVesting.revoke(beneficiary1)).to.be.revertedWith(
        "Vesting schedule was revoked"
      )
    })
    it("Should set vesting schedule as not initialized", async () => {
      const vestingScheduleBefore: VestingSchedule =
        await akreVesting.getVestingSchedule(beneficiary1)

      // eslint-disable-next-line no-unused-expressions
      expect(vestingScheduleBefore.initialized).to.be.true

      await akreVesting.revoke(beneficiary1)

      const vestingScheduleAfter: VestingSchedule =
        await akreVesting.getVestingSchedule(beneficiary1)

      // eslint-disable-next-line no-unused-expressions
      expect(vestingScheduleAfter.initialized).to.be.false
    })
    it("Should set vesting schedule as revoked", async () => {
      const vestingScheduleBefore: VestingSchedule =
        await akreVesting.getVestingSchedule(beneficiary1)

      // eslint-disable-next-line no-unused-expressions
      expect(vestingScheduleBefore.revoked).to.be.false

      await akreVesting.revoke(beneficiary1)

      const vestingScheduleAfter: VestingSchedule =
        await akreVesting.getVestingSchedule(beneficiary1)

      // eslint-disable-next-line no-unused-expressions
      expect(vestingScheduleAfter.revoked).to.be.true
    })

    context("When cliff is not reached", () => {
      it("Should transfer unreleased tokens to the owner", async () => {
        await expect(() =>
          akreVesting.revoke(beneficiary1)
        ).to.changeTokenBalance(testToken, owner, amount)
      })
      it("Should correctly update vesting schedules total amount", async () => {
        await akreVesting.revoke(beneficiary1)

        expect(
          await akreVesting.getVestingSchedulesTotalAmount()
        ).to.equal(0)
      })
      it("Should emit Revoked event with correct params", async () => {
        await expect(akreVesting.revoke(beneficiary1))
          .to.emit(akreVesting, "Revoked")
          .withArgs(beneficiary1, amount)
      })
    })

    context("When cliff is reached", () => {
      const amountToVestCliff = ((amount * cliff) / duration) | 0

      beforeEach(async () => {
        await ethers.provider.send("evm_increaseTime", [cliff + 10])
        await akreVesting.release(beneficiary1, amountToVestCliff)
      })

      it("Should transfer unreleased tokens to the owner", async () => {
        await expect(() =>
          akreVesting.revoke(beneficiary1)
        ).to.changeTokenBalance(testToken, owner, amount - amountToVestCliff)
      })
      it("Should correctly update vesting schedules total amount", async () => {
        await akreVesting.revoke(beneficiary1)

        expect(
          await akreVesting.getVestingSchedulesTotalAmount()
        ).to.equal(0)
      })
      it("Should emit Revoked event with correct params", async () => {
        await expect(akreVesting.revoke(beneficiary1))
          .to.emit(akreVesting, "Revoked")
          .withArgs(beneficiary1, amount - amountToVestCliff)
      })
    })

    context("When all vesting duration has passed", () => {
      beforeEach(async () => {
        await ethers.provider.send("evm_increaseTime", [cliff + duration + 10])
        await akreVesting.release(beneficiary1, amount)
      })

      it("Should transfer unreleased tokens to the owner", async () => {
        await expect(() =>
          akreVesting.revoke(beneficiary1)
        ).to.changeTokenBalance(testToken, owner, 0)
      })
      it("Should emit Revoked event with correct params", async () => {
        await expect(akreVesting.revoke(beneficiary1))
          .to.emit(akreVesting, "Revoked")
          .withArgs(beneficiary1, 0)
      })
    })
  })

  describe("release", () => {
    beforeEach(async () => {
      await testToken.transfer(akreVesting.address, amount)
      await akreVesting.createVestingSchedule(
        beneficiary1,
        startTime,
        cliff,
        duration,
        amount
      )
    })

    it("Should revert if beneficiary was revoked", async () => {
      await akreVesting.revoke(beneficiary1)

      await expect(
        akreVesting.release(beneficiary1, amount)
      ).to.be.revertedWith("Vesting schedule was revoked")
    })
    it("Should revert if caller is not the beneficiary or the owner", async () => {
      await expect(
        akreVesting.connect(nonOwner).release(beneficiary1, amount)
      ).to.be.revertedWith(
        "Only beneficiary and owner can release vested tokens"
      )
    })
    it("Should revert if amount requested is greater than releasable amount", async () => {
      await expect(
        akreVesting.release(beneficiary1, amount * 2)
      ).to.be.revertedWith("Amount is too high")
    })

    context("When only the cliff amount is released", () => {
      const amountToVestCliff = ((amount * cliff) / duration) | 0

      it("Should update vesting schedule released amount", async () => {
        const vestingScheduleBefore: VestingSchedule =
          await akreVesting.getVestingSchedule(beneficiary1)

        expect(vestingScheduleBefore.released).to.equal(0)

        await ethers.provider.send("evm_increaseTime", [cliff + 10])

        await akreVesting.release(beneficiary1, amountToVestCliff)

        const vestingScheduleAfter: VestingSchedule =
          await akreVesting.getVestingSchedule(beneficiary1)

        expect(vestingScheduleAfter.released).to.equal(amountToVestCliff)
      })
      it("Should transfer released tokens to beneficiary", async () => {
        await ethers.provider.send("evm_increaseTime", [cliff + 10])

        await expect(() =>
          akreVesting.release(beneficiary1, amountToVestCliff)
        ).to.changeTokenBalance(testToken, addr1, amountToVestCliff)
      })
      it("Should emit Released event with correct params", async () => {
        await ethers.provider.send("evm_increaseTime", [cliff + 10])

        await expect(akreVesting.release(beneficiary1, amountToVestCliff))
          .to.emit(akreVesting, "Released")
          .withArgs(beneficiary1, amountToVestCliff)
      })
    })

    context("releaseAll: When only the cliff amount is released", () => {
      it("Should update vesting schedule released amount", async () => {
        const vestingScheduleBefore: VestingSchedule =
          await akreVesting.getVestingSchedule(beneficiary1)

        expect(vestingScheduleBefore.released).to.equal(0)

        await ethers.provider.send("evm_increaseTime", [cliff + 100])

        await akreVesting.releaseAll(beneficiary1)
        const lastBlock = await ethers.provider.getBlock('latest')
        const amountToVestCliff = (amount * (lastBlock.timestamp - startTime) / duration) | 0

        const vestingScheduleAfter: VestingSchedule =
          await akreVesting.getVestingSchedule(beneficiary1)

        expect(vestingScheduleAfter.released).to.equal(amountToVestCliff)
      })
      it("Should emit Released event with correct params", async () => {
        await ethers.provider.send("evm_increaseTime", [cliff + 100])

        await expect(akreVesting.releaseAll(beneficiary1))
          .to.emit(akreVesting, "Released")
          .withArgs(beneficiary1, anyValue)
      })
    })

    context("When more than the cliff amount is released", () => {
      const periodAfterCliff = 60 * 60 * 24 * 365
      const amountToVestCliff =
        ((amount * (cliff + periodAfterCliff)) / duration) | 0

      it("Should update vesting schedule released amount", async () => {
        const vestingScheduleBefore: VestingSchedule =
          await akreVesting.getVestingSchedule(beneficiary1)

        // eslint-disable-next-line no-unused-expressions
        expect(vestingScheduleBefore.released).to.equal(0)

        await ethers.provider.send("evm_increaseTime", [
          cliff + periodAfterCliff + 10,
        ])

        await akreVesting.release(beneficiary1, amountToVestCliff)

        const vestingScheduleAfter: VestingSchedule =
          await akreVesting.getVestingSchedule(beneficiary1)

        // eslint-disable-next-line no-unused-expressions
        expect(vestingScheduleAfter.released).to.equal(amountToVestCliff)
      })
      it("Should transfer released tokens to beneficiary", async () => {
        await ethers.provider.send("evm_increaseTime", [
          cliff + periodAfterCliff + 10,
        ])

        await expect(() =>
          akreVesting.release(beneficiary1, amountToVestCliff)
        ).to.changeTokenBalance(testToken, addr1, amountToVestCliff)
      })
      it("Should emit Released event with correct params", async () => {
        await ethers.provider.send("evm_increaseTime", [
          cliff + periodAfterCliff + 10,
        ])

        await expect(akreVesting.release(beneficiary1, amountToVestCliff))
          .to.emit(akreVesting, "Released")
          .withArgs(beneficiary1, amountToVestCliff)
      })
    })

    context("When all vesting duration has passed", () => {
      it("Should update vesting schedule released amount", async () => {
        const vestingScheduleBefore: VestingSchedule =
          await akreVesting.getVestingSchedule(beneficiary1)

        // eslint-disable-next-line no-unused-expressions
        expect(vestingScheduleBefore.released).to.equal(0)

        await ethers.provider.send("evm_increaseTime", [cliff + duration + 10])

        await akreVesting.release(beneficiary1, amount)

        const vestingScheduleAfter: VestingSchedule =
          await akreVesting.getVestingSchedule(beneficiary1)

        // eslint-disable-next-line no-unused-expressions
        expect(vestingScheduleAfter.released).to.equal(amount)
      })
      it("Should transfer released tokens to beneficiary", async () => {
        await ethers.provider.send("evm_increaseTime", [cliff + duration + 10])

        await expect(() =>
          akreVesting.release(beneficiary1, amount)
        ).to.changeTokenBalance(testToken, addr1, amount)
      })
      it("Should emit Released event with correct params", async () => {
        await ethers.provider.send("evm_increaseTime", [cliff + duration + 10])

        await expect(akreVesting.release(beneficiary1, amount))
          .to.emit(akreVesting, "Released")
          .withArgs(beneficiary1, amount)
      })
    })
  })

  describe("withdraw", () => {
    it("Should revert if caller is not the owner", async () => {
      await expect(
        akreVesting.connect(nonOwner).withdraw(100)
      ).to.be.revertedWith("Only callable by owner")
    })
    it("Should revert amount is greater than withdrawable amount", async () => {
      await expect(akreVesting.connect(owner).withdraw(100)).to.be.revertedWith(
        "Not enough withdrawable funds"
      )
    })
    it("Should correctly withdraw available funds when no vesting schedule was created", async () => {
      await testToken.transfer(akreVesting.address, amount)

      await expect(() => akreVesting.withdraw(amount)).to.changeTokenBalance(
        testToken,
        owner,
        amount
      )
    })
    it("Should correctly withdraw available funds when vesting schedules were created", async () => {
      const excessAmount = 100

      await testToken.transfer(akreVesting.address, amount * 2 + excessAmount)
      await akreVesting.createVestingSchedule(
        beneficiary1,
        startTime,
        cliff,
        duration,
        amount
      )
      await akreVesting.createVestingSchedule(
        beneficiary2,
        startTime,
        cliff,
        duration,
        amount
      )

      await expect(() =>
        akreVesting.withdraw(excessAmount)
      ).to.changeTokenBalance(testToken, owner, excessAmount)
    })
  })

  describe("getVestingSchedulesTotalAmount", () => {
    it("Should return 0 if no vesting schedule was created", async () => {
      await testToken.transfer(akreVesting.address, amount)

      expect(
        await akreVesting.getVestingSchedulesTotalAmount()
      ).to.equal(0)
    })
    it("Should return correct amount after vesting schedules creation", async () => {
      await testToken.transfer(akreVesting.address, amount * 2 + 10)
      await akreVesting.createVestingSchedule(
        beneficiary1,
        startTime,
        cliff,
        duration,
        amount
      )
      await akreVesting.createVestingSchedule(
        beneficiary2,
        startTime,
        cliff,
        duration,
        amount
      )

      expect(
        await akreVesting.getVestingSchedulesTotalAmount()
      ).to.equal(amount * 2)
    })
  })

  describe("getVestingSchedule", () => {
    it("Should return an empty struct if beneficiary does not have a vesting schedule", async () => {
      const vestingSchedule: VestingSchedule =
        await akreVesting.getVestingSchedule(beneficiary1)

      expect(vestingSchedule.initialized).to.be.false
      expect(vestingSchedule.cliffEnd).to.equal(0)
      expect(vestingSchedule.start).to.equal(0)
      expect(vestingSchedule.duration).to.equal(0)
      expect(vestingSchedule.amountTotal).to.equal(0)
      expect(vestingSchedule.released).to.equal(0)
      // eslint-disable-next-line no-unused-expressions
      expect(vestingSchedule.revoked).to.be.false
    })
    it("Should return correct information", async () => {
      await testToken.transfer(akreVesting.address, amount)
      await akreVesting.createVestingSchedule(
        beneficiary1,
        startTime,
        cliff,
        duration,
        amount
      )

      const vestingSchedule: VestingSchedule =
        await akreVesting.getVestingSchedule(beneficiary1)

      expect(vestingSchedule.initialized).to.be.true
      expect(vestingSchedule.cliffEnd).to.equal(startTime + cliff)
      expect(vestingSchedule.start).to.equal(startTime)
      expect(vestingSchedule.duration).to.equal(duration)
      expect(vestingSchedule.amountTotal).to.equal(amount)
      expect(vestingSchedule.released).to.equal(0)
      // eslint-disable-next-line no-unused-expressions
      expect(vestingSchedule.revoked).to.be.false
    })
  })

  describe("computeReleasableAmount", () => {
    beforeEach(async () => {
      await testToken.transfer(akreVesting.address, amount)
      await akreVesting.createVestingSchedule(
        beneficiary1,
        startTime,
        cliff,
        duration,
        amount
      )
    })

    it("Should return 0 if address is not a beneficiary", async () => {
      expect(await akreVesting.computeReleasableAmount(beneficiary2)).to.equal(0)
    })
    it("Should return 0 if the cliff was not reached", async () => {
      expect(await akreVesting.computeReleasableAmount(beneficiary1)).to.equal(0)
    })
    it("Should return 0 if beneficiary was revoked", async () => {
      await akreVesting.revoke(beneficiary1)

      expect(await akreVesting.computeReleasableAmount(beneficiary1)).to.equal(0)
    })
    it("Should return correct amount after cliff", async () => {
      const periodAfterCliff = 60 * 60 * 24 * 365
      
      await ethers.provider.send("evm_increaseTime", [cliff + periodAfterCliff])
      await ethers.provider.send("evm_mine", [])

      const lastBlock = await ethers.provider.getBlock('latest')
      const releasableAmount = (amount * (lastBlock.timestamp - startTime)) / duration | 0

      expect(
        (await akreVesting.computeReleasableAmount(beneficiary1)).toNumber()
      ).to.be.eq(releasableAmount)
    })
    it("Should return all amount if all vesting duration has passed", async () => {
      await ethers.provider.send("evm_increaseTime", [cliff + duration + 10])
      await ethers.provider.send("evm_mine", [])

      expect(await akreVesting.computeReleasableAmount(beneficiary1)).to.equal(
        amount
      )
    })
    it("Should return correct amount after release", async () => {
      const periodAfterCliff = 60 * 60 * 24 * 365
      const cliffAmount = ((amount * cliff) / duration) | 0

      await ethers.provider.send("evm_increaseTime", [cliff + periodAfterCliff])
      await ethers.provider.send("evm_mine", [])

      await akreVesting.release(beneficiary1, cliffAmount)

      const lastBlock = await ethers.provider.getBlock('latest')
      const releasableAmount = (amount * (lastBlock.timestamp - startTime)) / duration | 0

      expect(
        (await akreVesting.computeReleasableAmount(beneficiary1)).toNumber()
      ).to.be.eq(releasableAmount - cliffAmount)
    })
  })

  describe("getWithdrawableAmount", () => {
    it("Should return 0 if no funding has been made", async () => {
      expect(await akreVesting.getWithdrawableAmount()).to.equal(0)
    })
    it("Should return correct amount after vesting schedules creation", async () => {
      const excessAmount = 100

      await testToken.transfer(akreVesting.address, amount * 2 + excessAmount)
      await akreVesting.createVestingSchedule(
        beneficiary1,
        startTime,
        cliff,
        duration,
        amount
      )
      await akreVesting.createVestingSchedule(
        beneficiary2,
        startTime,
        cliff,
        duration,
        amount
      )

      expect(await akreVesting.getWithdrawableAmount()).to.equal(excessAmount)
    })
  })
})
