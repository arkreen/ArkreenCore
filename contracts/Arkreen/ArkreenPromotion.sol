// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

import "../libraries/TransferHelper.sol";
import "../interfaces/IStakingRewards.sol";
import "../interfaces/IArkreenMiner.sol";

contract ArkreenPromotion is OwnableUpgradeable, UUPSUpgradeable {

    uint256 private constant PROMOT_RM      = 1;
    uint256 private constant PROMOT_ART     = 2;

    IStakingRewards public stakingPool;
    address public akreToken;
    address public artToken;
    IArkreenMiner public minerContract;

    uint256 public amountAKREPerRM;                  // amount of staking AKRE qualified to buy one Remote Miner 
    uint256 public priceRemoteMiner;                 // price of one remote miner in promotion 
    uint256 public countRM;                          // all count of RM sold 
    uint256 public amountAKREPerART;                 // amount of staking AKRE qualified to buy one ART 
    uint256 public priceARTToken;                    // price of one ART in promotion 
    uint256 public amountART;                        // all amount of ART sold 
    uint32 public startTime;
    uint32 public endTime;

    // user -> amount of staking AKRE that has been used, and how many RM/ART have bought               
    mapping(address => uint256) amountAKREUsed;     

    event PromoteBuy(address indexed user, uint256 promoteType, uint256 amount, uint256 count);
    event Deposit(address indexed token, address indexed depositor, uint256 amount);
    event Withdraw(address indexed token, address indexed receiver, uint256 amount);
    
    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(address pool, address akre, address art, address miner) external virtual initializer {
        __Ownable_init_unchained();
        __UUPSUpgradeable_init();     

        stakingPool = IStakingRewards(pool);
        akreToken = akre;
        artToken = art;
        minerContract = IArkreenMiner(miner);
    }   

    function postUpdate() external onlyProxy onlyOwner 
    {}

    function _authorizeUpgrade(address newImplementation) internal virtual override onlyOwner
    {}

    function changePromotionConfig(
            uint256 _amountAKREPerRM, 
            uint256 _priceRemoteMiner, 
            uint256 _amountAKREPerART, 
            uint256 _priceARTToken,
            uint256 _startTime,
            uint256 _endTime
        ) external onlyOwner {
        amountAKREPerRM = _amountAKREPerRM;
        priceRemoteMiner = _priceRemoteMiner;
        amountAKREPerART = _amountAKREPerART;
        priceARTToken = _priceARTToken;
        startTime = uint32(_startTime);
        endTime = uint32(_endTime);
    }

    function payForPromotion(uint256 amountAKREPayment, uint256 typePromotion) external {
        require((block.timestamp >= startTime) && (block.timestamp <endTime), "Not during promotion");

        (, uint256 userStakes, , , ,)  = stakingPool.getUserStakeStatus(msg.sender);
        uint256 amountAKREReady = userStakes - uint128(amountAKREUsed[msg.sender]);       // Remove the RM/ART count

        uint256 countMax;
        uint256 countBuy;
        if (typePromotion == PROMOT_RM) {
            countMax = amountAKREReady / amountAKREPerRM;
            countBuy = amountAKREPayment / priceRemoteMiner;

        } else if (typePromotion == PROMOT_ART) {
            countMax = amountAKREReady / amountAKREPerART;
            countBuy = amountAKREPayment / priceARTToken;
        } else {
            revert("Wrong Type");    
        }
 
        require(countBuy > 0, "Low payment");
        require(countMax >= countBuy, "Low staking");

        if (typePromotion == PROMOT_RM) {
            countRM += countBuy;
            amountAKREUsed[msg.sender] += countBuy * amountAKREPerRM + (countBuy << 240);
            amountAKREPayment = countBuy * priceRemoteMiner;
            minerContract.RemoteMinerOnboardAuthority(msg.sender, 0, uint8(countBuy));
        } else {
            amountART += countBuy;
            amountAKREUsed[msg.sender] += countBuy * amountAKREPerART + (countBuy << 224);
            amountAKREPayment = countBuy * priceARTToken;
            TransferHelper.safeTransfer(artToken, msg.sender, countBuy * (10**9) );
        }
        TransferHelper.safeTransferFrom(akreToken, msg.sender, address(this), amountAKREPayment);
        emit PromoteBuy(msg.sender, typePromotion, amountAKREPayment, countBuy);
    }
    
    /**
     * @dev Deposit tokens to the contact for promotion sales
     * @param token The address of the token to deposit. 
     * @param amount Amount of the token to deposit.
     */
    function depositToken(address token, uint256 amount) external {
        TransferHelper.safeTransferFrom(token, msg.sender, address(this), amount);
        emit Deposit(token, msg.sender, amount);
    }

    function getPromotionConfig() external view 
        returns ( uint256 _amountAKREPerRM,
                  uint256 _priceRemoteMiner, 
                  uint256 _amountAKREPerART, 
                  uint256 _priceARTToken,
                  uint256 _startTime,
                  uint256 _endTime
                ) {
      _amountAKREPerRM = amountAKREPerRM;
      _priceRemoteMiner = priceRemoteMiner;
      _amountAKREPerART = amountAKREPerART;
      _priceARTToken = priceARTToken;
      _startTime = startTime;
      _endTime = endTime;
    }

    function getPromotionUserStatus(address user) external view 
        returns ( uint256 userStakes,
                  uint256 stakesUsed,
                  uint256 countRMCanBuy, 
                  uint256 countARTCanBuy,
                  uint256 countRMHaveBought, 
                  uint256 countARTHaveBought
                ) {
        (,  userStakes, , , ,)  = stakingPool.getUserStakeStatus(user);
        stakesUsed = uint128(amountAKREUsed[user]);
        countRMCanBuy = (userStakes - stakesUsed) / priceRemoteMiner;
        countARTCanBuy = (userStakes - stakesUsed) / priceARTToken;
        countRMHaveBought = uint16(amountAKREUsed[user] >> 240);
        countARTHaveBought = uint16(amountAKREUsed[user] >> 224);
    }
   
    /**
     * @dev Withdraw sales income
     * @param token Address of the token to withdraw
     */
    function withdraw(address token, address receiver, uint256 amount) external onlyOwner {
        TransferHelper.safeTransfer(token, receiver, amount);
        emit Withdraw(token, receiver, amount);    
    }
}