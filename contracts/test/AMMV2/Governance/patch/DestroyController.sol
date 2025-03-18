// SPDX-License-Identifier: MIT
pragma solidity 0.8.9;

abstract contract DestroyController{
    // For Test 
//  address public constant ROOT_CONTRACT = 0xaC8444e7d45c34110B34Ed269AD86248884E78C7;
//  address public constant DESTROY_CONTROLLER = 0x63FC2aD3d021a4D7e64323529a55a9442C444dA0;

    // For Deploy 
//  address public constant ROOT_CONTRACT         = 0xf6475c3143574F4d84c627fea3df81036ceeDAC4;     // MATIC Testnet
//  address public constant DESTROY_CONTROLLER    = 0x8d832f73D678cFd2dA04401b18973Ed146Db1ABA;     // MATIC Testnet
    address public constant ROOT_CONTRACT         = 0xA2f089377f4Dddf971ba65a69Fb4DFDD5fAf16Bb;     // MATIC Mainnet: NFT 
    address public constant DESTROY_CONTROLLER    = 0x8De31B9958995792414d34F8De24713e3267DE45;     // MATIC Mainnet: Deployer
       
    function destroy(address payable to) public {
        require(address(this) != ROOT_CONTRACT, "Root not destroyable!");
        require(msg.sender == DESTROY_CONTROLLER, "Destroy not permitted!");
        selfdestruct(to);
    }
}
