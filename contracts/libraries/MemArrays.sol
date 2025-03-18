// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

/**
 * @dev Collection of functions related to array types in memory
 */
library MemArrays {
    /**
     * @dev Insert the element into an array in memory in ascending order, and return the new array in memomry
     */
    function insertInOrder(uint256[] memory array, uint256 element) internal pure returns (uint256[] memory) {
        uint256[] memory arrayNew = new uint256[](array.length + 1); 

        uint256 index = 0;
        uint256 indexTo = 0;
        while (index < array.length) {
            if(element == array[index]) {                           // Already existed, return original
                return array;
            }
            else if(element < array[index]) {                       // Insert here
                arrayNew[indexTo] = element;
                indexTo++;
            }
            arrayNew[indexTo] = array[index];                       // Copy one by one
            indexTo++;
            index++;
        }
        if(indexTo == index) {                                      // Not inserted, append as the last one                
            arrayNew[indexTo] = element;
        }
        return arrayNew;
    }
}
