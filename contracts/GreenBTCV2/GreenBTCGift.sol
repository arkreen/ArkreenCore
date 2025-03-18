// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC1155/ERC1155Upgradeable.sol";

import "../libraries/TransferHelper.sol";
import "../libraries/DecimalMath.sol";

// Import this file to use console.log
import "hardhat/console.sol";

contract GreenBTCGift is 
    ContextUpgradeable,
    UUPSUpgradeable,
    OwnableUpgradeable,
    ERC1155Upgradeable
{

    address public greenBTC;
    address public tokenAKRE;

    address public tokenLockAge;

    // tokenAddress: MSB0: 20, the address of the token to be sent to user while the gift card is returned back and burned
    // Amount1: MSB24:4, the amount of the Lockage token to be burned while claming. Let (MSB24:3) = a, (MSB27）= b, Amount1 = a * (10**b)
    // Amount0: MSB28:4, the amount to send. Let (MSB28:3) = n, (MSB31）= m, Amount0 = n * (10**m)
    mapping (uint256 => bytes32) public greenBTCGifts;     

    event GiftBatchMinted(address greener, uint256[] giftIDs, uint256[] amounts);
    event GiftBatchClaimed(address user, uint256[] giftIDs, uint256[] amounts);
    event GiftClaimed(address user, uint256 giftID, uint256 amount);
    event DomainRegistered(uint256 domainID, bytes32 domainInfo);
    event DomainGreenized(address gbtcActor, uint256 actionNumber, uint256 blockHeight, uint256 domainID, uint256 boxStart, uint256 boxNumber);

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    //function initialize(address gbtc, address akre)
    function initialize(address gbtc, address akre)
        external
        virtual
        initializer
    {
        __UUPSUpgradeable_init();
        __Ownable_init_unchained();
        __ERC1155_init_unchained("");
        greenBTC = gbtc;
        tokenAKRE = akre;
    }

    function _authorizeUpgrade(address newImplementation) internal virtual override onlyOwner
    {}

    function initGift(uint256 giftId, bytes32 giftInfo) public onlyOwner {
        require (uint256(giftInfo) != 0, "GBTC: Wrong Gift Info");
        require (uint256(greenBTCGifts[giftId]) == 0, "GBTC: Gift Repteated");
        greenBTCGifts[giftId] = giftInfo;
    }

    function setGreenBTC(address gbtc) public onlyOwner {
        require(gbtc != address(0), "GBTC: Zero Address");
        greenBTC = gbtc;
    }

    function mintGifts(address greener, uint256[] memory giftIDs, uint256[] memory amounts) public {
        require (msg.sender == greenBTC, "GBTC: Wrong Caller");
        require (giftIDs.length == amounts.length, "GBTC: Wrong Length");

        uint256 amountAKRE = 0;
        address akre = tokenAKRE;
        uint8 akreAmountDecimal = 0;
        for (uint256 index; index < giftIDs.length; index++) {
            uint256 giftInfo = uint256(greenBTCGifts[giftIDs[index]]);
            require (giftInfo != 0, "GBTC: Wrong Gift ID");

            address giftToken = address(uint160(giftInfo >> 96));
            if ((giftToken == akre) || giftToken == address(0)) {
                amountAKRE += (amounts[index] * uint256((uint32(giftInfo) >> 8)));
                if (akreAmountDecimal == 0) {
                    akreAmountDecimal = uint8(giftInfo);
                }
            } else {
                 uint256 amountToken = amounts[index] * uint256(uint32(giftInfo) >> 8) * DecimalMath.getDecimalPower(uint8(giftInfo));
                TransferHelper.safeTransferFrom(giftToken, msg.sender, address(this), amountToken);
            }
        }

        if (amountAKRE != 0) {
            TransferHelper.safeTransferFrom(akre, msg.sender, address(this), amountAKRE * DecimalMath.getDecimalPower(akreAmountDecimal));
        }
        _mintBatch(greener, giftIDs, amounts, '');

        emit GiftBatchMinted(greener, giftIDs, amounts);
    }

    function claimGift(uint256 giftID, uint256 amount) public {
        uint256 giftInfo = uint256(greenBTCGifts[giftID]);
        require (giftInfo != 0, "GBTC: Wrong Gift ID");
        require (amount != 0, "GBTC: Zero Amout");

        _burn(msg.sender, giftID, amount);

        address giftToken = address(uint160(giftInfo >> 96));
        uint256 amountToken = amount * (uint24(giftInfo >> 8)) * DecimalMath.getDecimalPower(uint8(giftInfo));

        emit GiftClaimed(msg.sender, giftID, amount);

        TransferHelper.safeTransfer(giftToken, msg.sender, amountToken);
    }

    function claimGiftBatch(uint256[] memory giftIDs, uint256[] memory amounts) public {

        require (giftIDs.length == amounts.length, "GBTC: Wrong Length");
        _burnBatch(msg.sender, giftIDs, amounts);

        uint256 amountAKRE;
        uint8 akreAmountDecimal;
        address akre = tokenAKRE;
        for (uint256 index; index < giftIDs.length; index++) {
            uint256 giftInfo = uint256(greenBTCGifts[giftIDs[index]]);
            require (giftInfo != 0, "GBTC: Wrong Gift ID");

            address giftToken = address(uint160(giftInfo >> 96));
            if ((giftToken == akre) || giftToken == address(0)) {
                amountAKRE += (amounts[index] * uint256((uint32(giftInfo) >> 8)));
                if (akreAmountDecimal == 0) {
                    akreAmountDecimal = uint8(giftInfo);
                }
            } else {
                 uint256 amountToken = amounts[index] * uint256(uint32(giftInfo) >> 8) * DecimalMath.getDecimalPower(uint8(giftInfo));
                TransferHelper.safeTransfer(giftToken, msg.sender, amountToken);
            }
        }

        if (amountAKRE != 0) {
            TransferHelper.safeTransfer(akre, msg.sender, amountAKRE * DecimalMath.getDecimalPower(akreAmountDecimal));
        }

        emit GiftBatchClaimed(msg.sender, giftIDs, amounts);
    }
}
