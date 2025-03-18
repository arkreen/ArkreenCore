// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.9;

interface IOwnable {
    function owner() external view returns (address);

    function renounceManagement() external;

    function pushManagement(address newOwner_) external;

    function pullManagement() external;
}
