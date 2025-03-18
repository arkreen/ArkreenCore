// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;
pragma experimental ABIEncoderV2;

interface IFeSwapRouter {

    struct AddLiquidityParams {
        address tokenA;
        address tokenB;
        uint    amountADesired;
        uint    amountBDesired;
        uint    amountAMin;
        uint    amountBMin;
        uint    ratio;
    }

    struct AddLiquidityETHParams {
        address token;
        uint    amountTokenDesired;
        uint    amountTokenMin;
        uint    amountETHMin;
        uint    ratio;
    }

    struct RemoveLiquidityParams {
        address tokenA;
        address tokenB;
        uint    liquidityAAB;
        uint    liquidityABB;        
        uint    amountAMin;
        uint    amountBMin;
    }

    struct Signature {
        uint8       v;
        bytes32     r;
        bytes32     s;
    }

//    function factory() external view returns (address);
//    function WETH() external view returns (address);

    function addLiquidity(
        AddLiquidityParams calldata addParams,
        address to,
        uint deadline
    ) external returns (uint amountA, uint amountB, uint liquidityAAB, uint liquidityABB);

    function addLiquidityETH(
        AddLiquidityETHParams calldata addParams,
        address to,
        uint deadline
    ) external payable returns (uint amountToken, uint amountETH, uint liquidityTTE, uint liquidityTEE);

    function removeLiquidity(
        RemoveLiquidityParams calldata removeParams,
        address to,
        uint deadline
    ) external returns (uint amountA, uint amountB);

    function removeLiquidityETH(
        RemoveLiquidityParams calldata removeParams,
        address to,
        uint deadline
    ) external returns (uint amountToken, uint amountETH);

    function removeLiquidityWithPermit(
        RemoveLiquidityParams calldata removeParams,
        address to,
        uint deadline,
        bool approveMax, 
        Signature   calldata sigAAB,
        Signature   calldata sigABB
    ) external returns (uint amountA, uint amountB);        

    function removeLiquidityETHWithPermit(
        RemoveLiquidityParams calldata removeParams,
        address to,
        uint deadline,
        bool approveMax, 
        Signature   calldata sigTTE,
        Signature   calldata sigTEE
    ) external returns (uint amountToken, uint amountETH);

    function removeLiquidityETHFeeOnTransfer(
        RemoveLiquidityParams calldata removeParams,
        address to,
        uint deadline
    ) external returns (uint amountETH);

    function removeLiquidityETHWithPermitFeeOnTransfer(
        RemoveLiquidityParams calldata removeParams,
        address to,
        uint deadline,
        bool approveMax, 
        Signature   calldata sigTTE,
        Signature   calldata sigTEE
    ) external returns (uint amountETH);

    function swapExactTokensForTokens(
        uint amountIn,
        uint amountOutMin,
        address[] calldata path,
        address to,
        uint deadline
    ) external returns (uint[] memory amounts);

    function swapTokensForExactTokens(
        uint amountOut,
        uint amountInMax,
        address[] calldata path,
        address to,
        uint deadline
    ) external returns (uint[] memory amounts);

    function swapExactETHForTokens(
        uint amountOutMin, 
        address[] calldata path, 
        address to, 
        uint deadline
    ) external payable returns (uint[] memory amounts);

    function swapTokensForExactETH(
        uint amountOut,
        uint amountInMax,
        address[] calldata path,
        address to,
        uint deadline
    ) external returns (uint[] memory amounts);

    function swapExactTokensForETH(
        uint amountIn,
        uint amountOutMin,
        address[] calldata path,
        address to,
        uint deadline
    ) external returns (uint[] memory amounts);

    function swapETHForExactTokens(
        uint amountOut,
        address[] calldata path,
        address to,
        uint deadline
    ) external payable returns (uint[] memory amounts);     

    function swapExactTokensForTokensFeeOnTransfer(
        uint amountIn,
        uint amountOutMin,
        address[] calldata path,
        address to,
        uint deadline
    ) external;

    function swapExactETHForTokensFeeOnTransfer(
        uint amountOutMin,
        address[] calldata path,
        address to,
        uint deadline
    ) external payable;

    function swapExactTokensForETHFeeOnTransfer(
        uint amountIn,
        uint amountOutMin,
        address[] calldata path,
        address to,
        uint deadline
    ) external;
    
    function quote(uint amountA, uint reserveA, uint reserveB) external pure returns (uint amountB);
    function getAmountOut(uint amountIn, uint reserveIn, uint reserveOut) external pure returns (uint amountOut);
    function getAmountIn(uint amountOut, uint reserveIn, uint reserveOut) external pure returns (uint amountIn);
    function estimateAmountsOut(uint amountIn, address[] calldata path) external view returns (uint[] memory amounts);
    function estimateAmountsIn(uint amountOut, address[] calldata path) external view returns (uint[] memory amounts);
}