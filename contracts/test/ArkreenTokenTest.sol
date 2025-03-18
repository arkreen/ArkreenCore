// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "../Arkreen/ArkreenToken.sol";

// For testing of contract upgrading 
contract ArkreenTokenTest is ArkreenToken
{
    function testUpgrade() external pure returns (string memory) {
        return "This is test";
    }
}
