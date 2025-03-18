// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

// For testing of contract upgrading 
contract TestGas
{
    struct Info {
        address   owner;
        uint16    dataA;
        uint32    dataB;
        uint48    dataC;
    }  

    mapping (uint256 => Info) public testInfo; 
    mapping (uint256 => uint256) public testInt; 

    function setInfo(address owner, uint16 dataA, uint32 dataB, uint48 dataC) external {    //gas: 24486 
      testInfo[1].owner = owner;
      testInfo[1].dataA = dataA;
      testInfo[1].dataB = dataB;
      testInfo[1].dataC = dataC;
    }

    function setInfoX(address owner, uint16 dataA, uint32 dataB, uint48 dataC) external {   //gas: 26265
      Info storage info = testInfo[1];
      info.owner = owner;
      info.dataA = dataA;
      info.dataB = dataB;
      info.dataC = dataC;
      testInfo[1] = info;
    }


    function getInfo() external view returns (address, uint16, uint32, uint48) {          // 3754
      return (testInfo[1].owner, testInfo[1].dataA, testInfo[1].dataB, testInfo[1].dataC);
    }

    function setInt(address owner, uint16 dataA, uint32 dataB, uint48 dataC) external {   // gas: 23819/3941(same)/6741(Unsame)
      testInt[1] = (uint256(uint160(owner)) << 96) + (uint256(dataA) << 80) + (uint256(dataB) << 48) + uint256(dataC);
    }

    function getInt() external view returns (address, uint16, uint32, uint48) {           // 2974
      uint256 testi = testInt[1];
      return ( address(uint160(testi>>96)),
                uint16(testi>>80), 
                uint32(testi>>48), 
                uint48(testi));
    }
}
