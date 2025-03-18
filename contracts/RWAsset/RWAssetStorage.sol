// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "./RWAssetType.sol";

abstract contract RWAssetStorage
{
    // Constants
    // keccak256("WithdrawDeposit(uint256 assetId,address owner,uint256 amount,uint256 deadline)");
    bytes32 public constant WITHDRAW_DEPOSIT_TYPEHASH = 0x13A85DF7BA3E360145D037DDF19961B9D6DD67577B03674D20BBB74BA15C259E;  

    // Public variables
    bytes32 public DOMAIN_SEPARATOR;
    address public tokenAKRE;                           // Token adddress of AKRE
    address public assetAuthority;                      // The entity doing authorization
    address public assetManager;                        // The enity managing the asset operating process on blockchain
    address public fundReceiver;                        // The enity address receiving the asset repayment monthly
    address public slashReceiver;                       // The enity address receiving the slash and clearance AKRE 
    address public oracleSwapPair;                      // The address of the swap pair serving the AKRE price
    address public assetPro;                            // The address of the asset pro 

    GlobalStatus public globalStatus;                           // Global asset status
    mapping(uint16 => AssetType) public assetTypes;             // All asset type that have been defined,  type -> type info
    mapping(address => AssetStatus) public userInfo;            // user information, user address -> user info
    mapping(uint32 => AssetDetails) public assetList;           // All asset list, asset id -> asset details
    mapping(uint32 => RepayDetails) public assetRepayStatus;    // All asset repaymnet status, asset id -> asset details
    mapping(uint32 => ClearanceDetails) public assetClearance;  // All asset clearance information, asset id -> asset clearance information

    mapping(address => uint32[]) public userAssetList;          // user asset list, user -> asset list, assuming the list is not long
    mapping(uint256 => bytes32) public deliveryProofList;       // all delivery proof list, proof id -> delivery proof 

    mapping(uint16 => InvestToken) public allInvestTokens;      // all tokens accepted for investing
    mapping(uint8 => InterestRate) public allInterestRates;    // all interest rates

    mapping(address => uint48[]) public userInvestList;         // user invest list, user -> investing index list, assuming the list is not long

    // investing index = (asset id (4Bytes B28-B30) || investing serial number (2 Bytes, B31-B32)) 
    // mapping (investing index) -> investList
    mapping(uint48 => Invest) public investList;
}
