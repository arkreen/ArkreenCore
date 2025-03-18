// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

interface IRWAsset {
    function executeInvestClearance(uint32) external;
    function executeFinalClearance(uint32, uint96 amountAKRE) external;
}

