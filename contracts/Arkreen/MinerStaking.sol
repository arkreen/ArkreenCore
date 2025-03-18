// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";

contract MinerStaking is OwnableUpgradeable, UUPSUpgradeable, ReentrancyGuardUpgradeable {

    struct StakeInfo {
        uint24  timesStake;
        uint24  timesUnstake;
        uint16  timesSlash;
        uint96  amountStake;
        uint96  amountSlash;							
    }

    IERC20Upgradeable public akreToken;
    address public slashManager;
    address public slashReceiver;

    mapping(address => address[]) userStakeMiners;                              // Staker -> miner list
    mapping(address => StakeInfo) public allUserStakeInfo;                      // Staker -> all deposit info
    mapping(address => mapping(address => StakeInfo)) public userStakeInfo;     // Staker -> miner -> deposit info

    mapping(address => address[]) minerStakers;                                 // Miner -> staker list
    mapping(address => StakeInfo) public allMinerStakeInfo;                     // Miner -> overall staking info

    StakeInfo public totalStakeInfo;                                            // System staking info

    event Deposit(address indexed staker, address cspminer, uint256 amount);
    event Withdraw(address indexed staker, address cspminer, uint256 amount);
    event Slash(uint256 indexed txid, address indexed cspminer, address indexed owner, uint256 amount, uint256 amountSlash);

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(address _stakingToken, address _manager, address receiver) external virtual initializer {
        __Ownable_init_unchained();
        __UUPSUpgradeable_init();     
        __ReentrancyGuard_init();   
        akreToken = IERC20Upgradeable(_stakingToken);
        slashManager = _manager;
        slashReceiver = receiver;
    }   

    function _authorizeUpgrade(address newImplementation) internal virtual override onlyOwner
    {}

    modifier onlyManager(){
        require(msg.sender == slashManager, "Not Manager");
        _;
    }

    function changeManager(address newManager) external onlyOwner {
        if (newManager != address(0)) slashManager = newManager;
    }

    function changeStakingToken(address stakingToken) external onlyOwner {
        if (stakingToken != address(0)) akreToken = IERC20Upgradeable(stakingToken);
    }

    function deposit(address cspminer, uint256 amount) external nonReentrant {
        require (amount > 0, "Zero Stake"); 
       
        if (userStakeInfo[msg.sender][cspminer].timesStake == 0) {
            userStakeMiners[msg.sender].push(cspminer);
            minerStakers[cspminer].push(msg.sender);
        }

        uint96 amountDeposit = uint96(amount);
        userStakeInfo[msg.sender][cspminer].amountStake += amountDeposit;
        userStakeInfo[msg.sender][cspminer].timesStake += 1;

        allUserStakeInfo[msg.sender].amountStake += amountDeposit;
        allUserStakeInfo[msg.sender].timesStake += 1;

        allMinerStakeInfo[cspminer].amountStake += amountDeposit;
        allMinerStakeInfo[cspminer].timesStake += 1;

        totalStakeInfo.amountStake += amountDeposit;
        totalStakeInfo.timesStake += 1;

        require(IERC20Upgradeable(akreToken).transferFrom(msg.sender, address(this), amountDeposit));

        emit Deposit(msg.sender, cspminer, amountDeposit);
    }

    function withdraw(address cspminer, uint256 amount) external nonReentrant {
        require (amount > 0, "Zero Stake"); 

        uint96 amountWithdraw = uint96(amount);
        userStakeInfo[msg.sender][cspminer].amountStake -= amountWithdraw;      
        userStakeInfo[msg.sender][cspminer].timesUnstake += 1;

        allUserStakeInfo[msg.sender].amountStake -= amountWithdraw;
        allUserStakeInfo[msg.sender].timesUnstake += 1;

        allMinerStakeInfo[cspminer].amountStake -= amountWithdraw;
        allMinerStakeInfo[cspminer].timesUnstake += 1;

        totalStakeInfo.amountStake -= amountWithdraw;
        totalStakeInfo.timesUnstake += 1;

        require(IERC20Upgradeable(akreToken).transfer(msg.sender, amountWithdraw));

        emit Withdraw(msg.sender, cspminer, amountWithdraw);
    }

    function slash(uint256 txid, address cspminer, address owner, uint256 amount, uint256 deadline) external onlyManager {
        require (amount > 0, "Zero Stake"); 
        require(block.timestamp <= deadline, "Deadline Expired!");

        uint96 amountSlash = userStakeInfo[owner][cspminer].amountStake;
        if (amount <= amountSlash) amountSlash = uint96(amount);

        userStakeInfo[owner][cspminer].amountStake -= amountSlash;
        userStakeInfo[owner][cspminer].amountSlash += amountSlash;
        userStakeInfo[owner][cspminer].timesSlash += 1;

        allUserStakeInfo[owner].amountStake -= amountSlash;
        allUserStakeInfo[owner].amountSlash += amountSlash;
        allUserStakeInfo[owner].timesSlash += 1;

        allMinerStakeInfo[cspminer].amountStake -= amountSlash;
        allMinerStakeInfo[cspminer].amountSlash += amountSlash;
        allMinerStakeInfo[cspminer].timesSlash += 1;

        totalStakeInfo.amountStake -= amountSlash;
        totalStakeInfo.amountSlash += amountSlash;
        totalStakeInfo.timesSlash += 1;

        require(IERC20Upgradeable(akreToken).transfer(slashReceiver, amountSlash));

        // if amountSlash == amount: Slash succeed;
        // if amountSlash < amount: Slash not fully fulfilled;
        emit Slash(txid, cspminer, owner, amount, amountSlash);     
    }

    function getUserStakeMiners(address staker) external view returns (address[] memory) {
        return userStakeMiners[staker];
    }

    function getMinerStakers(address miner) external view returns (address[] memory) {
        return minerStakers[miner];
    }
}

