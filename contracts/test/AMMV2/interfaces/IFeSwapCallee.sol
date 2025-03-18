// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

interface IFeSwapCallee {
    function FeSwapCall(address sender, uint amountOut, bytes calldata data) external;
}