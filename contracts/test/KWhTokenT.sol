// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/ERC20BurnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";

import "../libraries/TransferHelper.sol";
import "../interfaces/IUniswapV3Pool.sol";
import "../libraries/TickMath.sol";

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

    address public akre;
    address public akrePair;
    bool    public akreIsToken1;
    uint256 public lastAKREPrice;

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

    function setAKREPair(address _akre, address _akrePair) external onlyOwner {
        akre = _akre;
        akrePair = _akrePair;
        address token1 = IUniswapV3Pool(_akrePair).token1();
        akreIsToken1 = (_akre == token1);
    }

    /**
     * @dev Get the average price of 10 seconds ago, in the amount of AKRE what 1 USDC.e can buy
     */
    function getAverageAKREPrice(uint256 duration) public view returns (uint256) {
      uint32[] memory secondsAgos = new uint32[](2);
      secondsAgos[0] = 10;
      secondsAgos[1] = uint32(duration) + 10;             
      (int56[] memory tickCumulatives, ) = IUniswapV3Pool(akrePair).observe(secondsAgos);
      int24 tickMean = int24((tickCumulatives[0] - tickCumulatives[1]) / int56(uint56(duration)));
      uint256 sqrtPriceX96 = TickMath.getSqrtRatioAtTick(tickMean);
      sqrtPriceX96 = sqrtPriceX96 / (2**32); 
      sqrtPriceX96 = sqrtPriceX96 * sqrtPriceX96 * 1_000_000 / (2**128);  // Mutiply by 10**6 for 1 USDC
      return sqrtPriceX96;
    }

    /**
     * @dev Get the amount of AKRE what 1 USDC.e can buy
     */
    function getAKREPrice() public view returns (uint256) {
      (uint256 sqrtPriceX96, , , , , , ) = IUniswapV3Pool(akrePair).slot0();
      sqrtPriceX96 = sqrtPriceX96 / (2**32); 
      sqrtPriceX96 = sqrtPriceX96 * sqrtPriceX96 * 1_000_000 / (2**128);  // Mutiply by 10**6 for 1 USDC
      return sqrtPriceX96;
    }
    
    /**
     * @dev Convert ART/USDC/UDSDT tokens to kWh tokens
     * @param tokenToPay Address of the payment token used to pay for swapping ART
     * @param amountPayment amount of the tokeen to swap out
     */
    function convertKWh(address tokenToPay, uint256 amountPayment) external nonReentrant returns (uint256) {

        uint256 amountKWh;
        if (tokenToPay == akre) {
            uint256 price = getAKREPrice();
            uint256 lastPrice = lastAKREPrice;
            if (lastPrice != 0) {
                uint256 diff = (price >= lastPrice) ? (price - lastPrice) : (lastPrice - price);
                // Current price cannot be more 5% change compared to the last swap price and the average price. 
                if ((diff * 100 / price) >= 5) {
                    uint256 averagePrice = getAverageAKREPrice(1200);
                    diff = (price >= averagePrice) ? (price - averagePrice) : (averagePrice - price);
                    require ((diff * 100 / price) < 5, "Price unstable"); 
                }
            } 

            lastAKREPrice = price;
            amountPayment = amountPayment & ((1<<128)-1);
            amountKWh = amountPayment * (10**8) / price;    // 1U = 100kWh = 10**8

        } else {
            uint256 price = priceForSwap[tokenToPay];
            require (price != 0, "kWh: Payment Token Not Supported");

            amountKWh = amountPayment;
            if (tokenToPay != tokenART) amountKWh = amountPayment * (10**6) / price;      // kWh decimal is 6, so hardcoded here
        }
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
