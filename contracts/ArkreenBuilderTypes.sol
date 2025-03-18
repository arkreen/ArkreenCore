// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

struct twinPair {
    address     poolAB;
    address     poolBA;
}

struct Signature {
    address     token;
    uint256     value;
    uint256     deadline;  
    uint8       v;
    bytes32     r;
    bytes32     s;              
}

struct SigRegister {
    uint8       v;
    bytes32     r;
    bytes32     s;              
}

struct BadgeInfo {
    address     beneficiary;
    string      offsetEntityID;
    string      beneficiaryID;
    string      offsetMessage;
}