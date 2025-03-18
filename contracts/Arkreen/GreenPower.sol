// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/cryptography/ECDSAUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";

import "../libraries/TransferHelper.sol";
import "../interfaces/IkWhToken.sol";
import "../interfaces/IArkreenRECBank.sol";

contract GreenPower is OwnableUpgradeable, UUPSUpgradeable, ReentrancyGuardUpgradeable {

    // keccak256("offset(uint256 txid,address greener,(address plugMiner,uint256 offsetAmount)[],address tokenToPay,uint256 nonce,uint256 deadline)");
    bytes32 public constant  OFFSET_TYPEHASH  = 0xEC5BFF80AA08BF2051C80F564769C22E13314AB0C7D5E094D08823FF31D4EBEC;

    // keccak256("stake(uint256 txid,address greener,address plugMiner,uint256 amount,uint256 period,uint256 nonce,uint256 deadline)");
    bytes32 public constant  STAKE_TYPEHASH   = 0x080E8C5714C5A6A7764FF698D728557DA75162AB329E16A9B3A1BC5390F25071;

    // keccak256("unstake(uint256 txid,address greener,address plugMiner,uint256 amount,uint256 nonce,uint256 deadline)");
    bytes32 public constant UNSTAKE_TYPEHASH  = 0xD31FDEA5515458DA20F18A6739D5E9D9CE5C49340B56F05309D4A0B6FFDBB40E;

    // keccak256("claimReward(uint256 txid,address greener,uint256 rewardAmount,uint256 nonce,uint256 deadline)");
    bytes32 public constant  REWARD_TYPEHASH  = 0x9A6CE8C7C5EDCB1EAA7313523B253F809B5AC0E3EC4A56F23B411D538FE25B11;

    // keccak256("claimRewardExt(uint256 txid,address greener,address receiver,uint256 rewardAmount,uint256 nonce,uint256 deadline)");
    bytes32 public constant  REWARD_EXT_TYPEHASH  = 0xC7A88F1CA971FF53DAB58C413AF193738A9538AD0C8A3B5DC1CD27D35AF859C9;

    uint256 public constant OFFSET_UNIT = 10**5;                    // 0.1 kWh 

    struct StakeInfo {
        uint96  amountStake;   							                // Enough for AKRE: 10**28 
        uint32  releaseTime;                                // Timestamp the stake can be released  
        uint32  nonce;
    }  

    struct Sig {
        uint8       v;
        bytes32     r;
        bytes32     s;              
    }

    struct OffsetAction {
        address   plugMiner;
        uint256   offsetAmount;
    }  

    struct OffsetActionAgent {
        address   greener;
        address   plugMiner;
        uint256   offsetAmount;
    }  

    bytes32 public _DOMAIN_SEPARATOR;
    address public akreToken;
    address public kWhToken;
    address public manager;

    uint96 public totalStake;
    uint96 public totalOffset;
    uint96 public totalReward;

    // MSB0:12: Amount of stake, enough for 10**28 AKRE; MSB12:10 reserved; MSB22:2: period; MSB24:4: nonce; MSB28:4: stake release time;
    mapping(address => uint256) private stakerInfo;          // mapping from user address to stake info
    
    // MSB0:12: Amount of reward, enough for 10**28 AKRE; MSB12:12: reserved; MSB24:8: Total Offset(kWh) of the user 
    mapping(address => uint256) private userOffsetInfo;     // mapping from user address to offset and reward info

    // MSB0:20: Owner address; MSB20:4: offset Counter; MSB24:8: Total Offset (Unit: kWh);
    mapping(address => uint256) private minerOffsetInfo;   // mapping from plug miner address to offset info

    // Mapping from user address to the auto-offset flag and deposited ART token amount.
    // If deposit token is not ART, convert to ART first
    // Byte 0: auto-offset flag, 0x00, self-Offset, 0x01, auto-offset, Byte 1-4: switch timestamp, Byte 16-31: Deposited ART amount.
    mapping(address => uint256) public depositAmounts;

    address public tokenART;
    address public artBank;
    uint96 public offsetBaseIndex;

    modifier ensure(uint256 deadline) {
        require(block.timestamp <= deadline, "Deadline Expired!");
        _;
    }

    event OffsetAgent(address indexed txid, uint256 baseIndex, uint256 steps);
    event Offset(address indexed txid, address indexed greener, OffsetAction[] offsetActions, address tokenToPay, uint256 stakeAmount, uint256 offsetBaseIndex, uint256 nonce);
    event Stake(address indexed txid, address indexed greener, address plugMiner, uint256 amount, uint256 period, uint256 nonce);
    event Unstake(address indexed txid, address indexed greener, address plugMiner, uint256 amount, uint256 nonce);
    event Reward(address indexed txid, address indexed greener, uint256 amount, uint256 nonce);
    event ClaimRewardExt(address indexed txid, address indexed greener, address indexed receiver, uint256 amount, uint256 nonce);
    event Deposit(address indexed user, address tokenToPay, uint256 amount, uint256 amountART);
    event Withdraw(address indexed user, uint256 amountART);
    event AutoOffsetChanged(address indexed user, bool ifAuto);

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(address akre, address kWh, address _manager) external virtual initializer {
        __Ownable_init_unchained();
        __UUPSUpgradeable_init();     
        __ReentrancyGuard_init();   
        akreToken = akre;
        kWhToken = kWh;
        manager = _manager;

        _DOMAIN_SEPARATOR = keccak256(
            abi.encode(
                keccak256('EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)'),
                keccak256(bytes("Green Power")),
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

    function changeManager(address newManager) external onlyOwner {
        if (newManager != address(0))  manager = newManager;
    }

    function setBankAndART(address bank, address art) external onlyOwner {
        if (bank != address(0)) artBank = bank;
        if (art != address(0)) tokenART = art;
    }

    /**
     * @dev Approve the tokens which can be transferred to kWhContract from kWh converting.
     * @param tokens The token list
     */
    function approveConvertkWh(address[] calldata tokens) public onlyOwner {
        require (kWhToken != address(0), "Zero kWh");
        for (uint256 i = 0; i < tokens.length; i++) {
            TransferHelper.safeApprove(tokens[i], kWhToken, type(uint256).max);
        }
    }

    /**
     * @dev Change the auto-offset setting
     */
    function changeAutoOffet(bool offsetAuto) public {
      uint256 depositInfo = depositAmounts[msg.sender];
      bool curAuto = ((depositInfo >> 248) == 0x01);
      if (curAuto == offsetAuto) return;

      depositInfo = uint256(uint128(depositInfo)) + uint256((block.timestamp) << 216);

      if (offsetAuto) {
        depositInfo |= uint256(1 << 248);
      } 

      depositAmounts[msg.sender] = depositInfo;
      emit AutoOffsetChanged(msg.sender, offsetAuto);
    }

    function offsetPower(
            address txid,
            OffsetAction[] calldata offsetActions,
            address tokenToPay,
            uint256 nonce,
            uint256 deadline,
            Sig calldata signature
        ) external nonReentrant ensure(deadline) 
    {
        require ((depositAmounts[msg.sender] >> 248) == 0, "Auto Offset On");
        uint256 timeSwitch = uint32(depositAmounts[msg.sender] >> 216);
        require (block.timestamp >= (timeSwitch + 3600 *24), "Not ready");      // if timeSwitch is 0, check always passed. 

        {
            bytes32 offsetHash = keccak256(abi.encode(OFFSET_TYPEHASH, txid, msg.sender, offsetActions, tokenToPay, nonce, deadline));
            bytes32 digest = keccak256(abi.encodePacked('\x19\x01', _DOMAIN_SEPARATOR, offsetHash));
            address managerAddress = ECDSAUpgradeable.recover(digest, signature.v, signature.r, signature.s);

            require(managerAddress == manager, "Wrong Signature");
        }

        require (uint32(stakerInfo[msg.sender] >> 32) == uint32(nonce), "Nonce Not Match");

        uint256 totalOffsetAmount = 0;
        for (uint256 index; index < offsetActions.length; index++) {
            address plugMiner = offsetActions[index].plugMiner;
            if (minerOffsetInfo[plugMiner] == 0) {
                minerOffsetInfo[plugMiner] = (uint256(uint160(msg.sender)) << 96);          // set owner once the first time offseting
            } else {
                require (msg.sender == address(uint160(minerOffsetInfo[plugMiner] >> 96)), "Wrong Owner");
            }

            uint256 offsetAmount = offsetActions[index].offsetAmount;
            require ((offsetAmount >= OFFSET_UNIT) && ((offsetAmount % OFFSET_UNIT) == 0), "Wrong Offset Amount");
            
            // Total Offset Counter, 4 Bytes; Total Offset Amount: 8 Bytes, ~1.8 * (10**19) kWh; Assuming never overflow;
            minerOffsetInfo[plugMiner] += (1 << 64) + uint64(offsetAmount);
            totalOffsetAmount += offsetAmount;
        }
       
        {
            //function convertKWh(address tokenToPay, uint256 amountPayment)
            uint256 price = IkWhToken(kWhToken).priceForSwap(tokenToPay);
            uint256 amountPayment = totalOffsetAmount * price / (10**6);        // demical of kWh is 6
            //require(IERC20Upgradeable(tokenToPay).transferFrom(msg.sender, address(this), amountPayment));
            TransferHelper.safeTransferFrom(tokenToPay, msg.sender, address(this), amountPayment);
            
            uint256 amountToBurn = IkWhToken(kWhToken).convertKWh(tokenToPay, amountPayment);
            require (totalOffsetAmount == amountToBurn);

            IkWhToken(kWhToken).burn(amountToBurn);
        }

        stakerInfo[msg.sender] += (1 << 32);
        userOffsetInfo[msg.sender] += uint64(totalOffsetAmount);

        uint256 baseIndex;
        baseIndex = offsetBaseIndex;
        if (baseIndex == 0) {
            baseIndex  = totalOffset / ((10**6));
        }
        offsetBaseIndex = uint96(baseIndex + totalOffsetAmount / OFFSET_UNIT);

        totalOffset += uint96(totalOffsetAmount);

        emit Offset(txid, msg.sender, offsetActions, tokenToPay, (stakerInfo[msg.sender]>>160), baseIndex, nonce);
    }

    /**
     * @dev Approve the tokens which can be transferred from this GreenPower contract by bank contract
     * @param tokens The token list
     */
    function approveBank(address[] calldata tokens) external onlyOwner {
        for(uint256 i = 0; i < tokens.length; i++) {
            TransferHelper.safeApprove(tokens[i], artBank, type(uint256).max);
        }
    }

    /**
     * @dev Deposit to pay for offset. The paid token will be swapped to ART token.
     * @param tokenToPay the token to deposit
     * @param amount amount of the token to deposit
     */
    function deposit(address tokenToPay, uint256 amount) external nonReentrant returns (uint256 amountART) {
        require (amount !=0, "Zero Amount");
        TransferHelper.safeTransferFrom(tokenToPay, msg.sender, address(this), amount);

        amountART = amount;
        if (tokenToPay != tokenART) {
            // buyART(address tokenPay,address tokenART,uint256 amountPay,uint256 amountART,bool isExactPay)
            amountART = IArkreenRECBank(artBank).buyART(tokenToPay, tokenART, amount, 0, true);
        } 
        
        depositAmounts[msg.sender] += amountART;
        emit Deposit(msg.sender, tokenToPay, amount, amountART);
    }

    /**
     * @dev Withdraw ART token. Only allowed while in self-offset mode.
     * @param amount amount of the ART token to withdraw
     */
    function withdraw(uint256 amount) external {
        require ((depositAmounts[msg.sender] >> 248) == 0, "Auto Offset On");
        uint256 timeSwitch = uint32(depositAmounts[msg.sender] >> 216);
        require (block.timestamp >= (timeSwitch + 3600 *24), "Not ready");      // if timeSwitch is 0, check always passed. 

        require (amount !=0, "Zero Amount");
        require (uint128(depositAmounts[msg.sender]) >= amount, "Low deposit");
        depositAmounts[msg.sender] -= amount;
        emit Withdraw(msg.sender, amount);
        TransferHelper.safeTransfer(tokenART, msg.sender, amount);
    }

    function offsetPowerAgent(address txid, OffsetActionAgent[] calldata offsetActions, uint256 deadline) external ensure(deadline) {

        require (msg.sender == manager, "Not Allowed");

        uint256 totalOffsetAmount = 0;
        for (uint256 index; index < offsetActions.length; index++) {
            address greener = offsetActions[index].greener;
            address plugMiner = offsetActions[index].plugMiner;
            if (minerOffsetInfo[plugMiner] == 0) {
                minerOffsetInfo[plugMiner] = (uint256(uint160(greener)) << 96);          // set owner once the first time offseting
            } else {
                require (greener == address(uint160(minerOffsetInfo[plugMiner] >> 96)), "Wrong Owner");
            }

            uint256 offsetAmount = offsetActions[index].offsetAmount;
            require ((offsetAmount >= OFFSET_UNIT) && ((offsetAmount % OFFSET_UNIT) == 0), "Wrong Offset Amount");
            
            // Total Offset Counter, 4 Bytes; Total Offset Amount: 8 Bytes, ~1.8 * (10**19) kWh; Assuming never overflow;
            minerOffsetInfo[plugMiner] += (1 << 64) + uint64(offsetAmount);
            totalOffsetAmount += offsetAmount;

            uint256 depositART = depositAmounts[greener];
            uint256 timeSwitch = uint32(depositART >> 216);
            
            // Check the auto-offset flag, or the still in the allowance duration of closing auto-offset
            require ((depositART >= (1 << 248)) || (block.timestamp < (timeSwitch + 3600 *24)) , "Auto Offset Off"); 

            require (uint128(depositART) >= offsetAmount, "Low deposit");             // Mask the auto-offset flag

            depositAmounts[greener] = depositART - offsetAmount;
            userOffsetInfo[greener] += uint64(offsetAmount);
        }
       
        {
            //function convertKWh(address tokenART, uint256 amountPayment)
            uint256 price = IkWhToken(kWhToken).priceForSwap(tokenART);
            uint256 amountPayment = totalOffsetAmount * price / (10**6);        // demical of kWh is 6
            
            uint256 amountToBurn = IkWhToken(kWhToken).convertKWh(tokenART, amountPayment);
            require (totalOffsetAmount == amountToBurn, "Not Same");

            IkWhToken(kWhToken).burn(amountToBurn);
        }


        uint256 baseIndex = offsetBaseIndex;                
        if (baseIndex == 0) {                               // This part is added as upgrading, so may be not intialized
            baseIndex  = totalOffset / ((10**6));
        }

        uint256 steps = totalOffsetAmount / OFFSET_UNIT;
        offsetBaseIndex = uint96(baseIndex + steps);

        totalOffset += uint96(totalOffsetAmount);

        emit OffsetAgent(txid, baseIndex, steps);
    }

    function stake(address txid, address plugMiner, uint256 amount, uint256 period, uint256 nonce, uint256 deadline, Sig calldata signature) external nonReentrant ensure(deadline) {
        require (amount > 0, "Zero Stake"); 

        if (minerOffsetInfo[plugMiner] == 0) {
            minerOffsetInfo[plugMiner] = (uint256(uint160(msg.sender)) << 96);          // set owner once the first time staking
        } else {
            require (msg.sender == address(uint160(minerOffsetInfo[plugMiner] >> 96)), "Not Owner"); 
        }
        
        uint256 userStakeInfo = stakerInfo[msg.sender];
        require (nonce == uint32(userStakeInfo >> 32), "Nonce Not Match");                // Check nonce 
        require ((period % (30 * 3600 * 24)) == 0, "Wrong period");                       // 30, 60, 90, 180 days

        require ((block.timestamp + period) >= uint32(userStakeInfo), "Short Period");    // period must increase the release timestamp

        {
            bytes32 stakeHash = keccak256(abi.encode(STAKE_TYPEHASH, txid, msg.sender, plugMiner, amount, period, nonce, deadline));
            bytes32 digest = keccak256(abi.encodePacked('\x19\x01', _DOMAIN_SEPARATOR, stakeHash));
            address managerAddress = ECDSAUpgradeable.recover(digest, signature.v, signature.r, signature.s);
            require(managerAddress == manager, "Wrong Signature");
        }

        userStakeInfo = ((userStakeInfo >> 80) << 80) 
                        + (uint256(uint16(period / (3600 * 24))) << 64)         // update period
                        + (uint256(uint32(userStakeInfo >> 32)) << 32)          // Copy nonce
                        + uint32(block.timestamp + period);                     // update release timestamp

        stakerInfo[msg.sender] = userStakeInfo + uint256(1 << 32) + uint256(amount << 160);   // increase nonce, and add stake amount

        totalStake = totalStake + uint96(amount);

        TransferHelper.safeTransferFrom(akreToken, msg.sender, address(this), amount);
        emit Stake(txid, msg.sender, plugMiner, amount, period, nonce);

    }

    function unstake(address txid, address plugMiner, uint256 amount, uint256 nonce, uint256 deadline, Sig calldata signature) external nonReentrant ensure(deadline){
        require (amount > 0, "Zero Stake"); 
        require (msg.sender == address(uint160(minerOffsetInfo[plugMiner] >> 96)), "Not Owner"); 

        uint256 userStakeInfo = stakerInfo[msg.sender];
        require (nonce == uint32(userStakeInfo >> 32), "Nonce Not Match"); 

        require(uint96(userStakeInfo >> 160) >= amount, "Unstake Overflowed");
        require (block.timestamp >= uint32(userStakeInfo), "Not Released");

        {
            bytes32 unstakeHash = keccak256(abi.encode(UNSTAKE_TYPEHASH, txid, msg.sender, plugMiner, amount, nonce, deadline));
            bytes32 digest = keccak256(abi.encodePacked('\x19\x01', _DOMAIN_SEPARATOR, unstakeHash));
            address managerAddress = ECDSAUpgradeable.recover(digest, signature.v, signature.r, signature.s);
            require(managerAddress == manager, "Wrong Signature");
        }

        userStakeInfo += (1 << 32);                                                   // nonce + 1
        userStakeInfo -= (amount << 160);                                             // update the amount of stake
        if ((userStakeInfo >> 160) == 0) 
            userStakeInfo = (uint256(uint32(userStakeInfo >> 32)) << 32);             // clear period and release time if there is no stake
        stakerInfo[msg.sender] = userStakeInfo;                                       // save new stake info

        totalStake = totalStake - uint96(amount);

        TransferHelper.safeTransfer(akreToken, msg.sender, amount);
        emit Unstake(txid, msg.sender, plugMiner, amount, nonce);
    }

    function claimReward(
            address txid,
            uint256 amount,
            uint256 nonce,
            uint256 deadline,
            Sig calldata signature
        ) external nonReentrant ensure(deadline) 
    {
        uint256 userStakeInfo = stakerInfo[msg.sender];
        require (nonce == uint32(userStakeInfo >> 32), "Nonce Not Match"); 

        bytes32 offsetHash = keccak256(abi.encode(REWARD_TYPEHASH, txid, msg.sender, amount, nonce, deadline));
        bytes32 digest = keccak256(abi.encodePacked('\x19\x01', _DOMAIN_SEPARATOR, offsetHash));
        address managerAddress = ECDSAUpgradeable.recover(digest, signature.v, signature.r, signature.s);

        require(managerAddress == manager, "Wrong Signature");

        userOffsetInfo[msg.sender] += (amount << 160);
        stakerInfo[msg.sender] += (1 << 32);
        totalReward += uint96(amount);

        TransferHelper.safeTransfer(akreToken, msg.sender, amount);
        emit Reward(txid, msg.sender, amount, nonce);
    }

    function claimRewardExt(
            address txid,
            address receiver,
            uint256 amount,
            uint256 nonce,
            uint256 deadline,
            Sig calldata signature
        ) external nonReentrant ensure(deadline) {

        uint256 userStakeInfo = stakerInfo[msg.sender];
        require (nonce == uint32(userStakeInfo >> 32), "Nonce Not Match"); 

        bytes32 offsetHash = keccak256(abi.encode(REWARD_EXT_TYPEHASH, txid, msg.sender, receiver, amount, nonce, deadline));
        bytes32 digest = keccak256(abi.encodePacked('\x19\x01', _DOMAIN_SEPARATOR, offsetHash));
        address managerAddress = ECDSAUpgradeable.recover(digest, signature.v, signature.r, signature.s);

        require(managerAddress == manager, "Wrong Signature");

        userOffsetInfo[msg.sender] += (amount << 160);
        stakerInfo[msg.sender] += (1 << 32);
        totalReward += uint96(amount);

        TransferHelper.safeTransfer(akreToken, receiver, amount);
        emit ClaimRewardExt(txid, msg.sender, receiver, amount, nonce);
    }


    function getUserInfo(address greener) external view 
        returns (uint256 stakeAmount, uint256 offsetAmount, uint256 rewardAmount, 
        uint256 nonce, uint256 period, uint256 releaseTime, 
        uint256 depositAmount, bool autoOffset, uint256 switchTime) 
    {
        uint256 userStakeInfo = stakerInfo[greener];
        releaseTime = uint256(uint32(userStakeInfo));
        nonce = uint256(uint32(userStakeInfo >> 32));
        period = uint256(uint16(userStakeInfo >> 64));
        stakeAmount = uint256(uint96(userStakeInfo >> 160));

        uint256 offsetInfo = userOffsetInfo[greener];
        offsetAmount = uint256(uint64(offsetInfo));
        rewardAmount = offsetInfo >> 160;
        depositAmount = uint256(uint128(depositAmounts[greener]));
        autoOffset = ((depositAmounts[greener] >> 248) != 0);
        switchTime = uint32(depositAmounts[greener] >> 216);
    }

    function getMinerOffsetInfo(address plugMiner) external view 
        returns (address owner, uint256 offsetCounter, uint256 offsetAmount) 
    {
        uint256 offsetInfo = minerOffsetInfo[plugMiner];
        owner = address(uint160(offsetInfo >> 96));
        offsetCounter = uint256(uint32(offsetInfo >> 64));
        offsetAmount = uint256(uint64(offsetInfo));
    }

    /**
     * @dev get the reward rate of given account
     * @param account address of the target account
     * @return rate the rate to be lucky offset in accuracy of 8 decimal places
     *  rate = 1 + cx/(d+x), c=1/2, d =3; 
     *  x = stakeAmount * period / stakingbase; stakingbase = 16500 AKRE * 30 days
     */
    function getRewardRate(address account) external view 
        returns (uint256 rate) 
    {
        uint256 userStakeInfo = stakerInfo[account];
        uint256 stakeAmount = userStakeInfo >> 160;
        uint256 period = uint256(uint16(userStakeInfo >> 64));
        uint256 stakingbase = 6 * 16500 * 30 * (10**18);
        uint256 stakingCredit = stakeAmount * period;
        uint256 denominator = (stakingbase + 2 * stakingCredit);
        uint256 numerator = (denominator + stakingCredit) * (10**8);              // accuracy is 8 decimal
        rate = numerator / denominator;
        if (2 * (numerator - rate * denominator) >= denominator) rate += 1;       // round-up
    }

    /**
     * @dev check if offset action lucky result
     * @param greener address of offset actor
     * @param plugMiner address of miner been offset
     * @param blockHash hash of the block containing the offset transaction.
     * @param kWhIndex the offset index of the offset action by the order of kWh
     * @param kWhSteps the offset progress steps in KkWh
     * @param rewardRate the staking impacting rate for the lucky draw
     */
    function checkIfOffsetWon (
        address greener,
        address plugMiner,
        bytes32 blockHash,
        uint256 kWhIndex,
        uint256 kWhSteps,
        uint256 rewardRate)
        public pure returns (uint256[] memory result) 
    {
        if (kWhSteps >= 10000) kWhSteps = 10000;             // Maximum check 10000 steps
        result = new uint256[](kWhSteps);
      
        // rewardRate in 8 decimals, round is considered, 20 = 1/(5%), Lucky rate is 5% 
        uint256 posibility = (100000 * 20 * (10**8)) / rewardRate;      
        if ( 2 * (100000 * 20 * (10**8) - posibility * rewardRate) >= rewardRate) posibility += 1;

        uint256 wonIndex = 0 ;
        for (uint256 index = 0; index < kWhSteps; index++) {
            bytes32 offsetHash = keccak256(abi.encode(plugMiner, greener, kWhIndex + index, blockHash));
            if ((uint256(offsetHash) % posibility) < 100000) {
              result[wonIndex++] = kWhIndex + index;
            }
        }
        assembly {
            mstore(result, wonIndex)
        }
    }

    function checkIfOffsetWonBytes (bytes memory offsetInfo)
        external pure returns (uint256[] memory result) 
    {
        ( address greener, address plugMiner, bytes32 blockHash, 
          uint256 kWhIndex, uint256 kWhSteps, uint256 rewardRate )
            = abi.decode(offsetInfo, (address, address, bytes32, uint256, uint256, uint256));

        return checkIfOffsetWon(greener, plugMiner, blockHash, kWhIndex, kWhSteps, rewardRate);
    } 
}