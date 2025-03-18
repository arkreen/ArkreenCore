// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/ERC20BurnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";

import "../libraries/TransferHelper.sol";

contract KWhTokenT is
    ReentrancyGuardUpgradeable,
    OwnableUpgradeable,
    UUPSUpgradeable,
    ERC20BurnableUpgradeable
{
    // Public constant variables
    string public constant NAME = "AREC kWh";
    string public constant SYMBOL = "kWh";

    address public tokenART;
    mapping(address => uint256) public priceForSwap;            // Mapping ART/USDC/USDT -> ConverterInfo

    // Events
    event ARTConverted(address indexed user, address indexed tokenPayemnt, uint256 amountPayment, uint256 amountKWh);
    event SwapPriceChanged(address indexed payToken, uint256 newPrice);
    event RemoveReserve(address indexed reserveToken, uint256 amountRemove);

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(address art, uint256 amount, address foundationAddr, string calldata name, string calldata symbol)
        external
        virtual
        initializer
    {
        __Ownable_init();
        __UUPSUpgradeable_init();
        
        if(bytes(name).length == 0 || bytes(symbol).length == 0) {
          __ERC20_init_unchained(NAME, SYMBOL);
        } else {
          __ERC20_init_unchained(name, symbol);
        }

        tokenART = art;
        _mint(foundationAddr, amount * (10 ** 6));
    }

    function postUpdate() external onlyProxy onlyOwner
    {}

    function _authorizeUpgrade(address newImplementation) internal virtual override onlyOwner
    {}    

    function decimals() public view virtual override returns (uint8) {
        return 6;
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
    function removeReserve(address reserveToken, uint256 amountRemove) external onlyOwner {
        TransferHelper.safeTransfer(reserveToken, msg.sender, amountRemove);
        emit RemoveReserve(reserveToken, amountRemove);
    }  

    function mintKWh(uint256 amount) external onlyOwner {
        _mint(address(this), amount);
    }  

    /**
     * @dev Change the ART swap price based on the payToken. Price-zero means not-supporting
     * @param payToken Address of the payment token used to pay for swapping ART. 
     * @param newPrice Price of the ART token priced in payment token. 
     *        1 kWh -> 0.001ART, newPrice = 10**6 
     *        1 kWh -> 0.01 USDC, newPrice = 10**4
    */
    function changeSwapPrice(address payToken, uint256 newPrice ) external onlyOwner {
        priceForSwap[payToken] = newPrice;                  // price = 0 to disable the payToken
        emit SwapPriceChanged(payToken, newPrice);    
    }  
}
