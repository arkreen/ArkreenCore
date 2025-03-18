// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/cryptography/ECDSAUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";

contract PlantStaking is OwnableUpgradeable, UUPSUpgradeable, ReentrancyGuardUpgradeable {

    // keccak256("stake(uint256 txid,address staker,address cspminer,uint256 amount,uint256 nonce,uint256 deadline)");
    bytes32 public constant STAKE_TYPEHASH = 0xF970E4374212202D8F38B4CD5B1067E6B25AE9F3F76C60C2C45771C286C3F19D;  

    // keccak256("unstake(uint256 txid,address staker,address cspminer,uint256 amount,uint256 reward,uint256 nonce,uint256 deadline)");
    bytes32 public constant UNSTAKE_TYPEHASH = 0xDF27D93C407B51719EF6DE1C85A91844E20B5B3AFADCC7C5BF0828E9F5C6AAC3;  

    struct StakeInfo {
        uint64  nonce;
        uint96  amountStake;   							  // Enough for AKRE: 10**28 
        uint96  rewardStake;							    // Enough for AKRE or ART
    }  

    struct MinerStakeInfo {
        uint32  stakeCounter;
        uint32  unstakeCounter;
        uint96  amountStake;   							  // Enough for AKRE: 10**28 
        uint96  rewardStake;							    // Enough for AKRE or ART
    }  

    struct Sig {
        uint8       v;
        bytes32     r;
        bytes32     s;              
    }

    bytes32 public _DOMAIN_SEPARATOR;
    IERC20Upgradeable public stakingToken;
    address public rewarder;
    address public manager;

    mapping(address => StakeInfo) public stakeInfo;
    mapping(address => MinerStakeInfo) public minerStakeInfo;

    uint96 public totalStake;
    uint96 public totalReward;

    modifier ensure(uint256 deadline) {
        require(block.timestamp <= deadline, "Deadline Expired!");
        _;
    }

    event Stake(uint256 indexed txid, address indexed staker, address cspminer, uint256 amount);
    event Unstake(uint256 indexed txid, address indexed staker, address cspminer, uint256 amount, uint256 reward);
    event StakeSlash(uint256 indexed txid, address cspminer, address owner, uint256 amount);

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(address _stakingToken, address _rewarder, address _manager) external virtual initializer {
        __Ownable_init_unchained();
        __UUPSUpgradeable_init();     
        __ReentrancyGuard_init();   
        stakingToken = IERC20Upgradeable(_stakingToken);
        manager = _manager;
        rewarder = _rewarder;

        _DOMAIN_SEPARATOR = keccak256(
            abi.encode(
                keccak256('EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)'),
                keccak256(bytes("Plant Miner Staking")),
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

    modifier onlyManager(){
        require(msg.sender == manager, "CLAIM: Not Manager");
        _;
    }

    function changeManager(address newManager, address newRewarder) external onlyManager {
        if (newManager != address(0))  manager = newManager;
        if (newRewarder != address(0)) rewarder = newRewarder;
    }

    function stake(uint256 txid, address cspminer, uint256 amount, uint256 nonce, uint256 deadline, Sig calldata signature) external nonReentrant ensure(deadline) {
        require (amount > 0, "Zero Stake"); 
        require (nonce == stakeInfo[msg.sender].nonce, "Nonce Not Match"); 

        bytes32 stakeHash = keccak256(abi.encode(STAKE_TYPEHASH, txid, msg.sender, cspminer, amount, nonce, deadline));
        bytes32 digest = keccak256(abi.encodePacked('\x19\x01', _DOMAIN_SEPARATOR, stakeHash));
        address managerAddress = ECDSAUpgradeable.recover(digest, signature.v, signature.r, signature.s);

        require(managerAddress == manager, "Wrong Signature");

        stakeInfo[msg.sender].nonce =  uint64(nonce + 1);
        stakeInfo[msg.sender].amountStake = stakeInfo[msg.sender].amountStake + uint96(amount);   // imposssible overflow for AKRE
        totalStake = totalStake + uint96(amount);

        minerStakeInfo[cspminer].stakeCounter += 1; 
        minerStakeInfo[cspminer].amountStake += uint96(amount); 

        require(IERC20Upgradeable(stakingToken).transferFrom(msg.sender, address(this), amount));

        emit Stake(txid, msg.sender, cspminer, amount);
    }

    function unstakeWithReward(uint256 txid, address cspminer, uint256 amount, uint256 reward, uint256 nonce, uint256 deadline, Sig calldata signature) external nonReentrant ensure(deadline){
        require ((amount + reward) > 0, "Zero Stake");                                 // Zero amount is allowed to just withdraw rewards
        require (nonce == stakeInfo[msg.sender].nonce, "Nonce Not Match"); 
        require(stakeInfo[msg.sender].amountStake >= uint96(amount), "Unstake Overflowed");

        bytes32 unstakeHash = keccak256(abi.encode(UNSTAKE_TYPEHASH, txid, msg.sender, cspminer, amount, reward, nonce, deadline));
        bytes32 digest = keccak256(abi.encodePacked('\x19\x01', _DOMAIN_SEPARATOR, unstakeHash));
        address managerAddress = ECDSAUpgradeable.recover(digest, signature.v, signature.r, signature.s);

        require(managerAddress == manager, "Wrong Signature");

        stakeInfo[msg.sender].nonce =  stakeInfo[msg.sender].nonce + 1;

        stakeInfo[msg.sender].amountStake = stakeInfo[msg.sender].amountStake - uint96(amount);
        stakeInfo[msg.sender].rewardStake = stakeInfo[msg.sender].rewardStake + uint96(reward);
        totalStake = totalStake - uint96(amount);
        totalReward = totalReward + uint96(reward);

        minerStakeInfo[cspminer].unstakeCounter += 1; 
        minerStakeInfo[cspminer].amountStake -= uint96(amount); 
        minerStakeInfo[cspminer].rewardStake += uint96(reward); 

        require(IERC20Upgradeable(stakingToken).transfer(msg.sender, amount + reward));
        emit Unstake(txid, msg.sender, cspminer, amount, reward);
    }

    function stakeSlash(uint256 txid, address cspminer, address owner, uint256 amount) external {
        require(msg.sender == manager, "Not Allowed");
        uint96 stakeAmount = stakeInfo[owner].amountStake;
        require(stakeAmount >= uint96(amount), "Low stake");
        stakeInfo[owner].amountStake = stakeAmount - uint96(amount);
        minerStakeInfo[cspminer].amountStake -= uint96(amount); 
        totalStake = totalStake - uint96(amount);
        emit StakeSlash(txid, cspminer, owner, amount);
    }
}