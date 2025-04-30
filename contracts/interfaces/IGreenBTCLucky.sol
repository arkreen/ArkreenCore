// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

interface IGreenBTCLucky 
{
    /// @notice Thrown when the lottery is disabled
    error LotteryDisabled(uint256 ticketId);

    /// @notice Thrown when tokenId not allowed
    error TokenRejected(uint256 tokenId);

    /// @notice Thrown when pool reserve is too low
    error LowReserve();

    /// @notice Thrown when too much wBTC output
    error TooMoreTickets(uint256 tickets);

    /// @notice Thrown when too much wBTC output
    error DrawTooBig(uint256 playOutput);

    /// @notice Thrown when LotterId not existing
    error WrongLotteryId(uint256 LotterId);

    /// @notice Thrown when luckyId not existing
    error WrongLuckyIdOwner(uint256 luckyId);

    /// @notice Thrown when redeeming luckyId not allowed
    error RedeemNotAllowed(uint256 luckyId);

    /// @notice Thrown when redeeming luckyId too early
    error RedeemTooEarly(uint256 luckyId);

    /// @notice Thrown when redeeming luckyId too late
    error RedeemTooLate(uint256 luckyId);

    /// @notice Thrown when the luckyId already redeemed
    error AlreadyRedeemed(uint256 luckyId);

    /// @notice Thrown when the blockHeight is not same
    error WrongBlockHeight(uint256 blockHeight);

    struct Sig {
        uint8       v;
        bytes32     r;
        bytes32     s;              
    }

    // Events
    event LotteryAdded(uint256 indexed loterryId, uint256 lotteryInfo);
    event LotteryToggled(uint256 indexed loterryId, uint256 lotteryInfo);
    event LuckyFund(address indexed user, uint256 amountFund, uint256 amountToMint);
    event LuckyGain(address indexed user, uint256 amountTake, uint256 amountGain);
    event LuckyDistributed(uint8 usage, address receiver, uint256 amount);
    event LuckyDraw(address indexed user, uint48 indexed luckyId, uint256 ticketId, uint256 amountPay, uint256 amountOut, uint256 chips);
    event LuckyRedeem(address indexed user, uint48 indexed luckyId, uint256 amountWBTC, bytes luckyLevels);
    event LuckyRedeemWithHash(address indexed user, uint48 indexed luckyId, uint256 amountWBTC, bytes luckyLevels);

    function setLuckyManager(address manager) external;
    function addLottery(uint16 loterryId, uint256 lotteryInfo) external;
    function toggleLottery(uint16 loterryId) external;
    function manageSwapPath(uint8 swapPathId, bytes memory routePath) external;
    function managePayTokens(uint8 tokenId, address token) external;
    function manageSwapRouter(uint8 routerId, address router) external;
    function manageSetting(uint16 tickets, uint16 gap, uint64 reserve) external;
    function distributeLucky(uint8 usage, address receiver, uint256 amount) external;
    function fundLucky(uint256 amountFund) external;
    function gainLucky(uint256 amountTake) external;
    function playLucky(uint16 loterryId, uint16 tickets, uint256 mode) external returns (uint48 luckyId); 
    function redeemLucky(uint48 luckyId) external returns (uint256 wonAmount, bytes memory luckyLevels);
    function redeemLuckyWithHash(uint48 luckyId, uint256 blockHeight, bytes32 blockHash, Sig calldata signature)
              external returns (uint256 wonAmount, bytes memory luckyLevels);
    function checkIfLucky (address user, uint48 luckyId, bytes32 hash) 
            external view returns (bool ifRedeemed, uint256 wonAmount, uint256 amountJackpot, bytes memory luckyLevels); 
}