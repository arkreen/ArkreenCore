// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;
pragma experimental ABIEncoderV2;

    enum PoolRunningPhase {
        BidToStart,
        BidPhase, 
        BidDelaying,
        BidSettled,
        PoolHolding, 
        PoolForSale
    }

    struct FeswaPairNFT {
        address tokenA;
        address tokenB;
        uint256 currentPrice;
        uint64  timeCreated;
        uint64  lastBidTime; 
        PoolRunningPhase  poolState;
    }

interface IFeswaNFT {
    // Views
    function ownerOf(uint256 tokenId) external view returns (address owner);
    function getPoolInfo(uint256 tokenId) external view returns (address, FeswaPairNFT memory);
}