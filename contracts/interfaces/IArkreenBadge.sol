// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

interface IArkreenBadge {
    function registerOffset(address, address, uint256, uint256) external returns (uint256);
    function mintCertificate(address, address, string calldata, string calldata,
                              string calldata, uint256[] calldata) external;
    function getDetailStatus(address) external view returns (uint256, uint256);
    function getBridgeDetailStatus(address) external view returns (uint256, uint256);
    function registerDetail(uint256 amount, uint256 tokenId, bool bNew) external returns (uint256, uint256);    
}