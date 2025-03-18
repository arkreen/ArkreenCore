// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;


import "@openzeppelin/contracts/utils/Base64.sol";
import "@openzeppelin/contracts/utils/Strings.sol";

import "./libraries/FormattedStrings.sol";
import "./libraries/TransferHelper.sol";

import "./GreenBTCType.sol";

contract GreenBTCImage {
 
    using Strings for uint128;
    using Strings for uint256;
    using Strings for address;
    using FormattedStrings for uint256;

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


    function getCertificateSVG(address owner, GreenBTCInfo calldata gbtc, NFTStatus calldata dataNFT) external pure returns(string memory) {

        string memory svgData;
        uint256 tokenID = gbtc.height;

        bytes memory typeNFT;
        string memory turncateEnergy = _decimalTruncate(gbtc.energyStr, 3);
        if(dataNFT.open == false || dataNFT.reveal == false) { 
            svgData = getBlindBoxSVGBytes(tokenID);
            typeNFT = "Mystery Box";
        } else {
            if(dataNFT.won) {
                svgData = getGreenTreeSVGBytes(gbtc.greenType);
                typeNFT = "Genesis Seed";
            } else {
                svgData = getCertificateSVGBytes(owner, gbtc);    
                typeNFT = "Certificate";
            }      
        }

        bytes memory dataURI = abi.encodePacked(
            '{"name":"GreenBTC #',
            tokenID.toString(),
            '","description":"',
            "Climate Actions For Greening BTC.",
            '","image":"data:image/svg+xml;base64,',
            svgData,
            '","attributes":[{"display_type":"number","trait_type":"Height","value":',
            tokenID.toString(),
            '},{"trait_type":"Energy","value":"',
            turncateEnergy,
            ' kWh"},{"trait_type":"Type","value":"',
            typeNFT,
            '"}]}'
        );
        return string(abi.encodePacked("data:application/json;base64,", Base64.encode(dataURI)));
    }

    function getCertificateSVGBytes(address owner, GreenBTCInfo calldata gbtc) internal pure returns(string memory) {

        string memory turncateEnergy = _decimalTruncate(gbtc.energyStr, 3);

        string memory artFlag = ((gbtc.greenType & 0xF0) == 0x10) 
                                  ? '<text x="15" y="135" class="prefix__medium">*ART</text>' 
                                  : '';

        bytes memory imgBytes = abi.encodePacked(
            '<svg width="300" height="300" xmlns="http://www.w3.org/2000/svg" font-family="Courier New">'
            '<rect width="300" height="300" rx="10" fill="#f3f6d3" />'
            '<path fill="#fffef8" d="M0 60h300v125H0z" />'
            '<rect y="240" width="300" height="60" rx="10" fill="#e5d2bd" />'
            '<path fill="#f6dfeb" d="M0 180h300v70H0z" />'
            '<text x="15" y="25" class="prefix__medium">GREENBTC CERTIFICATE</text>'
            '<path fill="#8E8984" d="M15 50h115v.409H15z" />'
            '<path opacity=".1" stroke="#5F5246" stroke-width="20" stroke-dasharray="5 5 5" d="M275 208v87" />'
            '<text x="15" y="95" class="prefix__medium">HEIGHT&gt;</text>'
            '<text x="110" y="95" class="prefix__medium">',
            gbtc.height.toString(),
            '</text>'
            '<text x="15" y="115" class="prefix__medium">ENERGY&gt;</text>'
            '<text x="110" y="115" class="prefix__medium">',
            turncateEnergy,
            '  kWh'
            '</text>',
            artFlag,
            '<text x="15" y="210" class="prefix__medium">OWNER:</text>'
            '<text x="15" y="230" font-size="9">',
            owner.toHexString(),
            '</text>'
            '<g opacity=".25" fill="#FFC736">'
            '<path d="M223.859 16.717h-.26V0H203.51v16.717h-20.096v123.824h20.096v16.733h20.089v-16.733h.26v-26.773H210.2V90.342h13.659V63.57H210.2V43.49h13.659V16.717zM236.579 63.57h17.148c5.547 0 10.044-4.495 10.044-10.04 0-5.545-4.497-10.04-10.044-10.04h-17.148V0h20.071v16.832c18.974 1.489 33.907 17.35 33.907 36.698a36.655 36.655 0 01-8.866 23.957 38.316 38.316 0 018.866 24.568c0 19.7-14.809 35.943-33.907 38.214v17.005h-20.071v-43.506h15.473c6.473 0 11.719-5.244 11.719-11.713 0-6.469-5.246-11.713-11.719-11.713h-15.473V63.57z" />'
            '</g>'
            '<style>.prefix__medium{font-size:16px}</style>'
            '</svg>'
        );

        return  string(Base64.encode(imgBytes));
    }

    function getGreenTreeSVGBytes(uint8 greenType) internal pure returns(string memory) {

        string memory artFlag = ((greenType & 0xF0) == 0x10) 
                                  ? '<rect width="10" height="10" x="290" y="280" fill="#fff"/>'
                                    '<rect width="10" height="10" x="280" y="280" fill="#58a90f"/>'
                                    '<rect width="10" height="10" x="290" y="290" fill="#58a90f"/>'
                                    '<rect width="10" height="10" x="280" y="290" fill="#fff"/>'
                                   : '';

        bytes memory imgBytes = abi.encodePacked(
            '<svg width="320" height="320" viewBox="0 0 320 320" xmlns="http://www.w3.org/2000/svg" shape-rendering="crispEdges">'
                '<rect width="100%" height="100%" fill="none"/>'
                '<rect width="320" height="10" x="0" y="0" fill="#49b652"/>'
                '<rect width="320" height="10" x="0" y="10" fill="#49b652"/>'
                '<rect width="320" height="10" x="0" y="20" fill="#49b652"/>'
                '<rect width="320" height="10" x="0" y="30" fill="#49b652"/>'
                '<rect width="320" height="10" x="0" y="40" fill="#49b652"/>'
                '<rect width="320" height="10" x="0" y="50" fill="#49b652"/>'
                '<rect width="100" height="10" x="0" y="60" fill="#49b652"/>'
                '<rect width="20" height="10" x="100" y="60" fill="#0e3500"/>'
                '<rect width="30" height="10" x="120" y="60" fill="#49b652"/>'
                '<rect width="20" height="10" x="150" y="60" fill="#0e3500"/>'
                '<rect width="30" height="10" x="170" y="60" fill="#49b652"/>'
                '<rect width="20" height="10" x="200" y="60" fill="#0e3500"/>'
                '<rect width="100" height="10" x="220" y="60" fill="#49b652"/>'
                '<rect width="90" height="10" x="0" y="70" fill="#49b652"/>'
                '<rect width="10" height="10" x="90" y="70" fill="#0e3500"/>'
                '<rect width="20" height="10" x="100" y="70" fill="#287a17"/>'
                '<rect width="10" height="10" x="120" y="70" fill="#0e3500"/>'
                '<rect width="10" height="10" x="130" y="70" fill="#49b652"/>'
                '<rect width="10" height="10" x="140" y="70" fill="#0e3500"/>'
                '<rect width="20" height="10" x="150" y="70" fill="#58a90f"/>'
                '<rect width="10" height="10" x="170" y="70" fill="#0e3500"/>'
                '<rect width="10" height="10" x="180" y="70" fill="#49b652"/>'
                '<rect width="10" height="10" x="190" y="70" fill="#0e3500"/>'
                '<rect width="20" height="10" x="200" y="70" fill="#287a17"/>'
                '<rect width="10" height="10" x="220" y="70" fill="#0e3500"/>'
                '<rect width="90" height="10" x="230" y="70" fill="#49b652"/>'
                '<rect width="80" height="10" x="0" y="80" fill="#49b652"/>'
                '<rect width="10" height="10" x="80" y="80" fill="#0e3500"/>'
                '<rect width="10" height="10" x="90" y="80" fill="#287a17"/>'
                '<rect width="20" height="10" x="100" y="80" fill="#1e6310"/>'
                '<rect width="10" height="10" x="120" y="80" fill="#287a17"/>'
                '<rect width="20" height="10" x="130" y="80" fill="#0e3500"/>'
                '<rect width="20" height="10" x="150" y="80" fill="#58a90f"/>'
                '<rect width="20" height="10" x="170" y="80" fill="#0e3500"/>'
                '<rect width="10" height="10" x="190" y="80" fill="#287a17"/>'
                '<rect width="20" height="10" x="200" y="80" fill="#1e6310"/>'
                '<rect width="10" height="10" x="220" y="80" fill="#287a17"/>'
                '<rect width="10" height="10" x="230" y="80" fill="#0e3500"/>'
                '<rect width="80" height="10" x="240" y="80" fill="#49b652"/>'
                '<rect width="90" height="10" x="0" y="90" fill="#49b652"/>'
                '<rect width="10" height="10" x="90" y="90" fill="#0e3500"/>'
                '<rect width="20" height="10" x="100" y="90" fill="#287a17"/>'
                '<rect width="10" height="10" x="120" y="90" fill="#0e3500"/>'
                '<rect width="10" height="10" x="130" y="90" fill="#49b652"/>'
                '<rect width="10" height="10" x="140" y="90" fill="#0e3500"/>'
                '<rect width="20" height="10" x="150" y="90" fill="#58a90f"/>'
                '<rect width="10" height="10" x="170" y="90" fill="#0e3500"/>'
                '<rect width="10" height="10" x="180" y="90" fill="#49b652"/>'
                '<rect width="10" height="10" x="190" y="90" fill="#0e3500"/>'
                '<rect width="20" height="10" x="200" y="90" fill="#287a17"/>'
                '<rect width="10" height="10" x="220" y="90" fill="#0e3500"/>'
                '<rect width="90" height="10" x="230" y="90" fill="#49b652"/>'
                '<rect width="100" height="10" x="0" y="100" fill="#49b652"/>'
                '<rect width="20" height="10" x="100" y="100" fill="#0e3500"/>'
                '<rect width="20" height="10" x="120" y="100" fill="#49b652"/>'
                '<rect width="10" height="10" x="140" y="100" fill="#0e3500"/>'
                '<rect width="20" height="10" x="150" y="100" fill="#58a90f"/>'
                '<rect width="10" height="10" x="170" y="100" fill="#0e3500"/>'
                '<rect width="20" height="10" x="180" y="100" fill="#49b652"/>'
                '<rect width="20" height="10" x="200" y="100" fill="#0e3500"/>'
                '<rect width="100" height="10" x="220" y="100" fill="#49b652"/>'
                '<rect width="130" height="10" x="0" y="110" fill="#49b652"/>'
                '<rect width="10" height="10" x="130" y="110" fill="#30120b"/>'
                '<rect width="10" height="10" x="140" y="110" fill="#b7a31c"/>'
                '<rect width="20" height="10" x="150" y="110" fill="#bec028"/>'
                '<rect width="10" height="10" x="170" y="110" fill="#b7a31c"/>'
                '<rect width="10" height="10" x="180" y="110" fill="#30120b"/>'
                '<rect width="130" height="10" x="190" y="110" fill="#49b652"/>'
                '<rect width="120" height="10" x="0" y="120" fill="#49b652"/>'
                '<rect width="10" height="10" x="120" y="120" fill="#30120b"/>'
                '<rect width="10" height="10" x="130" y="120" fill="#662819"/>'
                '<rect width="10" height="10" x="140" y="120" fill="#30120b"/>'
                '<rect width="20" height="10" x="150" y="120" fill="#b7a31c"/>'
                '<rect width="10" height="10" x="170" y="120" fill="#30120b"/>'
                '<rect width="10" height="10" x="180" y="120" fill="#662819"/>'
                '<rect width="10" height="10" x="190" y="120" fill="#30120b"/>'
                '<rect width="120" height="10" x="200" y="120" fill="#49b652"/>'
                '<rect width="110" height="10" x="0" y="130" fill="#49b652"/>'
                '<rect width="10" height="10" x="110" y="130" fill="#30120b"/>'
                '<rect width="10" height="10" x="120" y="130" fill="#662819"/>'
                '<rect width="20" height="10" x="130" y="130" fill="#722f1c"/>'
                '<rect width="20" height="10" x="150" y="130" fill="#30120b"/>'
                '<rect width="20" height="10" x="170" y="130" fill="#722f1c"/>'
                '<rect width="10" height="10" x="190" y="130" fill="#662819"/>'
                '<rect width="10" height="10" x="200" y="130" fill="#30120b"/>'
                '<rect width="110" height="10" x="210" y="130" fill="#49b652"/>'
                '<rect width="100" height="10" x="0" y="140" fill="#49b652"/>'
                '<rect width="10" height="10" x="100" y="140" fill="#30120b"/>'
                '<rect width="10" height="10" x="110" y="140" fill="#662819"/>'
                '<rect width="80" height="10" x="120" y="140" fill="#722f1c"/>'
                '<rect width="10" height="10" x="200" y="140" fill="#662819"/>'
                '<rect width="10" height="10" x="210" y="140" fill="#30120b"/>'
                '<rect width="100" height="10" x="220" y="140" fill="#49b652"/>'
                '<rect width="90" height="10" x="0" y="150" fill="#49b652"/>'
                '<rect width="10" height="10" x="90" y="150" fill="#30120b"/>'
                '<rect width="10" height="10" x="100" y="150" fill="#662819"/>'
                '<rect width="20" height="10" x="110" y="150" fill="#722f1c"/>'
                '<rect width="60" height="10" x="130" y="150" fill="#ffffff"/>'
                '<rect width="20" height="10" x="190" y="150" fill="#722f1c"/>'
                '<rect width="10" height="10" x="210" y="150" fill="#662819"/>'
                '<rect width="10" height="10" x="220" y="150" fill="#30120b"/>'
                '<rect width="90" height="10" x="230" y="150" fill="#49b652"/>'
                '<rect width="90" height="10" x="0" y="160" fill="#49b652"/>'
                '<rect width="10" height="10" x="90" y="160" fill="#30120b"/>'
                '<rect width="10" height="10" x="100" y="160" fill="#662819"/>'
                '<rect width="20" height="10" x="110" y="160" fill="#722f1c"/>'
                '<rect width="60" height="10" x="130" y="160" fill="#ffffff"/>'
                '<rect width="20" height="10" x="190" y="160" fill="#722f1c"/>'
                '<rect width="10" height="10" x="210" y="160" fill="#662819"/>'
                '<rect width="10" height="10" x="220" y="160" fill="#30120b"/>'
                '<rect width="90" height="10" x="230" y="160" fill="#49b652"/>'
                '<rect width="80" height="10" x="0" y="170" fill="#49b652"/>'
                '<rect width="10" height="10" x="80" y="170" fill="#30120b"/>'
                '<rect width="10" height="10" x="90" y="170" fill="#662819"/>'
                '<rect width="30" height="10" x="100" y="170" fill="#722f1c"/>'
                '<rect width="20" height="10" x="130" y="170" fill="#ffffff"/>'
                '<rect width="20" height="10" x="150" y="170" fill="#722f1c"/>'
                '<rect width="20" height="10" x="170" y="170" fill="#ffffff"/>'
                '<rect width="30" height="10" x="190" y="170" fill="#722f1c"/>'
                '<rect width="10" height="10" x="220" y="170" fill="#662819"/>'
                '<rect width="10" height="10" x="230" y="170" fill="#30120b"/>'
                '<rect width="80" height="10" x="240" y="170" fill="#49b652"/>'
                '<rect width="80" height="10" x="0" y="180" fill="#49b652"/>'
                '<rect width="10" height="10" x="80" y="180" fill="#30120b"/>'
                '<rect width="10" height="10" x="90" y="180" fill="#662819"/>'
                '<rect width="70" height="10" x="100" y="180" fill="#722f1c"/>'
                '<rect width="20" height="10" x="170" y="180" fill="#ffffff"/>'
                '<rect width="30" height="10" x="190" y="180" fill="#722f1c"/>'
                '<rect width="10" height="10" x="220" y="180" fill="#662819"/>'
                '<rect width="10" height="10" x="230" y="180" fill="#30120b"/>'
                '<rect width="80" height="10" x="240" y="180" fill="#49b652"/>'
                '<rect width="80" height="10" x="0" y="190" fill="#49b652"/>'
                '<rect width="10" height="10" x="80" y="190" fill="#30120b"/>'
                '<rect width="10" height="10" x="90" y="190" fill="#662819"/>'
                '<rect width="50" height="10" x="100" y="190" fill="#722f1c"/>'
                '<rect width="40" height="10" x="150" y="190" fill="#ffffff"/>'
                '<rect width="30" height="10" x="190" y="190" fill="#722f1c"/>'
                '<rect width="10" height="10" x="220" y="190" fill="#662819"/>'
                '<rect width="10" height="10" x="230" y="190" fill="#30120b"/>'
                '<rect width="80" height="10" x="240" y="190" fill="#49b652"/>'
                '<rect width="80" height="10" x="0" y="200" fill="#49b652"/>'
                '<rect width="10" height="10" x="80" y="200" fill="#30120b"/>'
                '<rect width="10" height="10" x="90" y="200" fill="#662819"/>'
                '<rect width="50" height="10" x="100" y="200" fill="#722f1c"/>'
                '<rect width="20" height="10" x="150" y="200" fill="#ffffff"/>'
                '<rect width="50" height="10" x="170" y="200" fill="#722f1c"/>'
                '<rect width="10" height="10" x="220" y="200" fill="#662819"/>'
                '<rect width="10" height="10" x="230" y="200" fill="#30120b"/>'
                '<rect width="80" height="10" x="240" y="200" fill="#49b652"/>'
                '<rect width="80" height="10" x="0" y="210" fill="#49b652"/>'
                '<rect width="10" height="10" x="80" y="210" fill="#30120b"/>'
                '<rect width="20" height="10" x="90" y="210" fill="#662819"/>'
                '<rect width="100" height="10" x="110" y="210" fill="#722f1c"/>'
                '<rect width="20" height="10" x="210" y="210" fill="#662819"/>'
                '<rect width="10" height="10" x="230" y="210" fill="#30120b"/>'
                '<rect width="80" height="10" x="240" y="210" fill="#49b652"/>'
                '<rect width="90" height="10" x="0" y="220" fill="#49b652"/>'
                '<rect width="10" height="10" x="90" y="220" fill="#30120b"/>'
                '<rect width="20" height="10" x="100" y="220" fill="#662819"/>'
                '<rect width="30" height="10" x="120" y="220" fill="#722f1c"/>'
                '<rect width="20" height="10" x="150" y="220" fill="#ffffff"/>'
                '<rect width="30" height="10" x="170" y="220" fill="#722f1c"/>'
                '<rect width="20" height="10" x="200" y="220" fill="#662819"/>'
                '<rect width="10" height="10" x="220" y="220" fill="#30120b"/>'
                '<rect width="90" height="10" x="230" y="220" fill="#49b652"/>'
                '<rect width="100" height="10" x="0" y="230" fill="#49b652"/>'
                '<rect width="20" height="10" x="100" y="230" fill="#30120b"/>'
                '<rect width="80" height="10" x="120" y="230" fill="#662819"/>'
                '<rect width="20" height="10" x="200" y="230" fill="#30120b"/>'
                '<rect width="100" height="10" x="220" y="230" fill="#49b652"/>'
                '<rect width="100" height="10" x="0" y="240" fill="#49b652"/>'
                '<rect width="20" height="10" x="100" y="240" fill="#426c4a"/>'
                '<rect width="80" height="10" x="120" y="240" fill="#30120b"/>'
                '<rect width="20" height="10" x="200" y="240" fill="#426c4a"/>'
                '<rect width="100" height="10" x="220" y="240" fill="#49b652"/>'
                '<rect width="110" height="10" x="0" y="250" fill="#49b652"/>'
                '<rect width="100" height="10" x="110" y="250" fill="#426c4a"/>'
                '<rect width="110" height="10" x="210" y="250" fill="#49b652"/>'
                '<rect width="320" height="10" x="0" y="260" fill="#49b652"/>'
                '<rect width="320" height="10" x="0" y="270" fill="#49b652"/>'
                '<rect width="320" height="10" x="0" y="280" fill="#49b652"/>'
                '<rect width="320" height="10" x="0" y="290" fill="#49b652"/>'
                '<rect width="320" height="10" x="0" y="300" fill="#49b652"/>'
                '<rect width="320" height="10" x="0" y="310" fill="#49b652"/>',
                artFlag,
                '</svg>'
        );

        return  string(Base64.encode(imgBytes));
    }

    function getBlindBoxSVGBytes(uint256 num) internal pure returns(string memory){
        bytes memory imgBytes = abi.encodePacked(
            '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 192 192" preserveAspectRatio="xMinYMin meet" fill="none">'
            '<style>.f{font-family:Montserrat,arial,sans-serif;dominant-baseline:middle;text-anchor:middle}</style>'
            '<path d="M96.864 172.667L33.356 136v56.833L96.863 246v-73.333zM160.4 135.997l-63.51 36.667v73.333l63.51-76.54v-33.46z"/>'
            '<path d="M96.86 99.33L33.352 62.665v73.333l63.508 36.667V99.33z" fill="#E8C684"/>'
            '<path d="M160.395 62.67L96.887 99.335v73.333l63.508-36.667V62.67z" fill="#D7A94F"/>'
            '<path d="M160.395 62.667L96.887 26 33.378 62.667l63.509 36.666 63.508-36.666z" fill="#EEDEA6"/>'
            '<text class="f" x="118" y="7" transform="rotate(30.5) skewX(-30)" fill="#98601e" font-size="16" font-weight="400">',
            num.toString(),
            "</text>"
            '<text class="f" x="68" y="82" transform="skewY(26.83) scale(.92718 1.07853)" fill="rgba(255,255,255,.5)" font-size="42">?</text>'
            "</svg>"
        );

        return  string(Base64.encode(imgBytes));
    }

}