// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

/// @dev  ArkreenRegistryStorage is to store system critical information
contract ArkreenRegistryStorage {

    struct IssuerStatus {
        bool      added;
        uint64    addTime;
        uint64    removeTime;
        address   tokenREC;
        string    issuerId;
    }

    struct AssetAREC {
        string      idAsset;        
        address     issuer;        
        address     tokenREC;
        address     tokenPay;
        uint128     rateToIssue;                // Calculated based on 1 AREC, 10**9
        uint16      rateToLiquidize;            // Calculated based on 10000
        bool        bActive;
        string      description;
    }

    // Arkreen Miner Contact Address
    address internal arkreenMiner;

    // Arkreen REC Issuance Contact Address
    address internal arkreenRECIssuance;

    // Arkreen REC Retirement Contract Address
    address internal arkreenRECRetirement;
    
    // REC issuers
    uint256 public numIssuers;
    mapping(address => IssuerStatus) public recIssuers;     // REC issuer -> IssuerStatus
    mapping(address => address) public tokenRECs;           // mapping token to issuer
    mapping(uint256 => address) public allIssuers;          // All Issuers
    uint256 public numAsset;
    mapping(uint256 => AssetAREC) public allAssets;          // All assets
}
