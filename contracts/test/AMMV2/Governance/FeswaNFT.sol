// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Address.sol";

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";

import "./utils/TransferHelper.sol";
import "./patch/NFTPatchCaller.sol";

    interface IFeSwapFactory {
        function createUpdatePair(address tokenA, address tokenB, address pairOwner, uint256 rateTrigger, uint256 switchOracle) 
                                    external returns (address pairAAB,address pairABB);
    }

    enum PoolRunningPhase {
        BidToStart,
        BidPhase, 
        BidDelaying,
        BidSettled,
        PoolHolding, 
        PoolForSale
    }

    struct FeswaPair {
        address tokenA;
        address tokenB;
        uint128 currentPrice;
        uint48  timeCreated;
        uint48  lastBidTime; 
        PoolRunningPhase  poolState;
    }

/**
 * @title FeswaNFT contract
 * @dev Extends ERC721 Non-Fungible Token Standard basic implementation
 */

contract FeswaNFT is ERC721, ERC721Enumerable, ERC721URIStorage, Ownable, NFTPatchCaller { 
    //    using SafeMath for uint256;	// seems not necessary

    // Public variables
    string public constant NAME = 'FeSwap Pool NFT';
    string public constant SYMBOL = 'FESN';

    // Price offering duration: two weeks 
    uint256 public constant OPEN_BID_DURATION = (3600 * 24 * 3);

    uint256 public constant RECLAIM_DURATION  = (3600 * 24 * 4);    // NFT will be reclaimed if the token pair is not created in the duration 

    // Price offering waiting duration: 2 Hours
    uint256 public constant CLOSE_BID_DELAY = (3600 * 2);           

    // Airdrop for the first tender: 1000 FESW
    // uint256 public constant AIRDROP_FOR_FIRST    = 1000e18;             // BNB:      1000
    uint256 public constant AIRDROP_FOR_FIRST       = 3000e18;             // MATIC:    3000
    // uint256 public constant AIRDROP_FOR_FIRST    = 5000e18;             // Avalanche: 5000

    // BNB = 1; MATIC = 100; Arbitrum, Rinkeby = 0.25; Avalanche=5, HT = 20, Fantom = 80, Harmony = 500

    // Airdrop for the next tender: 10000 FESW/BNB
    uint256 public constant AIRDROP_RATE_FOR_NEXT_BIDDER = 10_000 / 100;      // 10_000 / 1, BNB = 1; MATIC = 100 ; Arbitrum: 40_000

    // Airdrop rate for Bid winner: 50000 FESW/BNB
    uint256 public constant AIRDROP_RATE_FOR_WINNER = 50_000 / 100;           // 50_000 / 1; Arbitrum: 200_000

    // Minimum price increase for tender: 0.02 BNB, 2 MATIC
    uint256 public constant MINIMUM_PRICE_INCREACE = 2e16 * 100;              //  2e16 * 1; Arbitrum: 5e15

    // Max price for NFT sale: 100,000 BNB/ 100M MATIC 
    uint256 public constant MAX_SALE_PRICE = 1000_000e18 * 100;               // 1000_000e18 * 1; Arbitrum: 250_000e18

    // Bidding airdrop cap : 2500 BNB
    // uint256 private constant BIDDING_AIRDROP_CAP = 2500e18;             // BNB:     2500 BNB
    uint256 private constant BIDDING_AIRDROP_CAP    = 2800e18 * 100;       // MATIC:   280,000 MATIC

    // contract of Feswap DAO Token
    address public immutable FeswapToken;

    // contract of Token Pair Factory
    address public immutable PairFactory;

    // Sale start timestamp
    uint256 public immutable SaleStartTime;                                   //2021/09/28 08:00

    uint128 public TotalBidValue;
    uint64  public AirdropDepletionTime;

    // Mapping from token ID to token pair infomation
    mapping (uint256 => FeswaPair) public ListPools;
 
    // Events
    event PairCreadted(address indexed tokenA, address indexed tokenB, uint256 tokenID);
  
    /**
     * @dev Initializes the contract by setting a `name` and a `symbol` to the token collection.
     */
    constructor (address feswaToken, address pairFactory, uint256 saleStartTime ) 
        ERC721(NAME, SYMBOL)
    {
        FeswapToken = feswaToken;
        PairFactory = pairFactory;
        SaleStartTime = saleStartTime;
    }

    /**
     * @dev Bid for the token-pair swap pool with higher price. 
     * Create the new NFT for the fisrt-time calling with initial price 
     */
    function BidFeswaPair(address tokenA, address tokenB, address to) external payable returns (uint256 tokenID) {
        require(block.timestamp > SaleStartTime, 'FESN: BID NOT STARTED');
        require(tokenA != address(0) && tokenB != address(0) && to != address(0) , 'FeSwap: ZERO_ADDRESS');
        require(tokenA != tokenB, 'FESN: IDENTICAL_ADDRESSES');
        require(Address.isContract(tokenA) && Address.isContract(tokenB), 'FESN: Must be token');
        require(!Address.isContract(msg.sender), 'FESN: Contract Not Allowed');
        if(to != msg.sender) require(!Address.isContract(to), 'FESN: Contract Not Allowed');

        (address token0, address token1) = (tokenA <= tokenB) ? (tokenA, tokenB) : (tokenB, tokenA);
        tokenID  = uint256(keccak256(abi.encodePacked(address(this), token0, token1)));

        uint256 airdropAmount = 0;

        if(_exists(tokenID )){
            bool isReclaimable = false;
            address preOwner = ownerOf(tokenID);
            FeswaPair storage pairInfo = ListPools[tokenID]; 

            if(pairInfo.poolState == PoolRunningPhase.BidPhase){
                if( block.timestamp > (pairInfo.timeCreated + OPEN_BID_DURATION + RECLAIM_DURATION)) {
                    isReclaimable = true;
                }
                else{
                    require(block.timestamp <= pairInfo.timeCreated + OPEN_BID_DURATION, 'FESN: BID TOO LATE 1');  // Bid keep open for 3 days
                    if(block.timestamp >= (pairInfo.timeCreated + OPEN_BID_DURATION - CLOSE_BID_DELAY)) {
                        pairInfo.poolState = PoolRunningPhase.BidDelaying;
                    }
                }
            } else {
                require(pairInfo.poolState == PoolRunningPhase.BidDelaying, 'FESN: BID COMPLETED');
                if( block.timestamp > (pairInfo.lastBidTime + CLOSE_BID_DELAY + RECLAIM_DURATION)) {
                    isReclaimable = true;
                }
                else{
                    require(block.timestamp <= pairInfo.lastBidTime + CLOSE_BID_DELAY, 'FESN: BID TOO LATE 2');
                }
            }

            if(!isReclaimable)
            {
                require(msg.value >= pairInfo.currentPrice * 102 / 100, 'FESN: PAY LESS 1');  // minimum 2% increase
                require(msg.value >= pairInfo.currentPrice + MINIMUM_PRICE_INCREACE, 'FESN: PAY LESS 2');  // minimum 0.02 BNB increase

                // calculate airdrop amount, may be zero if airdrop depleted
                airdropAmount = getAirDropAmount(msg.value - pairInfo.currentPrice);

                // repay amount
                uint256 repayAmount = pairInfo.currentPrice;
                
                // Change the token owner
                _transfer(preOwner, to, tokenID);
                
                // update pairInfo information
                pairInfo.lastBidTime = uint48(block.timestamp);
                pairInfo.currentPrice = uint128(msg.value);

                // Airdrop to the next coming tenders
                if(airdropAmount > 0) TransferHelper.safeTransfer(FeswapToken, to, airdropAmount);

                // Repay the previous owner             
                TransferHelper.safeTransferETH(preOwner, repayAmount);
                return tokenID;
            }

            // Prepare to reclaim the swap token-pair, half of the bidding price will be returned
            uint256 returnPrice = pairInfo.currentPrice / 2;

            // Change the token owner
            _transfer(preOwner, to, tokenID);
            
            // return back 50% of the previous price
            if( returnPrice > 0 ){
                if((AirdropDepletionTime==0) || (pairInfo.timeCreated <= AirdropDepletionTime))
                    TransferHelper.safeTransfer(FeswapToken, preOwner, returnPrice * AIRDROP_RATE_FOR_WINNER);

                // As preOwner cannot be contact, re-entry not possible here       
                TransferHelper.safeTransferETH(preOwner, returnPrice);
            }
        } else {
            // _mint will check 'to' not be Zero, and tokenID not repeated.
            _mint(to, tokenID);
            emit PairCreadted(token0, token1, tokenID);             // (token0, token1, tokenID)
            
            // Only creators of the first 50,000 token pairs will receive the airdrop
//          if (totalSupply() <= 50_000) airdropAmount = AIRDROP_FOR_FIRST;     // BNB
            if (totalSupply() <= 10_000) airdropAmount = AIRDROP_FOR_FIRST;     // MATIC
//          if (totalSupply() <= 4_000) airdropAmount = AIRDROP_FOR_FIRST;      // AVALANCHE
  
        }
            
        // Prepare swap token-pair infomation for initial creation or re-bidding
        FeswaPair memory newPairInfo;
        newPairInfo.tokenA = token0;
        newPairInfo.tokenB = token1;
        newPairInfo.currentPrice = uint128(msg.value);              
        newPairInfo.timeCreated = uint48(block.timestamp);
        newPairInfo.lastBidTime = uint48(block.timestamp);
        newPairInfo.poolState = PoolRunningPhase.BidPhase;
        ListPools[tokenID] = newPairInfo;

        if(msg.value > 0) airdropAmount += getAirDropAmount(msg.value);

        // Airdrop to the first tender, airdropAmount maybe 0 after 50K/10K token pair created
        if(airdropAmount > 0) TransferHelper.safeTransfer(FeswapToken, to, airdropAmount);
    }

    function getAirDropAmount(uint256 userBidValue) internal returns (uint256 airdropAmount) {
        airdropAmount = 0;
        if(AirdropDepletionTime == 0) {
            uint256 availableAirdrop = BIDDING_AIRDROP_CAP - TotalBidValue;
            uint256 airdropValue = userBidValue;
            if(availableAirdrop <= airdropValue) {
                airdropValue = availableAirdrop;
                AirdropDepletionTime = uint64(block.timestamp);
            }
            airdropAmount = airdropValue * AIRDROP_RATE_FOR_NEXT_BIDDER;
        }
        TotalBidValue += uint128(userBidValue);
        return airdropAmount;
    }

    /**
     * @dev Settle the bid for the swap pair. 
     */
    function ManageFeswaPair( uint256 tokenID, address pairProfitReceiver, uint256 rateTrigger, uint256 switchOracleOn ) 
                external returns (address pairAAB, address pairABB) 
    {
        require(msg.sender == ownerOf(tokenID), 'FESN: NOT TOKEN OWNER');       // ownerOf checked if tokenID existing

        FeswaPair storage pairInfo = ListPools[tokenID]; 
        if(pairInfo.poolState < PoolRunningPhase.BidSettled){
            if(pairInfo.poolState == PoolRunningPhase.BidPhase){
                require(block.timestamp > pairInfo.timeCreated + OPEN_BID_DURATION, 'FESN: BID ON GOING 1');  
            } else {
                assert(pairInfo.poolState == PoolRunningPhase.BidDelaying); 
                require(block.timestamp > pairInfo.lastBidTime + CLOSE_BID_DELAY, 'FESN: BID ON GOING 2');
            }

            // could prevent recursive calling
            pairInfo.poolState = PoolRunningPhase.BidSettled;

            // Airdrop to the NFT owner, may be over airdropped, the over part paid from FeSwap Fund
            if(pairInfo.currentPrice > 0) { 
                if((AirdropDepletionTime == 0) || (pairInfo.timeCreated <= AirdropDepletionTime))
                    TransferHelper.safeTransfer(FeswapToken, msg.sender, pairInfo.currentPrice * AIRDROP_RATE_FOR_WINNER);
            }    
        }

        (address tokenA, address tokenB) = (pairInfo.tokenA, pairInfo.tokenB);

        // Create or Update the Pair settings 
        (pairAAB, pairABB) = IFeSwapFactory(PairFactory).createUpdatePair(tokenA, tokenB, pairProfitReceiver, rateTrigger, switchOracleOn); 
    }


    /**
     * @dev Sell the Pair with the specified Price. 
     */
    function FeswaPairForSale(uint256 tokenID, uint256 pairPrice) external returns (uint256 newPrice) {
        require(msg.sender == ownerOf(tokenID), 'FESN: NOT TOKEN OWNER');       // ownerOf checked if tokenID existing
        
        FeswaPair storage pairInfo = ListPools[tokenID]; 
        require(pairInfo.poolState >= PoolRunningPhase.BidSettled, 'FESN: BID NOT SETTLED'); 

        if(pairPrice != 0){
            require(pairPrice <= MAX_SALE_PRICE, 'FESN: PRICE TOO HIGH'); 
            pairInfo.poolState = PoolRunningPhase.PoolForSale;
            pairInfo.currentPrice = uint128(pairPrice);
        } else {
            pairInfo.poolState = PoolRunningPhase.PoolHolding;
        }
        
        return pairPrice;
    }    

    /**
     * @dev Sell the Pair with the specified Price. 
     */
    function FeswaPairBuyIn(uint256 tokenID, uint256 newPrice, address to) external payable returns (uint256 getPrice) {
        require(_exists(tokenID), 'FESN: TOKEN NOT CREATED');
        FeswaPair storage pairInfo = ListPools[tokenID]; 
        require(pairInfo.poolState == PoolRunningPhase.PoolForSale, 'FESN: NOT FOR SALE');

        uint256  currentPrice = pairInfo.currentPrice;
        require(msg.value >= currentPrice, 'FESN: PAY LESS');  
        require(newPrice <= MAX_SALE_PRICE, 'FESN: PRICE TOO HIGH'); 

        // Change the token owner
        address preOwner = ownerOf(tokenID);

        // send NFT to msg.sender, not to `to` Address
        _transfer(preOwner, msg.sender, tokenID);

        if(newPrice != 0){
            pairInfo.currentPrice = uint128(newPrice);
        } else {
            pairInfo.poolState = PoolRunningPhase.PoolHolding;
        }

        // Modify the profit receiver 
        IFeSwapFactory(PairFactory).createUpdatePair(pairInfo.tokenA, pairInfo.tokenB, to, 0, 0);     

        // Send ETH to the owner                    
        TransferHelper.safeTransferETH(preOwner, currentPrice);
        if( msg.value > currentPrice) 
            TransferHelper.safeTransferETH(msg.sender, msg.value - currentPrice);

        return currentPrice;
    }    

    /**
     * @dev Return the token-pair information 
     */
    function getPoolInfoByTokens(address tokenA, address tokenB) external view returns (uint256 tokenID, address nftOwner, FeswaPair memory pairInfo) {
        (address token0, address token1) = (tokenA < tokenB) ? (tokenA, tokenB) : (tokenB, tokenA);
        tokenID = uint256(keccak256(abi.encodePacked(address(this), token0, token1)));
        (nftOwner, pairInfo) = getPoolInfo(tokenID);
    }

    /**
     * @dev Return the token pair addresses by TokenID 
     */
    function getPoolInfo(uint256 tokenID) public view returns (address nftOwner, FeswaPair memory pairInfo) {
        if(_exists(tokenID)){
            nftOwner = ownerOf(tokenID);
            pairInfo = ListPools[tokenID];
        }
    }

    /**
     * @dev Withdraw
     */
    function withdraw(address to, uint256 value) public onlyOwner{
        require(address(this).balance >= value, 'FESN: INSUFFICIENT BALANCE');
        TransferHelper.safeTransferETH(to, value);
    }

    function _beforeTokenTransfer(address from, address to, uint256 tokenId)
        internal
        override(ERC721, ERC721Enumerable)
    {
        super._beforeTokenTransfer(from, to, tokenId);
    }

    function _burn(uint256 tokenId) internal override(ERC721, ERC721URIStorage) {
        super._burn(tokenId);
    }

    function tokenURI(uint256 tokenId)
        public
        view
        override(ERC721, ERC721URIStorage)
        returns (string memory)
    {
        return super.tokenURI(tokenId);
    }

    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721, ERC721Enumerable)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }    

    /**
     * @dev @dev Set the prefix for the tokenURIs.
     */
//    function setTokenURIPrefix(string memory prefix) public onlyOwner {
//        _setBaseURI(prefix);
//    }

//    function setTokenURI(uint256 tokenID, string memory tokenURI) public {
//        require(msg.sender == ownerOf(tokenID), 'FESN: NOT TOKEN OWNER');       // ownerOf checked if tokenID existing
//        _setTokenURI(tokenID, tokenURI);
//    }
}
