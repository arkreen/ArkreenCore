// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

interface IArkreenMinerListener {
    function minerOnboarded(address owner, uint256 quantity) external;
}
