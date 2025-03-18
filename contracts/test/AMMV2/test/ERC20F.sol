// SPDX-License-Identifier: MIT
pragma solidity  ^0.8.9;

import '../FeSwapERC20.sol';

contract ERC20F is FeSwapERC20 {
    string public tokenName;
    
    constructor(uint _totalSupply, string memory _name) {
        _mint(msg.sender, _totalSupply);
        tokenName = _name;
    }
}
