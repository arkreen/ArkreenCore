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

contract GreenBTCPro is 
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

    modifier onlyManager(){
        require(msg.sender == manager, "GBTC: Not Manager");
        _;
    }

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    //initialize
    function initialize() external virtual initializer 
    {}

    function _authorizeUpgrade(address newImplementation) internal virtual override onlyOwner
    {}

    /**
     * @dev Reveal all the opened boxes stored internally. All overtime boxes will be moved to another list. 
     * waiting for another revealing with hash value.
     */
    function revealBoxes() public {         // Proxy

        uint256 openingListLength = openingBoxList.length;
        require (openingListLength != 0, "GBTC: Empty List");

        uint256 revealcap = normalRevealCap;
        uint256 overtimeCap = overtimeRevealCap;
        uint256 removeCap = removeRevealCap;

        uint256[] memory revealList = new uint256[](revealcap);       // reveal 200 blocks once a time
        bool[] memory wonList = new bool[](revealcap);

        uint256 revealCount;
        uint256 skipCount;
        uint256 allRevealCount;

        for (uint256 index = openingBoxListOffset; index < openingListLength; index++) {
            OpenInfo memory openInfo = openingBoxList[index];
            uint256 tokenID = openInfo.tokenID;
            uint256 openHeight = openInfo.openHeight + 1;               // Hash of the next block determining the result

            if (block.number <= openHeight) {
                skipCount++;
            } else if ( block.number <= openHeight + 256 ) {
                address owner = dataNFT[tokenID].opener;
                uint256 random = uint256(keccak256(abi.encodePacked(tokenID, owner, blockhash(openHeight))));

                if ((random % 100) < luckyRate) { 
                  dataNFT[tokenID].won = true;
                  wonList[revealCount] = true;
                }

                dataNFT[tokenID].reveal = true;
                dataNFT[tokenID].seed = random;

                revealList[revealCount] = tokenID;                    // Prepare for return data 

                delete openingBoxList[index];
                allRevealCount++;

                revealCount++;
                if(revealCount == revealcap) break;
            } else {
                overtimeBoxList.push(openInfo);
                dataNFT[tokenID].seed = overtimeBoxList.length - 1;     // Save index to make it easy to reveal with hash value

                delete openingBoxList[index];
                allRevealCount++;
                if(allRevealCount == overtimeCap) break;
            } 
        }
 
        openingBoxListOffset += allRevealCount;

        if ((skipCount == 0) && (openingBoxListOffset == openingListLength)) {
            uint256 popLength = openingListLength;
            if (popLength > removeCap) popLength = removeCap;

            for (uint256 index = 0; index < popLength; index++) {
                openingBoxList.pop();
            }

            if (openingBoxListOffset > openingBoxList.length) {
                openingBoxListOffset = openingBoxList.length;
            }
        }

        // Set the final reveal length if necessary
        if (revealCount < revealcap) {
          assembly {
              mstore(revealList, revealCount)
              mstore(wonList, revealCount)
          }
        }

        emit RevealBoxes(revealList, wonList);
    }

    /**
     * @dev Reveal the overtime boxes given in the input list.
     * @param tokenList All the token IDs of the NFT to be revealed.
     * @param hashList All the hash values of the block next after to block the NFT is minted.
     */
    function revealBoxesWithHash(uint256[] calldata tokenList, uint256[] calldata hashList) public onlyManager {

        uint256 lengthReveal = hashList.length; 
        require( tokenList.length == lengthReveal,  "GBTC: Wrong Length" );

        uint256 overtimeListLength = overtimeBoxList.length;
        require (overtimeListLength != 0, "GBTC: Empty Overtime List");

        uint256[] memory revealList = new uint256[](lengthReveal);
        bool[] memory wonList = new bool[](lengthReveal);

        uint256 revealCount;
        for (uint256 index = 0; index < lengthReveal; index++) {

            uint256 tokenID = tokenList[index];

            // Can not repeat revealing, and can not reveal while not opened
            require(dataNFT[tokenID].open != dataNFT[tokenID].reveal, "GBTC: Wrong Overtime Status" );  

            uint256 indexOvertime = dataNFT[tokenID].seed;          // seed is re-used to store the index in overtime list

            address owner = dataNFT[tokenID].opener;
            uint256 random = uint256(keccak256(abi.encodePacked(tokenID, owner, hashList[index])));

            if((random % 100) < luckyRate) {
                dataNFT[tokenID].won = true;
                wonList[revealCount] = true;
            }

            dataNFT[tokenID].reveal = true;
            dataNFT[tokenID].seed = random;

            // Remove the revealed item by replacing with the last item
            uint256 overtimeLast = overtimeBoxList.length - 1;
            if( indexOvertime < overtimeLast) {
                OpenInfo memory openInfo = overtimeBoxList[overtimeLast];
                overtimeBoxList[indexOvertime] = openInfo;
                dataNFT[openInfo.tokenID].seed = indexOvertime;
            }
            overtimeBoxList.pop();

            revealList[revealCount++] = tokenID;                            // Prepare for return data 
        }

        emit RevealBoxes(revealList, wonList);
    }

    /**
     * @dev Set new caps
     */
    function setNewCaps(uint256 newNormalCap, uint256 newOvertimeCap, uint256 newRemoveCap) public onlyOwner {
        if( newNormalCap != 0) normalRevealCap = newNormalCap;
        if( newOvertimeCap != 0) overtimeRevealCap = newOvertimeCap;
        if( newRemoveCap != 0) removeRevealCap = newRemoveCap;
    }

    /**
     * @dev Add or remove the acceptable ART tokens
     * @param tokenARTList ART list to add or rmeove
     * @param addOrRemove = 0, to remove; = 1, to add
     */
    function mangeARTTokens(address[] calldata tokenARTList, bool addOrRemove) external onlyOwner {
        for(uint256 i = 0; i < tokenARTList.length; i++) {
            address tokenART = tokenARTList[i];

            require(tokenART != address(0) && whiteARTList[tokenART] != addOrRemove, "GBTC: Wrong ART Status");
            whiteARTList[tokenART] = addOrRemove;
        }
    }   
}
