// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

interface IArkreenRegistry {
    function getArkreenMiner() external view returns (address);
    function recIssuers(address) external view returns (uint256);
    function getRECIssuance() external view returns (address);
    function isRECIssuer(address) external view returns(bool);
    function getRECToken(address, uint256) external view returns (address);
    function tokenRECs(address) external view returns (address);  
    function getArkreenRetirement() external view returns (address);  
    function getAssetInfo(uint256) external view returns (address issuer, address tokenREC,
                                    address tokenPay, uint128 rateToIssue, uint16 rateToLiquidize);
}
