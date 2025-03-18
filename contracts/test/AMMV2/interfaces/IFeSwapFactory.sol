// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

interface IFeSwapFactory {
//  event PairCreated(address indexed tokenA, address indexed tokenB, address pairAAB, address pairABB, uint allPairsLength);

    function feeTo() external view returns (address);
    function getFeeInfo() external view returns (address, uint256);
    function factoryAdmin() external view returns (address);
    function routerFeSwap() external view returns (address);  
    function nftFeSwap() external view returns (address);  
    function rateTriggerFactory() external view returns (uint16);  
    function rateCapArbitrage() external view returns (uint16);     
    function rateProfitShare() external view returns (uint16); 

    function getPair(address tokenA, address tokenB) external view returns (address pairAB, address pairBA);
    function allPairs(uint) external view returns (address);
    function allPairsLength() external view returns (uint);

    function createUpdatePair(address tokenA, address tokenB, address pairOwner, uint256 rateTrigger, uint256 switchOracle) 
                                external returns (address pairAAB,address pairABB);

    function setFeeTo(address) external;
    function setFactoryAdmin(address) external;
    function setRouterFeSwap(address) external;
    function configFactory(uint16, uint16, uint16) external;
    function getPairTokens() external view returns (address pairIn, address pairOut);
}