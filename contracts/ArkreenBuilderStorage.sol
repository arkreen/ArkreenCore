// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "./ArkreenBuilderTypes.sol";  

abstract contract ArkreenBuilderStorage {

    address public routerSwap;            // Address of the DEX router
    address public tokenNative;           // The wrapped token of the Native token, such as WETH, WMATIC

    mapping(address => bool) public trustedForwarders;         // List of trusted Forwarders
    address public artBank;               // Address of the ART sales bank contract

//  mapping(address => mapping(address => twinPair)) public pools;             // ART token => (pair token => two LP pools) 

}