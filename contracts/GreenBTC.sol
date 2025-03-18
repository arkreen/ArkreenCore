// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "@openzeppelin/contracts/utils/Base64.sol";
import "@openzeppelin/contracts/utils/Strings.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC721/extensions/ERC721EnumerableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ContextUpgradeable.sol";

import "./libraries/FormattedStrings.sol";
import "./libraries/TransferHelper.sol";

import "./interfaces/IWETH.sol";
import "./interfaces/IGreenBTCImage.sol";
import "./interfaces/IArkreenBuilder.sol";
import "./interfaces/IArkreenRECBank.sol";
import "./interfaces/IArkreenRECToken.sol";
import "./GreenBTCType.sol";
import "./interfaces/IERC20.sol";
import "./GreenBTCStorage.sol";

contract GreenBTC is 
    ContextUpgradeable,
    UUPSUpgradeable,
    OwnableUpgradeable,
    ERC721EnumerableUpgradeable,
    GreenBTCStorage
{

    using Strings for uint256;
    using Strings for address;
    using FormattedStrings for uint256;

    event GreenBitCoin(uint256 height, uint256 ARTCount, address minter, uint8 greenType);
    event OpenBox(address opener, uint256 tokenID, uint256 blockNumber);
    event RevealBoxes(uint256[] revealList, bool[] wonList);
    // event Subsidy(uint256 height, uint256 ratio);

    modifier ensure(uint256 deadline) {
        require(uint32(deadline) >= block.timestamp, "GBTC: EXPIRED");
        _;
    }

    modifier onlyManager(){
        require(msg.sender == manager, "GBTC: Not Manager");
        _;
    }

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    //initialize
    function initialize(address authority, address builder, address cART, address native)
        external
        virtual
        initializer
    {
        __UUPSUpgradeable_init();
        __Ownable_init_unchained();
        __ERC721_init_unchained(NAME, SYMBOL);

        DOMAIN_SEPARATOR = keccak256(
            abi.encode(
                keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"),
                keccak256(bytes(NAME)),
                keccak256(bytes(VERSION)),
                block.chainid,
                address(this)
            )
        );  

        manager         = owner();
        authorizer      = authority;
        arkreenBuilder  = builder;
        tokenCART       = cART;
        tokenNative     = native;
        luckyRate       = 5;
    }

    function _authorizeUpgrade(address newImplementation) internal virtual override onlyOwner
    {}

    function setManager(address newManager) public onlyOwner{
        require(newManager != address(0), "GBTC: Zero Address"); 
        manager = newManager;
    }

    function setAuthorizer(address newAuthAddress) public onlyOwner {
        require(newAuthAddress != address(0), "GBTC: Zero Address"); 
        authorizer = newAuthAddress;
    }

    function setImageContract(address newImageContract) public onlyOwner {
        require(newImageContract != address(0), "GBTC: Zero Address");
        greenBtcImage = newImageContract;
    }

    function setCARTContract(address newCARTToken) public onlyOwner {
        require(newCARTToken != address(0), "GBTC: Zero Address");
        tokenCART = newCARTToken;
    }

    function setARTContract(address newSubsidyART) public onlyOwner {
        require(newSubsidyART != address(0), "GBTC: Zero Address");
        tokenARTSubsidy = newSubsidyART;
    }

    function setGreenBTCPro(address newGreenBTCPro) public onlyOwner {
        require(newGreenBTCPro != address(0), "GBTC: Zero Address");
        greenBTCPro = newGreenBTCPro;
    }

    function setLuckyRate(uint256 newRate) public onlyOwner {
        require(newRate <= 20, "GBTC: Too More");
        luckyRate = newRate;
    }

    function setRatioSubsidyCap(uint256 newRatioSubsidyCap) public onlyOwner {
        require(newRatioSubsidyCap <= 99, "GBTC: Too More Ratio");
        ratioSubsidyCap = uint8(newRatioSubsidyCap);
    }

    /**
     * @dev Approve the tokens which can be transferred from this GreenBTC contract by arkreenBuilder
     * @param tokens The token list
     */
    function approveBuilder(address[] calldata tokens) public onlyOwner {
        require(arkreenBuilder != address(0), "GBTC: No Builder");
        for(uint256 i = 0; i < tokens.length; i++) {
            TransferHelper.safeApprove(tokens[i], arkreenBuilder, type(uint256).max);
        }
    }

    function callGreenBTCPro (address greenBTCPro) internal virtual {
        assembly {
            // Copy msg.data. We take full control of memory in this inline assembly
            // block because it will not return to Solidity code. We overwrite the
            // Solidity scratch pad at memory position 0.
            calldatacopy(0, 0, calldatasize())

            // Call the implementation.
            // out and outsize are 0 because we don't know the size yet.
            let result := delegatecall(gas(), greenBTCPro, 0, calldatasize(), 0, 0)

            // Copy the returned data.
            returndatacopy(0, 0, returndatasize())

            switch result
            // delegatecall returns 0 on error.
            case 0 { revert(0, returndatasize()) }
            default { return(0, returndatasize()) }
        }
    }

    /**
     * @dev Greenize BTC with the native token
     * @param gbtc Bitcoin block info to be greenized
     * @param sig Signature of the authority to Bitcoin block info
     * @param badgeInfo Information that will logged in Arkreen climate badge
     * @param deadline LB0-LB3: The deadline to cancel the transaction, 
     *                 LB7: 0x80, Open box at same time, gbtc.miner must be the caller if opening box at the same time 
     *                 LB6: ratio of subsidy
     */
    function authMintGreenBTCWithNative(      
        GreenBTCInfo    calldata gbtc,
        Sig             calldata sig,
        BadgeInfo       calldata badgeInfo,
        uint256                  deadline
    ) public payable ensure(deadline) {

        _mintGreenBTC(deadline, 0x00, gbtc, sig);

        IWETH(tokenNative).deposit{value: msg.value}(); // Wrap MATIC to WMATIC 

        // bit0 = 1: exact payment amount; bit1 = 1: ArkreenBank is used to get CART token; bit2 = 0: Repay to caller  
        uint256 modeAction = 0x03;                      
        
        // actionBuilderBadge(address,address,uint256,uint256,uint256,uint256,(address,string,string,string)): 0x8D7FCEFD  
        bytes memory builderCallData = abi.encodeWithSelector( 0x8D7FCEFD, tokenNative, tokenCART, msg.value,
                                            _getFullARTValue(gbtc.ARTCount), modeAction, uint32(deadline), badgeInfo);

        _actionBuilderBadge(abi.encodePacked(builderCallData, _msgSender()));
    }

    function _getFullARTValue( uint256 actionValue ) internal view returns (uint256) {
        uint256 ratioFeeOffset = IArkreenRECToken(tokenCART).getRatioFeeOffset();     // Assum ART, cART have the save rate
        return (actionValue * 10000) / (10000 - ratioFeeOffset);    // Add Offset fee
    }

    /** 
     * @dev Greenize BTC with the token/amount that the user has approved
     * @param gbtc Bitcoin block info to be greenized
     * @param sig Signature of the authority to Bitcoin block info
     * @param badgeInfo Information that will logged in Arkreen climate badge
     * @param payInfo Address and amount of the token that will be used to pay for offsetting ART
     * @param deadline LB0-LB3: The deadline to cancel the transaction, 
     *                 LB7: 0x80, Open box at same time, gbtc.miner must be the caller if opening box at the same time 
     *                 LB6: ratio of subsidy
     */
    function authMintGreenBTCWithApprove(
        GreenBTCInfo    calldata gbtc, 
        Sig             calldata sig, 
        BadgeInfo       calldata badgeInfo, 
        PayInfo         calldata payInfo,
        uint256                  deadline
    ) public ensure(deadline) {

        uint8 ratio = _mintGreenBTC(deadline, 0x00, gbtc, sig);
        TransferHelper.safeTransferFrom(payInfo.token, msg.sender, address(this), payInfo.amount);

        uint256 amountARTwithFee = _getFullARTValue(gbtc.ARTCount);

        if (ratio != 0) {
            uint256 amountART = (amountARTwithFee * (100 - ratio) + 99) / 100;                 // ART mount to pay by caller

            // buyARTBank(address,address,uint256,uint256,bool): 0x478A55B6
            bytes memory builderCallData = abi.encodeWithSelector( 0x478A55B6, payInfo.token, tokenARTSubsidy, payInfo.amount,
                                                          amountART, false);

            _actionBuilderBadge(abi.encodePacked(builderCallData, _msgSender()));

            // actionBuilderBadgeWithART(address,uint256,uint256,(address,string,string,string)): 0x6E556DF8
            builderCallData = abi.encodeWithSelector(0x6E556DF8, tokenARTSubsidy, amountARTwithFee, uint32(deadline), badgeInfo);

            _actionBuilderBadge(abi.encodePacked(builderCallData, _msgSender()));
        } else {
          // bit0 = 0: exact ART amount; bit1 = 1: ArkreenBank is used to get CART token; bit2 = 0: Repay to caller  
          uint256 modeAction = 0x02;            

          // actionBuilderBadge(address,address,uint256,uint256,uint256,uint256,(address,string,string,string)): 0x8D7FCEFD  
          bytes memory builderCallData = abi.encodeWithSelector( 0x8D7FCEFD, payInfo.token, tokenCART, payInfo.amount,
                                                          amountARTwithFee, modeAction, uint32(deadline), badgeInfo);

          _actionBuilderBadge(abi.encodePacked(builderCallData, _msgSender()));
        }
    }

    function _checkGBTCData(GreenBTCInfo memory gbtc, uint8 typeTarget) view internal {
        uint128 height = gbtc.height & ((1<<120) - 1);
        require(dataGBTC[height].ARTCount == 0, "GBTC: Already Minted");
        require((gbtc.greenType & 0xF0) == typeTarget, "GBTC: Wrong ART Type");
    }

    /** 
     * @dev Greenize BTC blocks in batch with the token/amount that the user has approved
     * @param gbtcList List of the Bitcoin block info to be greenized
     * @param sig Signature of the authority to Bitcoin block info
     * @param badgeInfo Information that will logged in Arkreen climate badge, all climate badges use the same info
     * @param payInfo Address and amount of the token that will be used to pay for offsetting ART of all the GreenBTC blocks
     * @param deadline LB0-LB3: The deadline to cancel the transaction, LB7: bit8, Open box at same time, bit7, skip if occupied 
     * gbtc.miner must be the caller if opening box at the same time 
     */
    function authMintGreenBTCWithApproveBatch(
        GreenBTCInfo[]  calldata  gbtcList, 
        Sig             calldata  sig, 
        BadgeInfo       calldata  badgeInfo, 
        PayInfo         calldata  payInfo,
        uint256                   deadline
    ) public ensure(deadline) {
      
        (uint256 amountARTSum, uint8 ratio) = _mintGreenBTCBatch(deadline, 0x00, gbtcList, sig);

        TransferHelper.safeTransferFrom(payInfo.token, msg.sender, address(this), payInfo.amount);

        uint256 amountARTwithFee = _getFullARTValue(amountARTSum);
        
        if (ratio != 0) {
            uint256 amountART = (amountARTwithFee * (100 - ratio) + 99) / 100;                 // ART mount to pay by caller

            // buyARTBank(address,address,uint256,uint256,bool): 0x478A55B6
            bytes memory builderCallData = abi.encodeWithSelector( 0x478A55B6, payInfo.token, tokenARTSubsidy, payInfo.amount,
                                                          amountART, false);

            _actionBuilderBadge(abi.encodePacked(builderCallData, _msgSender()));

            // actionBuilderBadgeWithART(address,uint256,uint256,(address,string,string,string)): 0x6E556DF8
            builderCallData = abi.encodeWithSelector(0x6E556DF8, tokenARTSubsidy, amountARTwithFee, uint32(deadline), badgeInfo);

            _actionBuilderBadge(abi.encodePacked(builderCallData, _msgSender()));
        } else {
            // modeAction = 0x02/0x06, bit0 = 0: exact ART amount; bit1 = 1: ArkreenBank is used to get CART token; bit2 = 0: Repay to caller
            uint256 modeAction = 0x02;

            // actionBuilderBadge(address,address,uint256,uint256,uint256,uint256,(address,string,string,string)): 0x8D7FCEFD
            bytes memory builderCallData = abi.encodeWithSelector( 0x8D7FCEFD, payInfo.token, tokenCART, payInfo.amount,
                                                  amountARTwithFee,
                                                  modeAction, uint32(deadline), badgeInfo);

            _actionBuilderBadge(abi.encodePacked(builderCallData, _msgSender()));      // Pay back to msg.sender already
        }
    }

    function _getSubsidyRatio( uint128 height ) internal view returns (uint8, uint128) {
        uint8 ratio = uint8(height >> 120); 
        require (ratio <= ratioSubsidyCap, "GBTC: Wrong Ratio!");
        height &= (1<<120) - 1;
        return (ratio, height);
    }

    /** 
     * @dev Greenize BTC with specified ART token
     * @param gbtc Bitcoin block info to be greenized
     * @param sig Signature of the authority to Bitcoin block info
     * @param badgeInfo Information that will logged in Arkreen climate badge
     * @param tokenART Address of the ART token, which should be whitelisted in the accepted list.
     * @param deadline LB0-LB3: The deadline to cancel the transaction
     *                 LB7: 0x80, Open box at same time, gbtc.miner must be the caller if opening box at the same time 
     *                 LB6: ratio of subsidy
     */
    function authMintGreenBTCWithART(
        GreenBTCInfo    calldata gbtc, 
        Sig             calldata sig, 
        BadgeInfo       calldata badgeInfo,
        address                  tokenART, 
        uint256                  deadline
    ) public ensure(deadline) {

        require(whiteARTList[tokenART], "GBTC: ART Not Accepted"); 

        uint8 ratio = _mintGreenBTC(deadline, 0x10, gbtc, sig);
        uint256 amountART = _getFullARTValue(gbtc.ARTCount);

        TransferHelper.safeTransferFrom(tokenART, msg.sender, address(this), amountART * (100 - ratio) / 100);

        // actionBuilderBadgeWithART(address,uint256,uint256,(address,string,string,string)): 0x6E556DF8
        bytes memory builderCallData = abi.encodeWithSelector(0x6E556DF8, tokenART, amountART, uint32(deadline), badgeInfo);
        _actionBuilderBadge(abi.encodePacked(builderCallData, _msgSender()));
    }

    /** 
     * @dev Greenize multiple BTC blocks with specified ART token
     * @param gbtcList Information of the Bitcoin blocks to be greenized
     * @param sig Signature of the authority to Bitcoin block info
     * @param badgeInfo Information that will logged in Arkreen climate badge, used for all the blocks
     * @param tokenART Address of the ART token, which should be whitelisted in the accepted list.
     * @param deadline The deadline to cancel the transaction
     * @param deadline LB0-LB3: The deadline to cancel the transaction, LB7: bit8, Open box at same time, bit7, skip if occupied 
     * gbtc.miner must be the caller if opening box at the same time     
     */
    function authMintGreenBTCWithARTBatch(
        GreenBTCInfo[]  calldata gbtcList, 
        Sig             calldata sig, 
        BadgeInfo       calldata badgeInfo,
        address                  tokenART, 
        uint256                  deadline
    )  public  ensure(deadline) {

        require(whiteARTList[tokenART], "GBTC: ART Not Accepted"); 

        (uint256 amountARTSum, uint8 ratio) = _mintGreenBTCBatch(deadline, 0x10, gbtcList, sig);

        uint256 amountART = _getFullARTValue(amountARTSum);
        TransferHelper.safeTransferFrom(tokenART, msg.sender, address(this), amountART * (100 - ratio) / 100);

        // actionBuilderBadgeWithART(address,uint256,uint256,(address,string,string,string)): 0x6E556DF8
        bytes memory builderCallData = abi.encodeWithSelector(0x6E556DF8, tokenART, amountART, uint32(deadline), badgeInfo);
        _actionBuilderBadge(abi.encodePacked(builderCallData, _msgSender()));
    }
    
    /**
     * @dev Open the Green Bitcoin box, only thw owner of the box acceptable.
     * @param tokenID ID of the NFT token to be opened
     */
    function openBox(uint256 tokenID) public {            // Can not put into Pro as called locally 
        require(msg.sender == ownerOf(tokenID), "GBTC: Not Owner");
        require(dataNFT[tokenID].open == false, "GBTC: Already Opened");

        OpenInfo memory openInfo = OpenInfo(uint64(tokenID), uint64(block.number));
        openingBoxList.push(openInfo);

        dataNFT[tokenID].open = true;
        dataNFT[tokenID].opener = msg.sender;

        emit OpenBox(msg.sender, tokenID, block.number);
    }

    /**
     * @dev Reveal all the opened boxes stored internally. All overtime boxes will be moved to another list. 
     * waiting for another revealing with hash value.
     */
    function revealBoxes() public {
      callGreenBTCPro(greenBTCPro);
    }

    /*
     * @dev Reveal the overtime boxes given in the input list.
     * @param tokenList All the token IDs of the NFT to be revealed.
     * @param hashList All the hash values of the block next after to block the NFT is minted.
     */
    // Warning is kept just for explorer decoding 
    function revealBoxesWithHash(
        uint256[] calldata tokenList,
        uint256[] calldata  hashList
    ) public {  // onlyManager is checked in Pro
        _revealBoxesWithHashMute(tokenList, hashList);                    // To mute compilation warning
        callGreenBTCPro(greenBTCPro);
    }

    function _revealBoxesWithHashMute(uint256[] calldata tokenList, uint256[] calldata hashList) internal {}  

    /**
     * @dev Set new caps
     */
    function setNewCaps(uint256 newNormalCap, uint256 newOvertimeCap, uint256 newRemoveCap) public onlyOwner {    // onlyOwner
      _setNewCapsMute(newNormalCap, newOvertimeCap, newRemoveCap);        // To mute compilation warning
      callGreenBTCPro(greenBTCPro);
    }
    
    function _setNewCapsMute(uint256 newNormalCap, uint256 newOvertimeCap, uint256 newRemoveCap) internal {}

    /**
     * @dev Return all the boxes waiting for revealing.
     */
    function getOpeningBoxList() public view returns (OpenInfo[] memory) {
        return openingBoxList;
    }

    /**
     * @dev Return all the boxes waiting for revealing with hash value
     */
    function getOvertimeBoxList() public view returns (OpenInfo[] memory) {
        return overtimeBoxList;
    }

        /**
     * @dev Return the number of the opened box in the opening list to be opened.
     * If the return value is non-zero, need to call revealBoxes repeatly 
     */
    function getOpeningOvertimed() public view returns (uint256) {
        return openingBoxListOffset;
    }

    /**
     * @dev See {IERC721Metadata-tokenURI}.
     */
    function tokenURI(uint256 tokenID) public view override returns (string memory) {
      
        require(dataGBTC[tokenID].minter != address(0), "GBTC: Not Minted");
        return IGreenBTCImage(greenBtcImage).getCertificateSVG(ownerOf(tokenID), dataGBTC[tokenID], dataNFT[tokenID]);
    }

    /**
     * @dev Return if the specified token is sold, opened and revealed
     */
    function isUnPacking(uint256 tokenID) public view returns(bool, bool, bool) {

        if (dataGBTC[tokenID].ARTCount == 0) {
            return (false, false, false);
        } else{
            return (true, dataNFT[tokenID].open, dataNFT[tokenID].reveal);
        }
    }

    /**
     * @dev Mint the GreenBTC NFT based on the GreenBTC info
     * @param gbtc Green BTC information
     */
    function _mintNFT(GreenBTCInfo memory gbtc, uint8 ratioSubsidy) internal {

        require(gbtc.minter != address(0), "GBTC: Zero Minter");

        dataGBTC[gbtc.height] = gbtc;

        NFTStatus memory nft;
        nft.blockHeight = uint64(gbtc.height);
        nft.ratioSubsidy = ratioSubsidy;
        dataNFT[gbtc.height] = nft;

        _mint(gbtc.minter, gbtc.height);
        emit GreenBitCoin(gbtc.height, gbtc.ARTCount, gbtc.minter, gbtc.greenType);
    }

    /**
     * @dev Verify the signature of authority based on the GreenBTC info
     * @param gbtc Green BTC information
     * @param sig Signature of the authority
     */
    function _authVerify(GreenBTCInfo memory gbtc, Sig calldata sig) internal view {

        bytes32 greenBTCHash = keccak256(abi.encode(GREEN_BTC_TYPEHASH, gbtc.height, gbtc.energyStr, gbtc.ARTCount, gbtc.blockTime, gbtc.minter, gbtc.greenType));
        bytes32 digest = keccak256(abi.encodePacked("\x19\x01", DOMAIN_SEPARATOR, greenBTCHash));
        address recoveredAddress = ecrecover(digest, sig.v, sig.r, sig.s);

        require(recoveredAddress == authorizer, "GBTC: Invalid Singature");
    }

    /**
     * @dev Verify the signature of authority based on the GreenBTC info, and mint the BTC block NFT
     * @param option the option to mint GreeenBTC block, if Open simultaneouly
     * @param typeTarget Type of the ART token; = 0x00, cART; = 0x10, ART token
     * @param gbtc the Bitcoin block info to be minted
     * @param sig Signature of the authority
     */
    function _mintGreenBTC(
        uint256 option,
        uint8 typeTarget,
        GreenBTCInfo memory gbtc,
        Sig calldata sig
    ) internal returns(uint8) {
        _checkGBTCData(gbtc, typeTarget);
        _authVerify(gbtc, sig);
        
        (uint8 ratio, uint128 height) = _getSubsidyRatio(gbtc.height);
        if( ratio != 0) gbtc.height = height;
        
        _mintNFT(gbtc, ratio);
        if((option >> 63) !=0) openBox(gbtc.height);
        return ratio;
    }

    /**
     * @dev Verify the signature of authority based on the GreenBTC info list, and mint the BTC block list
     * @param option the option to mint GreeenBTC block, if Open simultaneouly, if skip while occupied 
     * @param typeTarget Type of the ART token; = 0x00, cART; = 0x01, ART token
     * @param gbtcList List of the Bitcoin block info to be minted
     * @param sig Signature of the authority
     */
    function _mintGreenBTCBatch(
        uint256 option,
        uint8 typeTarget,
        GreenBTCInfo[] memory gbtcList,
        Sig calldata sig
    ) internal returns(uint256 amountARTSum, uint8 ratio) {

        bytes memory greenBTCData = abi.encode(GREENBTC_BATCH_TYPEHASH, gbtcList);
        bytes32 greenBTCHash = keccak256(greenBTCData);
        bytes32 digest = keccak256(abi.encodePacked("\x19\x01", DOMAIN_SEPARATOR, greenBTCHash));
        address recoveredAddress = ecrecover(digest, sig.v, sig.r, sig.s);

        require(recoveredAddress == authorizer, "GBTC: Invalid Singature");

        bool ifOpen = (option & (1<<63)) != 0;
        bool ifSkip = (option & (1<<62)) != 0;

        uint128 height;
        (ratio, height) = _getSubsidyRatio(gbtcList[0].height);
        if( ratio != 0) gbtcList[0].height = height;

        for(uint256 index = 0; index < gbtcList.length; index++) {
            GreenBTCInfo memory gbtc = gbtcList[index];

            // skip if occupied in skipping option 
            if(ifSkip && (dataGBTC[gbtc.height].ARTCount != 0)) continue;

            _checkGBTCData(gbtc, typeTarget);
            _mintNFT(gbtc, ratio);

            if(ifOpen) openBox(gbtc.height);

            amountARTSum += gbtcList[index].ARTCount;
        }
        require(amountARTSum != 0, "GBTC: No Block Available");

    }

    /**
     * @dev Add or remove the acceptable ART tokens
     * @param tokenARTList ART list to add or rmeove
     * @param addOrRemove = 0, to remove; = 1, to add
     */
    function mangeARTTokens(address[] calldata tokenARTList, bool addOrRemove) external {       // onlyOwner
      _mangeARTTokensMute(tokenARTList, addOrRemove);                     // no code size because optimization
      callGreenBTCPro(greenBTCPro);
    }

    function _mangeARTTokensMute(address[] calldata tokenARTList, bool addOrRemove) internal {}
    
    /**
     * @dev Call arkreenBuilder with the specified calldata
     * @param builderCallData Call data passed to arkreenBuilder
     */
    function _actionBuilderBadge(bytes memory builderCallData) internal {
        (bool success, bytes memory returndata) = arkreenBuilder.call(builderCallData);

         if (!success) {
            if (returndata.length > 0) {
                // solhint-disable-next-line no-inline-assembly
                assembly {
                    let returndata_size := mload(returndata)
                    revert(add(32, returndata), returndata_size)
                }
            } else {
                revert("GBTC: Error Call to actionBuilder");
            }
        }        
    }
    
    /**
     * @dev Get the price and sold amount of the specified ART versus the payment token 
     * @param tokenART ART token
     * @param tokenPay Payment token
     */
    function getPrice(address tokenART, address tokenPay) external view returns(uint128 price, uint128 received) {
        address artBank = IArkreenBuilder(arkreenBuilder).artBank();
        (price, received) = IArkreenRECBank(artBank).saleIncome(tokenART, tokenPay);
    }
}
