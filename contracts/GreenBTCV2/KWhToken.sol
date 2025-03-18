// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
//import "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/ERC20BurnableUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";

import "../libraries/TransferHelper.sol";
import "../interfaces/IArkreenRECBank.sol";
import "../interfaces/IArkreenBuilder.sol";
import "../interfaces/IArkreenRECToken.sol";

contract KWhToken is
    ReentrancyGuardUpgradeable,
    OwnableUpgradeable,
    UUPSUpgradeable,
    ERC20BurnableUpgradeable
{
    // Public constant variables
    string public constant NAME = "AREC kWh";
    string public constant SYMBOL = "kWh";

    address public tokenART;
    address public artBank;               						// Address of the ART sales bank contract
    address public arkreenBuilder;
    address public offsetManager;

    mapping(address => uint256) public priceForSwap;            // Mapping ART/USDC/USDT -> ConverterInfo

    IArkreenBuilder.BadgeInfo public badgeInfo;									// Badge info used for AREC Climate badge

    // Events
    event KWhMinted(address indexed tokenPayemnt, uint256 amountPayment, uint256 amountKWh);
    event ARTConverted(address indexed user, address indexed tokenPayemnt, uint256 amountPayment, uint256 amountKWh);
    event SwapPriceChanged(address indexed payToken, uint256 newPrice);
    event RemoveReserve(address indexed reserveToken, uint256 amountRemove);

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(address art, address bank, address builder, address manager) external virtual initializer {
        __ReentrancyGuard_init();   
        __Ownable_init_unchained();
        __UUPSUpgradeable_init();        
        __ERC20_init_unchained(NAME, SYMBOL);
        require ((art != address(0)) && (bank != address(0)) && (builder != address(0)));
        tokenART = art;
        artBank = bank;
        arkreenBuilder = builder;
        offsetManager = manager;
        TransferHelper.safeApprove(art, builder, type(uint256).max);
    }

    function postUpdate() external onlyProxy onlyOwner
    {}

    function _authorizeUpgrade(address newImplementation) internal virtual override onlyOwner
    {}    

    function decimals() public view virtual override returns (uint8) {
        return 6;
    }

    modifier onlyOwnerOrManager(){
        require ((msg.sender == owner()) || ((offsetManager != address(0)) && (msg.sender == offsetManager)), "kWh: Not Allowed");
        _;
    }

    function setOffsetManager(address manager) external onlyOwner {
        offsetManager = manager;                      // set offsetManager to 0 to disable the offsetManager
    }

    /**
     * @dev Approve the tokens which can be transferred from this GreenBTC contract by arkreenBuilder
     * @param tokens The token list
     */
    function approveBank(address[] calldata tokens) external onlyOwner {
        for(uint256 i = 0; i < tokens.length; i++) {
            TransferHelper.safeApprove(tokens[i], artBank, type(uint256).max);
        }
    }

    /**
     * @dev Mint kWh token with the give token and amount, only can be called by owner or manager
     * @param tokenToPay address of the payment token, if not ART, it is the address of the token used to buy ART token. 
     * It it is ART token, convert ART token to kWh token directly
     * @param amount amount of the token to pay, either the amount of the ART token or the amount of the payment token to pay.
     */
    function MintKWh(address tokenToPay, uint256 amount) external nonReentrant onlyOwnerOrManager returns (uint256) {

        uint256 amountART = amount;
        if (tokenToPay != tokenART) {
            // buyART(address tokenPay,address tokenART,uint256 amountPay,uint256 amountART,bool isExactPay)
            amountART = IArkreenRECBank(artBank).buyART(tokenToPay, tokenART, amount, 0, true);
        }

        // actionBuilderBadgeWithART(address tokenART, uint256 amountART, uint256 deadline, BadgeInfo calldata badgeInfo)
        IArkreenBuilder.BadgeInfo memory badgeInfoMem = badgeInfo;
        IArkreenBuilder(arkreenBuilder).actionBuilderBadgeWithART(tokenART, amountART, type(uint256).max, badgeInfoMem);

        uint256 ratioFeeOffset = IArkreenRECToken(tokenART).getRatioFeeOffset(); 
        if (ratioFeeOffset != 0) {
            amountART = amountART * (10000 - ratioFeeOffset) / 10000;
        }

        emit KWhMinted(tokenToPay, amount, amountART);
        _mint(address(this), amountART);
        return amountART;
    }

    /**
     * @dev Convert ART/USDC/UDSDT tokens to kWh tokens
     * @param tokenToPay Address of the payment token used to pay for swapping ART
     * @param amountPayment amount of the tokeen to swap out
     */
    function convertKWh(address tokenToPay, uint256 amountPayment) external nonReentrant returns (uint256) {
        uint256 price = priceForSwap[tokenToPay];
        require (price != 0, "kWh: Payment Token Not Supported");

        uint256 amountKWh = amountPayment;
        if (tokenToPay != tokenART) amountKWh = amountPayment * (10**6) / price;      // kWh decimal is 6, so hardcoded here

        require(IERC20Upgradeable(tokenToPay).transferFrom(msg.sender, address(this), amountPayment));
        require(IERC20Upgradeable(this).transfer(msg.sender, amountKWh));

        emit ARTConverted(msg.sender, tokenToPay, amountPayment, amountKWh);
        return amountKWh;
    }

    /**
     * @dev Remove the reserve token of the given amount
     * @param reserveToken The reserve token address to remove. 
     * @param amountRemove Amount of the reserve token to remove.
     */
    function removeReserve(address reserveToken, uint256 amountRemove) external onlyOwnerOrManager {
        TransferHelper.safeTransfer(reserveToken, msg.sender, amountRemove);
        emit RemoveReserve(reserveToken, amountRemove);
    }  

    /// @dev Receive climate badge
    function onERC721Received(
        address,        /* operator */
        address,        /* from */
        uint256,        /* tokenId*/
        bytes calldata  /* data */
    ) external pure returns (bytes4) {
        return this.onERC721Received.selector;
    }

    /**
     * @dev Change the ART swap price based on the payToken. Price-zero means not-supporting
     * @param payToken Address of the payment token used to pay for swapping ART. 
     * @param newPrice Price of the ART token priced in payment token. 
     *        1 kWh -> 0.001ART, newPrice = 10**6 
     *        1 kWh -> 0.01 USDC, newPrice = 10**4
    */
    function changeSwapPrice(address payToken, uint256 newPrice ) external onlyOwnerOrManager {
        priceForSwap[payToken] = newPrice;                  // price = 0 to disable the payToken
        emit SwapPriceChanged(payToken, newPrice);    
    }  

    /**
     * @dev Set the new badge info used for offset ART to mint kWh token.
     * @param newBadgeInfo new badgeinfo to be used.
    */
    function setBadgeInfo(IArkreenBuilder.BadgeInfo calldata newBadgeInfo) external onlyOwnerOrManager {
	    badgeInfo = newBadgeInfo;
    }  
}