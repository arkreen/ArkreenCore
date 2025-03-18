// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

interface IERC20 {
    function transfer(address to, uint256 value) external returns (bool);
    function transferFrom(address from, address to, uint256 value) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
    function allowance(address owner, address spender) external view returns (uint256);
}

contract ClaimToken is OwnableUpgradeable, UUPSUpgradeable {

    address public token;
    address public manager;
    address public from;
    uint128 public allClaimed;
    uint128 public allClaimable;

    struct ClaimInfo {
        uint128 totalClaimed;
        uint128 totalClaimable;
    }  

    mapping(address => ClaimInfo) public users;    

    event Claimed(address indexed user, uint128 value);

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(address _token, address _manager, address _from) external virtual initializer {
        __Ownable_init_unchained();
        __UUPSUpgradeable_init();        
        token = _token;
        if (_manager == address(0)) {
            manager = msg.sender;
        } else {
            manager = _manager;
        }
        if (_from != address(0)) {
            from = _from;
        }
    }   

    function postUpdate() external onlyProxy onlyOwner 
    {}

    function _authorizeUpgrade(address newImplementation) internal virtual override onlyOwner
    {}

    modifier onlyManager(){
        require(msg.sender == manager, "CLAIM: Not Manager");
        _;
    }

    function changeManager(address newManager) external onlyManager {
        require(newManager != address(0), "CLAIM: Zero Address");
        manager = newManager;
    }

    function changeFrom(address newFrom) external onlyOwner {
        from = newFrom;
    }

    function increase(address recipient, uint128 value) external onlyManager {
        users[recipient].totalClaimable += value;
        allClaimable += value;
        // checkIncrease();
    }

    function decrease(address recipient, uint128 value) external onlyManager {
        require(users[recipient].totalClaimable >= value, "CLAIM: Too More Value");
        users[recipient].totalClaimable -= value;
        allClaimable -= value;
    }

    function increaseBatch(address[] calldata recipients, uint128[] calldata values) external onlyManager {
        uint256 length = recipients.length;
        require(length == values.length, "CLAIM: Wrong Length");

        uint128 allIncrease = 0;
        for (uint256 index = 0; index < length; index++) {
            users[recipients[index]].totalClaimable += values[index];
            allIncrease += values[index];
        }
        allClaimable += allIncrease;
        // checkIncrease();
    }

    function checkIncrease() internal view {
        if(from == address(0)) {
            require(IERC20(token).balanceOf(address(this)) >= allClaimable, "CLAIM: Low Balance");
        } else {
            require(IERC20(token).allowance(from, address(this)) >= allClaimable, "CLAIM: Low Allowance");
        }
    }

    function claimAll() external {
        uint128 valueToClaim = users[msg.sender].totalClaimable;
        _claim(valueToClaim);
    }

    function claim(uint128 value) external  {
        _claim(value);
    }

    function _claim(uint128 valueToClaim) internal  {
        users[msg.sender].totalClaimable -= valueToClaim;
        users[msg.sender].totalClaimed += valueToClaim;
        allClaimable -= valueToClaim;
        allClaimed += valueToClaim;
        if (from == address(0)) {
            require(IERC20(token).transfer(msg.sender, valueToClaim));
        } else {
            require(IERC20(token).transferFrom(from, msg.sender, valueToClaim));
        }    

        emit Claimed(msg.sender, valueToClaim); 
    }

    function withdraw(uint128 value) public onlyOwner {
        require(IERC20(token).transfer(msg.sender, value));
    }
}