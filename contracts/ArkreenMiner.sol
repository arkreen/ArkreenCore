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

contract ArkreenMiner is 
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

    function initialize(address _tokenAKRE, address _tokenNative, address _minerManager, address _minerAuthority)
        external
        virtual
        initializer
    {
        __Ownable_init_unchained();
        __UUPSUpgradeable_init();
        __ERC721_init_unchained(NAME, SYMBOL);
        tokenAKRE = _tokenAKRE;
        tokenNative = _tokenNative;
        AllManagers[uint256(MinerManagerType.Miner_Manager)] = _minerManager;
        AllManagers[uint256(MinerManagerType.Register_Authority)] = _minerAuthority;
        baseURI = "https://www.arkreen.com/miners/";

        DOMAIN_SEPARATOR = keccak256(
            abi.encode(
                keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"),
                keccak256(bytes("Arkreen Miner")),
                keccak256(bytes("1")),
                block.chainid,
                address(this)
            )
        );  
    }

    function postUpdate() external onlyProxy onlyOwner 
    {}

    function _authorizeUpgrade(address newImplementation)
        internal
        virtual
        override
        onlyOwner
    {}

    function callArkreenMinerPro (address minerPro) internal virtual {
        assembly {
            // Copy msg.data. We take full control of memory in this inline assembly
            // block because it will not return to Solidity code. We overwrite the
            // Solidity scratch pad at memory position 0.
            calldatacopy(0, 0, calldatasize())

            // Call the implementation.
            // out and outsize are 0 because we don't know the size yet.
            let result := delegatecall(gas(), minerPro, 0, calldatasize(), 0, 0)

            // Copy the returned data.
            returndatacopy(0, 0, returndatasize())

            switch result
            // delegatecall returns 0 on error.
            case 0 { revert(0, returndatasize()) }
            default { return(0, returndatasize()) }
        }
    }

    /**
     * @dev Onboarding a remote Miner paid with Native token (MATIC)
     * @param owner address receiving the remote miner
     * @param miner address of the remote miner onboarding
     * @param permitMiner signature of the miner register authority to confirm the miner address and price.  
     */
    function RemoteMinerOnboardNative(
        address     owner,
        address     miner,
        Signature   memory  permitMiner
    ) external payable ensure(permitMiner.deadline) {

        // Check payment value
        require( (tokenNative != address(0)) && (tokenNative == permitMiner.token) && 
                  (msg.value == permitMiner.value), "Arkreen Miner: Payment error");

        // Check for minting remote miner  
        _mintRemoteMinerCheck(owner, miner, permitMiner);

        // mint new remote miner
        _mintRemoteMiner(owner, miner);
        checkListener(owner, 1);
        emit MinerOnboarded(owner, miner);
    }    

    /**
     * @dev Onboarding remote miners in batch, orderly fetched from the batch whitelist, paid with Native token (MATIC)
     * @param owner address receiving the remote miners
     * @param numMiners number of remote miners desired to purchase
     * @param permitMiner signature of the miner register authority to confirm the owner and sales price.  
     */

    function RemoteMinerOnboardNativeBatch(
        address     owner,
        uint8       numMiners,
        Signature   memory  permitMiner
    ) external payable ensure(permitMiner.deadline) {

        // Check payment value
        require( (tokenNative != address(0)) && (tokenNative == permitMiner.token) && 
                  (msg.value == permitMiner.value), "Arkreen Miner: Payment error");

        // Check for remote miner minting price  
        _mintBatchCheckPrice(0, owner, numMiners, permitMiner);

        // mint new remote miners in batch
        address[] memory minersBatch = _mintRemoteMinerBatch(0, owner, numMiners);

        checkListener(owner, numMiners);
        emit MinerOnboardedBatch(owner, minersBatch);
    }    

    /**
     * @dev Onboarding a remote miner while the payment has been approved
     * @param owner address receiving the remote miner
     * @param miner address of the remote miner onboarding
     * @param permitMiner signature of miner register authority to confirm the miner address and price.  
     */
    function RemoteMinerOnboardApproved(
        address     owner,
        address     miner,
        Signature   memory  permitMiner
    ) external ensure(permitMiner.deadline) {

        // Check for minting remote miner  
        _mintRemoteMinerCheck(owner, miner, permitMiner);

        // mint new remote miner
        _mintRemoteMiner(owner, miner);

        // Transfer onboarding fee
        if(permitMiner.value != 0) {
            address sender = _msgSender();
            TransferHelper.safeTransferFrom(permitMiner.token, sender, address(this), permitMiner.value);
        }

        checkListener(owner, 1);
        emit MinerOnboarded(owner, miner);
    }

    /**
     * @dev Onboarding a remote miner while the payment has been approved
     * @param owner address receiving the remote miner
     * @param numMiners number of remote miners desired to purchase
     * @param permitMiner signature of miner register authority to confirm the miner address and price.  
     */
    function RemoteMinerOnboardApprovedBatch(
        address     owner,
        uint8       numMiners,
        Signature   memory  permitMiner
    ) external ensure(permitMiner.deadline) {

        // Check for minting remote miner  
        _mintBatchCheckPrice(0, owner, numMiners, permitMiner);

        // mint new remote miner
        address[] memory minersBatch = _mintRemoteMinerBatch(0, owner, numMiners);

        // Transfer onboarding fee
        if(permitMiner.value != 0) {
            address sender = _msgSender();
            TransferHelper.safeTransferFrom(permitMiner.token, sender, address(this), permitMiner.value);
        }

        checkListener(owner, numMiners);
        emit MinerOnboardedBatch(owner, minersBatch);
    }

    /**
     * @dev Claiming and Onboarding a remote miner under the approval
     * @param owner address receiving the remote miner
     * @param remoteType type of the remote miner, indicating different power normally; = 0, default 100W
     * @param numMiners number of remote miners desired to purchase
     * @param permitMiner signature of miner register authority to confirm the miner address and price.  
     */
    function RemoteMinerOnboardBatchClaim(
        address     owner,
        uint256     remoteType,
        uint8       numMiners,
        Signature   memory  permitMiner
    ) external ensure(permitMiner.deadline) {

        // Check for minting remote miner  
        require(permitMiner.deadline > claimTimestamp[owner], "Arkreen Miner: Not Allowed");
        claimTimestamp[owner] = permitMiner.deadline;

        _mintBatchCheckPrice(remoteType, owner, numMiners, permitMiner);

        // mint new remote miner
        address[] memory minersBatch = _mintRemoteMinerBatch(remoteType, owner, numMiners);

        // Transfer onboarding fee
        if(permitMiner.value != 0) {
            address sender = _msgSender();
            TransferHelper.safeTransferFrom(permitMiner.token, sender, address(this), permitMiner.value);
        }

        checkListener(owner, numMiners);
        emit MinerOnboardedBatch(owner, minersBatch);
    }

    function RemoteMinerOnboardNativeBatchClaim(
        address     owner,
        uint256     remoteType,
        uint8       numMiners,
        Signature   memory  permitMiner
    ) external payable ensure(permitMiner.deadline) {

        // Check for minting remote miner  
        require(permitMiner.deadline > claimTimestamp[owner], "Arkreen Miner: Not Allowed");
        claimTimestamp[owner] = permitMiner.deadline;

        // Check payment value
        require( (tokenNative != address(0)) && (tokenNative == permitMiner.token) && 
                  (msg.value == permitMiner.value), "Arkreen Miner: Payment error");

        _mintBatchCheckPrice(remoteType, owner, numMiners, permitMiner);

        // mint new remote miner
        address[] memory minersBatch = _mintRemoteMinerBatch(remoteType, owner, numMiners);

        checkListener(owner, numMiners);
        emit MinerOnboardedBatch(owner, minersBatch);
    }

    /**
     * @dev Check for minting a remote Miner
     * @param owner address receiving the remote miner
     * @param miner address of the remote miner onboarding
     * @param permitMiner signature of miner register authority to confirm the miner address and price.  
     */
    function _mintRemoteMinerCheck( 
        address     owner,
        address     miner,
        Signature   memory  permitMiner
    ) view internal {

        // Check miner is white listed  
        require((whiteListMiner[miner] == uint8(MinerType.RemoteMiner)) ||
                (whiteListMiner[miner] == uint8(MinerType.LiteMiner)), "Arkreen Miner: Wrong Miner");
        require(AllMinersToken[miner] == 0, "Arkreen Miner: Miner Repeated");

        // Check signature
        // keccak256("RemoteMinerOnboard(address owner,address miners,address token,uint256 price,uint256 deadline)");
        bytes32 hashRegister = keccak256(abi.encode(REMOTE_MINER_TYPEHASH, owner, miner, 
                                          permitMiner.token, permitMiner.value, permitMiner.deadline));
        bytes32 digest = keccak256(abi.encodePacked("\x19\x01", DOMAIN_SEPARATOR, hashRegister));
        address recoveredAddress = ecrecover(digest, permitMiner.v, permitMiner.r, permitMiner.s);
  
        require(recoveredAddress != address(0) && 
                recoveredAddress == AllManagers[uint256(MinerManagerType.Register_Authority)], "Arkreen Miner: INVALID_SIGNATURE");
    }

    /**
     * @dev Check the remote miner minting authorization, including owner, quantity and sale value
     * @param remoteType type of the remote miner, indicating different power normally; = 0, default 100W
     * @param owner address receiving the remote miners in batch
     * @param quantity quantity of remote miner for batch sale
     * @param permitMiner signature of miner register authority to confirm the owner address and value.  
     */
    function _mintBatchCheckPrice(
        uint256     remoteType, 
        address     owner,
        uint8       quantity,
        Signature   memory  permitMiner
    ) view internal {

        require((quantity != 0) && (quantity <= numberOfWhiteListBatch(remoteType)), "Arkreen Miner: Wrong Miner Number");
        // require( quantity <= MAX_BATCH_SALE, "Arkreen Miner: Quantity Too More");

        // Check signature
        // keccak256("RemoteMinerOnboardBatch(address owner,uint256 quantity,address token,uint256 value,uint256 deadline)");
        uint256 remoteTypeTag = remoteType << 248;   
        uint256 stationId = uint256((uint16)(remoteType >> 8)) << 232;   
        remoteTypeTag += stationId;

        uint256 typeAndQuantity = remoteTypeTag + uint256(quantity);

        bytes32 hashRegister = keccak256(abi.encode(REMOTE_MINER_BATCH_TYPEHASH, owner, typeAndQuantity,
                                          permitMiner.token, permitMiner.value, permitMiner.deadline));
        bytes32 digest = keccak256(abi.encodePacked("\x19\x01", DOMAIN_SEPARATOR, hashRegister));
        address recoveredAddress = ecrecover(digest, permitMiner.v, permitMiner.r, permitMiner.s);
  
        require(recoveredAddress != address(0) && 
                recoveredAddress == AllManagers[uint256(MinerManagerType.Register_Authority)], "Arkreen Miner: INVALID_SIGNATURE");
    }

    /**
     * @dev mint a remote Miner
     * @param owner address receiving the remote miner
     * @param miner address of the remote miner onboarding
     */
    function _mintRemoteMiner( address owner, address miner) internal {

        // Prepare to mint new remote miner
        Miner memory newMiner;
        newMiner.mAddress = miner;
        newMiner.mType = whiteListMiner[miner];
        newMiner.mStatus = MinerStatus.Normal;
        newMiner.timestamp = uint32(block.timestamp);    

        // mint new remote miner
        delete whiteListMiner[miner];
        _mintMiner(owner, miner, newMiner);
    }

    function _mintMiner( address owner, address miner, Miner memory newMiner) internal {
        uint256 realMinerID = totalSupply() + 1;
        AllMinersToken[miner] = realMinerID;
        AllMinerInfo[realMinerID] = newMiner;
        _safeMint(owner, realMinerID);
    }

    /**
     * @dev mint a remote Miner
     * @param remoteType type of the different remote miners, id=0, the default 100Wh remote miner 
     * @param owner address receiving the remote miner
     * @param numMiners number of remote miners needed to mint
     */
    function _mintRemoteMinerBatch(uint256 remoteType, address owner, uint8 numMiners) internal returns (address[] memory minerList) {

        // Prepare to mint new remote miners
        Miner memory newMiner;
        minerList = new address[](numMiners);

        if (remoteType == 0) {
            newMiner.mType = uint8(MinerType.RemoteMiner);
        } else if (remoteType == 1) {
            newMiner.mType = uint8(MinerType.LiteMiner);
        } else {
            newMiner.mType = (uint8(remoteType) << 4) + uint8(MinerType.RemoteMiner);
        }

        newMiner.mStatus = MinerStatus.Normal;
        newMiner.timestamp = uint32(block.timestamp);   

        uint256 listHead = whiteListBatchPoolIndexHead[remoteType];

        uint256 remoteTypeTag = remoteType << 248;   
        uint256 stationId = uint256((uint16)(remoteType >> 8)) << 232;   
        remoteTypeTag += stationId;

        for(uint8 index; index < numMiners; index++) {
            address miner = whiteListMinerBatch[remoteTypeTag + listHead + index];
            minerList[index] = miner;

            // Check miner is not repeated
            require(AllMinersToken[miner] == 0, "Arkreen Miner: Miner Repeated");

            // mint new remote miner
            newMiner.mAddress = miner;
            _mintMiner(owner, miner, newMiner);
            delete whiteListMinerBatch[remoteTypeTag + listHead +index];
        }
        whiteListBatchPoolIndexHead[remoteType] += numMiners;
    }

    /**
     * @dev Onboarding a remote Miner
     * @param owner address receiving the remote miner
     * @param miner address of the remote miner onboarding
     * @param permitMiner signature of miner register authority to confirm the miner address and price.  
     * @param permitToPay signature of payer to pay the onboarding fee
     */
    function RemoteMinerOnboard(
        address     owner,
        address     miner,
        Sig       memory  permitMiner,
        Signature memory  permitToPay
    ) external ensure(permitToPay.deadline) {

        // Check miner is white listed  
        Signature memory fullPermitMiner = Signature(permitToPay.token, permitToPay.value, permitToPay.deadline,
                                            permitMiner.v, permitMiner.r, permitMiner.s);
 
        _mintRemoteMinerCheck(owner, miner, fullPermitMiner);

        // Permit payment
        address sender = _msgSender();
        IERC20Permit(permitToPay.token).permit(sender, address(this), 
                                        permitToPay.value, permitToPay.deadline, permitToPay.v, permitToPay.r, permitToPay.s);

        // mint new remote miner
        _mintRemoteMiner(owner, miner);

        // Transfer onboarding fee
        if(permitToPay.value != 0) {
            TransferHelper.safeTransferFrom(permitToPay.token, sender, address(this), permitToPay.value);
        }

        checkListener(owner, 1);
        emit MinerOnboarded(owner, miner);
    }


    /**
     * @dev Onboarding remote miners in batch mode
     * @param owner address receiving the remote miner
     * @param numMiners number of remote miners desired to purchase
     * @param permitMiner signature of miner register authority to confirm the miner address and price.  
     * @param permitToPay signature of payer to pay the onboarding fee
     */
    function RemoteMinerOnboardBatch(
        address     owner,
        uint8       numMiners,
        Sig       memory  permitMiner,
        Signature memory  permitToPay
    ) external ensure(permitToPay.deadline) {

        // Check miner is white listed  
        Signature memory fullPermitMiner = Signature(permitToPay.token, permitToPay.value , permitToPay.deadline,
                                            permitMiner.v, permitMiner.r, permitMiner.s);
 
        _mintBatchCheckPrice(0, owner, numMiners, fullPermitMiner);

        // Permit payment
        address sender = _msgSender();
        IERC20Permit(permitToPay.token).permit(sender, address(this), 
                                        permitToPay.value, permitToPay.deadline, permitToPay.v, permitToPay.r, permitToPay.s);

        // mint new remote miner
        address[] memory minersBatch = _mintRemoteMinerBatch(0, owner, numMiners);

        // Transfer onboarding fee
        if(permitToPay.value != 0) {
            TransferHelper.safeTransferFrom(permitToPay.token, sender, address(this), permitToPay.value);
        }

        checkListener(owner, numMiners);
        emit MinerOnboardedBatch(owner, minersBatch);
    }

    function RemoteMinerOnboardAuthority(address owner, uint256 remoteType, uint8 numMiners) external {
        require( msg.sender == AllManagers[uint256(MinerManagerType.Airdrop_Authority)], "Not allowed");

        // mint new remote miner
        address[] memory minersBatch = _mintRemoteMinerBatch(remoteType, owner, numMiners);
        checkListener(owner, numMiners);
        emit MinerOnboardedBatch(owner, minersBatch);
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
    ) external {
      _StandardMinerOnboardMute(owner, miner, deadline, permitMiner);
      callArkreenMinerPro(arkreenMinerPro);
    }

    function _StandardMinerOnboardMute(address owner, address miner, uint256 deadline, Sig calldata permitMiner) internal {}  

    /**
     * @dev Onboarding remote miners in batch
     * @param owners addresses receiving the remote miners
     * @param miners addresses of the remote miners onboarding
     */
    function RemoteMinerOnboardInBatch(
        address[]  calldata   owners,
        address[]  calldata   miners
    ) external onlyMinerManager {

        require(owners.length == miners.length, "Arkreen Miner: Wrong Address List");

        // Prepare to mint new remote miners, only remote miners
        Miner memory newMiner;
        newMiner.mType = uint8(MinerType.RemoteMiner);
        newMiner.mStatus = MinerStatus.Normal;
        newMiner.timestamp = uint32(block.timestamp);

        for(uint256 index; index < owners.length; index++) {
            // Mint new remote miners one by one
            newMiner.mAddress = miners[index];
            _mintMiner(owners[index], newMiner.mAddress, newMiner);
            checkListener(owners[index], 1);
        }

        // Need to emit? If yes, data may be big 
        emit RemoteMinersInBatch(owners, miners);
    }

    function checkListener(address owner, uint256 quantity) internal {
    }

