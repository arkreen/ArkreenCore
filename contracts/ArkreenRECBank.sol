// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

import "./libraries/TransferHelper.sol";
import "./interfaces/IERC20.sol";
import "./interfaces/IERC20Permit.sol";
import "./interfaces/IWETH.sol";

struct IncomeInfo {
    uint128     priceForSale;           // 1 ART -> X Payment token
    uint128     amountReceived;         // Amount of payment token received
}

struct SaleInfo {
    address     controller;             // Address of the ART token controller
    address     fundReceiver;           // Address of the receiver while withdrawing the sale income  
    uint128     amountDeposited;        // The amount of ART deposited to this bank contract
    uint128     amountSold;             // The amount of ART already sold out
}

struct Signature {
    address     token;
    uint256     value;
    uint256     deadline;  
    uint8       v;
    bytes32     r;
    bytes32     s;              
}

contract ArkreenRECBank is
    OwnableUpgradeable,
    UUPSUpgradeable
{
    // Public variables
    address public tokenNative;                                             // The wrapped token of the Native token, such as WETH, WMATIC
    mapping(address => bool) public forwarders;                             // All forwarders acceptable
    mapping(address => mapping(address => IncomeInfo)) public saleIncome;   // Mapping X-ART -> Payment Token -> SaleInfo, price zero means not-supported
    mapping(address => SaleInfo) public artSaleInfo;                        // All ART deposit and sale info. If deposit is zero, it means not-supported

    // Events
    event ARTSold(address indexed artToken, address indexed payToken, uint256 artAmount, uint256 payAmount);
    event ARTPriceChanged(address indexed artToken, address indexed payToken, uint256 newPrice);   
    event Deposit(address indexed artToken, uint256 amountDeposit);    
    event RemoveART(address indexed artToken, uint256 amountRemove);    
    event Withdraw(address indexed artToken, address indexed payToken, uint256 balance);   

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(address native) external virtual initializer {
        __Ownable_init_unchained();
        __UUPSUpgradeable_init(); 
        tokenNative = native;       
    }

    function postUpdate() external onlyProxy onlyOwner 
    {}

    function _authorizeUpgrade(address newImplementation) internal virtual override onlyOwner
    {}    

    receive() external payable {
        assert(msg.sender == tokenNative); // only accept WMATIC via fallback from the WMATIC contract
    }

    function buyART(
        address             tokenPay,
        address             tokenART,
        uint256             amountPay,
        uint256             amountART,
        bool                isExactPay
    ) external returns (uint256) {
        return _buyART (msg.sender, _msgSender(), tokenPay, tokenART, amountPay, amountART, isExactPay);
    }

    /** 
     * @dev Buy the ART token, then offset the bought ART and mint a cliamte badge.
     * @param tokenART The address of the ART token. There may be serveral different ART tokens in AREC ecosystem.
     * @param amountART The amount of the ART token.
     *                  if isExactPay is true, amountART means the minumum ART token to receive, which may be zero for no checking.
     *                  if isExactPay is false, amountART is the amount of ART token to receive.
     * @param isExactPay Which amount is the exact amount
     *                  = true,  msg.value is the exact amount of the payment token to pay.
     *                  = false, amountART is the exact amount of the ART token to receive.
     */
    function buyARTNative(
        address             tokenART,
        uint256             amountART,
        bool                isExactPay
    ) external payable returns (uint256) {

        uint256 priceSale = saleIncome[tokenART][tokenNative].priceForSale;
        require (priceSale !=0, "ARBK: Payment token not allowed");
        
        uint256 amountPay =  msg.value;
        address receiver = _msgSender();
        if(isExactPay) {
            uint256 amountARTReal = amountPay * (10**9) / priceSale;                    // ART decimal is always 9, so hardcoded here
            require (amountARTReal >= amountART, "ARBK: Get Less");

            saleIncome[tokenART][tokenNative].amountReceived += uint128(amountPay);     // Native Token already received

            TransferHelper.safeTransfer(tokenART, receiver, amountARTReal);
            artSaleInfo[tokenART].amountSold += uint128(amountARTReal);

            emit ARTSold(tokenART, tokenNative, amountARTReal, amountPay);
            return amountARTReal;
        } else {
            uint256 amountPayReal = (amountART * priceSale + (10**9) -1) / (10**9);       // ART decimal is always 9, so hardcoded here
            require (amountPay >= amountPayReal, "ARBK: Pay Less");                       // amountPay plays as the maximum to pay

            saleIncome[tokenART][tokenNative].amountReceived += uint128(amountPayReal);

            TransferHelper.safeTransfer(tokenART, receiver, amountART);
            artSaleInfo[tokenART].amountSold += uint128(amountART);

            if(amountPay > amountPayReal) TransferHelper.safeTransferETH(msg.sender, amountPay - amountPayReal);

            emit ARTSold(tokenART, tokenNative, amountART, amountPayReal);
            return amountART;
        }
    }

    function buyARTWithPermit(
        address             tokenART,
        uint256             amountART,
        bool                isExactPay,
        Signature calldata  permitToPay
    ) external returns (uint256) {                       // Deadline will be checked by router, no need to check here.
        // Permit payment token
        address payer = _msgSender();
        IERC20Permit(permitToPay.token).permit(payer, address(this), 
                        permitToPay.value, permitToPay.deadline, permitToPay.v, permitToPay.r, permitToPay.s);

        // Transfer payement 
        return _buyART(payer, payer, permitToPay.token, tokenART, permitToPay.value, amountART, isExactPay);
    }

    function _buyART(
        address             payer,
        address             receiver,
        address             tokenPay,
        address             tokenART,
        uint256             amountPay,
        uint256             amountART,
        bool                isExactPay
    ) internal returns (uint256) {

        // priceSale: 1 ART = priceSale (Payment Tokens), for example:
        // 1 ART = 5 USDC, priceSale = 5 000 000
        // 1 ART = 8 MATIC, priceSale = 8 * (10**18), as decial of MATIC is 18 
        uint256 priceSale = saleIncome[tokenART][tokenPay].priceForSale;
        require (priceSale != 0, "ARBK: Payment token not allowed");
        
        if(isExactPay) {
            uint256 amountARTReal = amountPay * (10**9) / priceSale;          // ART decimal is always 9, so hardcoded here
            require (amountARTReal >= amountART, "ARBK: Get Less");           // amountART is the minimum ART desired to receive

            TransferHelper.safeTransferFrom(tokenPay, payer, address(this), amountPay);
            saleIncome[tokenART][tokenPay].amountReceived += uint128(amountPay);    // Assmume never overflow, as it is big as (3.4 *10**20)

            TransferHelper.safeTransfer(tokenART, receiver, amountARTReal);
            artSaleInfo[tokenART].amountSold += uint128(amountARTReal);

            emit ARTSold(tokenART, tokenPay, amountARTReal, amountPay);
            return amountARTReal;
        } else {
            // The minimum payment is 1 (Payment Token) to avoid attack buying very small amount of ART tokens
            uint256 amountPayReal = (amountART * priceSale + (10**9) -1 ) / (10**9);    // ART decimal is always 9, so hardcoded here 

            require (amountPayReal <= amountPay, "ARBK: Pay Less");                     // amountPay is the maximum payment 

            TransferHelper.safeTransferFrom(tokenPay, payer, address(this), amountPayReal);
            saleIncome[tokenART][tokenPay].amountReceived += uint128(amountPayReal);    // Assmume never overflow

            TransferHelper.safeTransfer(tokenART, receiver, amountART);
            artSaleInfo[tokenART].amountSold += uint128(amountART);

            emit ARTSold(tokenART, tokenPay, amountART, amountPayReal);
            return amountART;
        }
    }

    /**
     * @dev Change the ART sale price based on the buyInToken. Price-zero means not-supporting
     * @param artToken Address of the ART token to sell. The bank contract support multiple ART tokens.
     * @param buyInToken Address of the payment token used to buy ART. 
     * @param price Price of the ART token priced in payment token, 1 ART = X payment token.  
    */
    function changeSalePrice(address artToken, address buyInToken, uint256 price ) external {
        require (msg.sender == artSaleInfo[artToken].controller, "ARBK: Not allowed");
        saleIncome[artToken][buyInToken].priceForSale = uint128(price);
        emit ARTPriceChanged(artToken, buyInToken, price);    
    }  

    /**
     * @dev Add new type of ART token and the controller, only can be called by the owner
     * @param artToken Token address of the ART to add
     * @param controller Address of the controller of the ART token
     */
    function addNewART(address artToken, address controller) external onlyOwner {
        require (controller != address(0), "ARBK: Zero Address");
        require (artSaleInfo[artToken].controller == address(0), "ARBK: Already Added");
        artSaleInfo[artToken].controller = controller;
    }  

    /**
     * @dev Change/shift the controller of the ART token
     * @param artToken Address of the ART token to change controller
     * @param newController Address of the new controller
     */
    function changeARTOwner(address artToken, address newController) external {
        address caller = msg.sender;
        require( caller ==  owner() || caller == artSaleInfo[artToken].controller, "ARBK: Not allowed");
        require (newController != address(0), "ARBK: Zero Address");

        artSaleInfo[artToken].controller = newController;
    }  

    /**
     * @dev Deposit various ART token to the bank, only callable by the controller.
     * @param artToken Token address of the ART to deposit. 
     * @param amountDeposit Amount of the ART to deposit.
     */
    function depositART(address artToken, uint256 amountDeposit) external {
        require (msg.sender == artSaleInfo[artToken].controller, "ARBK: Not allowed");

        uint256 amount = artSaleInfo[artToken].amountDeposited;
        require ((amount = (amount + amountDeposit)) < type(uint128).max, "ARBK: Deposit overflowed" );

        TransferHelper.safeTransferFrom(artToken, msg.sender, address(this), amountDeposit);
        artSaleInfo[artToken].amountDeposited = uint128(amount);
        emit Deposit(artToken, amountDeposit);
    }  

    /**
     * @dev Remove deposited ART token from the bank, only callable by the controller.
     * @param artToken Token address of the ART to remove. 
     * @param amountRemove Amount of the ART to remove.
     */
    function removeART(address artToken, uint256 amountRemove) external {
        require (msg.sender == artSaleInfo[artToken].controller, "ARBK: Not allowed");
        uint128 amount = artSaleInfo[artToken].amountDeposited - uint128(amountRemove);
        TransferHelper.safeTransfer(artToken, msg.sender, amountRemove);
        artSaleInfo[artToken].amountDeposited = uint128(amount);
        emit RemoveART(artToken, amountRemove);
    }  

    /**
     * @dev Withdraw all the sales income
     * @param artToken Address of the ART token to withdraw
     * @param payToken Address of the payment token to withdraw
     */
    function withdraw(address artToken, address payToken) external {
        require ((msg.sender == owner()) || (msg.sender == artSaleInfo[artToken].controller), "ARBK: Not allowed");

        address receiver = artSaleInfo[artToken].fundReceiver;
        if (receiver == address(0)) receiver = msg.sender;

        uint256 amountReceived = saleIncome[artToken][payToken].amountReceived;
        saleIncome[artToken][payToken].amountReceived = 0;

        uint256 balance = IERC20(payToken).balanceOf(address(this));
        if (amountReceived > balance) amountReceived = balance;
        TransferHelper.safeTransfer(payToken, receiver, amountReceived);

        emit Withdraw(artToken, payToken, amountReceived);    
    }

    /**
     * @dev Set the income receiver address
     * @param artToken Address of the ART token to set receiver
     * @param receiver Address of the receiver
     */
    function setFundReceiver(address artToken, address receiver) external {
        require (msg.sender == artSaleInfo[artToken].controller, "ARBK: Not allowed");
        artSaleInfo[artToken].fundReceiver = receiver;
    } 

    function _msgSender() internal override view returns (address sender) {
        sender = msg.sender;
        if (msg.data.length >= 20 && forwarders[sender]) {
            assembly {
                sender := shr(96,calldataload(sub(calldatasize(),20)))
            }
        }    
    }

    function setForwarder(address forwarder, bool active) external onlyOwner {
        forwarders[forwarder] = active;
    }

}