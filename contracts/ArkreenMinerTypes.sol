// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

enum MinerType {
    SKIP_0,
    LiteMiner,                // 1
    StandardMiner,            // 2
    RemoteMiner,              // 3
    APIMiner,                 // 4
    SocketMiner,              // 5
    SKIP_6,                   // 6
    SKIP_7,                   // 7
    SKIP_8,                   // 8
    PlantMiner               // 9
}

enum MinerStatus {
    Pending,            // 0
    Normal,             // 1
    Locked,             // 2
    Terminated          // 3
}

struct Miner {
    address         mAddress;
//  MinerType       mType;
    uint8           mType;
    MinerStatus     mStatus;
    uint32          timestamp;
}    

enum MinerManagerType {
    Miner_Manager,        // 0
    Register_Authority,   // 1
    Payment_Receiver,     // 2
    Airdrop_Authority     // 3
}

struct Signature {
    address     token;
    uint256     value;
    uint256     deadline;  
    uint8       v;
    bytes32     r;
    bytes32     s;              
}

struct Sig {
    uint8       v;
    bytes32     r;
    bytes32     s;              
}