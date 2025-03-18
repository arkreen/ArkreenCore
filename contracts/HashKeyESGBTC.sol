// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "@openzeppelin/contracts-upgradeable/utils/AddressUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/StringsUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC721/extensions/ERC721EnumerableUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

import "./interfaces/IPausable.sol";
import "./interfaces/IERC5192.sol";
import "./ArkreenBuilderTypes.sol";
import "./libraries/TransferHelper.sol";
import "./interfaces/IWETH.sol";
import "./interfaces/IERC20Permit.sol";

// Import this file to use console.log
// import "hardhat/console.sol";

contract HashKeyESGBTC is
    OwnableUpgradeable,
    UUPSUpgradeable,
    ERC721EnumerableUpgradeable,
    IERC5192
{
    using AddressUpgradeable for address;

    // Public variables
    string  public    constant NAME             = "Eco Coiner";
    string  public    constant SYMBOL           = "EC";
    uint256 public    constant ART_DECIMAL      = 9;
    uint256 private   constant MAX_BRICK_ID     = 4096;
    uint256 private   constant MASK_ID          = 0xFFF;

    string  public baseURI;
    address public tokenHART;                         // HashKey Pro ART
    address public arkreenBuilder;
    address public tokenNative;                         // The wrapped token of the Native token, such as WETH, WMATIC
    mapping(uint256 => uint256) public brickIds;        // Green Id -> Owned brick id list, maximumly 21 bricks, 12 bits each
    mapping(uint256 => uint256) public greenIdLoc;      // Brick Id -> Green Id
    mapping(uint256 => uint256[]) public brickIdsMVP;   // Green Id -> bricks id more than 21 cells
    uint256 public ESGBadgeLimit;                       // Limit of each level of ESG badge, one byte for one level, starting from low end
    uint256 public ESGBadgeCount;                       // Count of each level of ESG badge, one byte for one level, starting from low end

    // The total REC amount to greenize the BTC block mined at the same time of HashKey Pro opening ceremony
    uint256 public maxRECToGreenBTC;

    mapping(uint256 => uint256) public levelOrder;      // Green Id -> level + order in level
    mapping(uint256 => string)  public cidBadge;        // Green Id -> cID

    mapping(address => bool)  public whiteARTList;      // ART token -> true/false

    // Events

    // Modifiers
    modifier ensure(uint deadline) {
        require(deadline >= block.timestamp, "HSKESG: EXPIRED");
        _;
    }

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(address builder, address hArt, address native, uint256 numBlock) external virtual initializer {
        __Ownable_init_unchained();
        __UUPSUpgradeable_init();        
        __ERC721_init_unchained(NAME, SYMBOL);

        arkreenBuilder      = builder; 
        tokenHART           = hArt;
        tokenNative         = native;
        maxRECToGreenBTC    = numBlock;

        baseURI = "https://www.arkreen.com/ESGBTC/" ;
    }   

    function postUpdate(uint256[] calldata order) external onlyProxy onlyOwner {
        for(uint256 index; index < order.length; index++) {
            levelOrder[index+1] = order[index];
        }
    }

    function _authorizeUpgrade(address newImplementation) internal virtual override onlyOwner
    {}

    /** 
     * @dev Greenize BTC with Native token, such as MATIC.
     * @param bricksToGreen The brick ID list in the format of IDn || ... || ID2 || ID1, each of which is 12 bits.
     * @param deadline The deadline to cancel the transaction.
     * @param badgeInfo The information to be included for climate badge.
     */
    function greenizeBTCNative(
        uint256             bricksToGreen,      
        uint256             deadline,
        BadgeInfo calldata  badgeInfo
    ) external payable ensure(deadline) {                       // Deadline will be checked by router, no need to check here. 

        address actorGreenBTC = _msgSender();
        uint256 amountART = _mintESGBadge(actorGreenBTC, bricksToGreen);        
        
        // Wrap MATIC to WMATIC  
        IWETH(tokenNative).deposit{value: msg.value}();

        // actionBuilderBadge(address,address,uint256,uint256,uint256,uint256,(address,string,string,string)): 0x8D7FCEFD
        uint256 modeAction = (bricksToGreen>>255)<<1;     
        bytes memory callData = abi.encodeWithSelector(0x8D7FCEFD, tokenNative, tokenHART, msg.value,
                                                        amountART, modeAction, deadline, badgeInfo);

        _actionBuilderBadge(abi.encodePacked(callData, actorGreenBTC));     // Pay back to msg.sender already
    }

    function greenizeBTCNativeMVP(
        uint256             bricksToGreen,   
        uint256[] memory    bricksToGreenMVP,           
        uint256             deadline,
        BadgeInfo calldata  badgeInfo
    ) external payable ensure(deadline) {                       // Deadline will be checked by router, no need to check here. 

        address actorGreenBTC = _msgSender();
        uint256 amountART = _mintESGBadgeMVP(actorGreenBTC, bricksToGreen, bricksToGreenMVP);        
        
        // Wrap MATIC to WMATIC  
        IWETH(tokenNative).deposit{value: msg.value}();

        // actionBuilderBadge(address,address,uint256,uint256,uint256,uint256,(address,string,string,string)): 0x8D7FCEFD
        uint256 modeAction = (bricksToGreen>>255)<<1;     
        bytes memory callData = abi.encodeWithSelector(0x8D7FCEFD, tokenNative, tokenHART, msg.value,
                                                        amountART, modeAction, deadline, badgeInfo);

        _actionBuilderBadge(abi.encodePacked(callData, actorGreenBTC));     // Pay back to msg.sender already

    }

    /** 
     * @dev Greenize BTC with specified ART token
     * @param tokenART Address of the ART token, which should be whitelisted in the accepted list.
     * @param bricksToGreen The brick ID list in the format of IDn || ... || ID2 || ID1, each of which is 12 bits
     * @param deadline The deadline to cancel the transaction
     * @param badgeInfo The information to be included for climate badge
     */
    function greenizeBTCWithART(
        address             tokenART,
        uint256             bricksToGreen,   
        uint256             deadline,        
        BadgeInfo calldata  badgeInfo
    ) external ensure(deadline) {

        require(whiteARTList[tokenART], "HSKESG: ART Not Accepted"); 

        address actorGreenBTC = _msgSender();
        uint256 amountART = _mintESGBadge(actorGreenBTC, bricksToGreen);

        // Transfer payement 
        TransferHelper.safeTransferFrom(tokenART, actorGreenBTC, address(this), amountART);

        // actionBuilderBadgeWithART(address,uint256,uint256,(address,string,string,string)): 0x6E556DF8
        bytes memory callData = abi.encodeWithSelector(0x6E556DF8, tokenART, amountART, deadline, badgeInfo);

        _actionBuilderBadge(abi.encodePacked(callData, actorGreenBTC));
    }


    /** 
     * @dev Greenize BTC with specified payment token
     * @param tokenPay The token to pay for swapping ART token
     * @param amountPay The maximum amount of tokenPay which will de paid
     * @param bricksToGreen The brick ID list in the format of IDn || ... || ID2 || ID1, each of which is 12 bits
     * @param deadline The deadline to cancel the transaction
     * @param badgeInfo The information to be included for climate badge
     */
    function greenizeBTC(
        address             tokenPay,
        uint256             amountPay,
        uint256             bricksToGreen,   
        uint256             deadline,        
        BadgeInfo calldata  badgeInfo
    ) external ensure(deadline) {                               // Deadline will be checked by router, no need to check here.

        address actorGreenBTC = _msgSender();
        uint256 amountART = _mintESGBadge(actorGreenBTC, bricksToGreen);

        // Transfer payement 
        TransferHelper.safeTransferFrom(tokenPay, actorGreenBTC, address(this), amountPay);
        
        // actionBuilderBadge(address,address,uint256,uint256,uint256,uint256,(address,string,string,string)): 0x8D7FCEFD
        uint256 modeAction = (bricksToGreen>>255)<<1;
        bytes memory callData = abi.encodeWithSelector(0x8D7FCEFD, tokenPay, tokenHART, amountPay,
                                                        amountART, modeAction, deadline, badgeInfo);

        _actionBuilderBadge(abi.encodePacked(callData, actorGreenBTC));
    }

    function greenizeBTCMVP(
        address             tokenPay,
        uint256             amountPay,
        uint256             bricksToGreen,   
        uint256[] memory    bricksToGreenMVP,
        uint256             deadline,        
        BadgeInfo calldata  badgeInfo
    ) external ensure(deadline) {                               // Deadline will be checked by router, no need to check here.

        address actorGreenBTC = _msgSender();
        uint256 amountART = _mintESGBadgeMVP(actorGreenBTC, bricksToGreen, bricksToGreenMVP);

        // Transfer payement 
        TransferHelper.safeTransferFrom(tokenPay, actorGreenBTC, address(this), amountPay);
        
        // actionBuilderBadge(address,address,uint256,uint256,uint256,uint256,(address,string,string,string)): 0x8D7FCEFD
        uint256 modeAction = (bricksToGreen>>255)<<1;
        bytes memory callData = abi.encodeWithSelector(0x8D7FCEFD, tokenPay, tokenHART, amountPay,
                                                        amountART, modeAction, deadline, badgeInfo);

        _actionBuilderBadge(abi.encodePacked(callData, actorGreenBTC));
    }

    /** 
     * @dev Greenize BTC with payment Approval.
     * @param bricksToGreen The brick ID list in the format of IDn || ... || ID2 || ID1, each of which is 12 bits.
     * @param badgeInfo The information to be included for climate badge.
     * @param permitToPay The Permit information to approve the payment token to swap for ART token 
     */
    function greenizeBTCPermit(
        uint256             bricksToGreen,      
        BadgeInfo calldata  badgeInfo,
        Signature calldata  permitToPay
    ) external ensure(permitToPay.deadline) {                     // Deadline will be checked by router, no need to check here. 

        address actorGreenBTC = _msgSender();
        uint256 amountART = _mintESGBadge(actorGreenBTC, bricksToGreen);

        // Permit payment token
        IERC20Permit(permitToPay.token).permit(actorGreenBTC, address(this), 
                        permitToPay.value, permitToPay.deadline, permitToPay.v, permitToPay.r, permitToPay.s);

        // Transfer payement 
        TransferHelper.safeTransferFrom(permitToPay.token, actorGreenBTC, address(this), permitToPay.value);

        // actionBuilderBadge(address,address,uint256,uint256,uint256,uint256,(address,string,string,string)): 0x8D7FCEFD
        uint256 modeAction = (bricksToGreen>>255)<<1;
        bytes memory callData = abi.encodeWithSelector(0x8D7FCEFD, permitToPay.token, tokenHART, permitToPay.value,
                                                        amountART, modeAction, permitToPay.deadline, badgeInfo);

        _actionBuilderBadge(abi.encodePacked(callData, actorGreenBTC));
    }

    /** 
     * @dev Greenize BTC with payment Approval.
     * @param bricksToGreen The brick ID list in the format of IDn || ... || ID2 || ID1, each of which is 12 bits.
     * @param badgeInfo The information to be included for climate badge.
     * @param permitToPay The Permit information to approve the payment token to swap for ART token 
     */
    function greenizeBTCPermitMVP(
        uint256             bricksToGreen,
        uint256[] memory    bricksToGreenMVP,
        BadgeInfo calldata  badgeInfo,
        Signature calldata  permitToPay
    ) external ensure(permitToPay.deadline) {                     // Deadline will be checked by router, no need to check here. 

        address actorGreenBTC = _msgSender();
        uint256 amountART = _mintESGBadgeMVP(actorGreenBTC, bricksToGreen, bricksToGreenMVP);

        // Permit payment token
        IERC20Permit(permitToPay.token).permit(actorGreenBTC, address(this), 
                        permitToPay.value, permitToPay.deadline, permitToPay.v, permitToPay.r, permitToPay.s);

        // Transfer payement 
        TransferHelper.safeTransferFrom(permitToPay.token, actorGreenBTC, address(this), permitToPay.value);

        // actionBuilderBadge(address,address,uint256,uint256,uint256,uint256,(address,string,string,string)): 0x8D7FCEFD
        uint256 modeAction = (bricksToGreen>>255)<<1;
        bytes memory callData = abi.encodeWithSelector(0x8D7FCEFD, permitToPay.token, tokenHART, permitToPay.value,
                                                        amountART, modeAction, permitToPay.deadline, badgeInfo);

        _actionBuilderBadge(abi.encodePacked(callData, actorGreenBTC));
    }


    /** 
     * @dev mint ESGBadge to the greenActor
     * @param actorGreenBTC The address of the actor
     * @param bricksToGreen The brick ID list in the format of IDn || ... || ID2 || ID1, each of which is 12 bits
     * @return uint256 The amount ART token to pay for the ESG badge
     */
    function _mintESGBadge(address actorGreenBTC, uint256 bricksToGreen) internal returns (uint256){
        uint256 amountART;
        uint256 brickID;

        require( bricksToGreen > 0, "HSKESG: Wrong IDs");

        bricksToGreen = (bricksToGreen<<4) >> 4;                            // clear 4 msb, uint252
        uint256 greenId = totalSupply() + 1;
        _safeMint(actorGreenBTC, greenId);
        brickIds[greenId] = bricksToGreen;

        while( (brickID = (bricksToGreen & MASK_ID)) != 0) {
            amountART += 1;
            setBrick(brickID, greenId);
            bricksToGreen = bricksToGreen >> 12;
        }

        uint256 levelOffet = ((amountART-1)/3) * 8;
        uint256 limit = (ESGBadgeLimit >> levelOffet) & 0xFF; 
        uint256 count = (ESGBadgeCount >> levelOffet) & 0xFF; 

        require( count < limit, "HSKESG: Reach Limit");
        ESGBadgeCount += (1 << levelOffet);                     // Add count, no overflow happens here

        levelOrder[greenId] = (((levelOffet/8) + 1) << 8) + (count + 1);

        return amountART * 2 * (10**ART_DECIMAL);               // 1 Cell -> 2 ART token 
    }

    /** 
     * @dev mint ESGBadge to the greenActor
     * @param actorGreenBTC The address of the actor
     * @param bricksToGreen The brick ID list in the format of IDn || ... || ID2 || ID1, each of which is 12 bits
     * @return uint256 The amount ART token to pay for the ESG badge
     */
    function _mintESGBadgeMVP(address actorGreenBTC, uint256 bricksToGreen, uint256[] memory bricksToGreenMVP) internal returns (uint256) {
        uint256 amountART;
        uint256 brickID;

        require( bricksToGreen > 0, "HSKESG: Wrong IDs");

        bricksToGreen = (bricksToGreen<<4) >> 4;                            // clear 4 msb, uint252
        uint256 greenId = totalSupply() + 1;
        _safeMint(actorGreenBTC, greenId);

        uint256 flagMVP = (bricksToGreenMVP.length > 0) ? (1<<255) : 0;
        brickIds[greenId] = bricksToGreen | flagMVP;

        while( (brickID = (bricksToGreen & MASK_ID)) != 0) {
            amountART += 1;
            setBrick(brickID, greenId);
            bricksToGreen = bricksToGreen >> 12;
        }
        
        if(bricksToGreenMVP.length > 0 ) {
          require (amountART == 21, "HSKESG: Not MVP"); 
          brickIdsMVP[greenId] = bricksToGreenMVP;

          for (uint256 index; index < bricksToGreenMVP.length; index++) {
            bricksToGreen = (bricksToGreenMVP[index]<<4) >> 4;
            while( (brickID = (bricksToGreen & MASK_ID)) != 0) {
                amountART += 1;
                setBrick(brickID, greenId);
                bricksToGreen = bricksToGreen >> 12;
            }
          }
        }

        uint256 levelOffet = (amountART >= 22) ? 7*8 : ((amountART-1)/3) * 8;
        uint256 limit = (ESGBadgeLimit >> levelOffet) & 0xFF; 
        uint256 count = (ESGBadgeCount >> levelOffet) & 0xFF; 

        require( count < limit, "HSKESG: Reach Limit");
        ESGBadgeCount += (1 << levelOffet);                     // Add count, no overflow happens here     

        levelOrder[greenId] =  (((levelOffet/8) + 1) << 8) + (count + 1);
   
        return amountART * 2 * (10**ART_DECIMAL);             // 1 Cell -> 2 ART token 
    }


    /** 
     * @dev call actionBuilderBadge to buy ART token and mint the Arkreen cliamte badge.
     * @param callData The calling data with actors address attached
     */
    function _actionBuilderBadge(bytes memory callData) internal {
        (bool success, bytes memory returndata) = arkreenBuilder.call(callData);

         if (!success) {
            if (returndata.length > 0) {
                // solhint-disable-next-line no-inline-assembly
                assembly {
                    let returndata_size := mload(returndata)
                    revert(add(32, returndata), returndata_size)
                }
            } else {
                revert("HSKESG: Error Call to actionBuilderBadge");
            }
        }        
    }

    /** 
     * @dev set the greenId to the given brick
     */
    function setBrick(uint256 brickId, uint256 greenId) internal {                           //  brickId starts from 1
        require((brickId != 0) || (brickId <= maxRECToGreenBTC), "HSKESG: Wrong Brick ID");
        require( greenIdLoc[brickId] == 0,  "HSKESG: Brick Occupied");
        greenIdLoc[brickId] = greenId;
    }

    /** 
     * @dev Return the given brick information: owner, greenId, and all sibbling bricks
     */
    function ownerBricks(uint256 brickId) external view returns (address owner, uint256 greenId, uint256 bricks) {
        require((brickId != 0) || (brickId <= maxRECToGreenBTC), "HSKESG: Wrong Brick ID");
        greenId = greenIdLoc[brickId];
        owner = ownerOf(greenId);
        bricks = brickIds[greenId];
    }

    /** 
     * @dev Check if the given brick occupied
     */
    function checkBrick(uint256 brickId) external view returns (bool) {         //  brickId starts from 1
        require((brickId != 0) || (brickId <= maxRECToGreenBTC), "HSKESG: Wrong Brick ID");
        return greenIdLoc[brickId] != 0;
    }    


    /** 
     * @dev Update the ESGBadgeLimit
     */
    function UpdateESGBadgeLimit(uint256 limit, uint256 count ) external onlyOwner {    
        if(limit!=0)  ESGBadgeLimit = limit;
        if(count!=0) ESGBadgeCount = count;
    }    

    /** 
     * @dev Get the all MVP blocks of the specified GreenID
     */
    function getMVPBlocks(uint256 greenId) external view returns (uint256[] memory bricksMVP) {         //  brickId starts from 1
        return brickIdsMVP[greenId];
    }       

    /**
     * @dev update the maximum REC number to green BTC block
     * @param amountREC type of the managing account
     */
    function setRECAmount(uint256 amountREC) external onlyOwner {
        maxRECToGreenBTC = amountREC;
    }

    /**
     * @dev Approve the token that the  arkreenBuilder smart contract can transfer from this ESG smart contract
     * @param tokens The token list
     */
    function approveBuilder(address[] calldata tokens) external onlyOwner {
        require(arkreenBuilder != address(0), "HSKESG: No Builder");
        for(uint256 i = 0; i < tokens.length; i++) {
            TransferHelper.safeApprove(tokens[i], arkreenBuilder, type(uint256).max);
        }
    }       

    /**
     * @dev Add or remove the acceptable ART tokens
     */
    function mangeARTTokens(address[] calldata tokenARTList, bool addOrRemove) external onlyOwner {
        for(uint256 i = 0; i < tokenARTList.length; i++) {
            address tokenART = tokenARTList[i];

            require(tokenART != address(0) && whiteARTList[tokenART] != addOrRemove, "HSKESG: Wrong ART Status");
            whiteARTList[tokenART] = addOrRemove;
        }
    }      

    /** 
     * @dev Change the BaseURI
     */
    function setBaseURI(string calldata newBaseURI) external virtual onlyOwner {
        baseURI = newBaseURI;
    }

    function _baseURI() internal view virtual override returns (string memory) {
        return baseURI;
    }

    /**
     * @dev See {IERC721Metadata-tokenURI}.
     */
    function tokenURI(uint256 tokenId) public view virtual override returns (string memory) {
        _requireMinted(tokenId);

        string memory cid = cidBadge[levelOrder[tokenId]];
        if( bytes(cid).length > 0) {
            return string(abi.encodePacked("https://", cid, ".ipfs.w3s.link"));
        } else {
            return super.tokenURI(tokenId);
        }
    }    

    function updateCID(uint256 level, uint256 limit, bytes calldata allCID) external virtual onlyOwner {
        uint256 length = allCID.length;
        uint256 offset = 0;
        for(uint256 idxLevel = (level & 0xFF); idxLevel <= (level >> 8); idxLevel++) {
            uint256 levelLimit = limit & 0xFF;
            limit = limit >> 8;
            for(uint256 idxLimit = 1; idxLimit <= levelLimit; idxLimit++ ) {
                uint256 badgeID = (idxLevel<<8) + idxLimit;
                require( (offset+59) <= length, "ARB: Overflowed");
                cidBadge[badgeID] = string(abi.encodePacked(allCID[offset: offset + 59]));
                offset += 59;
            }
        }
    }        

    /**
     * @dev Hook that is called before any token transfer. Blocking transfer unless minting
     */
/*    
    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 tokenId
    ) internal virtual override (ERC721EnumerableUpgradeable) {
        require(from == address(0), "ARB: Transfer Not Allowed");
        super._beforeTokenTransfer(from, to, tokenId);
    }
*/

    /**
     * @dev get all the brick IDs with in th scope specified by the paramters
     * @param tokeIDStart the starting token ID, from which all brick IDs are returned
     * @param tokeIDEnd the starting token ID, till which all brick IDs are retured
     */
    function getAllBrickIDs(uint256 tokeIDStart, uint256 tokeIDEnd) 
                external view returns (uint256 totalTokens, address[] memory owners, uint256[] memory allBricks) {

        totalTokens = totalSupply();
        if(tokeIDEnd == 0) tokeIDEnd = totalTokens;
        require( (tokeIDStart >= 1) && (tokeIDStart <= tokeIDEnd) && (tokeIDEnd <= totalTokens), "ARB: Wrong tokeID");

        owners =  new address[](tokeIDEnd - tokeIDStart + 1);
        allBricks = new uint256[](tokeIDEnd - tokeIDStart + 1);
        uint256 offset;
        for (uint256 index = tokeIDStart; index <= tokeIDEnd; index++ ) {
            owners[offset] = ownerOf(index);
            allBricks[offset] = brickIds[index];
            offset += 1;
        }
    }

    function locked(uint256 tokenId) external view returns (bool) {
        require((tokenId > 0) && (tokenId <= totalSupply()), "ARB: Wrong tokenId");
        return true;  
    }
}
