// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/AddressUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/cryptography/ECDSAUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";

import '@uniswap/v3-core/contracts/interfaces/IUniswapV3Pool.sol';

import "../interfaces/IRWAsset.sol";

import "../libraries/TickMath.sol";
import "../libraries/TransferHelper.sol";
import "../libraries/DateTime.sol";
import "../libraries/SafeMath.sol";

import "../interfaces/IERC20.sol";
import "../interfaces/IERC20Permit.sol";

import "./RWAssetType.sol";
import "./RWAssetStorage.sol";

contract RWAsset is 
    OwnableUpgradeable,
    UUPSUpgradeable,
    ReentrancyGuardUpgradeable,
    RWAssetStorage
{
    uint32 constant SECONDS_PER_DAY = 3600;                       // 3600 for testnet, 3600 *24 for mainnet

    // Events
    event AddNewInvestToken(uint8 tokenType, address[] tokens);
    event DepositForAsset(address indexed user, uint256 typeAsset, uint256 tokenId, uint256 assetId, uint256 amountDeposit);
    event AddNewAssetType(AssetType newAssetType);
    event WithdrawDeposit(address indexed user, uint256 assetId, uint256 amount);
    event DeliverAsset(uint256 assetId, bytes32 proof);
    event OnboardAsset(uint256 assetId);
    event InvestAsset(address indexed user, uint256 assetId, address token, uint256 amount);
    event InvestExit(address indexed user, uint256 investIndex, address tokenInvest, uint256 amountToken);
    event TakeInvest(address indexed manager, uint256 assetId, address tokenInvest, uint256 amountToken);
    event SetInterestRate(uint8 rateId, uint96 ratePerSecond);
    event ClaimtDeposit(address indexed user, uint256 assetId, uint256 amountDeposit);

    event RepayMonthly(address indexed user, uint256 assetId, address tokenInvest, uint256 amountToken, AssetStatus assetStatus);
    event InvestTakeYield(address indexed user, uint256 investIndex, uint256 months, address tokenInvest, uint256 amountToken, uint256 amountAKRE); 
    event TakeRepayment(uint256 assetId, address tokenInvest, uint256 amountToken); 
    event InvestClearance(uint256 assetId, uint256 monthBeCleared, uint256 amountAKREBeCleared, uint256 amountClearFee);
    event ExecuteFinalClearance(uint256 assetId, uint256 amountAKRE, uint256 amountFund, uint256 amountOwner);
    event ExecuteSlash(uint256 assetId, uint256 amountAKRE);

    modifier ensure(uint256 deadline) {
        require(block.timestamp <= deadline, "RWA: EXPIRED");
        _;
    }

    modifier onlyManager() {
        require(msg.sender == assetManager, "RWA: Not manager");
        _;
    }   

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(address _tokenAKRE, address _assetAuthority, address _assetManager)
        external
        virtual
        initializer
    {
        __Ownable_init_unchained();
        __UUPSUpgradeable_init();
        tokenAKRE = _tokenAKRE;
        assetAuthority = _assetAuthority;
        assetManager = _assetManager;

        DOMAIN_SEPARATOR = keccak256(
            abi.encode(
                keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"),
                keccak256(bytes("Arkreen RWA Fund")),
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

    function callRWAssetPro (address assetPro) internal virtual {
        assembly {
            // Copy msg.data. We take full control of memory in this inline assembly
            // block because it will not return to Solidity code. We overwrite the
            // Solidity scratch pad at memory position 0.
            calldatacopy(0, 0, calldatasize())

            // Call the implementation.
            // out and outsize are 0 because we don't know the size yet.
            let result := delegatecall(gas(), assetPro, 0, calldatasize(), 0, 0)

            // Copy the returned data.
            returndatacopy(0, 0, returndatasize())

            switch result
            // delegatecall returns 0 on error.
            case 0 { revert(0, returndatasize()) }
            default { return(0, returndatasize()) }
        }
    }

    /**
     * @dev Set the asset manager
     */
    function setAssetManager(address manager) external onlyOwner {
        require (manager != address(0), "RWA: Zero address");
        assetManager = manager;
    }

    function setFundReceiver(address receiver) external onlyOwner {
        require (receiver != address(0), "RWA: Zero address");
        fundReceiver = receiver;
    }

    function setRWAPro (address pro) external onlyOwner {
        require (pro != address(0), "RWA: Zero address");
        assetPro = pro;
    }

    function setSlashReceiver (address receiver) external onlyOwner {
        require (receiver != address(0), "RWA: Zero address");
        slashReceiver = receiver;
    }

    function setOracleSwapPair (address oracle) external onlyOwner {
        require (oracle != address(0), "RWA: Zero address");
        oracleSwapPair = oracle;
    }

    /**
     * @dev Add new accepted investment tokens
     * @param tokenType type of the tokens.
     * @param newTokens new token list. should avoid repeation, which is not checked.
     */
    function addNewInvestToken(
        uint8 tokenType, 
        address[] memory newTokens
    ) external onlyManager {

        uint16 numTokenAdded = globalStatus.numTokenAdded;
        for (uint256 index = 0; index < newTokens.length; index++) {
            numTokenAdded += 1;
            allInvestTokens[numTokenAdded].tokenType = tokenType;
            allInvestTokens[numTokenAdded].tokenAddress = newTokens[index];

        }
        globalStatus.numTokenAdded = numTokenAdded;

        emit AddNewInvestToken(tokenType, newTokens);
    }

    /**
     * @dev Define a new asset type 
     * @param newAssetType add a new asset type
     */
    function addNewAssetType(
        AssetType calldata newAssetType
    ) external onlyManager {
        globalStatus.numAssetType += 1;
        require(globalStatus.numAssetType == newAssetType.typeAsset,  "RWA: Wrong asset type");
        assetTypes[newAssetType.typeAsset] = newAssetType;
        emit AddNewAssetType(newAssetType);
    }

    /**
     * @dev Set interest rate
     */
    function setInterestRate(uint8 rateId, uint96 ratePerSecond) external onlyManager {
        require(rateId != 0,  "RWA: Wrong rate id");
        allInterestRates[rateId].ratePerSecond = ratePerSecond;
        emit SetInterestRate(rateId, ratePerSecond);
    }

    function depositForAsset (uint16 typeAsset, uint16 tokenId) external {

        require (assetTypes[typeAsset].typeAsset != 0, "RWA: Asset type not defined");
        require (assetTypes[typeAsset].investTokenType == allInvestTokens[tokenId].tokenType, "RWA: Wrong token");

        // Generate the new asset id
        uint32 assetId = globalStatus.numAssets + 1;
        globalStatus.numAssets = assetId;

        // Save new asset info
        assetList[assetId].assetOwner = msg.sender;
        assetList[assetId].tokenId = tokenId;
        assetList[assetId].typeAsset = typeAsset;
        assetList[assetId].amountDeposit = assetTypes[typeAsset].amountDeposit;   // depost amount may be modified for asset type
        assetList[assetId].status = AssetStatus.Deposited;

        // append to user asset list
        userAssetList[msg.sender].push(assetId);

        // Transfer deposit AKRE
        uint256 amountDepositAKRE = uint256(assetTypes[typeAsset].amountDeposit) * (1 ether);
        TransferHelper.safeTransferFrom(tokenAKRE, msg.sender, address(this), amountDepositAKRE);

        emit DepositForAsset(msg.sender, typeAsset, tokenId, assetId, amountDepositAKRE);
    }

    function withdrawDeposit(
        uint32 assetId,
        uint256 deadline,
        Sig memory withdrawPermit
    ) external ensure(deadline) {

        require (assetList[assetId].assetOwner == msg.sender, "RWA: Not Owner");
        require (assetList[assetId].status == AssetStatus.Deposited, "RWA: Not allowed");

        uint256 amountDeposit = uint256(assetList[assetId].amountDeposit) * (1 ether); 

        // Check signature
        // keccak256("WithdrawDeposit(uint32 assetId,address owner,uint256 amount,uint256 deadline)");
        bytes32 hashRegister = keccak256(abi.encode(WITHDRAW_DEPOSIT_TYPEHASH, 
                                                      assetId, msg.sender, amountDeposit, deadline));
        bytes32 digest = keccak256(abi.encodePacked("\x19\x01", DOMAIN_SEPARATOR, hashRegister));
        address authorityAddress = ECDSAUpgradeable.recover(digest, withdrawPermit.v, withdrawPermit.r, withdrawPermit.s);
        require(authorityAddress == assetAuthority, "RWA: Wrong Signature");
  
        assetList[assetId].status = AssetStatus.Withdrawed;
        TransferHelper.safeTransfer(tokenAKRE, msg.sender, amountDeposit);
        emit WithdrawDeposit(msg.sender, assetId, amountDeposit);
    }

    function claimtDeposit(uint32 assetId) external  {

        require (assetList[assetId].assetOwner == msg.sender, "RWA: Not Owner");
        require (assetList[assetId].status == AssetStatus.Completed, "RWA: Not allowed");

        ClearanceDetails storage assetClearanceRef = assetClearance[assetId];
        uint256 amountDeposit = uint256(assetClearanceRef.amountAKREAvailable); 
        require (amountDeposit > 0, "RWA: No more deposit");

        assetClearanceRef.amountAKREAvailable = 0;
  
        TransferHelper.safeTransfer(tokenAKRE, msg.sender, amountDeposit);
        emit ClaimtDeposit(msg.sender, assetId, amountDeposit);
    }

    /**
     * @dev Declare the asset has been delivered 
     * @param assetId the asset id that has been delivered
     * @param deliveryProof the proof info proving the delivery, which may be the hash of all delivery information.
     */
    function deliverAsset(
        uint256 assetId,
        bytes32 deliveryProof
    ) external onlyManager {

        require (assetList[uint32(assetId)].status == AssetStatus.Deposited, "RWA: Not allowed");
        assetList[uint32(assetId)].status = AssetStatus.Delivered;

        uint32 numDelivered = globalStatus.numDelivered + 1;
        globalStatus.numDelivered = numDelivered;
        assetList[uint32(assetId)].deliverProofId = numDelivered;

        deliveryProofList[numDelivered] = deliveryProof;

        emit DeliverAsset(assetId, deliveryProof);
    }

    /**
     * @dev Onboarding the asset
     * @param assetId the asset id that has been onboarded
     */
    function onboardAsset(
        uint32 assetId
    ) external onlyManager {

        require (assetList[assetId].status == AssetStatus.Delivered, "RWA: Not allowed");
        assetList[assetId].status = AssetStatus.Onboarded;

        globalStatus.numOnboarded += 1;
        assetList[assetId].onboardTimestamp = uint32(block.timestamp);

        //uint16 typeAsset = assetList[assetId].typeAsset;

        AssetType storage assetTypesRef = assetTypes[assetList[assetId].typeAsset];

        assetRepayStatus[assetId].monthDueRepay = 1; 
        //assetRepayStatus[assetId].timestampNextDue = uint32(DateTime.addMonthsEnd(block.timestamp, 1));
        assetRepayStatus[assetId].timestampNextDue = uint32((block.timestamp / 3600 * 24) * (3600 * 24) +  3600 * 24 - 1);

        assetRepayStatus[assetId].amountRepayDue = assetTypesRef.amountRepayMonthly;

        assetClearance[assetId].productToTriggerClearance = uint80(assetTypesRef.amountRepayMonthly) * 
                                                            uint80(assetTypesRef.paramsClearance >> 8) *
                                                            SECONDS_PER_DAY;

        assetClearance[assetId].amountAKREAvailable = uint96(assetTypesRef.amountDeposit) * (1 ether);
        assetClearance[assetId].timesSlashTop = assetTypesRef.timesSlashTop;
        
        emit OnboardAsset(assetId);
    }

    /**
     * @dev Investing the asset
     * @param assetId the asset id that has been onboarded
     * @param numQuota number of quota to invest
     */
    function investAsset(
        uint32 assetId,
        uint16 numQuota
    ) external {

        AssetStatus statusAsset = assetList[assetId].status;
        require ((statusAsset >= AssetStatus.Delivered) && (statusAsset < AssetStatus.Clearing), "RWA: Status not allowed");

        uint16 typeAsset = assetList[assetId].typeAsset;

        if (statusAsset == AssetStatus.Onboarded) {
            uint32 onboardTimestamp = assetList[assetId].onboardTimestamp;
            uint32 overdueTime = onboardTimestamp + uint32(assetTypes[typeAsset].maxInvestOverdue) * SECONDS_PER_DAY;
            require (uint32(block.timestamp) < overdueTime, "RWA: Invest overdued");
        }

        uint16 numQuotaTotal = assetList[assetId].numQuotaTotal + numQuota;   
        require (numQuotaTotal <= assetTypes[typeAsset].investQuota, "RWA: Invest overflowed");
        assetList[assetId].numQuotaTotal = numQuotaTotal;

        uint16 numInvestings = assetList[assetId].numInvestings + 1;
        assetList[assetId].numInvestings = numInvestings;

        uint48 indexInvesting = uint48(assetId << 16) + numInvestings; 

        userInvestList[msg.sender].push(indexInvesting);

        investList[indexInvesting].invester = msg.sender;
        investList[indexInvesting].status = InvestStatus.InvestNormal;
        //investList[indexInvesting].assetId = assetId;
        investList[indexInvesting].numQuota = numQuota;
        investList[indexInvesting].timestamp = uint32(block.timestamp);
        investList[indexInvesting].monthTaken = 0;                              // this line may be removed

        globalStatus.numInvest += 1;

        uint256 amountToken = uint256(numQuota) * uint256(assetTypes[typeAsset].valuePerInvest);
        address tokenInvest = allInvestTokens[assetList[assetId].tokenId].tokenAddress;
        TransferHelper.safeTransferFrom(tokenInvest, msg.sender, address(this), amountToken);

        emit InvestAsset(msg.sender, assetId, tokenInvest, amountToken);
    }

    /**
     * @dev Exit the asset investment before onboarding
     * @param investIndex the index of the asset investment
     */
    function investExit(uint48 investIndex) external {

        Invest storage investToAbort = investList[investIndex];

        require (investToAbort.invester == msg.sender, "RWA: Not owner");
        require (investToAbort.status == InvestStatus.InvestNormal, "RWA: Wrong status");

        uint32 assetId = uint32(investIndex >> 16);
        uint16 typeAsset = assetList[assetId].typeAsset;

        AssetStatus statusAsset = assetList[assetId].status;
        require ((statusAsset <= AssetStatus.Delivered) , "RWA: Status not allowed");   // Not allowed after onboarding

        uint32 minStay = investToAbort.timestamp + uint32(assetTypes[typeAsset].minInvestExit) * SECONDS_PER_DAY;
        require (uint32(block.timestamp) >= minStay, "RWA: Need to stay");

        investList[investIndex].status = InvestStatus.InvestAborted;
        assetList[assetId].numQuotaTotal -= investToAbort.numQuota;

        uint256 amountToken = uint256(investToAbort.numQuota) * uint256(assetTypes[typeAsset].valuePerInvest);
        address tokenInvest = allInvestTokens[assetList[assetId].tokenId].tokenAddress;

        TransferHelper.safeTransfer(tokenInvest, msg.sender, amountToken);

        emit InvestExit(msg.sender, investIndex, tokenInvest, amountToken);
    }

    /**
     * @dev Take the asset investment, but keep the clearance fee for clearance
     * @param assetId the index of the asset investment
     */
    function takeInvest(uint32 assetId) external onlyManager {

        AssetDetails storage assetStatuseRef = assetList[assetId];
        require (assetStatuseRef.status >= AssetStatus.Onboarded, "RWA: Status not allowed");

        AssetType storage assetTypesRef = assetTypes[assetStatuseRef.typeAsset];

        uint16 numQuota = assetRepayStatus[assetId].numInvestTaken + uint8(assetTypesRef.paramsClearance);
        require(assetStatuseRef.numQuotaTotal > numQuota, "RWA: Low investment");

        numQuota = assetStatuseRef.numQuotaTotal - numQuota;
        assetRepayStatus[assetId].numInvestTaken += numQuota;

        uint256 amountToken = uint256(numQuota) * uint256(assetTypesRef.valuePerInvest);
        address tokenInvest = allInvestTokens[assetStatuseRef.tokenId].tokenAddress;

        address receiver = fundReceiver;
        if (receiver == address(0)) receiver = msg.sender;
        TransferHelper.safeTransfer(tokenInvest, receiver, amountToken);

        emit TakeInvest(msg.sender, assetId, tokenInvest, amountToken);
    }
   
    /**
     * @dev Exit the asset investment before onboarding
     * @param assetId the index of the asset investment
     * @param timeToPay the index of the asset investment     
     */
    function queryRepay(
        uint32 assetId,
        uint32 timeToPay
    ) external pure returns (uint256, uint256) {
      //return (assetId, timeToPay);
    }

    /**
     * @dev Repay the asset installment monthly
     * @param assetId index of the asset investment
     * @param amountToken amount of the repay
     */
    // solc-ignore-next-line unused-param
    function repayMonthly(uint32 assetId, uint48 amountToken) external {
        callRWAssetPro (assetPro);
    }

    // solc-ignore-next-line unused-param
    function takeRepayment(uint32 assetId) external {
        callRWAssetPro (assetPro);
    }

    // solc-ignore-next-line unused-param
    function executeInvestClearance(uint32 assetId) external {
        callRWAssetPro (assetPro);
    }

    // solc-ignore-next-line unused-param
    function executeFinalClearance(uint32 assetId, uint96 amountAKRE, uint96 amountAKREFund) external onlyManager {
        callRWAssetPro (assetPro);
    }

    // solc-ignore-next-line unused-param
    function executeSlash(uint32 assetId, uint96 amountAKRE) external onlyManager {
        callRWAssetPro (assetPro);
    }

    // solc-ignore-next-line unused-param
    function takeYield(uint48 investIndex) external {
        callRWAssetPro (assetPro);
    }

    function rpow(uint256 rate, uint256 exp) external pure returns (uint256){
      return SafeMath.rpow(rate, exp);
    }
}
