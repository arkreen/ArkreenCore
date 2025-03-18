// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

contract UniV3OracleSimu
{
     // solc-ignore-next-line unused-param
    function observe(uint32[] calldata secondsAgos) external
        pure
        returns (int56[] memory tickCumulatives, uint160[] memory secondsPerLiquidityCumulativeX128s)
    {
        tickCumulatives = new int56[](2);
        secondsPerLiquidityCumulativeX128s = new uint160[](2);
        tickCumulatives[0] = 8194038191843;
        tickCumulatives[1] = 8194244297395;
        secondsPerLiquidityCumulativeX128s[0] = 8801969629938932587124686173;
        secondsPerLiquidityCumulativeX128s[1] = 8801985654803822704166034852;
    }
}