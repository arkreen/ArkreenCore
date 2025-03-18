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

// Import this file to use console.log
// import "hardhat/console.sol";

contract ArkreenRECIssuanceExt is
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

    /**
     * @dev To mint the empty AREC NFT as as ESG batch, which must be updated later to be successfully confirmed.
     * @param idAssetType The type of the AREC asset to issue
     * @param amountREC The amount if the AREC asset target to issue.
     * permitToPay Payment info to mint the AREC NFT
     */
    function mintESGBatch(
        uint256   idAssetType,
        uint256   amountREC,
        Signature calldata permitToPay
    ) external ensure(permitToPay.deadline) whenNotPaused nonReentrant returns (uint256 tokenId) {

        // Check the caller be the MVP enity
        address sender = _msgSender();
        require( AllMVPEntity[sender], "AREC: Not Allowed");

        // Check and get asset information
        (address issuer, , address tokenPay, uint128 rateToIssue, ) 
                                                = IArkreenRegistry(arkreenRegistry).getAssetInfo(idAssetType);

        // Check payment appoval
        require( permitToPay.token == tokenPay, "AREC: Wrong Payment Token");

        uint256 valuePayment = amountREC * rateToIssue / ( 10**9);              // Rate is caluated based 10**9

        if(permitToPay.value != 0) {
          require( permitToPay.value >= valuePayment, "AREC: Low Payment Value");

          IERC20Permit(permitToPay.token).permit(sender, address(this), 
                          permitToPay.value, permitToPay.deadline, permitToPay.v, permitToPay.r, permitToPay.s);
        }

        tokenId = totalSupply() + 1;
        _safeMint(sender, tokenId);

        // Prepare REC data
        RECData memory recData;
        recData.issuer =  issuer;
        recData.minter = sender;
        recData.amountREC =  uint128(amountREC);
        recData.status = uint8(RECStatus.Pending);
        recData.idAsset = uint16(idAssetType);

        allRECData[tokenId] = recData;

        PayInfo memory payInfo = PayInfo({token: permitToPay.token, value: valuePayment});
        allPayInfo[tokenId] = payInfo;

        emit ESGBatchMinted(sender, tokenId);

        // Transfer the REC mint fee
        if(valuePayment != 0) {
            TransferHelper.safeTransferFrom(permitToPay.token, _msgSender(), address(this), valuePayment);
        }
    }

    /**
     * @dev To update the REC NFT mint info while it is rejected by the the issuer.
     * tokenId The ID of the REC NFT to update
     */
    function updateRECDataExt(
        uint256         tokenID,
        uint32          startTime,
        uint32          endTime,
        string calldata cID,
        string calldata region,
        string calldata url,
        string calldata memo) external whenNotPaused
    {
        // Check the caller be the MVP enity
        address sender = _msgSender();
        require( AllMVPEntity[sender], "AREC: Not Allowed");

        // Only ESG_AREC owner allowed to change the REC data
        require(ownerOf(tokenID) == _msgSender(), "AREC: Not Owner");     // owner should be the minter also

        // Only Pending and Rejected ESG_AREC can be updated
        RECData storage recData = allRECData[tokenID];
        require(recData.status <= uint8(RECStatus.Rejected), "AREC: Wrong Status");

        if(startTime != 0) recData.startTime = startTime;
        if(endTime != 0) recData.endTime = endTime;
        if(bytes(cID).length != 0) recData.cID = cID;
        if(bytes(region).length != 0) recData.region = region;
        if(bytes(url).length != 0) recData.url = url;
        if(bytes(memo).length != 0) recData.memo = memo;

        recData.status =  uint8(RECStatus.Pending);
        emit ESGBatchDataUpdated(_msgSender(), tokenID);
    }

    /**
     * @dev To cancel the REC NFT mint request,only can be called the NFT owner.
     * REC NFT mint fee is refund to the owner after the transaction.
     * tokenId The ID of the REC NFT to update
     */
    function cancelRECRequest(uint256 tokenID) external whenNotPaused {

        // Only REC owner allowed to cancel the request
        require(ownerOf(tokenID) == _msgSender(), "AREC: Not Owner");

        // Only pending REC can be cancelled
        require(allRECData[tokenID].status <= uint8(RECStatus.Rejected), "AREC: Wrong Status");  

        allRECData[tokenID].status = uint8(RECStatus.Cancelled);

        // Refund the request fee
        TransferHelper.safeTransfer(allPayInfo[tokenID].token, _msgSender(), allPayInfo[tokenID].value);

        // delete the payment info to save storage
        delete allPayInfo[tokenID];
        emit RECCanceled(_msgSender(), tokenID);
    }

    /// @dev return all the AREC issaunce token/price list
    function allARECMintPrice() external view virtual returns (RECMintPrice[] memory) {
        uint256 sizePrice = paymentTokens.length;
        RECMintPrice[] memory ARECMintPrice = new RECMintPrice[](sizePrice);

        for(uint256 index; index < sizePrice; index++) {
          address token = paymentTokens[index];
          ARECMintPrice[index].token = paymentTokens[index];
          ARECMintPrice[index].value = paymentTokenPrice[token];
        }
        return ARECMintPrice;
    }

    /**
     * @dev Add or remove the MVP addresses 
     * @param op The operation of MVP address, =true, add MVP; =false, remove MVP 
     * @param listMVP The list of the MVP addresses
     */
    function manageMVPAddress(bool op, address[] calldata listMVP) public whenNotPaused onlyOwner {
        for(uint256 index; index < listMVP.length; index++) {
            require( AllMVPEntity[listMVP[index]] != op, "AREC: Wrong Status" );
            AllMVPEntity[listMVP[index]] = op;
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
}