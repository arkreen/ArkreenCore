// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

interface IGreenBTCGift {
    function mintGifts(
        address greener,
        uint256[] memory giftIDs, 
        uint256[] memory amounts
      )  external;
}