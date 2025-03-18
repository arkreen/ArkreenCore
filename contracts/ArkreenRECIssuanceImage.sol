// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "@openzeppelin/contracts/utils/Base64.sol";
import "@openzeppelin/contracts/utils/Strings.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

import "./libraries/FormattedStrings.sol";
import "./libraries/TransferHelper.sol";
import "./libraries/BytesLib.sol";
import "./libraries/DateTime.sol";

import "./ArkreenRECIssuanceType.sol";

interface IArkreenRECIssuanceImageLogo {
    function getARECLogoImage(uint256 logoId) external pure returns(bytes memory);
}

contract ArkreenRECIssuanceImage is Ownable{
 
    using Strings for uint128;
    using Strings for uint256;
    using Strings for address;
    using FormattedStrings for uint256;
    using BytesLib for bytes;

    IArkreenRECIssuanceImageLogo public imageLogo;
    address public arkreenRECIssuance;

    constructor(address arecNFT, address neWImageLogo) {
        arkreenRECIssuance = arecNFT;
        imageLogo = IArkreenRECIssuanceImageLogo(neWImageLogo);
    }

    function setImageLogo(address neWImageLogo) onlyOwner public {
        imageLogo = IArkreenRECIssuanceImageLogo(neWImageLogo);
    }

    function _decimalTruncate(string memory _str, uint256 decimalDigits) internal pure returns (string memory) {
        bytes memory strBytes = bytes(_str);
        uint256 dotIndex = strBytes.length;

        for (uint256 i = 0; i < strBytes.length; i++) {
            if (strBytes[i] == ".") {

                if(i + decimalDigits + 1 < strBytes.length){
                    dotIndex = i + decimalDigits + 1;
                }
                break;
            }
        }

        bytes memory result = new bytes(dotIndex);
        for (uint256 i = 0; i < dotIndex; i++) {
            result[i] = strBytes[i];
        }

        return string(result);
    }

    function toFixedPoint(uint256 value, uint256 decimal) internal pure returns (string memory) {
        require(decimal <= 18, "Strings: Fixed point too long");
        string memory valueString = value.toString();
        
        if (decimal == 0) return valueString;

        bytes memory valueBytes = bytes(valueString);
        uint256 length = valueBytes.length;

        bytes memory resulInBytes;
        if (length > decimal) {
            resulInBytes = valueBytes.slice(0, length - decimal).concat(".")                // Integer part
                                .concat(valueBytes.slice(length - decimal, decimal));       // Decimal part
        } else {
            resulInBytes = bytes("0.000000000000000000").slice(0, decimal + 2 - length)     // Maximum 18 decimals
                                .concat(valueBytes);
        }
        return string(resulInBytes);
    }

    function toStringDayMonth(uint16 year, uint8 month, uint8 day) internal pure returns (string memory) {
        bytes memory buffer = new bytes(10);
        buffer[3] = bytes1(uint8(48 + uint256(year % 10)));  year /= 10;
        buffer[2] = bytes1(uint8(48 + uint256(year % 10)));  year /= 10;
        buffer[1] = bytes1(uint8(48 + uint256(year % 10)));  year /= 10;
        buffer[0] = bytes1(uint8(48 + uint256(year)));
        buffer[4] = "-";
        buffer[6] = bytes1(uint8(48 + uint256(month % 10)));  month /= 10;
        buffer[5] = bytes1(uint8(48 + uint256(month))); 
        buffer[7] = "-";
        buffer[9] = bytes1(uint8(48 + uint256(day % 10)));  day /= 10;
        buffer[8] = bytes1(uint8(48 + uint256(day)));  
        return string(buffer);
    }

    function getARECSVG(
        uint256 tokenId,
        address owner,
        RECData memory recData
    ) external view returns(string memory) {

        bytes memory dataURI;
        string memory tokenString = tokenId.toString();

        {
            string memory energyInBadge = _decimalTruncate(toFixedPoint(recData.amountREC, 9), 3);
            string memory svgData = getARECSVGImage(tokenId, owner, recData);

            dataURI = abi.encodePacked(
                            '{"name":"AREC NFT #',
                            tokenString,
                            '","description":"',
                            'Details of renewable energy included in the AREC NFT.',
                            '","image":"data:image/svg+xml;base64,',
                            svgData,
                            '","attributes":[{"display_type":"number","trait_type":"AREC NFT ID","value":',
                            tokenString,
                            '},{"trait_type":"Serial Number","value":"',
                            recData.serialNumber,
                            '"},{"trait_type":"Renewable Energy","value":"',
                            energyInBadge,
                            ' kWh"},'
                            );
        }

        {
            dataURI = abi.encodePacked(dataURI,
                            '{"display_type":"date","trait_type":"AREC Start Time","value":',
                            uint256(recData.startTime).toString(),
                            '},{"display_type":"date","trait_type":"AREC End Time","value":',
                            uint256(recData.endTime).toString(),
                            '},{"trait_type":"AREC Region","value":"',
                            recData.region,
                            '"},{"trait_type":"AREC URL","value":"',
                            recData.url,
                            '"}'
                        );
        }
        if (bytes(recData.memo).length !=0) {
            dataURI = abi.encodePacked(dataURI,
                            ',{"trait_type":"AREC Memo","value":"',
                            recData.memo,
                            '"}]}'
                        );
        } else {
            dataURI = abi.encodePacked(dataURI, ']}');
        }

        return string(abi.encodePacked("data:application/json;base64,", Base64.encode(dataURI)));
    }

    function getARECSVGImage(uint256 tokenId, address owner, RECData memory recData) internal view returns(string memory) {

        bytes memory imgBytes;
        bytes memory imgLogoBytes= imageLogo.getARECLogoImage(1);
        
        imgBytes = abi.encodePacked(
            '<svg viewBox="0 0 900 744" fill="none" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">'
                '<defs>'
                    '<path id="center" d="M0 20 800 20" stroke="white" fill="none"/>'
                '</defs>'
                '<style>.f{font-family:Montserrat;dominant-baseline:middle;text-anchor:middle}</style>'
                '<style>.f4{font-family:Montserrat;font-size=12px;font-weight:400;dominant-baseline:middle;text-anchor:middle}</style>'
                '<style>.fb{font-family:Montserrat;font-weight:700;dominant-baseline:middle;text-anchor:middle}</style>'
                '<path fill="#fff" d="M.5.5h899v743H.5z"/>'
                '<path stroke="#2F2F34" d="M.5.5h899v743H.5z"/>'
                '<path stroke="#DBDBE4" d="M24.5 24.5h851v695h-851z"/>'
                '<path stroke="#DBDBE4" d="M32.5 32.5h835v679h-835z"/>'
                '<g>',
                imgLogoBytes,
                '<path d="M482 88c0 17.673-14.327 32-32 32-17.673 0-32-14.327-32-32 0-17.673 14.327-32'
                    ' 32-32 17.673 0 32 14.327 32 32z" fill="#00913A"/>'
                '<path d="M449.53 87.816l-6.583 10.543c-.632 1.013.095 2.329 1.288 2.329h23.366c1.342 0 2.16-1.478'
                    ' 1.449-2.618L452.268 71.19c-1.042-1.668-3.465-1.668-4.509 0l-16.963 27.17c-.632 1.013.095 2.329 1.288'
                    ' 2.329h3.793c.193-.001.383-.05.552-.143a1.15 1.15 0 00.414-.394l12.687-20.325a.573.573 0 01.967 0l8.68'
                    ' 13.905a.575.575 0 01.017.58.568.568 0 01-.5.294h-5.21a.57.57 0 01-.48-.873l.404-.648a.575.575'
                    ' 0 000-.604l-2.911-4.662a.566.566 0 00-.759-.199.574.574 0 00-.208.197z" fill="#fff"/>'
               '</g>'
                '<g transform="translate(50,130)">'
                    '<text class="f" font-size="24px" font-weight="700" fill="#202024">'
                        '<textPath xlink:href="#center" startOffset="50%">'
                          'ARKREEN RENEWABLE ENERGY CERTIFICATE'
                        '</textPath>'
                    '</text>'
                '</g>'
                '<line x1="50" y1="620" x2="850" y2="620" stroke="#E0E0E0" stroke-width="1.5" stroke-dasharray="4,4" />'
                '<g transform="translate(50,200)">'
                    '<text class="f4" font-size="12px" fill="#5D5D68">'
                        '<textPath xlink:href="#center" startOffset="50%">'
                            'This certificate is issued to the account on Polygon of'
                        '</textPath>'
                    '</text>'
                '</g>'
                '<g transform="translate(50,240)">'
                    '<rect width="800" height="40"/>'
                    '<text class="f" font-size="16px" font-weight="700" fill="#2f2f34">'
                        '<textPath xlink:href="#center" startOffset="50%">',
                          owner.toHexString(),
                        '</textPath>'
                    '</text>'
                '</g>'
                '<g transform="translate(50,272)">'
                    '<text class="f4" font-size="12px" fill="#5D5D68">'
                        '<textPath xlink:href="#center" startOffset="50%">'
                          'by'
                        '</textPath>'
                    '</text>'
                '</g>'
                '<g transform="translate(50,302)">'
                    '<text class="f" font-size="16px" font-weight="700" fill="#2f2f34">'
                        '<textPath xlink:href="#center" startOffset="50%">',
                          'Arkreen Network',
                        '</textPath>'
                    '</text>'
                '</g>'
                
            );

        {
            string memory artAmount = _decimalTruncate(toFixedPoint(recData.amountREC, 9), 4);
            bytes memory fullARTString = bytes("AREC certificates, representing ")
                                            .concat(bytes(artAmount))
                                            .concat(bytes(' MWh of electricity generated from renewable sources, in the AREC NFT'));
            
            imgBytes = abi.encodePacked(imgBytes,

                '<g transform="translate(50,344)">'
                    '<text class="f4" font-size="12px" fill="#5D5D68">'
                        '<textPath xlink:href="#center" startOffset="50%">',
                            'confirming the issuance of',
                        '</textPath>'
                    '</text>'
                '</g>'
                '<g transform="translate(50,384)">'
                    '<rect width="800" height="40" />'
                    '<text class="f" font-size="32px" font-weight="700" fill="#202024">'
                        '<textPath xlink:href="#center" startOffset="50%">',
                          artAmount,
                        '</textPath>'
                    '</text>'
                '</g>'
                '<g transform="translate(50,418)">'
                    '<text class="f4" font-size="12px" fill="#5D5D68">'
                        '<textPath xlink:href="#center" startOffset="50%">',
                            string(fullARTString),
                        '</textPath>'
                    '</text>'
                '</g>'
             );    
        }

        {
            string memory linkHead = "https://polygonscan.com/nft/";
            string memory arkreenRECIssuanceString = arkreenRECIssuance.toHexString();
            string memory tokenString = tokenId.toString();

            imgBytes = abi.encodePacked(imgBytes,
                '<g transform="translate(50,444)">'
                    '<text class="f" font-size="12px" font-weight="700" fill="#2f2f34">'
                        '<textPath xlink:href="#center" startOffset="50%">',
                          linkHead,
                          arkreenRECIssuanceString,
                          '/',
                          tokenString,
                      '</textPath>'
                    '</text>'
                '</g>'

                '<g transform="translate(50,470)">'
                    '<text class="f4" font-size="12px" fill="#5D5D68">'
                        '<textPath xlink:href="#center" startOffset="50%">'
                          'This certificate relates to the electricity generation located at or in'
                        '</textPath>'
                    '</text>'
                '</g>'
             );    
        }

        {
            uint256 year;
            uint256 month;
            uint256 day;

            (year, month, day) = DateTime.timestampToDate(uint256(recData.startTime));
            string memory startString = toStringDayMonth(uint16(year), uint8(month), uint8(day));

            (year, month, day) = DateTime.timestampToDate(uint256(recData.endTime));
            string memory endString = toStringDayMonth(uint16(year), uint8(month), uint8(day));

            imgBytes = abi.encodePacked(imgBytes,     

                    '<g transform="translate(50,504)">'
                        '<rect width="800" height="40"/>'
                        '<text class="f" font-size="16px" font-weight="700" fill="#2f2f34">'
                            '<textPath xlink:href="#center" startOffset="50%">',
                                recData.region,
                            '</textPath>'
                        '</text>'
                    '</g>'
                    '<g transform="translate(50,536)">'
                        '<text class="f4" font-size="12px" fill="#5D5D68">'
                            '<textPath xlink:href="#center" startOffset="50%">'
                                'in respect of the reporting period'
                            '</textPath>'
                        '</text>'
                    '</g>'
                    '<g transform="translate(50,574)">'
                        '<text class="f4" font-size="12px" fill="#5D5D68">'
                            '<textPath xlink:href="#center" startOffset="50%">'
                                'to'
                            '</textPath>'
                        '</text>'
                    '</g>'
                    '<g transform="translate(-20,574)">'
                        '<text class="f" font-size="16px" font-weight="500" fill="#202024">'
                            '<textPath xlink:href="#center" startOffset="50%">',
                                startString,
                            '</textPath>'
                        '</text>'
                    '</g>'

                    '<g transform="translate(120,574)">'
                        '<text class="f" font-size="16px" font-weight="500" fill="#202024">'
                            '<textPath xlink:href="#center" startOffset="50%">',
                                endString,
                            '</textPath>'
                        '</text>'
                    '</g>'
                    '<line x1="50" y1="620" x2="850" y2="620" stroke="#E0E0E0" stroke-width="1.5" stroke-dasharray="4,4" />'
                '</svg>'
            );
        }

        return  string(Base64.encode(imgBytes));
    }
}