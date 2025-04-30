// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/cryptography/ECDSAUpgradeable.sol";
import "../interfaces/IkWhToken.sol";
import "../interfaces/ISwapRouter.sol";
import "../libraries/DecimalMath.sol";
import "../libraries/BytesLib.sol";
import "../libraries/TransferHelper.sol";
import {CustomRevert} from "../libraries/CustomRevert.sol";
import "../interfaces/IGreenBTCLucky.sol";

// Import this file to use console.log
// import "hardhat/console.sol";

contract GreenBTCLucky is 
    UUPSUpgradeable,
    ContextUpgradeable,
    OwnableUpgradeable,
    ERC20Upgradeable,
    IGreenBTCLucky
{
    using CustomRevert for bytes4;

    // Public constant variables
    string public constant NAME = "Lucky BTC";
    string public constant SYMBOL = "LBTC";

    // keccak256("redeemLuckyWithHash(address owner,uint256 luckyId,uint256 blockHeight,byte32 blockHash)");
    bytes32 public constant REDEEM_LUCKY_TYPEHASH = 0x3C892242239DC88794675D2B09BF838DB92B3EEA8ECEA13FAC3AA16F95AF807D;  

    uint24 internal constant poolFee100     = 100;
    uint24 internal constant poolFee500     = 500;
    uint24 internal constant poolFee3000    = 3000;

    bytes32 public _DOMAIN_SEPARATOR;
    address public luckyManager;
    address public wBTC;
    address public kWhToken;
    address public swapRouter;
    uint16  public maxTickets;
    uint16  public gapBlockRefund;
    uint64  public minPoolReserve;

    uint48  public lastDrawHeight;               // Last draw height for security consideration
    uint48  public drawId;
    uint64  public grossIncome;       
    uint64  public poolReserve;

    uint64  public luckyReserve;                 // 10%
//  uint64  public fundingReserve;               // 3%, no need and not possible to track    
    uint64  public projectReserve;               // 2%
    uint64  public publicGoodsReserve;           // 3%
    uint64  public greenBTCReserve;              // 2%

    // 12 bytes to config promotion setting
    // Byte 11-8: promotion start timme 
    // Byte 7-4:  promotion end timme 
    // Byte 3:    token Id,  =0, WBTC, 1: USDT, 2: USDC, 255: kWh 
    // Byte 2-1,  Base value
    // Byte 0:    bit 7: Active setting, = 0, actived = 1 deactivated; bit 6-5, reserve;
    //            bit 4-0: Exp, Airdrop Value = Base value  * (10 ** exp)
    uint96 public configPromotion;            	

    // lotteryInfo:  tokenId (1B) || baseValue (3B) || routerId (1B) || swapPathId (1B) || free (1B) || level (1B) || [times, ratio](8)  
    // tokenId (1B): bit7: 0, active, 1 dective; bit 0-6: tokenId: =0, wBTC, =1, USDT, =2 USDC, others: other token;
    // baseValue (3B): base (2B) || exp(1B), baseValue = base * (10**exp)
    // routerId (1B): 0x00, default, others, routerId
    // swapPathId (1B): 0x00, default, others, swapPathId
    // times (12 bits): exp = 4 lsbs, factor = 8 msbs in (0, 255)
    //                  real value: times = factor * (10 ** exp)), 
    //                  relative: percentage = (factor * 100 / 1000) % 
    // ratio (12 bits): 0xFFF: relative; others: real 
    //                  real: exp = 4 lsbs, numerator = 8 msbs in (0, 255], ratio = numerator / (10 ** exp)
    mapping (uint16 loterryId => uint256 lotteryInfo)  public lotteryList;   // Can be added, but not be updated
    mapping (uint8 swapPathId => bytes)  public swapPath;
    mapping (uint8 tokenId => address token)  public payTokens;
    mapping (uint8 routerId => address router)  public swapRouterList;

    // drawInfo: Block height(4B) || WBTC Amount (4B) || tickets (2B) || loterryId (2B) || Redeemed(1B) || free(3B) || wonAmount (8B) || poolReserve (8B)
    mapping (uint256 drawId => uint256) public drawInfo;

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(address wbtc, address kWh, address router)
        external
        virtual
        initializer
    {
        __UUPSUpgradeable_init();
        __Ownable_init_unchained();
        __ERC20_init_unchained(NAME, SYMBOL);

        wBTC            = wbtc;
        kWhToken        = kWh;
        swapRouter      = router;
        require(ERC20Upgradeable(wBTC).decimals() == 8);

        _DOMAIN_SEPARATOR = keccak256(
            abi.encode(
                keccak256('EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)'),
                keccak256(bytes("GreenBTC Lucky")),
                keccak256(bytes("1")),
                block.chainid,
                address(this)
            )
        );  
    }

    function _authorizeUpgrade(address newImplementation) internal virtual override onlyOwner
    {}

    function postUpdate() external onlyProxy onlyOwner 
    {}

    function decimals() public view virtual override returns (uint8) {
        return 8;     // Same as WBTC
    }

    function setLuckyManager(address manager) external onlyOwner {
        require(manager != address(0), "YBTC: Zero Address");
        luckyManager = manager;                    
    }

    function addLottery(uint16 loterryId, uint256 lotteryInfo) external onlyOwner {
        require(lotteryList[loterryId] == 0, "YBTC: Already Added");

        uint8 tokenId = uint8(lotteryInfo >> 248);
        require(payTokens[tokenId] != address(0), "YBTC: Token Not Defined");

        // lotteryInfo: tokenId (1B) || baseValue (3B) || routerId (1B) || swapPathId (1B) || free (1B) || level (1B) || [times, ratio](8)  
        uint8 routerId = uint8(lotteryInfo >> 216);
        require((routerId == 0) || (swapRouterList[routerId] != address(0)) , "YBTC: Wrong Router ID");

        uint8 swapPathId = uint8(lotteryInfo >> 208);
        require((swapPathId == 0) || (swapPath[swapPathId].length >= 43), "YBTC: Wrong Path ID");

        lotteryList[loterryId] = lotteryInfo;
        emit LotteryAdded(loterryId, lotteryInfo);
    }

    function toggleLottery(uint16 loterryId) external onlyOwner {
        uint256 lotteryInfo = lotteryList[loterryId];
        require(lotteryInfo != 0, "YBTC: Not existed");
        lotteryInfo ^= (1<<255); 
        lotteryList[loterryId] = lotteryInfo;
        emit LotteryToggled(loterryId, lotteryInfo);
    }

    function manageSwapPath(uint8 swapPathId, bytes memory routePath) external onlyOwner {
        require(swapPathId != 0, "YBTC: Zero Id");
        swapPath[swapPathId] = routePath;
    }

    function managePayTokens(uint8 tokenId, address token) external onlyOwner {
        payTokens[tokenId] = token;
    }

    function manageSwapRouter(uint8 routerId, address router) external onlyOwner {
        require(routerId != 0, "YBTC: Zero Id");
        require(router != address(0), "YBTC: Zero Address");
        swapRouterList[routerId] = router;
    }

    function approveRouter(address[] memory tokens, address router) external onlyOwner {
        if (router == address(0)) router = swapRouter;
        for(uint256 i = 0; i < tokens.length; i++) {
            TransferHelper.safeApprove(tokens[i], router, type(uint256).max);
        }
    }

    function manageSetting(uint16 tickets, uint16 gap, uint64 reserve) external onlyOwner {
        if (tickets != 0) maxTickets = tickets;
        if (gap != 0) gapBlockRefund = gap;
        if (reserve != 0) minPoolReserve = reserve * 100;       // 100X stored
    }

    function managePromotion(uint256 promotion) external onlyOwner {
        configPromotion = uint96(promotion);
    }

    function distributeLucky(uint8 usage, address receiver, uint256 amount) external onlyOwner {
        uint256 reserveAvailable;
        if (usage == 1) reserveAvailable = projectReserve;
        if (usage == 2) reserveAvailable = publicGoodsReserve;
        if (usage == 3) reserveAvailable = greenBTCReserve;
        require(reserveAvailable != 0, "YBTC: Wrong Usage");

        reserveAvailable = reserveAvailable / 100;

        if (receiver == address(0)) receiver = msg.sender;
        if ((amount == 0) || (amount > reserveAvailable)) { 
            amount = reserveAvailable;
        }
        else {
            reserveAvailable = amount;
        }

        reserveAvailable = reserveAvailable * 100;
        if (usage == 1) projectReserve -= uint64(reserveAvailable);
        if (usage == 2) publicGoodsReserve -= uint64(reserveAvailable);
        if (usage == 3) greenBTCReserve -= uint64(reserveAvailable);

        TransferHelper.safeTransfer(wBTC, receiver, amount);

        emit LuckyDistributed(usage, receiver, amount);
    }

    function fundLucky(uint256 amountFund) external {
        require(amountFund > 0, "YBTC: Zero Value");

        TransferHelper.safeTransferFrom(wBTC, msg.sender, address(this), amountFund);
        uint256 lbtcSupply = totalSupply();
        uint256 amountToMint;

        if (lbtcSupply == 0) {
            amountToMint = amountFund;
        } else {
            amountToMint = amountFund * 100 * lbtcSupply / (poolReserve - luckyReserve);          // poolReserve is multiplied by 100
        }

        poolReserve += uint64(amountFund * 100);
        _mint(msg.sender, amountToMint);
        emit LuckyFund(msg.sender, amountFund, amountToMint);
    }

    function gainLucky(uint256 amountTake) external {
        require(amountTake > 0, "YBTC: Zero Value");

        uint256 lbtcSupply = totalSupply();
        require( amountTake <= lbtcSupply, "YBTC: Take More");
        require(block.number >= (lastDrawHeight + gapBlockRefund), "YBTC: Need to Wait");

        // poolReserve is stoared as 100X, 0.1% is deducted from the amount to be taken.
        uint256 amountGain = amountTake * uint256(poolReserve - luckyReserve) / (100 * lbtcSupply);  

        poolReserve -= uint64(amountGain * 100);
        uint256 feeProject = amountGain / 1000;
        projectReserve += uint64(feeProject * 100); 
        amountGain -= feeProject;

        _burn(msg.sender, amountTake);
        TransferHelper.safeTransfer(wBTC, msg.sender, amountGain);
        emit LuckyGain(msg.sender, amountTake, amountGain);
    }

    function playLucky(
        uint16 loterryId,
        uint16 tickets,
        uint256 mode
    ) external returns (uint48 luckyId) {

        if (poolReserve <= minPoolReserve) LowReserve.selector.revertWith();
        if (tickets > maxTickets) TooMoreTickets.selector.revertWith(uint256(maxTickets));
        
        uint256 lotteryInfo = lotteryList[loterryId];
        if (lotteryInfo == 0) WrongLotteryId.selector.revertWith(uint256(loterryId));

        // lotteryInfo: tokenId (1B) || baseValue (3B) || routerId (1B) || swapPathId (1B) || free (1B) || level (1B) || [times, ratio](8)  
        address payToken;
        uint256 payAmount;
        uint256 amountWBTC;

        uint8 tokenId = uint8(lotteryInfo >> 248);
        if ((tokenId & 0x80) != 0) LotteryDisabled.selector.revertWith(uint256(loterryId));

        if (tokenId == 0) {
            payToken = wBTC;
        } else {
            payToken = payTokens[tokenId]; 
        }

        payAmount = tickets * ((lotteryInfo >> 232) & 0xFFFF) * ( 10 ** ((lotteryInfo >> 224) & 0xFF));   // tickets * baseValue

        // Transfer payment
        TransferHelper.safeTransferFrom(payToken, msg.sender, address(this), payAmount);    // payToken is checked in addLottery 

        if (tokenId == 0) {
            amountWBTC = payAmount;                   // Input wBTC, no need to swap
        } else {
            address router;                           // Checked in manageSwapRouter for Non-Zero
            uint8 routerId = uint8(lotteryInfo >> 216);
            if (routerId == 0x00) {
                router = swapRouter;
            } else {
                router = swapRouterList[routerId]; 
            }

            // lotteryInfo:  tokenId (1B) || baseValue (3B) || routerId (1B) || swapPathId (1B) || free (1B) || level (1B) || [times, ratio](8)  
            ISwapRouter.ExactInputParams memory params;
            bytes memory path;
            uint8 swapPathId = uint8(lotteryInfo >> 208);
            if (swapPathId != 0x00) {
                path = swapPath[swapPathId];
            } else {
                if (tokenId == 1) {                                           // payTokens[1] = USDT,  payTokens[2] = USDC
                    path = abi.encodePacked(payToken, poolFee500, payTokens[2], poolFee3000, wBTC);
                } else if (tokenId == 2) {                                    // USDC
                    path = abi.encodePacked(payToken, poolFee3000, wBTC);
                } else {
                    TokenRejected.selector.revertWith(uint256(tokenId));
                }
            }

            params = ISwapRouter.ExactInputParams({
                        path: path,
                        recipient: address(this),
                        deadline: block.timestamp + 3600,     // Within an hour
                        amountIn: payAmount,
                        amountOutMinimum: 0
                    });

            // Executes the swap.
            amountWBTC = ISwapRouter(router).exactInput(params);
            if (amountWBTC > type(uint32).max) DrawTooBig.selector.revertWith(amountWBTC);
        }

        // Theoretically only grossIncome could be overflowed, we just need to allow grossIncome overflowed
        unchecked {
            luckyId = (drawId += 1);
            lastDrawHeight = uint48(block.number);                             
            grossIncome += uint64(amountWBTC * 100);
            poolReserve += uint64(amountWBTC * 93);         // PoolReserve is stored for jackpot distribution, 93% = 100% - (2+3+2)%
            luckyReserve += uint64(amountWBTC * 10);        // 10%
            projectReserve += uint64(amountWBTC * 2);       // 2%
            publicGoodsReserve += uint64(amountWBTC * 3);   // 3%
            greenBTCReserve += uint64(amountWBTC * 2);      // 2%            
        }

        emit LuckyDraw(msg.sender, luckyId, loterryId, payAmount, amountWBTC, tickets);

        if (mode != 1) mode = tickets;                         // Multiple mode 

        // drawInfo: Block height(4B) || WBTC Amount (4B) || ticketTop (2B) || loterryId (2B) || Redeemed(1B) || free(3B) || wonAmount (8B) || poolReserve (8B)
        uint256 _drawInfo = uint256(block.number << 224) + 
                            (uint256(uint32(amountWBTC)) << 192) +
                            (uint256(uint16(mode)) << 176) +
                            (uint256(uint16(loterryId)) << 160) +
                            uint256(poolReserve);

        drawInfo[(uint256(luckyId)<<160) + uint256(uint160(msg.sender))] = _drawInfo;        // User addres is encoded in the mapping index

        {
            uint256 promot = configPromotion;
            uint8 exp = uint8(promot);
            if ((exp & 0x80) == 0) {				        // Check promotion activation flag
                uint32 startTime = uint32(promot >> 64);
                uint32 endTime = uint32(promot >> 32);
                if ((block.timestamp >= startTime) && (block.timestamp <= endTime)) {
                    payAmount = ((promot >> 8) & 0xFFFF) * (10 ** exp);
                    tokenId = uint8(promot>>24);
                    if(tokenId == 0x00) payToken = wBTC;
                    else if(tokenId == 0xFF) payToken = kWhToken;
                    else payToken = payTokens[tokenId];
                    TransferHelper.safeTransfer(payToken, msg.sender, payAmount * tickets);
                }
            }
        }
    }

    // drawInfo: Block height(4B) || WBTC Amount (4B) || tickets (2B) || loterryId (2B) || Redeemed(1B) || free(3B) || wonAmount (8B) || poolReserve (8B)
    // lotteryInfo:  tokenId (1B) || baseValue (3B) || routerId (1B) || swapPathId (1B) || free (1B) || level (1B) || [times, ratio](8)  
    function redeemLucky(
        uint48 luckyId
    ) external returns (uint256 wonAmount, bytes memory luckyLevels) {
        uint256 drawInfoIndex = (uint256(luckyId)<<160) + uint256(uint160(msg.sender));
        uint256 _drawInfo  = drawInfo[drawInfoIndex];

        if (_drawInfo == 0) WrongLuckyIdOwner.selector.revertWith(uint256(luckyId));                // Check luckyId and Owner
        if (((_drawInfo >> 152) & 0xFF) != 0) AlreadyRedeemed.selector.revertWith(uint256(luckyId)); 

        uint256 blockHeight = (_drawInfo >> 224);
        if (block.number <= (blockHeight + 3)) RedeemTooEarly.selector.revertWith(uint256(blockHeight)); 
        if (block.number > (blockHeight + 256)) RedeemTooLate.selector.revertWith(uint256(blockHeight)); 

        uint256 digest = (uint256(luckyId) << 224) +                        // truncated luckyId (4B) || 
                         (uint256(uint96(uint160(msg.sender))) << 128) +    // truncated user address(12B) || 
                         (uint256(uint64(_drawInfo >> 160)) << 64) +        // WBTC Amount (4B) || tickets (2B) || loterryId (2B)
                         uint256(uint64(_drawInfo));                        // poolReserve (8B) 

        bytes32 luckyNumber = keccak256(abi.encodePacked(blockhash(blockHeight), digest));
        uint256 amountJackpot;

        (wonAmount, amountJackpot, luckyLevels) = _calculateLuckyPrize(_drawInfo, luckyNumber);

        if (amountJackpot > 0) {
            if (luckyReserve > amountJackpot) luckyReserve -= uint64(amountJackpot);
            else luckyReserve = 0;
        }

        poolReserve -= uint64(wonAmount);
        drawInfo[drawInfoIndex] = _drawInfo + (0x01 << 152) + (wonAmount << 64);             // Set redeemded flag

        TransferHelper.safeTransfer(wBTC, msg.sender, wonAmount);
        emit LuckyRedeem(msg.sender, luckyId, wonAmount, luckyLevels);
    }

    function redeemLuckyWithHash(
        uint48 luckyId, 
        uint256 blockHeight, 
        bytes32 blockHash,
        Sig calldata signature
    ) external returns (uint256 wonAmount, bytes memory luckyLevels) {
        uint256 drawInfoIndex = (uint256(luckyId)<<160) + uint256(uint160(msg.sender));
        uint256 _drawInfo  = drawInfo[drawInfoIndex];
        if (_drawInfo == 0) WrongLuckyIdOwner.selector.revertWith(uint256(luckyId));                // Check luckyId and Owner
        if (((_drawInfo >> 152) & 0xFF) != 0) AlreadyRedeemed.selector.revertWith(uint256(luckyId)); 
        if (blockHeight != uint32(_drawInfo >> 224)) WrongBlockHeight.selector.revertWith(uint256(blockHeight)); 

        bytes32 redeemLuckyHash = keccak256(abi.encode(REDEEM_LUCKY_TYPEHASH, msg.sender, luckyId, blockHeight, blockHash));
        bytes32 msgDigest = keccak256(abi.encodePacked('\x19\x01', _DOMAIN_SEPARATOR, redeemLuckyHash));
        address managerAddress = ECDSAUpgradeable.recover(msgDigest, signature.v, signature.r, signature.s);
        require(managerAddress == luckyManager, "Wrong Signature");

        uint256 digest = (uint256(luckyId) << 224) +                        // truncated luckyId (4B) || 
                         (uint256(uint96(uint160(msg.sender))) << 128) +    // truncated user address(12B) || 
                         (uint256(uint64(_drawInfo >> 160)) << 64) +        // WBTC Amount (4B) || tickets (2B) || loterryId (2B)
                         uint256(uint64(_drawInfo));                        // poolReserve (8B) 

        bytes32 luckyNumber = keccak256(abi.encodePacked(blockhash(blockHeight), digest));
        uint256 amountJackpot;

        (wonAmount, amountJackpot, luckyLevels) = _calculateLuckyPrize(_drawInfo, luckyNumber);

        if (amountJackpot > 0) {
            if (luckyReserve > amountJackpot) luckyReserve -= uint64(amountJackpot);
            else luckyReserve = 0;
        }

        poolReserve -= uint64(wonAmount);
        drawInfo[drawInfoIndex] = _drawInfo + (0x01 << 152) + (wonAmount << 64);

        TransferHelper.safeTransfer(wBTC, msg.sender, wonAmount);
        emit LuckyRedeemWithHash(msg.sender, luckyId, wonAmount, luckyLevels);
    }

    function checkIfLucky (address user, uint48 luckyId, bytes32 hash) 
            external view returns (bool ifRedeemed, uint256 wonAmount, uint256 amountJackpot, bytes memory luckyLevels) 
    {
        uint256 _drawInfo  = drawInfo[(uint256(luckyId)<<160) + uint256(uint160(user))];
        if (_drawInfo == 0) WrongLuckyIdOwner.selector.revertWith(uint256(luckyId));                // Check luckyId and Owner

        uint256 digest = (uint256(luckyId) << 224) +                        // truncated luckyId (4B) || 
                         (uint256(uint96(uint160(user))) << 128) +          // truncated user address(12B) || 
                         (uint256(uint64(_drawInfo >> 160)) << 64) +        // WBTC Amount (4B) || tickets (2B) || loterryId (2B)
                         uint256(uint64(_drawInfo));                        // poolReserve (8B) 

        bytes32 luckyNumber = keccak256(abi.encodePacked(hash, digest));
        (wonAmount, amountJackpot, luckyLevels) = _calculateLuckyPrize(_drawInfo, luckyNumber);
        ifRedeemed = ((_drawInfo >> 152) & 0xFF) != 0x00; 
    }
        
    function _calculateLuckyPrize (uint256 _drawInfo, bytes32 luckyNumber)
            internal view returns (uint256 wonAmount, uint256 jackpot, bytes memory luckyLevels) 
    {
        uint256 lotteryInfo = lotteryList[uint16(_drawInfo >> 160)];
        uint256 tickets = uint256(uint16(_drawInfo >> 176));

        // Convert to amountWBTC per ticket, and times 1000 for more precision and following calculation
        uint256 amountWBTC = uint256(uint32(_drawInfo >> 192)) * 1000 / tickets;   

        uint256 level = (lotteryInfo >> 192) & 0x0F;
        luckyLevels = new bytes(tickets); 

        for(uint256 ticketIndex = 0; ticketIndex < tickets; ticketIndex++) {
            uint256 luckyRange = 0;
            uint256 levelInfo = lotteryInfo;
            luckyLevels[ticketIndex] = "X";

            for(uint256 levelIndex = 0; levelIndex < level; (levelInfo = (levelInfo>>24), levelIndex++)) {
                uint256 times = (levelInfo >> 12) & 0xFFF;
                if ((levelInfo & 0xFFF) == 0xFFF) {                                         // Relative ratio
                    luckyRange += (1 << 128) * amountWBTC / uint256(uint64(_drawInfo)) / uint256(times >> 4);
                    if ((uint256(luckyNumber) % (1<<128)) < luckyRange) {                   // Be lucky
                        if (jackpot != 0) continue;                                         // jackpot only once, // Skip to next level
                        jackpot = uint256(uint64(_drawInfo)) * (times >> 4);                // times used as percentage(<=25.5%), 100 means 10%
                        luckyLevels[ticketIndex] = bytes1(uint8(0x30 + levelIndex + 1));
                        break;
                    }
                } else {
                    luckyRange += (1 << 128) * uint256(uint8(levelInfo >> 4)) / uint256(10 ** (levelInfo & 0xF));       // Apply next ratio     
                    if ((uint256(luckyNumber) % (1<<128)) < luckyRange) {                                               // Be lucky
                        wonAmount += amountWBTC * ((times >> 4) * (10 ** (times & 0xF)));                               // won amount * times        
                        luckyLevels[ticketIndex] = bytes1(uint8(0x30 + levelIndex + 1));
                        break;
                    }
                }
            }
            
            luckyNumber = keccak256(abi.encodePacked(luckyNumber));
        }
        return ((wonAmount + jackpot)/1000, jackpot/1000, luckyLevels);
    }
}