/*
    function checkListener(address owner, uint256 quantity) internal {
        uint256 allListenApps = listenUsers[owner]; 
        if (allListenApps == 0) return;
        while (allListenApps != 0) {
            address appToCall = listenApps[uint8(allListenApps)];
            if(appToCall != address(0)) IArkreenMinerListener(appToCall).minerOnboarded(owner, quantity);
            allListenApps = allListenApps >> 8;
        }
    }
*/

    function registerListener(address owner) external {
        uint256 appId = listenAppIds[msg.sender];
        require( appId != 0, "Arkreen Miner: App Not Registered");

        uint256 allListenApps = listenUsers[owner]; 
        require( (allListenApps >> 248) == 0, "Arkreen Miner: More Registered");

        allListenApps = (allListenApps << 8) + uint8(appId);
        listenUsers[owner] = allListenApps;
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
     * @dev Update the miner white list, add/remove the miners to/from the white list.
     *      Only miners in the white list are allowed to onboard as an NFT.
     * @param typeMiner Type of the miners to add, MinerType.Empty(=0) means to remove the miners
              = 1, LiteMiner; = 2, StandardMiner; = 3, RemoteMiner; = 5, SocketMiner
     * @param addressMiners List of the miners
     */
    function UpdateMinerWhiteList(uint8 typeMiner, address[] calldata addressMiners) external onlyMinerManager {
        address tempAddress;
        for(uint256 index; index < addressMiners.length; index++) {
            tempAddress = addressMiners[index];
            if(typeMiner == 0xFF) {
                delete whiteListMiner[tempAddress];
                continue;
            }
            // Checked for non-existence
            require( tempAddress != address(0) && !tempAddress.isContract(), "Arkreen Miner: Wrong Address");     
            require( whiteListMiner[tempAddress] == 0, "Arkreen Miner: Miners Repeated");      
            whiteListMiner[tempAddress] = uint8(typeMiner);
        }
    }

    /**
     * @dev Update the miner white list for batch sales. Only miners in the white list are allowed to onboard as an NFT.
     * All the miners in this list is located in the default pool.
     * @param addressMiners List of the miners
     */
    function UpdateMinerWhiteListBatch(address[] calldata addressMiners) external onlyMinerManager {
        _UpdateMinerWhiteListBatchMute(addressMiners);
        callArkreenMinerPro(arkreenMinerPro);
    }

    function _UpdateMinerWhiteListBatchMute(address[] calldata addressMiners) internal {}

    /**
     * @dev Remove the miner from the miner white list for batch sales.
     * @param addressMiner The miner to remove
     */
    function RemoveMinerFromWhiteList(uint256 remoteType, address addressMiner) external {
        _RemoveMinerFromWhiteListMute(remoteType, addressMiner);
        callArkreenMinerPro(arkreenMinerPro);
    }

    function _RemoveMinerFromWhiteListMute(uint256 remoteType, address addressMiner) internal {}  

    /**
     * @dev Update the miner white list for the specified pool. Only miners in the white list are allowed to onboard as an NFT.
     * @param remoteType type of the remote miner to claim, which could be used to differentiate the various type of remote miners
     * @param addressMiners List of the miners
     */
    function UpdateMinerWhiteListBatchClaim(uint256 remoteType, address[] calldata addressMiners) public {
        _UpdateMinerWhiteListBatchClaimMute(remoteType, addressMiners);
        callArkreenMinerPro(arkreenMinerPro);
    }

    function _UpdateMinerWhiteListBatchClaimMute(uint256 remoteType, address[] calldata addressMiners) internal {}

    /**
     * @dev get the length of the white list for batch sales
     */
    function numberOfWhiteListBatch(uint256 remoteType) public view returns (uint256) {
      return whiteListBatchPoolIndexTail[remoteType] - whiteListBatchPoolIndexHead[remoteType];
    }

    /**
     * @dev Check if holding miners
     * @param owner owner address
     */
    function isOwner(address owner) external view returns (bool) {
        // just considering number of tokens, token status not checked 
        return balanceOf(owner) > 0;
    }

    /**
     * @dev Set the Arkreen managing accounts 
     * @param managerType type of the managing account
     * @param managerAddress address of the managing account     
     */
    function setManager(uint256 managerType, address managerAddress) external onlyOwner {
      AllManagers[managerType] = managerAddress;
    }

    function setArkreenMinerPro(address minerPro) external onlyOwner {
        arkreenMinerPro = minerPro;
    }

    function registerListenApps(uint256 appid, address newApp) external onlyOwner {
        require ((appid != 0) && (appid <= 255), "Arkreen Miner: Wrong App ID");

        address oldApp = listenApps[appid];
        if ((oldApp != address(0)) && (newApp == address(0))) {
            listenApps[appid] = address(0);
            listenAppIds[oldApp] = 0;
            return;
        }

        if ((oldApp == address(0)) && (newApp != address(0))) {
            listenApps[appid] = newApp;
            listenAppIds[newApp] = appid;
            return;
        }
        revert("Arkreen Miner: Wrong App Data");
    }

    /**
     * @dev Set the native token address
     * @param native address, not checked againt zero address to disable payment by native token    
     */
    function setNativeToken(address native) external onlyOwner {
      tokenNative = native;
    }    

    /**
     * @dev Enable miner transferring
     */
    function enableTransfer() external onlyOwner {
        bTransferAllowed = true;
    }

    /**
     * @dev Withdraw all the onboarding fee
     * @param token address of the token to withdraw, USDC/ARKE
     */
    function withdraw(address token) public {
      _withdrawMute(token);
      callArkreenMinerPro(arkreenMinerPro);
    }

    function _withdrawMute(address token) internal {}  

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

    function tokenURI(uint256 tokenId) public view override returns (string memory){
        return super.tokenURI(tokenId);
    }

    function supportsInterface(bytes4 interfaceId)
        public view override( ERC721EnumerableUpgradeable) returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }

    function setBaseURI(string memory newBaseURI) external virtual onlyOwner {
        baseURI = newBaseURI;
    }

    function _baseURI() internal view virtual override returns (string memory) {
        return baseURI;
    }

}
