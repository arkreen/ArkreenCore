// SPDX-License-Identifier: MIT
pragma solidity 0.8.18;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

//Define the name of your contract. In this case, it is "WrappedToken".
contract WrappedToken is ERC20 { 
    error ZeroAddress();
    error OnlyBridge();
    
    //Stores the address of the bridge.
    //Bridge is the only entity that can mint or burn tokens.
    address public bridge;

    modifier onlyBridge() {
        if (_msgSender() != bridge) revert OnlyBridge();
        _;
    }
    
    //Contructor must be called at the deployment of the contract.
    //name: name of your wrapped token on Odyssey Chain.
    //symbol: symbol of your wrapped token on Odyssey Chain.
    //bridge_: address of the bridge on Odyssey Chain.
    //Bridge address on Odyssey testnet: 0x8310f622B6144d909Ba6C86d665bf2aD364881a2
    //Bridge address on Odyssey mainnet: 0xfce056220CDD2AE23b1C986DCaecF6086673AD53
    constructor(string memory name, string memory symbol, address bridge_) ERC20(name, symbol) {
        if (bridge_ == address(0)) revert ZeroAddress();

        bridge = bridge_;
    }

    //Function responsible for minting tokens. 
    //It can only be called by the Odyssey bridge.
    //Therefore, you must pass the correct bridge address in the constructor.
    function mint(address to, uint256 amount) external onlyBridge {
        _mint(to, amount);
    }
    
    //Function responsible for burning tokens. 
    //It can only be called by the Odyssey bridge.
    //Therefore, you must pass the correct bridge address in the constructor.
    function burn(uint256 amount) external onlyBridge {
        _burn(_msgSender(), amount);
    }
}