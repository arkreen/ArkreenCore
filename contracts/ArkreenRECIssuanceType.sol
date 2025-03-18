// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

enum RECStatus {
  Pending,            // 0
  Rejected,           // 1
  Cancelled,          // 2
  Certified,          // 3
  Retired,            // 4
  Liquidized          // 5
}

struct Signature {
    address     token;
    uint256     value;
    uint256     deadline;  
    uint8       v;
    bytes32     r;
    bytes32     s;              
}

struct PayInfo {
    address     token;
    uint256     value;
}

struct RECRequest {
    address   issuer;
    uint32    startTime;
    uint32    endTime;
    uint128   amountREC;
    string    cID;
    string    region;      
    string    url;
    string    memo;
} 

struct RECData {
    address   issuer;
    string    serialNumber;
    address   minter;
    uint32    startTime;
    uint32    endTime;
    uint128   amountREC;
    uint8     status;
    string    cID;
    string    region;
    string    url;
    string    memo;
    uint16    idAsset;
}

struct ARECAmount {
    uint256   ARECID;
    uint128   amountREC;
}

struct RECMintPrice {
    address   token;
    uint256   value;
}
