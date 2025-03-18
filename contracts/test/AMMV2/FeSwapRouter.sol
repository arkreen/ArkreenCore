// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;
pragma experimental ABIEncoderV2;

import "./libraries/TransferHelper.sol";
import "./interfaces/IFeSwapRouter.sol";
import "./libraries/FeSwapLibrary.sol";
import "./libraries/SafeMath.sol";
import "./interfaces/IERC20.sol";
import "./interfaces/IWETH.sol";
import "./patch/RouterPatchCaller.sol";
import "./interfaces/IFeSwapRouter.sol";

contract FeSwapRouter is IFeSwapRouter, RouterPatchCaller{

    using SafeMath for uint;

    address public immutable factory;
    address public immutable WETH;

    modifier ensure(uint deadline) {
        require(deadline >= block.timestamp, 'FeSwapRouter: EXPIRED');
        _;
    }

    constructor(address _factory, address _WETH) {
        factory = _factory;
        WETH = _WETH;
    }

    receive() external override payable {
        assert(msg.sender == WETH); // only accept ETH via fallback from the WETH contract
    }

    // **** ADD LIQUIDITY ****
    function _addLiquidity( address tokenIn, 
                            address tokenOut, 
                            uint amountInDesired, 
                            uint amountOutDesired,
                            uint amountInMin,
                            uint amountOutMin 
    ) internal virtual view returns (uint amountIn, uint amountOut, address pair) {
        pair = FeSwapLibrary.pairFor(factory, tokenIn, tokenOut);        
        require(pair != address(0), 'FeSwap: NOT CREATED');
        (uint reserveIn, uint reserveOut, ) = IFeSwapPair(pair).getReserves();
        if (reserveIn == 0 && reserveOut == 0) {
            (amountIn, amountOut) = (amountInDesired, amountOutDesired);
        } else {
            uint amountOutOptimal = FeSwapLibrary.quote(amountInDesired, reserveIn, reserveOut);
            if (amountOutOptimal <= amountOutDesired) {
                require(amountOutOptimal >= amountOutMin, 'FeSwap: LESS_OUT_AMOUNT');
                (amountIn, amountOut) = (amountInDesired, amountOutOptimal);
            } else {
                uint amountInOptimal = FeSwapLibrary.quote(amountOutDesired, reserveOut, reserveIn);
                assert(amountInOptimal <= amountInDesired);
                require(amountInOptimal >= amountInMin, 'FeSwap: LESS_IN_AMOUNT');
                (amountIn, amountOut) = (amountInOptimal, amountOutDesired);
            }
        }
    }

    function addLiquidity(  AddLiquidityParams calldata addParams, 
                            address to, 
                            uint deadline ) 
                external virtual override ensure(deadline) 
                returns (uint amountA, uint amountB, uint liquidityAAB, uint liquidityABB)
    {
        require(addParams.ratio <= 100,  'FeSwap: RATIO EER');
        if(addParams.ratio != uint(0)) {
            address pairA2B;
            uint liquidityA = addParams.amountADesired.mul(addParams.ratio)/100; 
            uint liquidityB = addParams.amountBDesired.mul(addParams.ratio)/100;
            uint amountAMin = addParams.amountAMin.mul(addParams.ratio)/100; 
            uint amountBMin = addParams.amountBMin.mul(addParams.ratio)/100;
            (amountA, amountB, pairA2B) = 
                            _addLiquidity(addParams.tokenA, addParams.tokenB, liquidityA, liquidityB, amountAMin, amountBMin);
            TransferHelper.safeTransferFrom(addParams.tokenA, msg.sender, pairA2B, amountA);
            TransferHelper.safeTransferFrom(addParams.tokenB, msg.sender, pairA2B, amountB);
            liquidityAAB = IFeSwapPair(pairA2B).mint(to);
        }
        if(addParams.ratio != uint(100)) {
            address pairB2A; 
            uint liquidityA = addParams.amountADesired - amountA; 
            uint liquidityB = addParams.amountBDesired - amountB;
            uint amountAMin = (addParams.amountAMin > amountA) ? (addParams.amountAMin - amountA) : 0 ; 
            uint amountBMin = (addParams.amountBMin > amountB) ? (addParams.amountBMin - amountB) : 0 ;
            (liquidityB, liquidityA, pairB2A) = 
                        _addLiquidity(addParams.tokenB, addParams.tokenA, liquidityB, liquidityA, amountBMin, amountAMin);
            TransferHelper.safeTransferFrom(addParams.tokenA, msg.sender, pairB2A, liquidityA);
            TransferHelper.safeTransferFrom(addParams.tokenB, msg.sender, pairB2A, liquidityB);
            liquidityABB = IFeSwapPair(pairB2A).mint(to);
            amountA += liquidityA;
            amountB += liquidityB;
        }
    }

    function addLiquidityETH(   AddLiquidityETHParams calldata addParams,
                                address to,
                                uint deadline )
                external virtual override payable ensure(deadline) 
                returns (uint amountToken, uint amountETH, uint liquidityTTE, uint liquidityTEE) 
    {
        require(addParams.ratio <= 100,  'FeSwap: RATIO EER');
        if(addParams.ratio != uint(0)) {        
            address pairTTE;
            uint liquidityToken = addParams.amountTokenDesired.mul(addParams.ratio)/100; 
            uint liquidityETH   = msg.value.mul(addParams.ratio)/100;
            uint amountTokenMin = addParams.amountTokenMin.mul(addParams.ratio)/100; 
            uint amountETHMin   = addParams.amountETHMin.mul(addParams.ratio)/100;
            (amountToken, amountETH, pairTTE) =
                        _addLiquidity(addParams.token, WETH, liquidityToken, liquidityETH, amountTokenMin, amountETHMin);
            TransferHelper.safeTransferFrom(addParams.token, msg.sender, pairTTE, amountToken);
            IWETH(WETH).deposit{value: amountETH}();
            assert(IWETH(WETH).transfer(pairTTE, amountETH));
            liquidityTTE = IFeSwapPair(pairTTE).mint(to);
        }
        if(addParams.ratio != uint(100)){
            address pairTEE;
            uint liquidityToken = addParams.amountTokenDesired - amountToken; 
            uint liquidityETH   = msg.value - amountETH;
            uint amountTokenMin = (addParams.amountTokenMin > amountToken) ? (addParams.amountTokenMin - amountToken) : 0 ;
            uint amountETHMin   = (addParams.amountETHMin > amountETH) ? (addParams.amountETHMin - amountETH) : 0 ;
            (liquidityETH, liquidityToken, pairTEE) = 
                    _addLiquidity(WETH, addParams.token, liquidityETH,  liquidityToken, amountETHMin, amountTokenMin);
            TransferHelper.safeTransferFrom(addParams.token, msg.sender, pairTEE, liquidityToken);
            IWETH(WETH).deposit{value: liquidityETH}();
            assert(IWETH(WETH).transfer(pairTEE, liquidityETH));
            liquidityTEE = IFeSwapPair(pairTEE).mint(to);     
            amountToken += liquidityToken;
            amountETH   += liquidityETH;       
        }

        // refund dust eth, if any
        if (msg.value > amountETH) TransferHelper.safeTransferETH(msg.sender, msg.value - amountETH);
    }

    // **** REMOVE LIQUIDITY ****
    function removeLiquidity(
        RemoveLiquidityParams calldata removeParams,
        address to,
        uint deadline
    ) public virtual override ensure(deadline) returns (uint amountA, uint amountB) {
        if(removeParams.liquidityAAB != uint(0)) {
            address pairAAB = FeSwapLibrary.pairFor(factory, removeParams.tokenA, removeParams.tokenB);
            IFeSwapPair(pairAAB).transferFrom(msg.sender, pairAAB, removeParams.liquidityAAB);  // send liquidity to pair
            (amountA, amountB) = IFeSwapPair(pairAAB).burn(to);
        }
        if(removeParams.liquidityABB != uint(0)) {
            address pairABB = FeSwapLibrary.pairFor(factory, removeParams.tokenB, removeParams.tokenA);
            IFeSwapPair(pairABB).transferFrom(msg.sender, pairABB, removeParams.liquidityABB);  // send liquidity to pair
            (uint amountB0, uint amountA0) = IFeSwapPair(pairABB).burn(to);
            amountA += amountA0;
            amountB += amountB0;
        }
        require(amountA >= removeParams.amountAMin, 'FeSwapRouter: INSUFFICIENT_A_AMOUNT');
        require(amountB >= removeParams.amountBMin, 'FeSwapRouter: INSUFFICIENT_B_AMOUNT');
    }

    function removeLiquidityETH(
        RemoveLiquidityParams calldata removeParams,
        address to,
        uint deadline
    ) public virtual override ensure(deadline) returns (uint amountToken, uint amountETH) {
        require(removeParams.tokenB == WETH,  'FeSwap: WRONG WETH');
        (amountToken, amountETH) = removeLiquidity(
            removeParams,    
            address(this),
            deadline
        );
        TransferHelper.safeTransfer(removeParams.tokenA, to, amountToken);
        IWETH(WETH).withdraw(amountETH);
        TransferHelper.safeTransferETH(to, amountETH);
    }

    function removePermit(
        RemoveLiquidityParams calldata removeParams,
        uint deadline,
        bool approveMax, 
        Signature   calldata sigAAB,
        Signature   calldata sigABB
    ) internal {
        if(sigAAB.s != 0){
            address pairAAB = FeSwapLibrary.pairFor(factory, removeParams.tokenA, removeParams.tokenB);
            uint value = approveMax ? type(uint256).max : removeParams.liquidityAAB; 
            IFeSwapPair(pairAAB).permit(msg.sender, address(this), value, deadline, sigAAB.v, sigAAB.r, sigAAB.s);
        }
        if(sigABB.s != 0){
            address pairABB = FeSwapLibrary.pairFor(factory, removeParams.tokenB, removeParams.tokenA);
            uint value = approveMax ? type(uint256).max : removeParams.liquidityABB; 
            IFeSwapPair(pairABB).permit(msg.sender, address(this), value, deadline, sigABB.v, sigABB.r, sigABB.s);
        }    
    }

    function removeLiquidityWithPermit(
        RemoveLiquidityParams calldata removeParams,
        address to,
        uint deadline,
        bool approveMax, 
        Signature   calldata sigAAB,
        Signature   calldata sigABB
    ) external virtual override returns (uint amountA, uint amountB) {
        removePermit(removeParams, deadline, approveMax, sigAAB, sigABB);
        (amountA, amountB) = removeLiquidity(removeParams, to, deadline);
    }

    function removeLiquidityETHWithPermit(
        RemoveLiquidityParams calldata removeParams,
        address to,
        uint deadline,
        bool approveMax, 
        Signature   calldata sigTTE,
        Signature   calldata sigTEE
    ) external virtual override returns (uint amountToken, uint amountETH) {
        removePermit(removeParams, deadline, approveMax, sigTTE, sigTEE);
        (amountToken, amountETH) = removeLiquidityETH(removeParams, to, deadline);
    }

    // **** REMOVE LIQUIDITY (supporting deflation tokens) ****
    function removeLiquidityETHFeeOnTransfer(
        RemoveLiquidityParams calldata removeParams,
        address to,
        uint deadline
    ) public virtual override ensure(deadline) returns (uint amountETH) {
        require(removeParams.tokenB == WETH,  'FeSwap: WRONG WETH');
        uint amountToken;
        uint balanceToken;
        (amountToken, amountETH) = removeLiquidity( removeParams,    
                                                    address(this),
                                                    deadline );
        balanceToken = IERC20(removeParams.tokenA).balanceOf(address(this));
        if(balanceToken < amountToken) amountToken = balanceToken;
        TransferHelper.safeTransfer(removeParams.tokenA, to, amountToken);
        IWETH(WETH).withdraw(amountETH);
        TransferHelper.safeTransferETH(to, amountETH);
    }

    function removeLiquidityETHWithPermitFeeOnTransfer(
        RemoveLiquidityParams calldata removeParams,
        address to,
        uint deadline,
        bool approveMax, 
        Signature   calldata sigTTE,
        Signature   calldata sigTEE
    ) external virtual override returns (uint amountETH) {
        removePermit(removeParams, deadline, approveMax, sigTTE, sigTEE);
        amountETH = removeLiquidityETHFeeOnTransfer(removeParams, to, deadline);
    }

    // **** SWAP ****
    // requires the initial amount to have already been sent to the first pair
    function _swap(uint[] memory amounts, address[] memory path, address _to) internal virtual {
        for (uint i = 0; i < path.length - 1; i++) {
            (address tokenInput, address tokenOutput) = (path[i], path[i + 1]);
            uint amountOut = amounts[i + 1];
            address to = i < path.length - 2 ? FeSwapLibrary.pairFor(factory, tokenOutput, path[i + 2]) : _to;
            IFeSwapPair(FeSwapLibrary.pairFor(factory, tokenInput, tokenOutput))
                .swap(amountOut, to, new bytes(0));
        }
    }

    function swapExactTokensForTokens(
        uint amountIn,
        uint amountOutMin,
        address[] calldata path,
        address to,
        uint deadline
    ) external virtual override ensure(deadline) returns (uint[] memory amounts) {
        address firstPair;
        (firstPair, amounts) = FeSwapLibrary.getAmountsOut(factory, amountIn, path);
        require(amounts[amounts.length - 1] >= amountOutMin, 'FeSwapRouter: INSUFFICIENT_OUTPUT_AMOUNT');
        TransferHelper.safeTransferFrom(path[0], msg.sender, firstPair , amountIn);
        _swap(amounts, path, to);
    }

    function swapTokensForExactTokens(
        uint amountOut,
        uint amountInMax,
        address[] calldata path,
        address to,
        uint deadline
    ) external virtual override ensure(deadline) returns (uint[] memory amounts) {
        address firstPair;
        (firstPair, amounts) = FeSwapLibrary.getAmountsIn(factory, amountOut, path);
        uint amountsTokenIn = amounts[0];
        require(amountsTokenIn <= amountInMax, 'FeSwapRouter: EXCESSIVE_INPUT_AMOUNT');
        TransferHelper.safeTransferFrom(path[0], msg.sender, firstPair, amountsTokenIn);
        _swap(amounts, path, to);
    }

    function swapExactETHForTokens(uint amountOutMin, address[] calldata path, address to, uint deadline)
        external virtual override payable ensure(deadline)
        returns (uint[] memory amounts)
    {
        require(path[0] == WETH, 'FeSwapRouter: INVALID_PATH');
        address firstPair;
        (firstPair, amounts) = FeSwapLibrary.getAmountsOut(factory, msg.value, path);
        require(amounts[amounts.length - 1] >= amountOutMin, 'FeSwapRouter: INSUFFICIENT_OUTPUT_AMOUNT');
        IWETH(WETH).deposit{value: msg.value}();
        assert(IWETH(WETH).transfer(firstPair, msg.value));
        _swap(amounts, path, to);
    }

    function swapTokensForExactETH(uint amountOut, uint amountInMax, address[] calldata path, address to, uint deadline)
        external virtual override ensure(deadline)
        returns (uint[] memory amounts)
    {
        require(path[path.length - 1] == WETH, 'FeSwapRouter: INVALID_PATH');
        address firstPair;
        (firstPair, amounts) = FeSwapLibrary.getAmountsIn(factory, amountOut, path);
        require(amounts[0] <= amountInMax, 'FeSwapRouter: EXCESSIVE_INPUT_AMOUNT');
        TransferHelper.safeTransferFrom(path[0], msg.sender, firstPair, amounts[0]);
        _swap(amounts, path, address(this));
        IWETH(WETH).withdraw(amountOut);
        TransferHelper.safeTransferETH(to, amountOut);
    }

    function swapExactTokensForETH(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline)
        external virtual override ensure(deadline)
        returns (uint[] memory amounts)
    {
        require(path[path.length - 1] == WETH, 'FeSwapRouter: INVALID_PATH');
        address firstPair;
        (firstPair, amounts) = FeSwapLibrary.getAmountsOut(factory, amountIn, path);
        uint amountsETHOut = amounts[amounts.length - 1];
        require(amountsETHOut >= amountOutMin, 'FeSwapRouter: INSUFFICIENT_OUTPUT_AMOUNT');
        TransferHelper.safeTransferFrom(path[0], msg.sender, firstPair, amountIn);
        _swap(amounts, path, address(this));
        IWETH(WETH).withdraw(amountsETHOut);
        TransferHelper.safeTransferETH(to, amountsETHOut);
    }

    function swapETHForExactTokens(uint amountOut, address[] calldata path, address to, uint deadline)
        external virtual override payable ensure(deadline)
        returns (uint[] memory amounts)
    {
        require(path[0] == WETH, 'FeSwapRouter: INVALID_PATH');
        address firstPair;
        (firstPair, amounts) = FeSwapLibrary.getAmountsIn(factory, amountOut, path);
        uint amountsETHIn = amounts[0];
        require(amountsETHIn <= msg.value, 'FeSwapRouter: EXCESSIVE_INPUT_AMOUNT');
        IWETH(WETH).deposit{value: amountsETHIn}();
        assert(IWETH(WETH).transfer(firstPair, amountsETHIn));
        _swap(amounts, path, to);
        // refund dust eth, if any
        if (msg.value > amountsETHIn) TransferHelper.safeTransferETH(msg.sender, msg.value - amountsETHIn);
    }

    // **** SWAP (supporting fee-on-transfer tokens) ****
    // requires the initial amount to have already been sent to the first pair
    function _swapTokensFeeOnTransfer(address[] memory path, address _to) internal virtual {
        for (uint i = 0; i < path.length - 1; i++) {
            (address input, address output) = (path[i], path[i + 1]);
            (uint reserveInput, uint reserveOutput, address pair) = FeSwapLibrary.getReserves(factory, input, output);
            uint amountInput = IERC20(input).balanceOf(pair).sub(reserveInput);
            uint amountOutput = FeSwapLibrary.getAmountOut(amountInput, reserveInput, reserveOutput);
            address to = i < path.length - 2 ? FeSwapLibrary.pairFor(factory, output, path[i + 2]) : _to;
            IFeSwapPair(pair).swap(amountOutput, to, new bytes(0));
        }
    }

    function swapExactTokensForTokensFeeOnTransfer(
        uint amountIn,
        uint amountOutMin,
        address[] calldata path,
        address to,
        uint deadline
    ) external virtual override ensure(deadline) {
        FeSwapLibrary.executeArbitrage(factory, path);
        TransferHelper.safeTransferFrom(path[0], msg.sender, FeSwapLibrary.pairFor(factory, path[0], path[1]), amountIn);
        uint balanceBefore = IERC20(path[path.length - 1]).balanceOf(to);
        _swapTokensFeeOnTransfer(path, to);
        require(IERC20(path[path.length - 1]).balanceOf(to).sub(balanceBefore) >= amountOutMin,
                'FeSwapRouter: INSUFFICIENT_OUTPUT_AMOUNT');
    }

    function swapExactETHForTokensFeeOnTransfer(
        uint amountOutMin,
        address[] calldata path,
        address to,
        uint deadline
    ) external virtual override payable ensure(deadline) {
        require(path[0] == WETH, 'FeSwapRouter: INVALID_PATH');
        FeSwapLibrary.executeArbitrage(factory, path);
        IWETH(WETH).deposit{value: msg.value}();
        assert(IWETH(WETH).transfer(FeSwapLibrary.pairFor(factory, path[0], path[1]), msg.value));
        uint balanceBefore = IERC20(path[path.length - 1]).balanceOf(to);
        _swapTokensFeeOnTransfer(path, to);
        require(IERC20(path[path.length - 1]).balanceOf(to).sub(balanceBefore) >= amountOutMin,
                'FeSwapRouter: INSUFFICIENT_OUTPUT_AMOUNT');
    }

    function swapExactTokensForETHFeeOnTransfer(
        uint amountIn,
        uint amountOutMin,
        address[] calldata path,
        address to,
        uint deadline
    ) external virtual override ensure(deadline) {
        require(path[path.length - 1] == WETH, 'FeSwapRouter: INVALID_PATH');
        FeSwapLibrary.executeArbitrage(factory, path);
        TransferHelper.safeTransferFrom(path[0], msg.sender, FeSwapLibrary.pairFor(factory, path[0], path[1]), amountIn);
        _swapTokensFeeOnTransfer(path, address(this));
        uint amountOut = IERC20(WETH).balanceOf(address(this));
        require(amountOut >= amountOutMin, 'FeSwapRouter: INSUFFICIENT_OUTPUT_AMOUNT');
        IWETH(WETH).withdraw(amountOut);
        TransferHelper.safeTransferETH(to, amountOut);
    }

    // **** LIBRARY FUNCTIONS ****
    function quote(uint amountA, uint reserveA, uint reserveB) 
                public pure virtual override returns (uint amountB) 
    {
        return FeSwapLibrary.quote(amountA, reserveA, reserveB);
    }

    function getAmountOut(uint amountIn, uint reserveIn, uint reserveOut)
                public pure virtual override returns (uint amountOut)
    {
        return FeSwapLibrary.getAmountOut(amountIn, reserveIn, reserveOut);
    }

    function getAmountIn(uint amountOut, uint reserveIn, uint reserveOut)
                public pure virtual override returns (uint amountIn)
    {
        return FeSwapLibrary.getAmountIn(amountOut, reserveIn, reserveOut);
    }

    function estimateAmountsOut(uint amountIn, address[] calldata path)
                public view virtual override returns (uint[] memory amounts)
    {
        return FeSwapLibrary.estimateAmountsOut(factory, amountIn, path);
    }

    function estimateAmountsIn(uint amountOut, address[] calldata path)
                public view virtual override returns (uint[] memory amounts)
    {
        return FeSwapLibrary.estimateAmountsIn(factory, amountOut, path);
    }
}