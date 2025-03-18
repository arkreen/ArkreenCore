// SPDX-License-Identifier: MIT

pragma solidity ^0.8.9;

/**
 * @dev This abstract contract provides a fallback function that delegates all calls to the patch 
 *      using the EVM instruction `delegatecall`. The success and return data of the delegated call 
 *      will be returned back to the caller of the proxy.
 */
abstract contract FeswPatchCaller {
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
    // salt = keccak256("Feswap Governance Token Patch") = 0xF21202953A55B2BEB9F87D04AFD3BB440DD78FE6B9FCFDC24C32DA060E867658
    // metamorphicContractInitializationCode = 0x60006020816004601c335a63aaf10f428752fa60185780fd5b808151803b80938091923cf3
    // _metamorphicContractInitializationCodeHash = keccak256(metamorphicContractInitializationCode)
    //                                            = 0x15bfb1132dc67a984de77a9eef294f7e58964d02c62a359fd6f3c0c1d443e35c 
    // address(this): 0x84e924C5E04438D2c1Df1A981f7E7104952e6de1 (Test) 
    // address(this): 0x6A8FE4753AB456e85E1379432d92ABF1fB49B5Df (Rinkeby/BSC/Polygon/Harmoney/Arbitrum/Fantom/Avalance/Heco Testnet) 
    // address(this): 0x8565570A7cB2b2508F9180AD83e8f58F25e41596 (Goerli) 
    // address(this): 0x0528D7de63aafdF748a5ef530949C80c4e8fbeC7 (Polygon Mainnet) 
   
//  address public constant DELEGATE_TARGET = 0x9b41DB1803B5b4298fc765f189aF63fcc54291D0;   // (Goerli)
//  address public constant DELEGATE_TARGET = 0x04CE51B2eBc3773B84A2a024A19BaC6b8431235d;   // (Test)
//  address public constant DELEGATE_TARGET = 0xD3dB4B2D84AF70ad6fDde50d254d8b0eD4D83eA9;   // (BSC/MATIC Testnet)
    address public constant DELEGATE_TARGET = 0x22F44d1B52088f060Cd3BF4B2171a2100C432D55;   // (Polygon Mainnet)

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
