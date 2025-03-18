// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "../ArkreenBadgeType.sol";

interface IArkreenBadgeImage {
    function getBadgeSVG(
        uint256 tokenId,
        OffsetRecord calldata offsetRecord,
        uint256 actionType,
        uint256[] calldata idsOfAREC
    ) external pure returns(string memory);                                
}
