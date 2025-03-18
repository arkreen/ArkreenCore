// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

interface IArkreenRECToken {
    function getRatioFeeOffset() external view returns (uint256);
    function commitOffset(uint256) external returns (uint256); 
    function commitOffsetFrom(address, uint256) external returns (uint256);     
    function offsetAndMintCertificate(  address beneficiary, string calldata offsetEntityID,
                                        string calldata beneficiaryID, string calldata offsetMessage, uint256 amount) external;
}