// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "./IFeSwapERC20.sol";

interface IFeSwapPair is IFeSwapERC20 {
    function MINIMUM_LIQUIDITY() external pure returns (uint);
    function factory() external view returns (address);
    function pairOwner() external view returns (address);
    function tokenIn() external view returns (address);
    function tokenOut() external view returns (address);
    function getReserves() external view returns ( uint112 _reserveIn, uint112 _reserveOut, uint32 _blockTimestampLast);
    function getReservesWithRate() external view returns ( uint112 _reserveIn, uint112 _reserveOut, uint _rateArbitrage);
    function getOracleInfo() external view returns (uint, uint, uint);
    
    function mint(address to) external returns (uint liquidity);
    function burn(address to) external returns (uint amount0, uint amount1);
    function swap(uint amountOut, address to, bytes calldata data) external;
    function skim(address to) external;
    function sync() external;

    function initialize(address, address, uint, uint) external;
}