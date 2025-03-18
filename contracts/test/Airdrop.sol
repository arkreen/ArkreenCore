// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;
import "@openzeppelin/contracts/access/Ownable.sol";

interface IERC20 {
    function transfer(address to, uint256 value) external returns (bool);
    function transferFrom(address from, address to, uint256 value) external returns (bool);
}

contract Airdrop is Ownable {

    address public token;
    address public from;
    uint256 public value;

    event Airdopped( uint256 indexed totalRecipient, uint256 totalValue );

    constructor (address _token, address _from, uint256 _value ) {
        token = _token;
        from = _from;
        value = _value;
    }

    function setParams(address _token, address _from, uint256 _value) external onlyOwner {
        token = _token;
        from = _from;
        value = _value;
    }

    function airdrop(address[] calldata recipients) external onlyOwner {
        for (uint256 index = 0; index < recipients.length; index++)
            if (from == address(0)) {
                require(IERC20(token).transfer(recipients[index], value));
            } else {
                require(IERC20(token).transferFrom(from, recipients[index], value));
            }     
    }

    function airdropWithValue(address[] calldata recipients, uint256[] calldata values) external onlyOwner {
        require(recipients.length == values.length, "Wrong Length" );
        uint256 totalValue = 0;
        
        for (uint256 index = 0; index < recipients.length; index++) {
            if (from == address(0)) {
                require(IERC20(token).transfer(recipients[index], values[index]));
            } else {
                require(IERC20(token).transferFrom(from, recipients[index], values[index]));
            }
            totalValue = totalValue + values[index];
        }
        emit Airdopped(recipients.length, totalValue); 
    }

    function airdropGeneric(address dropToken, address dropFrom, uint256 dropValue, address[] calldata recipients) external onlyOwner {
        for (uint256 index = 0; index < recipients.length; index++)
            require(IERC20(dropToken).transferFrom(dropFrom, recipients[index], dropValue));
    }

    function airdropGenericValue(address dropToken, address dropFrom, address[] calldata recipients, uint256[] calldata values) external onlyOwner {
        require(recipients.length == values.length, "Wrong Length" );
        for (uint256 index = 0; index < recipients.length; index++)
            require(IERC20(dropToken).transferFrom(dropFrom, recipients[index], values[index]));
    }
}