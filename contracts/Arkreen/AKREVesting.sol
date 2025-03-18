// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./ConfirmedOwner.sol";  

contract AKREVesting is ConfirmedOwner, ReentrancyGuard {
    using SafeERC20 for IERC20;

    struct VestingSchedule {
        bool initialized;
        // time of the end of the cliff period
        uint256 cliffEnd;
        // start time of the vesting period
        uint256 start;
        // duration of the vesting period in seconds
        uint256 duration;
        // total amount of tokens to be released at the end of the vesting
        uint256 amountTotal;
        // amount of tokens already released
        uint256 released;
        // whether or not the vesting has been revoked
        bool revoked;
    }

    // address of the ERC20 token
    IERC20 private immutable _token;

    mapping(address => VestingSchedule) private vestingSchedules;
    uint256 private vestingSchedulesTotalAmount;

    event VestingScheduleCreated(address indexed beneficiary, uint256 amount);
    event Released(address indexed beneficiary, uint256 amount);
    event Revoked(address indexed beneficiary, uint256 amountUnreleased);

    /// @dev Reverts if the vesting schedule does not exist or has been revoked
    modifier onlyIfVestingScheduleNotRevoked(address beneficiary) {
        require(
            !vestingSchedules[beneficiary].revoked,
            "Vesting schedule was revoked"
        );
        _;
    }

    /// @dev Creates a vesting contract
    /// @param token_ address of the ERC20 token contract
    constructor(address token_) {
        require(token_ != address(0), "Token cannot be zero address");
        _token = IERC20(token_);
    }

    /// @notice Creates a new vesting schedule for a beneficiary
    /// @param _beneficiary address of the beneficiary to whom vested tokens are transferred
    /// @param _start start time of the vesting period
    /// @param _cliff duration in seconds of the cliff in which tokens will begin to vest
    /// @param _duration duration in seconds of the period in which the tokens will vest
    /// @param _amount total amount of tokens to be released at the end of the vesting
    function createVestingSchedule(
        address _beneficiary,
        uint256 _start,
        uint256 _cliff,
        uint256 _duration,
        uint256 _amount
    ) external onlyOwner {
        require(!vestingSchedules[_beneficiary].initialized, "Already initialized");
        require(_duration > 0, "Duration must be > 0");
        require(_amount > 0, "Amount must be > 0");
        require(_cliff <= _duration, "Cliff must be <= duration");
        require(getWithdrawableAmount() >= _amount, "Not sufficient tokens");

        vestingSchedules[_beneficiary] = VestingSchedule(
            true,
            _start + _cliff,
            _start,
            _duration,
            _amount,
            0,
            false
        );

        vestingSchedulesTotalAmount += _amount;

        emit VestingScheduleCreated(_beneficiary, _amount);
    }

    /// @notice Revokes the vesting schedule for given beneficiary
    /// @param _beneficiary address of the beneficiary to whom vested tokens are transferred
    function revoke(address _beneficiary) external onlyOwner
            onlyIfVestingScheduleNotRevoked(_beneficiary)
    {
        VestingSchedule storage vestingSchedule = vestingSchedules[_beneficiary];

        vestingSchedule.initialized = false;
        vestingSchedule.revoked = true;

        uint256 unreleased = vestingSchedule.amountTotal - vestingSchedule.released;

        if (unreleased > 0) {
            vestingSchedulesTotalAmount -= unreleased;
            _token.safeTransfer(owner(), unreleased);
        }

        emit Revoked(_beneficiary, unreleased);
    }

    /// @notice Release vested amount of tokens
    /// @param beneficiary address of the beneficiary to whom vested tokens are transferred
    /// @param amount the amount to release
    function release(address beneficiary, uint256 amount) external nonReentrant
            onlyIfVestingScheduleNotRevoked(beneficiary)
    {
        VestingSchedule storage vestingSchedule = vestingSchedules[beneficiary];
        require(msg.sender == beneficiary || msg.sender == owner(), 
                "Only beneficiary and owner can release vested tokens");

        uint256 releasableAmount = _computeReleasableAmount(vestingSchedule);
        require(releasableAmount >= amount, "Amount is too high");

        vestingSchedule.released += amount;
        vestingSchedulesTotalAmount -= amount;

        _token.safeTransfer(beneficiary, amount);

        emit Released(beneficiary, amount);
    }

    /// @notice Release all vested amount of tokens till current time
    /// @param beneficiary address of the beneficiary to whom vested tokens are transferred
    function releaseAll(address beneficiary) external nonReentrant
            onlyIfVestingScheduleNotRevoked(beneficiary)
    {
        require(msg.sender == beneficiary || msg.sender == owner(), 
                "Only beneficiary and owner can release vested tokens");

        VestingSchedule storage vestingSchedule = vestingSchedules[beneficiary];
        uint256 releasableAmount = _computeReleasableAmount(vestingSchedule);

        vestingSchedule.released += releasableAmount;
        vestingSchedulesTotalAmount -= releasableAmount;

        _token.safeTransfer(beneficiary, releasableAmount);

        emit Released(beneficiary, releasableAmount);
    }

    /// @notice Withdraw the specified amount if possible
    /// @param amount the amount to withdraw
    function withdraw(uint256 amount) external onlyOwner nonReentrant {
        require(getWithdrawableAmount() >= amount, "Not enough withdrawable funds");
        _token.safeTransfer(owner(), amount);
    }

    /// @notice Returns the address of the ERC20 token managed by the vesting contract
    function getToken() external view returns (address) {
        return address(_token);
    }

    /// @notice Returns the total amount of vesting schedules
    function getVestingSchedulesTotalAmount() external view returns (uint256) {
        return vestingSchedulesTotalAmount;
    }

    /// @notice Returns the vesting schedule information for a given identifier
    /// @param beneficiary address of the beneficiary to whom vested tokens are transferred
    /// @return vestingSchedule the vesting schedule structure information
    function getVestingSchedule(address beneficiary) external view
            returns (VestingSchedule memory vestingSchedule)
    {
        vestingSchedule = vestingSchedules[beneficiary];
    }

    /// @notice Computes the vested amount of tokens for the given vesting schedule identifier
    /// @param beneficiary address of the beneficiary to whom vested tokens are transferred
    /// @return releasableAmount the vested amount
    function computeReleasableAmount(address beneficiary) external view
            returns (uint256 releasableAmount)
    {
        VestingSchedule storage vestingSchedule = vestingSchedules[beneficiary];
        releasableAmount = !vestingSchedule.revoked
                           ? _computeReleasableAmount(vestingSchedule)
                           : 0;
    }

    /// @dev Returns the amount of tokens that can be withdrawn by the owner
    /// @return the amount of tokens
    function getWithdrawableAmount() public view returns (uint256) {
        return _token.balanceOf(address(this)) - vestingSchedulesTotalAmount;
    }

    /// @dev Computes the releasable amount of tokens for a vesting schedule
    /// @param vestingSchedule vesting schedule struct
    /// @return releasableAmount the amount of releasable tokens
    function _computeReleasableAmount(VestingSchedule memory vestingSchedule) private view
            returns (uint256 releasableAmount)
    {
        uint256 currentTime = block.timestamp;

        if (currentTime >= vestingSchedule.start + vestingSchedule.duration) {
            releasableAmount = vestingSchedule.amountTotal - vestingSchedule.released;
        } else if (currentTime > vestingSchedule.cliffEnd) {
            uint256 timeFromStart = currentTime - vestingSchedule.start;
            uint256 vestedAmount = (vestingSchedule.amountTotal * timeFromStart) /
                                    vestingSchedule.duration;
            releasableAmount = vestedAmount - vestingSchedule.released;
        }
    }
}