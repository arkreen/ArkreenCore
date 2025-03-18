// SPDX-License-Identifier: MIT

pragma solidity ^0.8.9;
pragma experimental ABIEncoderV2;

import "../interfaces/IGreenBTC.sol";

interface IERC20 {
    function transfer(address to, uint256 value) external returns (bool);
    function transferFrom(address from, address to, uint256 value) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
    function allowance(address owner, address spender) external view returns (uint256);
}

/// @title Multicall - Aggregate results from multiple read-only function calls
/// @author Michael Elliot <mike@makerdao.com>
/// @author Joshua Levine <joshua@makerdao.com>
/// @author Nick Johnson <arachnid@notdot.net>

library BytesUtils {
    function toHexString(bytes memory data) internal pure returns (string memory) {
        bytes memory hexString = new bytes(2 * data.length);

        for (uint256 i = 0; i < data.length; i++) {
            uint256 value = uint8(data[i]);
            uint8 firstDigit = uint8(value / 16);
            uint8 secondDigit = uint8(value % 16);

            hexString[2 * i] = _toHexChar(firstDigit);
            hexString[2 * i + 1] = _toHexChar(secondDigit);
        }

        return string(hexString);
    }

    function _toHexChar(uint8 value) private pure returns (bytes1) {
        if (value < 10) {
            return bytes1(uint8(bytes1("0")) + value);
        } else {
            return bytes1(uint8(bytes1("a")) + (value - 10));
        }
    }
}

contract MulticallS {
    using BytesUtils for bytes;

    struct Call {
        address target;
        bytes callData;
    }
    function aggregate(address addr, Call[] memory calls) public returns (uint256 blockNumber, uint256 balance, bytes[] memory returnData) {
        if (addr != address(0)) balance = addr.balance;
        (blockNumber, returnData) = aggregate(calls);
    }
    
    function aggregate(Call[] memory calls) public returns (uint256 blockNumber, bytes[] memory returnData) {
        blockNumber = block.number;
        returnData = new bytes[](calls.length);
        for(uint256 i = 0; i < calls.length; i++) {
            (bool success, bytes memory ret) = calls[i].target.call(calls[i].callData);
            require(success, abi.encodePacked(calls[i].target,calls[i].callData, ret).toHexString());
            returnData[i] = ret;
        }
    }

    // Helper functions
    function getEthBalance(address addr) public view returns (uint256 balance) {
        balance = addr.balance;
    }
    function getBlockHash(uint256 blockNumber) public view returns (bytes32 blockHash) {
        blockHash = blockhash(blockNumber);
    }
    function getLastBlockHash() public view returns (bytes32 blockHash) {
        blockHash = blockhash(block.number - 1);
    }
    function getCurrentBlockTimestamp() public view returns (uint256 timestamp) {
        timestamp = block.timestamp;
    }
    function getCurrentBlockGasLimit() public view returns (uint256 gaslimit) {
        gaslimit = block.gaslimit;
    }
    function getCurrentBlockCoinbase() public view returns (address coinbase) {
        coinbase = block.coinbase;
    }

    function checkIfContract(address[] calldata list) public view returns (address[] memory) {
        uint256 length = list.length;
        address[] memory returnList = new address[](length);
        uint256 returnLength = 0;
        for(uint256 index = 0; index < length; index++ ) {
            if(list[index].code.length > 0) {
                returnList[returnLength] = list[index];
                returnLength++;
            }
        }

        assembly {
            mstore(returnList, returnLength)
        }
        return returnList;
    }

    function listEmptyGreenBTC(uint256 start, uint256 length) public view returns (uint256[] memory) {
        address greenBTC = address(0xDf51F3DCD849f116948A5B23760B1ca0B5425BdE);

        uint256[] memory returnList = new uint256[](length);
        uint256 returnLength = 0;
        for (uint256 index = 0; index < length; index++) {
          ( , , address minter, , , ) = IGreenBTC(greenBTC).dataGBTC(start + index);

          if (minter == address(0)) {
            returnList[returnLength] = start + index;
            returnLength ++;
          }
        }

        assembly {
            mstore(returnList, returnLength)
        }
 
        return returnList;
    }

    function getAllBalance(address account, address[] memory tokens) public view returns (uint256[] memory balances) {
        balances = new uint256[](tokens.length + 1);
        balances[0] = account.balance;
        for (uint256 index = 0; index < tokens.length; index++) {
            balances[index + 1] = IERC20(tokens[index]).balanceOf(account);
        }
    }

    function getAllAccountBalance(address token, address[] memory accounts) public view returns (uint256[] memory balances) {
        balances = new uint256[](accounts.length);
        for (uint256 index = 0; index < accounts.length; index++) {
            balances[index] = IERC20(token).balanceOf(accounts[index]);
        }
    }


}