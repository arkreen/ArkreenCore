// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "../ArkreenRECIssuanceType.sol";

interface IArkreenRECIssuanceImage {
    function getARECSVG(
        uint256 tokenId,
        address owner,
        RECData memory offsetRecord
    ) external view returns(string memory);                       
}