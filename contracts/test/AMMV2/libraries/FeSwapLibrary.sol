// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "../interfaces/IFeSwapPair.sol";
import "../interfaces/IFeSwapFactory.sol";
import "./TransferHelper.sol";
import "./SafeMath.sol";

library FeSwapLibrary {
    using SafeMath for uint;

    // calculates the CREATE2 address for a pair without making any external calls
    function pairFor(address factory, address tokenA, address tokenB) internal pure returns (address pair) {
       pair = address(uint160(uint256(keccak256(abi.encodePacked(
                hex'ff',
                factory,
                keccak256(abi.encodePacked(tokenA, tokenB)),
                hex'61ba50a567aed79f740c2a36f5fb032b17a57707506d4890ccec01a00a16129a' // init code hash // save 9916 gas
            )))));
    }
//    61ba50a567aed79f740c2a36f5fb032b17a57707506d4890ccec01a00a16129a
//    62a5b6c40cb3aa9eaf4ddaafa2a38ceea7440a0080e5730ab156a7f484e7be01
//    7aa8464d8ac14b76fb2c0b86c2a76d577b4b0e799422728bff419da91438af36    // org

    // fetches and sorts the reserves for a pair
    function getReserves(address factory, address tokenA, address tokenB) 
                        internal view returns (uint reserveA, uint reserveB, address pair) {
        pair = pairFor(factory, tokenA, tokenB);
        (reserveA, reserveB, ) = IFeSwapPair(pair).getReserves();
    }

    function getReservesWithRate(address factory, address tokenA, address tokenB) 
                        internal view returns (uint reserveA, uint reserveB, address pair, uint rateTriggerArbitrage) {
        pair = pairFor(factory, tokenA, tokenB);
        (reserveA, reserveB, rateTriggerArbitrage) = IFeSwapPair(pair).getReservesWithRate();
    }

    // given some amount of an asset and pair reserves, returns an equivalent amount of the other asset
    function quote(uint amountA, uint reserveA, uint reserveB) internal pure returns (uint amountB) {
        require(amountA > 0, 'FeSwapLibrary: INSUFFICIENT_AMOUNT');
        require(reserveA > 0 && reserveB > 0, 'FeSwapLibrary: INSUFFICIENT_LIQUIDITY');
        amountB = amountA.mul(reserveB) / reserveA;
    }

    // given an input amount of an asset and pair reserves, returns the maximum output amount of the other asset
    function getAmountOut(uint amountIn, uint reserveIn, uint reserveOut) internal pure returns (uint amountOut) {
        require(amountIn > 0, 'FeSwapLibrary: INSUFFICIENT_INPUT_AMOUNT');
        require(reserveIn > 0 && reserveOut > 0, 'FeSwapLibrary: INSUFFICIENT_LIQUIDITY');
        uint numerator = amountIn.mul(reserveOut);
        uint denominator = reserveIn.add(amountIn);
        amountOut = numerator / denominator;
    }

    // given an output amount of an asset and pair reserves, returns a required input amount of the other asset
    function getAmountIn(uint amountOut, uint reserveIn, uint reserveOut) internal pure returns (uint amountIn) {
        require(amountOut > 0, 'FeSwapLibrary: INSUFFICIENT_OUTPUT_AMOUNT');
        require(reserveIn > 0 && reserveOut > 0, 'FeSwapLibrary: INSUFFICIENT_LIQUIDITY');
        uint numerator = reserveIn.mul(amountOut);
        uint denominator = reserveOut.sub(amountOut);
        amountIn = (numerator.add(denominator)) / denominator;
    }

    function arbitragePairPools(address factory, address tokenA, address tokenB) 
                                    internal returns (uint reserveIn, uint reserveOut, address pair) {
        (reserveIn, reserveOut, pair) = getReserves(factory, tokenA, tokenB);
        (uint reserveInMate, uint reserveOutMate, address PairMate, uint rateTriggerArbitrage) = getReservesWithRate(factory, tokenB, tokenA); 
        uint productIn = uint(reserveIn).mul(reserveInMate);
        uint productOut = uint(reserveOut).mul(reserveOutMate);
        if(productIn.mul(10000) > productOut.mul(rateTriggerArbitrage)){                 
            productIn = productIn.sub(productOut);                                  // productIn are re-used
            uint totalTokenA = (uint(reserveIn).add(reserveOutMate)).mul(2);               
            uint totalTokenB = (uint(reserveOut).add(reserveInMate)).mul(2);
            TransferHelper.safeTransferFrom(tokenA, pair, PairMate, productIn / totalTokenB);          
            TransferHelper.safeTransferFrom(tokenB, PairMate, pair, productIn / totalTokenA); 
            IFeSwapPair(pair).sync();
            IFeSwapPair(PairMate).sync();
            (reserveIn, reserveOut, ) = getReserves(factory, tokenA, tokenB);
        }
    }   

    function culculatePairPools(address factory, address tokenA, address tokenB) internal view returns (uint reserveIn, uint reserveOut, address pair) {
        (reserveIn, reserveOut, pair) = getReserves(factory, tokenA, tokenB);
        (uint reserveInMate, uint reserveOutMate, , uint rateTriggerArbitrage) = getReservesWithRate(factory, tokenB, tokenA); 
        uint productIn = uint(reserveIn).mul(reserveInMate);
        uint productOut = uint(reserveOut).mul(reserveOutMate);
        if(productIn.mul(10000) > productOut.mul(rateTriggerArbitrage)){                 
            productIn = productIn.sub(productOut);
            uint totalTokenA = (uint(reserveIn).add(reserveOutMate)).mul(2);               
            uint totalTokenB = (uint(reserveOut).add(reserveInMate)).mul(2);
            reserveIn = reserveIn.sub(productIn / totalTokenB);
            reserveOut = reserveOut.add(productIn / totalTokenA);
        }
    }   

    // performs chained getAmountOut calculations on any number of pairs
    function getAmountsOut(address factory, uint amountIn, address[] calldata path) internal returns (address firstPair, uint[] memory amounts) {
        require(path.length >= 2, 'FeSwapLibrary: INVALID_PATH');
        amounts = new uint[](path.length);
        amounts[0] = amountIn;
        for (uint i = 0; i < path.length - 1; i++) {
            (uint reserveIn, uint reserveOut, address _firstPair) = arbitragePairPools(factory, path[i], path[i + 1]);
            amounts[i + 1] = getAmountOut(amounts[i], reserveIn, reserveOut);
            if ( i == 0 ) firstPair = _firstPair;
        }
    }

    // performs aritrage beforehand
    function executeArbitrage(address factory, address[] calldata path) internal {
        require(path.length >= 2, 'FeSwapLibrary: INVALID_PATH');
        for (uint i = 0; i < path.length - 1; i++) {
            arbitragePairPools(factory, path[i], path[i + 1]);
        }
    }

    // performs chained estimateAmountsOut calculations on any number of pairs
    function estimateAmountsOut(address factory, uint amountIn, address[] calldata path) internal view returns (uint[] memory amounts) {
        require(path.length >= 2, 'FeSwapLibrary: INVALID_PATH');
        amounts = new uint[](path.length);
        amounts[0] = amountIn;
        for (uint i = 0; i < path.length - 1; i++) {
            (uint reserveIn, uint reserveOut, ) = culculatePairPools(factory, path[i], path[i + 1]);
            amounts[i + 1] = getAmountOut(amounts[i], reserveIn, reserveOut);
        }
    }

    // performs chained getAmountIn calculations on any number of pairs
    function getAmountsIn(address factory, uint amountOut, address[] calldata path) internal returns (address firstPair, uint[] memory amounts) {
        require(path.length >= 2, 'FeSwapLibrary: INVALID_PATH');
        amounts = new uint[](path.length);
        amounts[amounts.length - 1] = amountOut;
        uint reserveIn;
        uint reserveOut;
        for (uint i = path.length - 1; i > 0; i--) {
            (reserveIn, reserveOut, firstPair) = arbitragePairPools(factory, path[i - 1], path[i]);
            amounts[i - 1] = getAmountIn(amounts[i], reserveIn, reserveOut);
        }
    }

    function estimateAmountsIn(address factory, uint amountOut, address[] calldata path) internal view returns (uint[] memory amounts) {
        require(path.length >= 2, 'FeSwapLibrary: INVALID_PATH');
        amounts = new uint[](path.length);
        amounts[amounts.length - 1] = amountOut;
        for (uint i = path.length - 1; i > 0; i--) {
            (uint reserveIn, uint reserveOut, ) = culculatePairPools(factory, path[i - 1], path[i]);
            amounts[i - 1] = getAmountIn(amounts[i], reserveIn, reserveOut);
        }
    }
}