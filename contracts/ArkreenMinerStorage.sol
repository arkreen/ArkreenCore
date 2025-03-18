// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "./ArkreenMinerTypes.sol";

abstract contract ArkreenMinerStorage 
{
    // Constants
    string public constant NAME = "Arkreen Miner";
    string public constant SYMBOL = "AKREM";

    // keccak256("RemoteMinerOnboard(address owner,address miners,address token,uint256 price,uint256 deadline)");
    bytes32 public constant REMOTE_MINER_TYPEHASH = 0xE397EAA556C649D10F65393AC1D09D5AA50D72547C850822C207516865E89E32;  

    // keccak256("RemoteMinerOnboardBatch(address owner,uint256 quantity,address token,uint256 value,uint256 deadline)");
    bytes32 public constant REMOTE_MINER_BATCH_TYPEHASH = 0x9E7E2F63BB8D2E99F3FA05B76080E528E9CA50746A4383CDF2803D633AFF18A6;  

    // keccak256("StandardMinerOnboard(address owner,address miner,uint256 deadline)");
    bytes32 public constant STANDARD_MINER_TYPEHASH = 0x73F94559854A7E6267266A158D1576CBCAFFD8AE930E61FB632F9EC576D2BB37;  

    uint256 public constant MAX_BATCH_SALE = 50;

    // Public variables
    bytes32 public DOMAIN_SEPARATOR;
    uint256 public totalStandardMiner;                  // Total amount of standard miner
    string public baseURI;
    address public tokenAKRE;                           // Token adddress of AKRE
    address public tokenNative;                         // The wrapped token of the Native token, such as WETH, WMATIC

    // All registered miner manufactures
    mapping(address => bool) public AllManufactures;

    // All miner infos
    mapping(uint256 => Miner) public AllMinerInfo;

    // All managers with various privilege
    mapping(uint256 => address) public AllManagers;

    // Mapping from miner address to the respective token ID
    mapping(address => uint256) public AllMinersToken;

    // Miner white list mapping from miner address to miner type
    mapping(address => uint8) public whiteListMiner;

    uint256 public totalSocketMiner;                  // Total amount of socket miner

    // Miner white list for sales in batch, mapping from index to miner address
    mapping(uint256 => address) internal whiteListMinerBatch;
    uint256 internal whiteListBatchIndexHead;                // Not used after upgrading remoteType support, but need to keep
    uint256 internal whiteListBatchIndexTail;                // Not used after upgrading remoteType support, but need to keep

    mapping(uint256 => uint256) public whiteListBatchPoolIndexHead;
    mapping(uint256 => uint256) public whiteListBatchPoolIndexTail;
    mapping(address => uint256) internal claimTimestamp;   // protect againt replay 

    uint256 public totalPlantMiner;                       // Total amount of plant miner
    bool    public bTransferAllowed;                      // Allow miner transfer
    
    address public arkreenMinerPro;                       // Extension of arkreenMiner
    mapping(address => uint256) public listenUsers;       // Listen App ids that need to be called back for the user
    mapping(uint256 => address) public listenApps;        // Listen Apps mapping from appid to address
    mapping(address => uint256) public listenAppIds;      // Listen App Ids mapping from address to appid
}
