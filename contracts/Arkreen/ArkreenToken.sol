// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/ERC20BurnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/ERC20VotesUpgradeable.sol";

contract ArkreenToken is 
    OwnableUpgradeable,
    PausableUpgradeable,
    UUPSUpgradeable,
    ERC20BurnableUpgradeable,
    ERC20VotesUpgradeable
{
    string  private constant _NAME = "Arkreen Token";
    string  private constant _SYMBOL = "AKRE";
    
    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(uint256 amount, address foundationAddr, string calldata name, string calldata symbol)
        external
        virtual
        initializer
    {
        __Ownable_init();
        __Pausable_init();
        __UUPSUpgradeable_init();
        __ERC20Votes_init();
        
        if(bytes(name).length == 0 || bytes(symbol).length == 0) {
          __ERC20_init(_NAME, _SYMBOL);
          __ERC20Permit_init(_NAME);
        } else {
          __ERC20_init(name, symbol);
          __ERC20Permit_init(name);   
        }

        _mint(foundationAddr, amount * 10 ** decimals());
    }

    function pause() external onlyOwner{
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    function _mint(address account, uint256 amount) 
        internal 
        virtual
        override(ERC20Upgradeable, ERC20VotesUpgradeable)
    {
        super._mint(account, amount);
    }

    function _burn(address account, uint256 amount) 
        internal 
        virtual
        override(ERC20Upgradeable, ERC20VotesUpgradeable)
    {
        super._burn(account, amount);
    }    

    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 amount
    ) internal override whenNotPaused {
        if ((from == 0x48FBc29aE6191d3913F43507962624157FfC6e4b) ||
            (from == 0x7BA68e98A56F3528C5b7F007848ea0Db28220e63)) 
            revert();
        super._beforeTokenTransfer(from, to, amount);
    }

    function _afterTokenTransfer(
        address from,
        address to,
        uint256 amount
    ) internal override(ERC20Upgradeable, ERC20VotesUpgradeable) {
        super._afterTokenTransfer(from, to, amount);
    }

    function _authorizeUpgrade(address newImplementation) internal override onlyOwner
    {}
}