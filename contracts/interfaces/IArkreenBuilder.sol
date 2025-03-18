// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

interface IArkreenBuilder {
    struct BadgeInfo {
        address     beneficiary;
        string      offsetEntityID;
        string      beneficiaryID;
        string      offsetMessage;
    }

    function artBank() external view returns (address);
    function actionBuilderBadgeWithART(
        address             tokenART,
        uint256             amountART,
        uint256             deadline,
        BadgeInfo calldata  badgeInfo
    ) external;
}
