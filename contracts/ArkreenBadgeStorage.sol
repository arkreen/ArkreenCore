// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "./ArkreenBadgeType.sol";  
import "./interfaces/IArkreenBadgeImage.sol";

abstract contract ArkreenBadgeStorage {
    string public baseURI;
    uint256 public minOffsetAmount;

    address public arkreenRegistry;                // contracts storing all miner's ownership        

    /// @dev Counter of total offset action, also the id tracks the offset action
    uint256 public offsetCounter;

    /// @dev Total redeemed REC amount
    uint256 public totalRedeemed;

    /// @dev Total offset AREC amount registered in offset actions
    uint256 public totalOffsetRegistered;

    /// @dev Total offset AREC amount retired in AREC retiremment certificateion
    uint256 public totalOffsetRetired;    
      
    /// @dev mapping from offsetCounter to OffsetAction data
    mapping(uint256 => OffsetAction) public offsetActions;

    /// @dev List all the offset action ids belonging to user
    mapping(address => uint256[]) public userActions;

    mapping(uint256 => OffsetRecord) public certificates;               // Retirement Badges

    mapping(address => uint256) public partialARECIDBridge;             // ID of AREC NFT already partialy offset as AREC bridge
    mapping(address => uint256) public partialAvailableAmountBridge;    // Amount available for partial offset of AREC bridge

    uint256 public detailsCounter;
    mapping(uint256 => OffsetDetail[]) public OffsetDetails;

    mapping(address => uint256) public partialARECIDExt;                // AREC NFT ID already partialy offset, from REC Token to ID
    mapping(address => uint256) public partialAvailableAmountExt;       // Amount available for partial offset, from REC Token to Amount

    mapping(uint256 => string) public cidBadge; 

    IArkreenBadgeImage public arkreenBadgeImage;
}
