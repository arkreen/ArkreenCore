// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

struct GreenBTCInfo {
    uint128     height;
    uint128     ARTCount;
    address     minter;             // Minter of the respective NFT
    uint8       greenType;          // High nibble:  ART type: 0, CART, 1, Arkreen ART; Low nibble: mint type, 1: system, 2: user;
    string      blockTime;          // For NFT display
    string      energyStr;          // For NFT display
}

struct NFTStatus {
    address     opener;
    uint64      blockHeight;
    bool        open;
    bool        reveal;
    bool        won;
    uint8       ratioSubsidy;       // ratio of the subsidy from GreenBTC, 0-90 in percentage 
    uint256     seed;
}

struct OpenInfo {
    uint64      tokenID;            // The token ID of the NFT opened
    uint64      openHeight;         // The height of the block opening the NFT
}

struct Sig {
    uint8       v;
    bytes32     r;
    bytes32     s;              
}

struct PayInfo {
    address     token;
    uint256     amount;
}

struct BadgeInfo {
    address     beneficiary;
    string      offsetEntityID;
    string      beneficiaryID;
    string      offsetMessage;
}