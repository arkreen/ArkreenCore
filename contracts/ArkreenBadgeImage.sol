// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "@openzeppelin/contracts/utils/Base64.sol";
import "@openzeppelin/contracts/utils/Strings.sol";

import "./libraries/FormattedStrings.sol";
import "./libraries/TransferHelper.sol";
import "./libraries/BytesLib.sol";

import "./ArkreenBadgeType.sol";

contract ArkreenBadgeImage {
 
    using Strings for uint128;
    using Strings for uint256;
    using Strings for address;
    using FormattedStrings for uint256;
    using BytesLib for bytes;

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

    function getBadgeSVG(
        uint256 tokenId,
        OffsetRecord calldata offsetRecord,
        uint256 actionType,
        uint256[] calldata idsOfAREC
    ) external pure returns(string memory) {

        bytes memory dataURI;
        string memory tokenString = tokenId.toString();

        {
            string memory energyInBadge = _decimalTruncate(toFixedPoint(offsetRecord.offsetTotalAmount, 9), 3);
            address beneficiary = offsetRecord.beneficiary;
            if (beneficiary == address(0))  beneficiary = offsetRecord.offsetEntity;

            string memory svgData = getBadgeSVGImage(beneficiary.toHexString(), energyInBadge);

            dataURI = abi.encodePacked(
                            '{"name":"ArkreenClimateBadge #',
                            tokenString,
                            '","description":"',
                            'Proof of the climate actions for carbon offset.',
                            '","image":"data:image/svg+xml;base64,',
                            svgData,
                            '","attributes":[{"display_type":"number","trait_type":"AREC Badge ID","value":',
                            tokenString,
                            '},{"trait_type":"Renewable Energy","value":"',
                            energyInBadge,
                            ' kWh"},{"display_type":"date","trait_type":"AREC Badge Time","value":',
                            offsetRecord.creationTime.toString(),
                            '},'       
                        );
        }

        {
            string memory typeAction;
            if (actionType == 1) { 
                typeAction ="Redeem";
            } else if (actionType == 2) {
                typeAction = "Offset";
            } else {
                typeAction = "Redeem,Offset";
            }

            dataURI = abi.encodePacked(dataURI,
                            '{"trait_type":"Climate Action Type","value":"',
                            typeAction,
                            '"},{"display_type":"number","trait_type":"Climate Action Number","value":',
                            offsetRecord.offsetIds.length.toString(),
                            '},'
                        );
        }

        {
            bytes memory actionIds;
            for (uint256 index=0; index < offsetRecord.offsetIds.length; index++) {
                if (index == 0) actionIds = bytes(offsetRecord.offsetIds[0].toString());
                else actionIds = actionIds.concat(",").concat(bytes(offsetRecord.offsetIds[index].toString()));
            }
        
            dataURI = abi.encodePacked(dataURI,
                            '{"trait_type":"Climate Action IDs","value":"',
                            string(actionIds),
                            '"},'
                        );
        }

        {
            bytes memory arecNftIds;
            for (uint256 index=0; index < idsOfAREC.length; index++) {
                if (index==0) arecNftIds = bytes(idsOfAREC[0].toString());
                else arecNftIds = arecNftIds.concat(",").concat(bytes(idsOfAREC[index].toString()));
            }
        
            dataURI = abi.encodePacked(dataURI,
                            '{"trait_type":"Retired AREC NFTs","value":"',
                            string(arecNftIds),
                            '"},'
                        );
        }

        {
            bytes memory bytesBadgeFile = "https://arec.arkreen.com/badges/AREC_Badge_000000.pdf";
            bytes memory tokenInBytes = bytes(tokenString);
            bytes memory BadgeFile = bytesBadgeFile.slice(0, bytesBadgeFile.length - 4 - tokenInBytes.length)
                                        .concat(tokenInBytes.concat('.pdf'));

            dataURI = abi.encodePacked(dataURI,
                            '{"trait_type":"AREC Badge File","value":"',
                            string(BadgeFile),
                            '"}]}'
                        );
        }

        return string(abi.encodePacked("data:application/json;base64,", Base64.encode(dataURI)));
    }

    function getBadgeSVGImage(string memory beneficiary, string memory energyInBadge) internal pure returns(string memory) {

        bytes memory imgBytes = abi.encodePacked(

            '<svg viewBox="0 0 400 400" fill="none" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">'
                '<defs>'
                    '<path id="center" d="M0 20,400,20" stroke="white" fill="none"/>'
                    '<path id="top" transform="translate(140,40)" d="M -70 162 A 50 50 0 1 1 190 162"/>'
                    '<path id="address" transform="translate(140,40)" d="M -98 160 A 50 50 0 1 0 218 160"/>'
                '</defs>'
                '<path'
                    ' d="M178.596 12.8029C191.891 5.3451 208.109 5.34509 221.404 12.8029L236.374 21.2005C242.954 24.8916'
                    ' 250.355 26.8745 257.899 26.968L275.062 27.1805C290.305 27.3693 304.35 35.4785 312.135 48.5846L320.901'
                    ' 63.3422C324.754 69.8288 330.171 75.2463 336.658 79.0992L351.415 87.865C364.522 95.6498 372.631 109.695'
                    ' 372.819 124.938L373.032 142.101C373.125 149.645 375.108 157.046 378.8 163.626L387.197 178.596C394.655'
                    ' 191.891 394.655 208.109 387.197 221.404L378.8 236.374C375.108 242.954 373.125 250.355 373.032'
                    ' 257.899L372.819 275.062C372.631 290.305 364.522 304.35 351.415 312.135L336.658 320.901C330.171'
                    ' 324.754 324.754 330.171 320.901 336.658L312.135 351.415C304.35 364.522 290.305 372.631 275.062'
                    ' 372.819L257.899 373.032C250.355 373.125 242.954 375.108 236.374 378.8L221.404 387.197C208.109'
                    ' 394.655 191.891 394.655 178.596 387.197L163.626 378.8C157.046 375.108 149.645 373.125 142.101'
                    ' 373.032L124.938 372.819C109.695 372.631 95.6498 364.522 87.865 351.415L79.0992 336.658C75.2463'
                    ' 330.171 69.8288 324.754 63.3422 320.901L48.5846 312.135C35.4785 304.35 27.3693 290.305 27.1805'
                    ' 275.062L26.968 257.899C26.8745 250.355 24.8916 242.954 21.2005 236.374L12.8029 221.404C5.3451'
                    ' 208.109 5.34509 191.891 12.8029 178.596L21.2005 163.626C24.8916 157.046 26.8745 149.645 26.968'
                    ' 142.101L27.1805 124.938C27.3693 109.695 35.4785 95.6498 48.5846 87.865L63.3422 79.0992C69.8288'
                    ' 75.2463 75.2463 69.8288 79.0992 63.3422L87.865 48.5846C95.6498 35.4785 109.695 27.3693 124.938'
                    ' 27.1805L142.101 26.968C149.645 26.8745 157.046 24.8916 163.626 21.2005L178.596 12.8029Z"'
                    ' fill="#28282D" stroke="#404047" strokeWidth="1.38889"/>'
                '<circle cx="200" cy="200" r="166.667" fill="#28282D" stroke="#34C46E" strokeWidth="2.66667"/>'
                '<rect x="88" y="88" width="224" height="224" rx="112" fill="#2F2F34"/>'
                '<path'
                    ' d="M198.826 167.539L182.368 193.898C180.788 196.429 182.606 199.719 185.588 199.719H244.003C247.357 199.719'
                    ' 249.403 196.024 247.626 193.175L205.67 125.971C203.066 121.801 197.007 121.801 194.396 125.971L151.99'
                    ' 193.898C150.409 196.429 152.227 199.719 155.209 199.719H164.692C165.175 199.719 165.65 199.596 166.072'
                    ' 199.361C166.495 199.127 166.851 198.789 167.106 198.379L198.826 147.565C198.954 147.36 199.132 147.191'
                    ' 199.343 147.074C199.555 146.956 199.792 146.895 200.034 146.895C200.276 146.895 200.514 146.956 200.725'
                    ' 147.074C200.936 147.191 201.114 147.36 201.242 147.565L222.943 182.326C223.079 182.542 223.154 182.791'
                    ' 223.162 183.046C223.169 183.301 223.108 183.553 222.985 183.776C222.861 184 222.68 184.186 222.461'
                    ' 184.315C222.241 184.445 221.991 184.513 221.736 184.512H208.711C208.457 184.511 208.209 184.442 207.991'
                    ' 184.313C207.773 184.183 207.593 183.997 207.471 183.775C207.348 183.553 207.287 183.301 207.294'
                    ' 183.048C207.301 182.794 207.376 182.546 207.51 182.331L208.519 180.711C208.66 180.484 208.735 180.222'
                    ' 208.735 179.955C208.735 179.688 208.66 179.426 208.519 179.2L201.242 167.544C201.115 167.339 200.937'
                    ' 167.169 200.726 167.051C200.515 166.933 200.277 166.871 200.035 166.871C199.794 166.87 199.556 166.932'
                    ' 199.344 167.048C199.133 167.165 198.955 167.334 198.826 167.539Z"'
                    ' fill="#34C46E"/>'
                '<text text-anchor="middle" fill="#34C46E">'
                    '<textPath font-family="Montserrat" xlink:href="#top" startOffset="50%" font-size="24" font-weight="700">'
                        'Arkreen Climate Action Badge'
                    '</textPath>'
                '</text>'
                '<text text-anchor="middle" fill="#34C46E">'
                    '<textPath font-family="Montserrat" xlink:href="#address" startOffset="50%" font-size="16" font-weight="500">',
                        beneficiary,
                    '</textPath>'
                '</text>'
                '<g transform="translate(0,227)">'
                    '<text font-family="Montserrat" font-size="26px" font-weight="700" fill="white" text-anchor="middle" dominant-baseline="middle">'
                        '<textPath xlink:href="#center" startOffset="50%">',
                            energyInBadge,
                            ' ART'
                        '</textPath>'
                    '</text>'
                '</g>'
                '<g transform="translate(0,253)">'
                    '<rect width="400" height="40"/>'
                    '<text font-family="Montserrat" font-size="12px" font-weight="400" fill="#7F7F8D" text-anchor="middle" dominant-baseline="middle">'
                        '<textPath xlink:href="#center" startOffset="50%">'
                            'Offset'
                        '</textPath>'
                    '</text>'
                '</g>'
            '</svg>'
        );

        return  string(Base64.encode(imgBytes));
    }
}