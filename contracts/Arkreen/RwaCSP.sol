// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/cryptography/ECDSAUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";

import "../libraries/TransferHelper.sol";

contract RwaCSP is OwnableUpgradeable, UUPSUpgradeable, ReentrancyGuardUpgradeable {

    // keccak256("claimReward(uint256 txid,address greener,uint256 rewardAmount,uint256 nonce,uint256 deadline)");
    bytes32 public constant  REWARD_TYPEHASH  = 0x9A6CE8C7C5EDCB1EAA7313523B253F809B5AC0E3EC4A56F23B411D538FE25B11;
    
    // keccak256("claimRewardExt(uint256 txid,address greener,address receiver,uint256 rewardAmount,uint256 nonce,uint256 deadline)");
    bytes32 public constant REWARD_EXT_TYPEHASH  = 0xC7A88F1CA971FF53DAB58C413AF193738A9538AD0C8A3B5DC1CD27D35AF859C9;


    struct RewardStatus {
        uint96  amountClaimed;   							                // Enough for AKRE: 10**28 
        uint32  nonce;
    }  

    struct Sig {
        uint8       v;
        bytes32     r;
        bytes32     s;              
    }

    bytes32 public _DOMAIN_SEPARATOR;
    address public akreToken;
    address public manager;
    uint96 public totalReward;
    mapping(address => RewardStatus) private rewardInfo;            // mapping from user address to reward info
    
    modifier ensure(uint256 deadline) {
        require(block.timestamp <= deadline, "Deadline Expired!");
        _;
    }

    event ClaimReward(address indexed txid, address indexed greener, uint256 amount, uint256 nonce);
    event ClaimRewardExt(address indexed txid, address indexed greener, address indexed receiver, uint256 amount, uint256 nonce);

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(address akre, address _manager) external virtual initializer {
        __Ownable_init_unchained();
        __UUPSUpgradeable_init();     
        __ReentrancyGuard_init();   
        akreToken = akre;
        manager = _manager;

        _DOMAIN_SEPARATOR = keccak256(
            abi.encode(
                keccak256('EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)'),
                keccak256(bytes("RWA CSP")),
                keccak256(bytes("1")),
                block.chainid,
                address(this)
            )
        );  
    }   

    function postUpdate() external onlyProxy onlyOwner 
    {}

    function _authorizeUpgrade(address newImplementation) internal virtual override onlyOwner
    {}

    function changeManager(address newManager) external onlyOwner {
        if (newManager != address(0)) manager = newManager;
    }

    function claimReward(
            address txid,
            uint256 amount,
            uint256 nonce,
            uint256 deadline,
            Sig calldata signature
        ) external nonReentrant ensure(deadline) 
    {
        RewardStatus storage userReward = rewardInfo[msg.sender];
        require (nonce == userReward.nonce, "Nonce Not Match"); 

        bytes32 offsetHash = keccak256(abi.encode(REWARD_TYPEHASH, txid, msg.sender, amount, nonce, deadline));
        bytes32 digest = keccak256(abi.encodePacked('\x19\x01', _DOMAIN_SEPARATOR, offsetHash));
        address managerAddress = ECDSAUpgradeable.recover(digest, signature.v, signature.r, signature.s);

        require(managerAddress == manager, "Wrong Signature");

        userReward.amountClaimed += uint96(amount);
        userReward.nonce += 1;
        totalReward += uint96(amount);

        TransferHelper.safeTransfer(akreToken, msg.sender, amount);
        emit ClaimReward(txid, msg.sender, amount, nonce);
    }

    function claimRewardExt(
            address txid,
            address receiver,
            uint256 amount,
            uint256 nonce,
            uint256 deadline,
            Sig calldata signature
        ) external nonReentrant ensure(deadline) 
    {
        RewardStatus storage userReward = rewardInfo[msg.sender];
        require (nonce == userReward.nonce, "Nonce Not Match"); 

        bytes32 offsetHash = keccak256(abi.encode(REWARD_EXT_TYPEHASH, txid, msg.sender, receiver, amount, nonce, deadline));
        bytes32 digest = keccak256(abi.encodePacked('\x19\x01', _DOMAIN_SEPARATOR, offsetHash));
        address managerAddress = ECDSAUpgradeable.recover(digest, signature.v, signature.r, signature.s);

        require(managerAddress == manager, "Wrong Signature");

        userReward.amountClaimed += uint96(amount);
        userReward.nonce += 1;
        totalReward += uint96(amount);

        TransferHelper.safeTransfer(akreToken, receiver, amount);
        emit ClaimRewardExt(txid, msg.sender, receiver, amount, nonce);
    }


    function getUserInfo(address greener) external view 
        returns (uint256 amountClaimed, uint256 nonce) 
    {
        amountClaimed = rewardInfo[greener].amountClaimed;
        nonce = rewardInfo[greener].nonce;
    }
}