// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "../libraries/TickMath.sol";

contract UniTool {
    function getSqrtRatioAtTick(int24 tick) public pure returns (uint160 sqrtPriceX96) {
      return TickMath.getSqrtRatioAtTick(tick);   
    }

    function getTickAtSqrtRatio(uint160 sqrtPriceX96) public pure returns (int24 tick) {
      return TickMath.getTickAtSqrtRatio(sqrtPriceX96);
    }

    function getPriceAtTick(int24 tick) public pure returns (uint256 price) {
      uint160 sqrtPriceX96 = getSqrtRatioAtTick(tick);
      price = getPriceAtSqrtRatio(sqrtPriceX96);
    }

    function getPriceAtSqrtRatio(uint160 sqrtPriceX96) public pure returns (uint256 price) {
      price = (1 << 192) * 1e18 / sqrtPriceX96;
      price = price * 1e12 / sqrtPriceX96;
    }
}

