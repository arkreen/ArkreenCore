// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "../ArkreenRECIssuanceType.sol";

interface IArkreenRECIssuance {
    function baseURI() external view returns (string memory);
    function getRECData(uint256 tokenId) external view returns (RECData memory);
    function getRECDataCore(uint256 tokenId) external view 
                            returns(address issuer, uint128 amountREC, uint8 status, uint16 idAsset); 
    function safeTransferFrom(address from, address to, uint256 tokenId) external;
    function safeTransferFrom(address from, address to, uint256 tokenId, bytes memory data) external;
}