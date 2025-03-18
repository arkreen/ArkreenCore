// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

interface IMinerRegister {
    function isOwner(address owner) external returns (bool);
}
