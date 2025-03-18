// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

struct OffsetRecord {
    address   offsetEntity;
    address   beneficiary;
    string    offsetEntityID;
    string    beneficiaryID;
    string    offsetMessage;
    uint256   creationTime;
    uint256   offsetTotalAmount;
    uint256[] offsetIds;
}
/**
 * @dev Detailed offset info, both applicable for REC NFT and REC token.
 */
struct OffsetAction {
    address offsetEntity;
    address issuerREC;                    // the ERC20 token can be referred from registed issuer address
    uint128 amount;
    uint64  tokenId;                      // id of the REC NFT, = 0 for REC ERC20 token
    uint56  createdAt;
    bool    bClaimed;
}
struct OffsetDetail {
    uint64  tokenId;                      // id of the REC NFT, = 0 for REC ERC20 token
    uint128 amount;
}
