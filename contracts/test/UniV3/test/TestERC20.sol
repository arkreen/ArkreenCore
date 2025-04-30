// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.9;

import '@openzeppelin/contracts/token/ERC20/extensions/draft-ERC20Permit.sol';

contract TestERC20 is ERC20Permit {
    uint8 decimal;

    constructor(uint256 amountToMint, uint256 decimals_, string memory name_, string memory symbol_) 
                  ERC20(name_, symbol_) ERC20Permit(name_)
    {
        decimal = uint8(decimals_);
        _mint(msg.sender, amountToMint);
    }

    function decimals() public view virtual override returns (uint8) {
        return decimal;
    }
}

/*
contract TestERC20 is ERC20Permit {
    constructor(uint256 amountToMint) ERC20('Test ERC20', 'TEST') ERC20Permit('Test ERC20') {
        _mint(msg.sender, amountToMint);
    }
}
*/