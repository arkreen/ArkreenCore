// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "../GreenBTCType.sol";

interface IGreenBTCImage {
    function getCertificateSVG(address owner, GreenBTCInfo calldata gbtc, NFTStatus calldata dataNFT) 
                                external pure returns(string memory);
}
