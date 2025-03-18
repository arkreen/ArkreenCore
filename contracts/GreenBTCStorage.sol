// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "./GreenBTCType.sol";

abstract contract GreenBTCStorage
{
    //keccak256("GreenBitCoin(uint256 height,string energyStr,uint256 artCount,string blockTime,address minter,uint8 greenType)");
    bytes32 constant GREEN_BTC_TYPEHASH = 0xE645798FE54DB29ED50FD7F01A05DE6D1C5A65FAC8902DCFD7427B30FBD87C24;

    //keccak256("GreenBitCoinBatch((uint128,uint128,address,uint8,string,string)[])");
    bytes32 constant GREENBTC_BATCH_TYPEHASH = 0x829ABF7A83FCBCF66649914B5A9A514ACBF6BEDA598A620AEF732202E8155D73;
    
    string  constant NAME = "Green BTC Club";
    string  constant SYMBOL = "GBC";
    string  constant VERSION = "1";

    bytes32 public  DOMAIN_SEPARATOR;

    address public manager;
    address public authorizer;

    address public greenBtcImage;
    address public arkreenBuilder;
    address public tokenCART;                       // CART token is bought to greenize Bitcoin by default while some other token is paid.
    address public tokenNative;              

    OpenInfo[] internal openingBoxList;             // Box in this list could be opened internally with just a trigger command 
    OpenInfo[] internal overtimeBoxList;            // Box in this list need to be revealed with external hash information

    mapping (uint256 => GreenBTCInfo)  public dataGBTC;
    mapping (uint256 => NFTStatus)  public dataNFT;
    mapping(address => bool) public whiteARTList;   // ART token -> true/false

    uint256 public luckyRate;  

    uint256 internal openingBoxListOffset;

    uint256 public overtimeRevealCap;
    uint256 public normalRevealCap;
    uint256 public removeRevealCap;

    address public greenBTCPro;                   // Pro function of Green
    uint8   public ratioSubsidyCap;
    address public tokenARTSubsidy;               // ART token for subsidy
}
