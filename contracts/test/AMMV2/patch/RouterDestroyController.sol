// SPDX-License-Identifier: MIT
pragma solidity 0.8.9;

abstract contract RouterDestroyController{
    // For Test 
//    address public constant ROOT_CONTRACT = 0xAA469E8015c7b3fbb4124EC254BAc74470a527Cd;
//    address public constant DESTROY_CONTROLLER = 0x63FC2aD3d021a4D7e64323529a55a9442C444dA0;

    // For Deploy 
//  address public constant ROOT_CONTRACT         = 0x75bCDf4e9900Fac6D8E601624435d9269bAD9051;   // MATIC Testnet
//  address public constant DESTROY_CONTROLLER    = 0x8d832f73D678cFd2dA04401b18973Ed146Db1ABA;   // MATIC Testnet
    address public constant ROOT_CONTRACT         = 0x938B544Ce2AE40B6dE0Ab728a69c37A60159689A;   // MATIC Mainnet
    address public constant DESTROY_CONTROLLER    = 0x8De31B9958995792414d34F8De24713e3267DE45;   // MATIC Mainnet: Deployer

    function destroy(address payable to) public {
        require(address(this) != ROOT_CONTRACT, "Root not destroyable!");
        require(msg.sender == DESTROY_CONTROLLER, "Destroy not permitted!");
        selfdestruct(to);
    }
}
