// SPDX-License-Identifier: MIT
pragma solidity 0.8.9;

/**
 * @dev This abstract contract provides a fallback function that delegates all calls to the patch 
 *      using the EVM instruction `delegatecall`. The success and return data of the delegated call 
 *      will be returned back to the caller of the proxy.
 */
abstract contract FactoryPatchCaller {
    // DELEGATE_TARGET = uint160(                      // downcast to match the address type.
    //                      uint256(                    // convert to uint to truncate upper digits.
    //                          keccak256(                // compute the CREATE2 hash using 4 inputs.
    //                              abi.encodePacked(       // pack all inputs to the hash together.
    //                                  hex"ff",              // start with 0xff to distinguish from RLP.
    //                                  address(this),        // this contract will be the caller.
    //                                  salt,                 // pass in the supplied salt value.
    //                                  _metamorphicContractInitializationCodeHash // the init code hash.
    //                              )
    //                          )
    //                      )
    //                   )
    //
    // salt = keccak256("Feswap Factory Patch") = 0x804853013B8794AECE4A460DFA60AAD95CCF1CB9435B71BFAAB287F39536A9DD
    // metamorphicContractInitializationCode = 0x60006020816004601c335a63aaf10f428752fa60185780fd5b808151803b80938091923cf3
    // _metamorphicContractInitializationCodeHash = keccak256(metamorphicContractInitializationCode)
    //                                            = 0x15bfb1132dc67a984de77a9eef294f7e58964d02c62a359fd6f3c0c1d443e35c 
    // address(this): 0xFDFEF9D10d929cB3905C71400ce6be1990EA0F34 (Test) 
    // address(this): 0x8565570A7cB2b2508F9180AD83e8f58F25e41596 (Goerli) 
    // address(this): 0x6A8FE4753AB456e85E1379432d92ABF1fB49B5Df (Rinkeby/BSC/Polygon/Harmoney/Arbitrum/Fantom/Avalance/Heco Testnet) 
    // address(this): 0x0528D7de63aafdF748a5ef530949C80c4e8fbeC7 (Polygon Mainnet) 
   
//  address public constant DELEGATE_TARGET = 0x92DD76703DACF9BE7F61CBC7ADAF77319084DBF8;   // (Goerli)
//  address public constant DELEGATE_TARGET = 0x8CAF582948011A604d53DBAb24783aC0f0464b3d;   // (Test)
//  address public constant DELEGATE_TARGET = 0x8C80f5aa060fD83faDC384Ffc469ceD5548cF554;   // (BSC/MATIC Testnet)
    address public constant DELEGATE_TARGET = 0xb9c7fc86878409E3B87EdCc221C9caf8d7c25bF2;   // (Polygon Mainnet)

    /**
     * @dev Delegates the current call to `DELEGATE_TARGET`.
     *
     * This function does not return to its internall call site, it will return directly to the external caller.
     */

    receive() external virtual payable {
        revert("Refused!");
    }

    /**
     * @dev Fallback function that delegates calls to the address returned by `_implementation()`. Will run if no other
     * function in the contract matches the call data.
     */
    fallback () external payable virtual {
       // solhint-disable-next-line no-inline-assembly
        assembly {
            // Copy msg.data. We take full control of memory in this inline assembly
            // block because it will not return to Solidity code. We overwrite the
            // Solidity scratch pad at memory position 0.
            calldatacopy(0, 0, calldatasize())

            // Call the implementation.
            // out and outsize are 0 because we don't know the size yet.
            let result := delegatecall(gas(), DELEGATE_TARGET, 0, calldatasize(), 0, 0)

            // Copy the returned data.
            returndatacopy(0, 0, returndatasize())

            switch result
            // delegatecall returns 0 on error.
            case 0 { revert(0, returndatasize()) }
            default { return(0, returndatasize()) }
        }
    }
}
