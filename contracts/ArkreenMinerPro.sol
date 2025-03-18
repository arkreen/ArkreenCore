// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/AddressUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC721/extensions/ERC721EnumerableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

import "./libraries/TransferHelper.sol";
import "./interfaces/IERC20.sol";
import "./interfaces/IERC20Permit.sol";
import "./interfaces/IArkreenMinerListener.sol";
import "./ArkreenMinerTypes.sol";
import "./ArkreenMinerStorage.sol";
import "./interfaces/IWETH.sol";

contract ArkreenMinerPro is 
    OwnableUpgradeable,
    UUPSUpgradeable,
    ERC721EnumerableUpgradeable,
    ArkreenMinerStorage
{
    using AddressUpgradeable for address;

    // Events
    event MinerOnboarded(address indexed owner, address indexed miner);
    event MinerOnboardedBatch(address indexed owner, address[] minersBatch);
    event StandardMinerOnboarded(address indexed owner, address indexed miner);
    event RemoteMinersInBatch(address[] owners, address[] miners);
    event SocketMinerOnboarded(address indexed owner, address indexed miner);
    event PlantMinerOnboarded(address indexed owner, address indexed miner);

    modifier ensure(uint256 deadline) {
        require(block.timestamp <= deadline, "Arkreen Miner: EXPIRED");
        _;
    }

    modifier onlyMinerManager() {
        require(_msgSender() == AllManagers[uint256(MinerManagerType.Miner_Manager)], "Arkreen Miner: Not Miner Manager");
        _;
    }    

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize() external virtual initializer 
    {}

    function postUpdate() external onlyProxy onlyOwner 
    {}

    function _authorizeUpgrade(address newImplementation)
        internal
        virtual
        override
        onlyOwner
    {}

    function _mintMiner( address owner, address miner, Miner memory newMiner) internal {
        uint256 realMinerID = totalSupply() + 1;
        AllMinersToken[miner] = realMinerID;
        AllMinerInfo[realMinerID] = newMiner;
        _safeMint(owner, realMinerID);
    }

    /**
     * @dev Onboarding standard miner
     * @param owner address receiving the standard miner
     * @param miner address of the standard miner onboarding
     * @param permitMiner signature of onboarding manager to approve the onboarding
     */
    function StandardMinerOnboard(
        address owner,
        address miner,
        uint256 deadline,
        Sig     calldata permitMiner
    ) external ensure(deadline) {

        // Check the starndard address
        require(!miner.isContract(), "Arkreen Miner: Not EOA Address");
        require(AllMinersToken[miner] == 0, "Arkreen Miner: Miner Repeated");
        MinerType minerType = MinerType(whiteListMiner[miner]);
        require((minerType == MinerType.StandardMiner) || 
                (minerType == MinerType.SocketMiner) ||
                (minerType == MinerType.PlantMiner), "Arkreen Miner: Wrong Miner");        

        // Check signature
        bytes32 hashRegister = keccak256(abi.encode(STANDARD_MINER_TYPEHASH, owner, miner, deadline));
        bytes32 digest = keccak256(abi.encodePacked("\x19\x01", DOMAIN_SEPARATOR, hashRegister));
        address recoveredAddress = ecrecover(digest, permitMiner.v, permitMiner.r, permitMiner.s);
  
        require(recoveredAddress != address(0) && 
                recoveredAddress == AllManagers[uint256(MinerManagerType.Register_Authority)], "Arkreen Miner: INVALID_SIGNATURE");

        Miner memory newMiner;
        newMiner.mAddress = miner;
        newMiner.mType = uint8(minerType);
        newMiner.mStatus = MinerStatus.Normal;
        newMiner.timestamp = uint32(block.timestamp);     

        // Mint a new standard miner
        _mintMiner(owner, miner, newMiner);

        // Increase the counter of total standard/socket miner 
        if(minerType == MinerType.StandardMiner) { 
            totalStandardMiner += 1;
            emit StandardMinerOnboarded(owner,  miner);   // emit onboarding event
        } else if(minerType == MinerType.SocketMiner) {
            totalSocketMiner += 1;
            emit SocketMinerOnboarded(owner,  miner);
        } else {
            totalPlantMiner += 1;
            emit PlantMinerOnboarded(owner,  miner);
        }

        checkListener(owner, 1);
        delete whiteListMiner[miner]; 
    }

    function checkListener(address owner, uint256 quantity) internal {
        uint256 allListenApps = listenUsers[owner]; 
        if (allListenApps == 0) return;
        while (allListenApps != 0) {
            address appToCall = listenApps[uint8(allListenApps)];
            if(appToCall != address(0)) IArkreenMinerListener(appToCall).minerOnboarded(owner, quantity);
            allListenApps = allListenApps >> 8;
        }
    }

    /**
     * @dev Get all the miner info of the specified miner
     * @param addrMiner miner address
     */
    function GetMinerInfo(address addrMiner) external view returns (address owner, Miner memory miner) {
        uint256 minerID = AllMinersToken[addrMiner];
        owner = ownerOf(minerID);
        miner = AllMinerInfo[minerID];
    }

    /**
     * @dev Get all the miner address of the owner
     * @param owner owner address
     */
    function GetMinersAddr(address owner) external view returns (address[] memory minersAddr) {
        uint256 totalMiners = balanceOf(owner);
        minersAddr = new address[](totalMiners);
        for(uint256 index;  index < totalMiners; index++) {     
            uint256 minerID = tokenOfOwnerByIndex(owner, index);
            minersAddr[index] = AllMinerInfo[minerID].mAddress;
        }
    }

    /**
     * @dev Register or unregister miner manufactures
     * @param manufactures manufactures to be registered or unregistered
     * @param yesOrNo = true, to register manufactures, = false, to unregister manufactures
     */
    function ManageManufactures(address[] calldata manufactures, bool yesOrNo) external onlyOwner {
      for(uint256 index;  index < manufactures.length; index++) {
        AllManufactures[manufactures[index]] = yesOrNo;
      }
    }

    /**
     * @dev Update the miner status
     * @param minerID miner ID of any type of miners
     * @param minerStatus new status
     */
    function SetMinersStatus(uint256 minerID, MinerStatus minerStatus) external onlyOwner {
        require(minerStatus != MinerStatus.Pending, "Arkreen Miner: Wrong Input");      
        AllMinerInfo[minerID].mStatus = minerStatus;
    }

    /**
     * @dev Update the miner white list for batch sales. Only miners in the white list are allowed to onboard as an NFT.
     * All the miners in this list is located in the default pool.
     * @param addressMiners List of the miners
     */
    function UpdateMinerWhiteListBatch(address[] calldata addressMiners) external onlyMinerManager {
        _UpdatePoolMinerWhiteList(0, addressMiners);
    }

    /**
     * @dev Remove the miner from the miner white list for batch sales.
     * @param addressMiner The miner to remove
     */
     
    function RemoveMinerFromWhiteList(uint256 remoteType, address addressMiner) external onlyMinerManager {
        // pool id is located at the MSB of index 
        uint256 remoteTypeTag = remoteType << 248;   
        uint256 stationId = uint256((uint16)(remoteType >> 8)) << 232;   
        remoteTypeTag += stationId;

        uint256 indexHead = whiteListBatchPoolIndexHead[remoteType];
        uint256 indexTail = whiteListBatchPoolIndexTail[remoteType];

        for(uint256 index = indexHead; index < indexTail; index++) {
            if(whiteListMinerBatch[remoteTypeTag + index] == addressMiner) {
                if(index != (indexTail-1)) {
                    whiteListMinerBatch[remoteTypeTag + index] = whiteListMinerBatch[remoteTypeTag + indexTail-1];
                }
                whiteListMinerBatch[remoteTypeTag + indexTail-1] = address(0);
                whiteListBatchPoolIndexTail[remoteType] = indexTail - 1;
                break;   
            }
        }
    }

    /**
     * @dev Update the miner white list for the specified pool. Only miners in the white list are allowed to onboard as an NFT.
     * @param remoteType type of the remote miner to claim, which could be used to differentiate the various type of remote miners
     * @param addressMiners List of the miners
     */
    function UpdateMinerWhiteListBatchClaim(uint256 remoteType, address[] calldata addressMiners) public onlyMinerManager {
        require(remoteType <= type(uint24).max, "Arkreen Miner: Wrong Pool ID");
        _UpdatePoolMinerWhiteList(remoteType, addressMiners);
    }

    function _UpdatePoolMinerWhiteList(uint256 remoteType, address[] calldata addressMiners) internal  {
        // pool id is located at the MSB of index 
        uint256 remoteTypeTag = remoteType << 248;   
        uint256 stationId = uint256((uint16)(remoteType >> 8)) << 232;   
        remoteTypeTag += stationId;

        uint256 indexStart = whiteListBatchPoolIndexTail[remoteType];
        uint256 length = addressMiners.length;
        for(uint256 index; index < length; index++) {
            whiteListMinerBatch[remoteTypeTag + indexStart + index] = addressMiners[index];
        }
        whiteListBatchPoolIndexTail[remoteType] += length;
    }
    
    /**
     * @dev Withdraw all the onboarding fee
     * @param token address of the token to withdraw, USDC/ARKE
     */
    function withdraw(address token) public onlyOwner {
        address receiver = AllManagers[uint256(MinerManagerType.Payment_Receiver)];
        if(receiver == address(0)) {
            receiver = _msgSender();
        }

        if(token == tokenNative) {
            uint256 amountWithdraw = IERC20(tokenNative).balanceOf(address(this));
            if (amountWithdraw != 0) IWETH(tokenNative).withdraw(amountWithdraw);
            TransferHelper.safeTransferETH(receiver, address(this).balance);      
        } else {
            uint256 balance = IERC20(token).balanceOf(address(this));
            TransferHelper.safeTransfer(token, receiver, balance);
        }
    }

    /**
     * @dev Hook that is called before any token transfer.
     */
    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 tokenId
    ) internal virtual override (ERC721EnumerableUpgradeable) {
        require(bTransferAllowed || (from == address(0)), "Arkreen Miner: Transfer Not Allowed");
        super._beforeTokenTransfer(from, to, tokenId);
    }
}
