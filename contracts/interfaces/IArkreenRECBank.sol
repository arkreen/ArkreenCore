// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

interface IArkreenRECBank {

    struct Signature {
        address     token;
        uint256     value;
        uint256     deadline;  
        uint8       v;
        bytes32     r;
        bytes32     s;              
    }

    function buyART(
        address             tokenPay,
        address             tokenART,
        uint256             amountPay,
        uint256             amountART,
        bool                isExactPay
    ) external returns (uint256);

    function buyARTNative(
        address             tokenART,
        uint256             amountART,
        bool                isExactPay
    ) external payable returns (uint256); 


    function buyARTWithPermit(
        address             tokenART,
        uint256             amountART,
        bool                isExactPay,
        Signature calldata  permitToPay
    ) external returns (uint256);

    function saleIncome(
        address             tokenART,
        address             tokenPay     
    ) external view returns (uint128 priceForSale, uint128 amountReceived);
}
