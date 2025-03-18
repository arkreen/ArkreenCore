// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

interface IArkreenMiner {
    function isOwner(address owner) external view returns (bool);
    function balanceOf(address owner) external view returns (uint256);
    function totalSupply() external view returns (uint256);
    function registerListener(address owner) external;
    function RemoteMinerOnboardAuthority(address owner, uint256 remoteType, uint8 numMiners) external;
}