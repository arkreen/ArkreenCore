// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ContextUpgradeable.sol";

contract ArkreenNotary is 
    ContextUpgradeable,
    OwnableUpgradeable,
    UUPSUpgradeable
{
    uint256 public updateCount;

    string  public blockHash;
    string  public cid;
    uint256 public blockHeight;
    uint256 public totalPowerGeneraton;
    uint256 public circulatingSupply;

    address public dataManager;

    string public arweaveTransactionId;
    
    //events
    event DataSaved2(string indexed blockHash, string indexed cid, uint256 blockHeight, uint256 totalPowerGeneraton, uint256 circulatingSupply, string arweaveTransactionId);
    
    //modifier
    modifier onlyDataManager(){
        require(_msgSender() == dataManager, "Only data manager can do this!");
        _;
    }

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    //initialize
    function initialize(address manager_) external virtual initializer {
        __UUPSUpgradeable_init();
        __Ownable_init_unchained();

        dataManager = manager_;
    }

    function saveData(
        string calldata blockHash_,
        string calldata cid_,
        uint256 blockHeight_,
        uint256 totalPowerGeneraton_,
        uint256 circulatingSupply_,
        string calldata arweaveTransactionId_
    ) public onlyDataManager {
        require(blockHeight_ >= blockHeight, "blockHeight data must increase!");
        // require(totalPowerGeneraton_ >= totalPowerGeneraton, "totalPowerGeneraton data must increase!");
        require(circulatingSupply_ >= circulatingSupply, "circulatingSupply data must increase!");

        blockHash          = blockHash_;
        cid                = cid_;
        blockHeight        = blockHeight_;
        totalPowerGeneraton = totalPowerGeneraton_;
        circulatingSupply  = circulatingSupply_;

        arweaveTransactionId = arweaveTransactionId_;

        updateCount += 1;

        emit DataSaved2(blockHash, cid, blockHeight, totalPowerGeneraton, circulatingSupply, arweaveTransactionId);
    }

    function setDataManager(address newManager) external onlyOwner {
        require(newManager != address(0), "zero address is forbidden !");
        require(dataManager != newManager, "identical address is forbidden !");
        
        dataManager = newManager;
    }

    function _authorizeUpgrade(address newImplementation) internal virtual override onlyOwner
    {}
}