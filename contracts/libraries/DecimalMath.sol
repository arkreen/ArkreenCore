// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

library DecimalMath {
    // get the given power of ten, gas usage is less than fetching from storage. 
    function getDecimalPower(uint8 power) internal pure returns (uint256) {
        power = power % 20;     // max is 10**19
        uint256 result = 1;
        uint256 exp = 10;
        while (power > 0) {
          if ((power & 0x01) !=0) result = result * exp;
          exp = exp * exp;
          power >>= 1;
        }
        return result;
    }
}