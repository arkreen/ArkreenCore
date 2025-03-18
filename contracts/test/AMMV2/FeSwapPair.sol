// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "./interfaces/IFeSwapPair.sol";
import "./FeSwapERC20.sol";
import "./libraries/Math.sol";
import "./libraries/UQ112x112.sol";
import "./interfaces/IERC20.sol";
import "./interfaces/IFeSwapFactory.sol";
import "./interfaces/IFeSwapCallee.sol";
import "./libraries/TransferHelper.sol";

contract FeSwapPair is IFeSwapPair, FeSwapERC20 {

    using SafeMath  for uint;
    using UQ112x112 for uint224;

    uint public constant override MINIMUM_LIQUIDITY = 10**3;

    address public immutable override factory;
    address public immutable override tokenIn;
    address public immutable override tokenOut;
    address public override pairOwner;

    uint112 private reserveIn;              // uses single storage slot, accessible via getReserves
    uint112 private reserveOut;             // uses single storage slot, accessible via getReserves
    uint32  private blockTimestampLast;     // uses single storage slot, accessible via getReserves

    uint private price0CumulativeLast;
    uint private price1CumulativeLast;
    uint private kLast;                     // reserveIn * reserveOut, as of immediately after the most recent liquidity event

    uint private rateTriggerArbitrage;

    uint private unlocked = 0x5A;
    modifier lock() {
        require(unlocked == 0x5A, 'FeSwap: LOCKED');
        unlocked = 0x69;
        _;
        unlocked = 0x5A;
    }
  
    function getReserves() public view override returns ( uint112 _reserveIn, uint112 _reserveOut, uint32 _blockTimestampLast) {
        _reserveIn = reserveIn;
        _reserveOut = reserveOut;
        _blockTimestampLast = blockTimestampLast;
    }

    function getReservesWithRate() external view override returns ( uint112 _reserveIn, uint112 _reserveOut, uint _rateArbitrage) {
        _reserveIn = reserveIn;
        _reserveOut = reserveOut;
        _rateArbitrage = rateTriggerArbitrage;
     }

    function getOracleInfo() public view override returns ( uint _price0CumulativeLast, uint _price1CumulativeLast, uint _kLast) {
        return (price0CumulativeLast, price1CumulativeLast, kLast);
    }

    event Mint(address indexed sender, uint amountIn, uint amountOut);
    event Burn(address indexed sender, uint amountIn, uint amountOut, address indexed to);
    event Swap(
        address indexed sender,
        uint amount0In,
        uint amount1In,
        uint amount1Out,
        address indexed to
    );
    event Sync(uint112 reserveIn, uint112 reserveOut);

    constructor() {
        factory     = msg.sender;
        (tokenIn, tokenOut) = IFeSwapFactory(msg.sender).getPairTokens();
    }

    function initialize(address _pairOwner, address router, uint rateTrigger, uint switchOracle) external override {
        require(msg.sender == factory, 'FeSwap: FORBIDDEN');
        
        address _tokenIn = tokenIn;
        if(pairOwner == address(type(uint160).max)) {
            TransferHelper.safeApprove(_tokenIn, router, 0);                    // Remove Approve, only from Factory admin
        } else {
            pairOwner  = _pairOwner;
            if(router != address(0))
                TransferHelper.safeApprove(_tokenIn, router, type(uint).max);   // Approve Rourter to transfer out tokenIn for auto-arbitrage
        }

        if(rateTrigger != 0)  rateTriggerArbitrage = uint16(rateTrigger); 

        if(switchOracle == 0)  return;                                          // = 0, do not change the oracle setting
        if(switchOracle == uint(1)) {                                           // = 1, open price oracle setting  
            blockTimestampLast = uint32(block.timestamp % 2**32);
            return;
        }
        if(switchOracle == type(uint).max) {                                    // = -1, close price oracle setting  
            blockTimestampLast = 0;
            price0CumulativeLast = 0;
            price1CumulativeLast = 0;
        }
    }

    // update reserves and, on the first call per block, price accumulators
    function _update(uint balanceIn, uint balanceOut, uint112 _reserveIn, uint112 _reserveOut, uint32 _blockTimestampLast) private {
        require(balanceIn <= type(uint112).max && balanceOut <= type(uint112).max, 'FeSwap: OVERFLOW');
        uint32 blockTimestamp = 0;
        if(_blockTimestampLast != 0){           // check if oracle is activated or not
            blockTimestamp = uint32(block.timestamp % 2**32);
            uint32 timeElapsed = blockTimestamp - _blockTimestampLast; // overflow is desired
            if (timeElapsed > 0 && _reserveIn != 0 && _reserveOut != 0) {
                // * never overflows, and + overflow is desired
                price0CumulativeLast += uint(UQ112x112.encode(_reserveOut).uqdiv(_reserveIn)) * timeElapsed;
                price1CumulativeLast += uint(UQ112x112.encode(_reserveIn).uqdiv(_reserveOut)) * timeElapsed;
            }
        }
        reserveIn = uint112(balanceIn);
        reserveOut = uint112(balanceOut);
        blockTimestampLast = blockTimestamp;
        emit Sync(reserveIn, reserveOut);
    }

    // if fee is on, mint liquidity equivalent to 1/6th of the growth in sqrt(k)
    function _mintFee(uint112 _reserveIn, uint112 _reserveOut) private returns (bool feeOn) {
        (address feeTo, uint rateProfitShare) = IFeSwapFactory(factory).getFeeInfo();
        feeOn = (feeTo != address(0)) || (pairOwner != address(0));
        uint _kLast = kLast;            // gas savings
        if (feeOn) {
            if (_kLast != 0) {
                uint rootK = uint(_reserveIn).mul(_reserveOut);
                if (rootK > _kLast.add(uint(_reserveIn).mul(200))) {     // ignore swap dust increase, select 200 randomly 
                    rootK = Math.sqrt(rootK);
                    _kLast = Math.sqrt(_kLast);
                    uint numerator = totalSupply.mul(rootK.sub(_kLast)).mul(6);
                    uint denominator = rootK.mul(rateProfitShare).add(_kLast);
                    uint liquidityOwner = numerator / (denominator.mul(10));
                    if((liquidityOwner > 0) && (pairOwner != address(0))) {
                        _mint(pairOwner, liquidityOwner);
                    } 
                    uint liquidityFeSwap = numerator / (denominator.mul(15));
                    if((liquidityFeSwap > 0)  && (feeTo != address(0))) {
                        _mint(feeTo, liquidityFeSwap);
                    } 
                }
            }
        } else if (_kLast != 0) {
            kLast = 0;
        }            
    }

    // this low-level function should be called from a contract which performs important safety checks
    function mint(address to) external override lock returns (uint liquidity) {
        (uint112 _reserveIn, uint112 _reserveOut, uint32 _blockTimestampLast) = getReserves(); // gas savings
        uint balanceIn = IERC20(tokenIn).balanceOf(address(this));
        uint balanceOut = IERC20(tokenOut).balanceOf(address(this));
        uint amountTokenIn = balanceIn.sub(_reserveIn);
        uint amountTokenOut = balanceOut.sub(_reserveOut);

        bool feeOn = _mintFee(_reserveIn, _reserveOut);
        uint _totalSupply = totalSupply; // gas savings, must be defined here since totalSupply can update in _mintFee
        if (_totalSupply == 0) {
            liquidity = Math.sqrt(amountTokenIn.mul(amountTokenOut)).sub(MINIMUM_LIQUIDITY);
            _mint(address(0), MINIMUM_LIQUIDITY); // permanently lock the first MINIMUM_LIQUIDITY tokens
        } else {
            liquidity = Math.min(amountTokenIn.mul(_totalSupply) / _reserveIn, amountTokenOut.mul(_totalSupply) / _reserveOut);
        }
        require(liquidity > 0, 'FeSwap: INSUFFICIENT_LIQUIDITY_MINTED');
        _mint(to, liquidity);

        _update(balanceIn, balanceOut, _reserveIn, _reserveOut, _blockTimestampLast);
        if (feeOn) kLast = uint(reserveIn).mul(reserveOut);                    // reserve0 and reserve1 are up-to-date
        emit Mint(msg.sender, amountTokenIn, amountTokenOut);
    }

    // this low-level function should be called from a contract which performs important safety checks
    function burn(address to) external lock override returns (uint amountIn, uint amountOut) {
        (uint112 _reserveIn, uint112 _reserveOut, uint32 _blockTimestampLast) = getReserves();     // gas savings
        (address _tokenIn, address _tokenOut) = (tokenIn, tokenOut);    // gas savings
        uint balanceIn = IERC20(_tokenIn).balanceOf(address(this));
        uint balanceOut = IERC20(_tokenOut).balanceOf(address(this));
        uint liquidity = balanceOf[address(this)];                      // liquidity to remove

        bool feeOn = _mintFee(_reserveIn, _reserveOut);
        uint _totalSupply = totalSupply;                        // gas savings, must be defined here since totalSupply can update in _mintFee
        amountIn = liquidity.mul(balanceIn) / _totalSupply;     // using balances ensures pro-rata distribution
        amountOut = liquidity.mul(balanceOut) / _totalSupply;   // using balances ensures pro-rata distribution
        require(amountIn > 0 && amountOut > 0, 'FeSwap: INSUFFICIENT_LIQUIDITY_BURNED');

        _burn(address(this), liquidity);
        TransferHelper.safeTransfer(_tokenIn, to, amountIn);
        TransferHelper.safeTransfer(_tokenOut, to, amountOut);
        balanceIn = IERC20(_tokenIn).balanceOf(address(this));      // can use?: balanceIn = balanceIn.sub(amountIn)
        balanceOut = IERC20(_tokenOut).balanceOf(address(this));

        _update(balanceIn, balanceOut, _reserveIn, _reserveOut, _blockTimestampLast);
        if (feeOn) kLast = uint(reserveIn).mul(reserveOut);     // reserve0 and reserve1 are up-to-date
        emit Burn(msg.sender, amountIn, amountOut, to);
    }

    // this low-level function should be called from a contract which performs important safety checks
    function swap(uint amountOut, address to, bytes calldata data) external lock override {
        require(amountOut > 0, 'FeSwap: INSUFFICIENT_OUTPUT_AMOUNT');
        (uint112 _reserveIn, uint112 _reserveOut, uint32 _blockTimestampLast) = (reserveIn, reserveOut, blockTimestampLast);   // gas savings
        require(amountOut < _reserveOut, 'FeSwap: INSUFFICIENT_LIQUIDITY');

        uint balanceIn;
        uint balanceOut;
        {   // scope for {_tokenIn, _tokenOut}, avoids stack too deep errors
            (address _tokenIn, address _tokenOut) = (tokenIn, tokenOut);            // gas savings
            require(to != _tokenIn && to != _tokenOut, 'FeSwap: INVALID_TO');
            TransferHelper.safeTransfer(_tokenOut, to, amountOut); 
            if (data.length > 0) IFeSwapCallee(to).FeSwapCall(msg.sender, amountOut, data);
            balanceIn = IERC20(_tokenIn).balanceOf(address(this));
            balanceOut = IERC20(_tokenOut).balanceOf(address(this));
        }

        uint amountInTokenIn = balanceIn > _reserveIn ? balanceIn - _reserveIn : 0;
        uint amountInTokenOut = balanceOut > (_reserveOut - amountOut) 
                                           ? balanceOut - (_reserveOut - amountOut) : 0;  // to support Flash Swap
        require(amountInTokenIn > 0 || amountInTokenOut > 0, 'FeSwap: INSUFFICIENT_INPUT_AMOUNT');

        {   // avoid stack too deep errors
            uint balanceOutAdjusted = balanceOut.mul(1000);
            if(amountInTokenOut>0) balanceOutAdjusted = balanceOutAdjusted.sub(amountInTokenOut.mul(3)); // Fee for Flash Swap: 0.3% from tokenOut
            require(balanceIn.mul(balanceOutAdjusted) >= uint(_reserveIn).mul(_reserveOut).mul(1000), 'FeSwap: K');
        }
        _update(balanceIn, balanceOut, _reserveIn, _reserveOut, _blockTimestampLast);
        emit Swap(msg.sender, amountInTokenIn, amountInTokenOut, amountOut, to);
    }

    // force balances to match reserves
    function skim(address to) external lock override {
        (address _tokenIn, address _tokenOut) = (tokenIn, tokenOut);         // gas savings
        TransferHelper.safeTransfer(_tokenIn, to, IERC20(_tokenIn).balanceOf(address(this)).sub(reserveIn));
        TransferHelper.safeTransfer(_tokenOut, to, IERC20(_tokenOut).balanceOf(address(this)).sub(reserveOut));
    }

    // force reserves to match balances
    function sync() external lock override {
        _update(IERC20(tokenIn).balanceOf(address(this)), IERC20(tokenOut).balanceOf(address(this)), reserveIn, reserveOut, blockTimestampLast);
    }
}