// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "./interfaces/IFeSwapFactory.sol";
import "./interfaces/IFeSwapERC20.sol";
import "./FeSwapPair.sol";
import "./patch/FactoryPatchCaller.sol";

contract FeSwapFactory is IFeSwapFactory, FactoryPatchCaller {
    uint16 public constant RATE_TRIGGER_FACTORY         = 10;       //  price difference be 1%
    uint16 public constant RATE_CAP_TRIGGER_ARBITRAGE   = 50;       //  price difference < 5%
    uint16 public constant RATE_PROFIT_SHARE            = 11;       //  FeSwap and Pair owner share 1/12 of the swap profit, 11 means 1/12

    address public immutable override nftFeSwap;                    

    address public override factoryAdmin;                           // Storage Slot 0
    address public override routerFeSwap;                           // Storage Slot 1
    address public override feeTo;                                  // Storage Slot 2
    uint16 public override rateProfitShare;                         // Storage Slot 2;  1/X => rateProfitShare = (X-1)
    uint16 public override rateTriggerFactory;                      // Storage Slot 2    
    uint16 public override rateCapArbitrage;                        // Storage Slot 2

    address[] public override allPairs;                             // Storage Slot 3
    mapping(address => address) public twinPairs;                   // Storage Slot 4

    address private tokenInCreating;                                // Storage Slot 5
    address private tokenOutCreating;                               // Storage Slot 6

    event PairCreated(address indexed tokenA, address indexed tokenB, address pairAAB, address pairABB, uint allPairsLength);

    constructor(address _factoryAdmin, address _routerFeSwap, address _nftFeSwap) {       // factoryAdmin will be set to TimeLock after FeSwap works normally
        factoryAdmin        = _factoryAdmin;
        routerFeSwap        = _routerFeSwap;
        nftFeSwap           = _nftFeSwap;
        rateTriggerFactory  = RATE_TRIGGER_FACTORY;
        rateCapArbitrage    = RATE_CAP_TRIGGER_ARBITRAGE;
        rateProfitShare     = RATE_PROFIT_SHARE;
     }

    function allPairsLength() external view override returns (uint) {
        return allPairs.length;
    }
    
    function getPair(address tokenIn, address tokenOut) public view override  returns (address, address) {
        bool inverseOrder = tokenIn > tokenOut;
        if(inverseOrder) (tokenIn, tokenOut) = (tokenOut, tokenIn);

        address pairA = address(uint160(uint256(keccak256(abi.encodePacked( hex'ff', address(this),
                keccak256(abi.encodePacked(tokenIn, tokenOut)),
                hex'61ba50a567aed79f740c2a36f5fb032b17a57707506d4890ccec01a00a16129a' // init code hash // save gas
            )))));

        address pairB = twinPairs[pairA];
        if(pairB == address(0)) return (pairB, pairB);
        if(inverseOrder) return (pairB, pairA);
        return (pairA, pairB);
    }

    function getFeeInfo() external view override returns (address _feeTo, uint256 _rateProfitShare) {
        return (feeTo, rateProfitShare);
    }

    function createUpdatePair(address tokenA, address tokenB, address pairOwner, uint256 rateTrigger, uint256 switchOracle) 
                                external override returns (address pairAAB, address pairABB ) {
        require(tokenA != tokenB, 'FeSwap: IDENTICAL_ADDRESSES');
        // pairOwner allowed to zero to discard the profit
        require(tokenA != address(0) && tokenB != address(0), 'FeSwap: ZERO_ADDRESS');
        require((msg.sender == nftFeSwap) || (msg.sender == factoryAdmin), 'FeSwap: FORBIDDEN');
        uint16 _rateTriggerFactory = rateTriggerFactory;            // to save gas fee
        require(rateTrigger <= rateCapArbitrage, 'FeSwap: GAP TOO MORE');

        if(tokenA > tokenB) (tokenA, tokenB) = (tokenB, tokenA);

        (pairAAB, pairABB) = getPair(tokenA, tokenB);
        if(pairAAB != address(0)) {
            address _routerFeSwap = address(0);
            if((msg.sender == factoryAdmin) && (pairOwner == address(type(uint160).max))) {
                // Remove approval to disable token pair functionality
                _routerFeSwap = routerFeSwap;   
            }
            
            if(rateTrigger != 0) rateTrigger = rateTrigger*6 + _rateTriggerFactory*4 + 10000;     // base is 10000
            IFeSwapPair(pairAAB).initialize(pairOwner, _routerFeSwap, rateTrigger, switchOracle);
            IFeSwapPair(pairABB).initialize(pairOwner, _routerFeSwap, rateTrigger, switchOracle);
        } else {
            require(pairOwner != address(type(uint160).max), 'FeSwap: ZERO_ADDRESS');
            bytes memory bytecode = type(FeSwapPair).creationCode;

            tokenInCreating = tokenA;   
            tokenOutCreating = tokenB;     
            bytes32 saltAAB = keccak256(abi.encodePacked(tokenA, tokenB));
            assembly {
                pairAAB := create2(0, add(bytecode, 32), mload(bytecode), saltAAB)
            }

            tokenInCreating = tokenB;
            tokenOutCreating = tokenA;     
            bytes32 saltABB = keccak256(abi.encodePacked(tokenB, tokenA));
            assembly {
                pairABB := create2(0, add(bytecode, 32), mload(bytecode), saltABB)
            }

            if(rateTrigger == 0) rateTrigger = _rateTriggerFactory;
            rateTrigger = rateTrigger*6 + _rateTriggerFactory*4 + 10000;

            address _routerFeSwap = routerFeSwap;
            IFeSwapPair(pairAAB).initialize(pairOwner, _routerFeSwap, rateTrigger, switchOracle);
            IFeSwapPair(pairABB).initialize(pairOwner, _routerFeSwap, rateTrigger, switchOracle);
            twinPairs[pairAAB] = pairABB;
            allPairs.push(pairAAB);

            emit PairCreated(tokenA, tokenB, pairAAB, pairABB, allPairs.length);

        }
    }

    // Used by FeSwapPair from its constructor
    function getPairTokens() external view override returns (address pairIn, address pairOut) {
        return (tokenInCreating, tokenOutCreating);
    }

    function setFeeTo(address _feeTo) external override {
        require(msg.sender == factoryAdmin, 'FeSwap: FORBIDDEN');
        feeTo = _feeTo;
    }

    function setFactoryAdmin(address _factoryAdmin) external override {
        require(msg.sender == factoryAdmin, 'FeSwap: FORBIDDEN');
        factoryAdmin = _factoryAdmin;
    }

    function setRouterFeSwap(address _routerFeSwap) external override {
        require(msg.sender == factoryAdmin, 'FeSwap: FORBIDDEN');
        routerFeSwap = _routerFeSwap;                                         // for Router Initiation
    }    

    function configFactory(uint16 newTriggerRate, uint16 newRateCap, uint16 newProfitShareRate) external override {
        require(msg.sender == factoryAdmin, 'FeSwap: FORBIDDEN');
        rateTriggerFactory  = newTriggerRate;
        rateCapArbitrage    = newRateCap;
        rateProfitShare     = newProfitShareRate;                            // 1/X => rateProfitShare = (X-1)
    } 
}