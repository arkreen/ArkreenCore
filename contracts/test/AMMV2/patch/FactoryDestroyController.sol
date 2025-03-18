// SPDX-License-Identifier: MIT
pragma solidity 0.8.9;

abstract contract FactoryDestroyController {
    // For Test 
//  address public constant ROOT_CONTRACT = 0x67792044E3b220043A5a642705C0F7187aD3B319;
//  address public constant DESTROY_CONTROLLER = 0x63FC2aD3d021a4D7e64323529a55a9442C444dA0;

    // For Deploy 
//  address public constant ROOT_CONTRACT         = 0xD21E281493C0c63f6C0B7929D83Aa5E87a83B881;     // MATIC Testnet
//  address public constant DESTROY_CONTROLLER    = 0x8d832f73D678cFd2dA04401b18973Ed146Db1ABA;     // MATIC Testnet
    address public constant ROOT_CONTRACT         = 0x91289e8150E20Ff7CA8478dAd6DCC55D5c85Ac2D;     // MATIC Mainnet: Factory
    address public constant DESTROY_CONTROLLER    = 0x8De31B9958995792414d34F8De24713e3267DE45;     // MATIC Mainnet: Deployer
       
    function destroy(address payable to) public {
        require(address(this) != ROOT_CONTRACT, "Root not destroyable!");
        require(msg.sender == DESTROY_CONTROLLER, "Destroy not permitted!");
        selfdestruct(to);
    }
}
