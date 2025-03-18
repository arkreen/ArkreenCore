// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "@openzeppelin/contracts-upgradeable/utils/AddressUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC721/extensions/ERC721EnumerableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";

import "./interfaces/IMinerRegister.sol";
import "./interfaces/IArkreenRegistry.sol";
import "./interfaces/IArkreenMiner.sol";
import "./interfaces/IArkreenBadge.sol";

import "./interfaces/IERC20.sol";
import "./libraries/TransferHelper.sol";
import "./interfaces/IERC20Permit.sol";
import "./ArkreenRECIssuanceStorage.sol";
import "./interfaces/IPausable.sol";

import "@openzeppelin/contracts/utils/StorageSlot.sol";

contract ArkreenRECIssuance is
    OwnableUpgradeable,
    UUPSUpgradeable,
    ERC721EnumerableUpgradeable,
    ArkreenRECIssuanceStorage,
    ReentrancyGuardUpgradeable
{
    // using SafeMath for uint256;    // seems not necessary
    using AddressUpgradeable for address;

    // Public variables
    string public constant NAME = "Arkreen RE Certificate";
    string public constant SYMBOL = "AREC";

    // Events
    event RECRequested(address owner, uint256 tokenId);
    event RECRejected(uint256 tokenId);
    event RECDataUpdated(address owner, uint256 tokenId);
    event RECCertified(address issuer, uint256 tokenId);
    event RECCanceled(address owner, uint256 tokenId);    
    event RECLiquidized(address owner, uint256 tokenId, uint256 amountREC);
    event RedeemFinished(address redeemEntity, uint256 tokenId, uint256 offsetActionId);
    event ESGBatchMinted(address owner, uint256 tokenId);
    event ESGBatchDataUpdated(address owner, uint256 tokenId);

    // Modifiers
    modifier ensure(uint deadline) {
        require(deadline >= block.timestamp, "RECIssuance: EXPIRED");
        _;
    }

    modifier whenNotPaused() {
        require(!IPausable(arkreenRegistry).paused(), "AREC: Paused");
        _;
    }    
  
    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(address _tokenAKRE, address arkRegistry) external virtual initializer {
        __Ownable_init_unchained();
        __UUPSUpgradeable_init();
        __ERC721_init_unchained(NAME, SYMBOL);
        tokenAKRE = _tokenAKRE;
        arkreenRegistry = arkRegistry;
        baseURI = "https://www.arkreen.com/AREC/" ;
    }

    function postUpdate() external onlyProxy onlyOwner 
    {}

    function _authorizeUpgrade(address newImplementation) internal virtual override onlyOwner
    {}    

    receive() external payable {
        revert("Wrong calling"); // only accept WMATIC via fallback from the WMATIC contract
    }  

    /**
     * @dev Fallback function that delegates calls to the address returned by `_implementation()`. Will run if no other
     * function in the contract matches the call data.
     */
    fallback () external payable virtual {
      callExt();
    }
    
    function callExt() internal virtual {
       // solhint-disable-next-line no-inline-assembly
        address addrESG = getESGExtAddress();
        assembly {
            // Copy msg.data. We take full control of memory in this inline assembly
            // block because it will not return to Solidity code. We overwrite the
            // Solidity scratch pad at memory position 0.
            calldatacopy(0, 0, calldatasize())

            // Call the implementation.
            // out and outsize are 0 because we don't know the size yet.
            let result := delegatecall(gas(), addrESG, 0, calldatasize(), 0, 0)

            // Copy the returned data.
            returndatacopy(0, 0, returndatasize())

            switch result
            // delegatecall returns 0 on error.
            case 0 { revert(0, returndatasize()) }
            default { return(0, returndatasize()) }
        }
    }    

    /**
     * @dev To mint the REC NFT. After minted, the NFT is in pending status.
     * It needs to certified by the issuer before it can be transferred/retired/liquidized.
     * recRequest The request info to mint the REC NFT
     * permitToPay Payment info to mint the REC NFT
     */
  
    function mintRECRequest(
        RECRequest calldata recRequest,
        Signature calldata permitToPay
    ) external ensure(permitToPay.deadline) whenNotPaused nonReentrant returns (uint256 tokenId) {

        // Check issuer address
        require(IArkreenRegistry(arkreenRegistry).isRECIssuer(recRequest.issuer), "AREC: Wrong Issuer");

        // Check REC time period
        require(recRequest.startTime < recRequest.endTime && recRequest.endTime < block.timestamp, "AREC: Wrong Period");

        // Check the caller be acceptable miner
        address sender = _msgSender();
        address arkreenMiner = IArkreenRegistry(arkreenRegistry).getArkreenMiner();     /// for testing ///

        // require(arkreenMiner.isContract(), "AREC: Wrong Miner Contract");            // no need to check
        require(IArkreenMiner(arkreenMiner).isOwner(sender), "AREC: Not Miner");        /// May Removed for testing ///

        // Check payment appoval
        uint256 rateToIssue = paymentTokenPrice[permitToPay.token];
        require( (permitToPay.token == tokenAKRE) && (rateToIssue != 0), "AREC: Wrong Payment Token");

        uint256 valuePayment = recRequest.amountREC * rateToIssue;   // Rate is caluated based 10**9
        require( permitToPay.value >= valuePayment, "AREC: Low Payment Value");

        IERC20Permit(permitToPay.token).permit(sender, address(this), 
                        permitToPay.value, permitToPay.deadline, permitToPay.v, permitToPay.r, permitToPay.s);

        tokenId = totalSupply() + 1;        
        _safeMint(sender, tokenId);

        // Prepare REC data
        RECData memory recData;
        recData.issuer =  recRequest.issuer;
        recData.serialNumber = "";
        recData.minter = sender;
        recData.startTime =  recRequest.startTime;
        recData.endTime =  recRequest.endTime;
        recData.amountREC =  recRequest.amountREC;
        recData.status = uint8(RECStatus.Pending);        
        recData.cID =  recRequest.cID;
        recData.region =  recRequest.region;        
        recData.url =  recRequest.url;
        recData.memo =  recRequest.memo;

        allRECData[tokenId] = recData;

        PayInfo memory payInfo = PayInfo({token: permitToPay.token, value: valuePayment});
        allPayInfo[tokenId] = payInfo;

        emit RECRequested(sender, tokenId);

        // Transfer the REC mint fee
        TransferHelper.safeTransferFrom(permitToPay.token, _msgSender(), address(this), valuePayment);
    }

    /**
     * @dev To reject the REC NFT mint request by the issuer for any reason.
     * Only can be called while the NFT is in pending state.
     * tokenId The ID of the REC NFT
     */
    function rejectRECRequest(uint256 tokenId) external whenNotPaused
    {
        // Check that the call is the issuer of the token
        address issuer = _msgSender();
        RECData storage recData = allRECData[tokenId];

        uint16 idAssetType = recData.idAsset;
        if(idAssetType == 0) {
            require(IArkreenRegistry(arkreenRegistry).isRECIssuer(issuer), "AREC: Not Issuer");
            require(issuer == recData.issuer, "AREC: Wrong Issuer");
        } else {
            (address issuerAsset, , , , ) = IArkreenRegistry(arkreenRegistry).getAssetInfo(idAssetType);
            require(issuer == issuerAsset, "AREC: Wrong Issuer");
        }

        // Only pending REC can be cancelled
        require(recData.status == uint8(RECStatus.Pending), "AREC: Wrong Status");  

        // Set status to Rejected
        recData.status = uint8(RECStatus.Rejected);
        emit RECRejected(tokenId);
    }
    
    /**
     * @dev To update the REC NFT mint info while it is rejected by the the issuer.
     * tokenId The ID of the REC NFT to update
     */
    function updateRECData(
        uint256         tokenID,
        address         issuer,
        string memory   region,
        string memory   url,
        string memory   memo) external whenNotPaused
    {
        // Only REC owner allowed to change the REC data
        require(ownerOf(tokenID) == _msgSender(), "AREC: Not Owner");     // owner should be the minter also

        // Only rejected REC can be cancelled
        RECData storage recData = allRECData[tokenID];
        require(recData.status <= uint8(RECStatus.Rejected), "AREC: Wrong Status");  

        // Check issuer address
        require(IArkreenRegistry(arkreenRegistry).isRECIssuer(issuer), "AREC: Wrong Issuer");

        recData.issuer = issuer;                              
        recData.region = region;                    // Null string is not checked, as it could be set to null
        recData.url = url;
        recData.memo = memo;

        recData.status =  uint8(RECStatus.Pending);
        emit RECDataUpdated(_msgSender(), tokenID);
    }

    /**
     * @dev To certify the REC NFT mint request by the REC issuer.
     * tokenId The ID of the REC NFT to certify.
     * serialNumber The SN of REC NFT certificaton.
     */
    function certifyRECRequest(uint256 tokenID, string memory serialNumber) external whenNotPaused
    {
        // Check the issuer
        address issuer = _msgSender();
        RECData storage recData = allRECData[tokenID];

        uint16 idAssetType = recData.idAsset;
        if(idAssetType == 0) {
            require(IArkreenRegistry(arkreenRegistry).isRECIssuer(issuer), "AREC: Not Issuer");
            require(issuer == recData.issuer, "AREC: Wrong Issuer");
        } else {
            (address issuerAsset, , , , ) = IArkreenRegistry(arkreenRegistry).getAssetInfo(idAssetType);
            require(issuer == issuerAsset, "AREC: Wrong Issuer");
        }

        // Only pending REC can be Certified
        require(recData.status == uint8(RECStatus.Pending), "AREC: Wrong Status");  
        require(bytes(recData.cID).length > 20, "AREC: Wrong CID");  

        // Uniqueness is not checked here assuming the issuer has checked this point
        recData.serialNumber = serialNumber;            
        recData.status = uint8(RECStatus.Certified);

        address paymentToken = allPayInfo[tokenID].token;
        uint256 paymentValue = allPayInfo[tokenID].value;

        uint256 amountREC = recData.amountREC;
        allRECByIssuer[issuer] += amountREC;                        // REC amount by the issuer
        allRECIssued += amountREC;                                  // All REC amount

        // Update the issuer total payment value
        paymentByIssuer[issuer][paymentToken] += paymentValue;

        // delete the payment info to save storage
        delete allPayInfo[tokenID];

        emit RECCertified(issuer, tokenID);
    }

    /**
     * @dev Redeem the REC NFT by retiring the NFT and registering an offset action
     */
    function redeem(uint256 tokenId) public virtual whenNotPaused returns (uint256 offsetActionId) {
        offsetActionId = _redeem(_msgSender(), tokenId);
    }

    /**
     * @dev The third party triggers the RE redeem in the approval of the owner
     */
    function redeemFrom(address account, uint256 tokenId)
        external virtual whenNotPaused returns (uint256 offsetActionId) 
    {
        require(_isApprovedOrOwner(msg.sender, tokenId), "AREC: Not Approved");
        offsetActionId = _redeem(account, tokenId);
    }
   
    /**
     * @dev The internal function to offset the REC NFT.
     */
    function _redeem(address owner, uint256 tokenId) internal virtual returns (uint256 offsetActionId) {

        // Check if the REC owner
        require( ownerOf(tokenId) == owner, "AREC: Not Owner");

        // Check if the REC NFT is in certified stataus
        require( allRECData[tokenId].status == uint8(RECStatus.Certified), "AREC: Not Certified");

        // Register the offset event
        address badgeContract = IArkreenRegistry(arkreenRegistry).getArkreenRetirement();
        address issuerREC = allRECData[tokenId].issuer;
        uint256 amount = allRECData[tokenId].amountREC;
        offsetActionId = IArkreenBadge(badgeContract).registerOffset(owner, issuerREC, amount, tokenId);

        // Send the REC NFT to the retirement contract and set the REC NFT status to be Retired
        _safeTransfer(owner, badgeContract, tokenId, "Redeem");
        allRECData[tokenId].status = uint8(RECStatus.Retired);
        allRECRedeemed += amount;

        emit RedeemFinished(owner, tokenId, offsetActionId);
    }

   /**
     * @dev Redeem the REC NFT and mint an offset certificate.
     * @param tokenId Id of the REC NFT to redeem.
     * @param beneficiary Beneficiary address for whom the REC was offset.
     * @param offsetEntityID ID string of the offset entity.
     * @param beneficiaryID ID string of the beneficiary.
     * @param offsetMessage Message to illustrate the offset intention.
     */
    function redeemAndMintCertificate(
        uint256         tokenId, 
        address         beneficiary,
        string calldata offsetEntityID,
        string calldata beneficiaryID,
        string calldata offsetMessage
    ) external whenNotPaused virtual {

        // Check if approved
        require(_isApprovedOrOwner(msg.sender, tokenId), "AREC: Not Approved");

        // Redeem the specified REC NFT
        address owner = ownerOf(tokenId);
        uint256 offsetActionId = _redeem(owner, tokenId);

        uint256[] memory offsetActionIds = new uint256[](1);
        offsetActionIds[0] = offsetActionId;

        // Issue the offset certificate NFT
        address badgeContract = IArkreenRegistry(arkreenRegistry).getArkreenRetirement();
        IArkreenBadge(badgeContract)
                .mintCertificate(owner, beneficiary, offsetEntityID, beneficiaryID, offsetMessage, offsetActionIds);
   
    }   

   /**
     * @dev liquidize the REC NFT and mint the corresponding ERC20 token
     * @param tokenId Id of the REC NFT to liquidize
     */
    function liquidizeREC( uint256 tokenId ) external whenNotPaused {

        require(_isApprovedOrOwner(msg.sender, tokenId), "AREC: Not Approved");

        // Check if the REC status
        RECData storage recData = allRECData[tokenId];
        require( recData.status == uint8(RECStatus.Certified), "AREC: Not Certified");

        uint256 amountREC = recData.amountREC;

        address tokenREC;
        uint256 idAsset = recData.idAsset;

        if(idAsset == 0) {
            address issuerREC = recData.issuer;
            tokenREC = IArkreenRegistry(arkreenRegistry).getRECToken(issuerREC, idAsset);
        } else {
            (, tokenREC, , , ) = IArkreenRegistry(arkreenRegistry).getAssetInfo(idAsset);
        }

        // Transfer the REC NFT to the ERC20 token contract to be liquidized
        address owner = ownerOf(tokenId);        
        _safeTransfer(owner, tokenREC, tokenId, "");

        // Set the AREC status to be Liquidized
        recData.status = uint8(RECStatus.Liquidized);

        // Accumulate the Liquidized REC amount
        allRECLiquidized += amountREC;
        emit RECLiquidized(owner, tokenId, amountREC);
    }

    /// @dev retrieve all AREC data
    function getRECData(uint256 tokenId) public view virtual returns (RECData memory) {
        return (allRECData[tokenId]);
    }

    /// @dev retrieve all AREC data
    function getRECDataCore(uint256 tokenId) public view virtual returns (
                                address issuer, uint128 amountREC, uint8 status, uint16 idAsset) {
        RECData storage recData = allRECData[tokenId];                          
        return (recData.issuer, recData.amountREC, recData.status, recData.idAsset);
    }

    /**
     * @dev Add/update/remove AREC isssaunce payment token/price. 
     * If the token existed, and if price is not zero, update the price, 
     *                           if the price is zero, remove the token/price.
     * If the token not existed, add the price
     * @param token address of the token to add/update/remove
     * @param price the price to pay AREC issuance, or, =0, remove the token/price.
     */
    function updateARECMintPrice(address token, uint256 price) external virtual onlyOwner {
      require(token.isContract(), "AREC: Wrong token");

      for(uint256 index; index < paymentTokens.length; index++) {
        if(paymentTokens[index] == token) {
          if(price == 0) {
            // Zero price means remove the token/price
            if(index != (paymentTokens.length-1)) {
              // replace by the last token/price
              paymentTokens[index] = paymentTokens[paymentTokens.length-1];     
            }
            paymentTokens.pop();                  // pop the last price as it is moved to the deleted position  
            delete paymentTokenPrice[token];
          } else {
            paymentTokenPrice[token] = price;         // update the price
          } 
          return; 
        }
      }
      require(price != 0, "AREC: Zero Price");
      paymentTokens.push(token);
      paymentTokenPrice[token] = price;
    }

    /**
     * @dev Withdraw all the REC certification fee
     * @param token address of the token to withdraw, USDC/ARKE
     */
    function withdraw(address token, address receiver, uint256 amount) public whenNotPaused onlyOwner {
        if(receiver == address(0)) {
            receiver = _msgSender();
        }
        if(amount == 0) {
            amount = IERC20(token).balanceOf(address(this));
        }
        TransferHelper.safeTransfer(token, receiver, amount);
    }

    /**
     * @dev Hook that is called before any token transfer.
     */
    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 tokenId
    ) internal virtual override (ERC721EnumerableUpgradeable) {

        // Only certified REC can be transferred
        if(from != address(0)) {
            RECData storage recData = allRECData[tokenId];
            if(recData.status == uint8(RECStatus.Liquidized)) {
                address issuerREC = recData.issuer;
                address tokenREC = IArkreenRegistry(arkreenRegistry).getRECToken(issuerREC, recData.idAsset);
                address arkreenBadge = IArkreenRegistry(arkreenRegistry).getArkreenRetirement();

                // Only the ART contract can restore the AREC
                require(msg.sender == tokenREC, "AREC: Not Allowed");

                if(to == arkreenBadge) {
                    recData.status = uint8(RECStatus.Retired);
                } else {
                    uint256 amountREC = recData.amountREC;
                    
                    // Modified the Liquidized REC amount
                    allRECLiquidized -= amountREC;

                    // Set the AREC status to be Liquidized
                    recData.status = uint8(RECStatus.Certified);
                }
            }
            else {
                require(recData.status == uint8(RECStatus.Certified), "AREC: Wrong Status");
            }
        }
        super._beforeTokenTransfer(from, to, tokenId);
    }  
  
    function setTokenAKRE(address _tokenAKRE) external virtual onlyOwner {
        require(_tokenAKRE != address(0), "Zero Address");
        tokenAKRE = _tokenAKRE;
    }

    function setESGExtAddress(address addrESGExt) external virtual onlyOwner {
        StorageSlot.getAddressSlot(_ESG_EXT_SLOT).value = addrESGExt; 
    }

    function getESGExtAddress() internal view returns (address) {
        return StorageSlot.getAddressSlot(_ESG_EXT_SLOT).value;
    }    

    function setBaseURI(string memory newBaseURI) external virtual onlyOwner {
        baseURI = newBaseURI;
    }

    function _baseURI() internal view virtual override returns (string memory) {
        return baseURI;
    }
    
    /**
     * @dev Returns the URI for the given token.  
     */    
    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        _requireMinted(tokenId);
        RECData memory arecData = getRECData(tokenId);
   
        return IArkreenRECIssuanceImage(arkreenRECImage).getARECSVG(tokenId, ownerOf(tokenId), arecData);
    }

    function setARECImage(address newImage) external virtual onlyOwner {
        require(newImage != address(0), "ARB: Zero Address");
        arkreenRECImage = IArkreenRECIssuanceImage(newImage);
    }  

    // solc-ignore-next-line unused-param
    function mintESGBatch(uint256 idAssetType, uint256 amountREC, Signature calldata permitToPay) external {
        callExt();
    }

    // solc-ignore-next-line unused-param
    function updateRECDataExt(uint256 tokenID, uint32 startTime, uint32 endTime, string calldata cID, 
                              // solc-ignore-next-line unused-param
                              string calldata region, string calldata url, string calldata memo) external {
        callExt();
    }

    // solc-ignore-next-line unused-param
    function cancelRECRequest(uint256 tokenID) external {
        callExt();
    }

    /*
    // solc-ignore-next-line unused-param
    function allARECMintPrice() external view virtual returns (RECMintPrice[] memory) {
        callExt();
    }
  

    // solc-ignore-next-line unused-param
    function manageMVPAddress(bool op, address[] calldata listMVP) external  {
        callExt();
    }
    */
}