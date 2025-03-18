// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "../Arkreen/ArkreenToken.sol";

// For testing of contract upgrading 
contract USDS is ArkreenToken
{
    function decimals() public view virtual override returns (uint8) {
        return 6;
    }
}

