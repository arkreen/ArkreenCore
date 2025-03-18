// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;


enum AssetStatus {
  Unused,               // 0
  Deposited,            // 1
  Withdrawed,           // 2
  Delivered,            // 3
  Onboarded,            // 4
  Completed,            // 5
  Clearing,             // 6
  ClearedInvester,      // 7
  ClearedFinal          // 8
}

enum InvestStatus {
  Unused,               // 0
  InvestNormal,         // 1
  InvestAborted,        // 2
  InvestCleared,        // 3
  InvestCompleted       // 4
}

struct AssetType {
    uint16    typeAsset;                  // asset type of specific device asset
    uint8     tenure;                     // asset funding effective duration in months
    uint16    investQuota;                // quota of the fixed-gain investment unit
    uint32    valuePerInvest;             // price per investing unit in USDC/USDT
    uint48    amountRepayMonthly;         // amount in USDC/USDT needed to repay monthly to this contract
    uint32    amountYieldPerInvest;       // amount of the yield in USDC/USDT paid to the investers per investing unit
    uint32    amountDeposit;              // amount of AKRE to deposit, in unit of 10**18, subject to change; subject to change. 
    uint8     investTokenType;            // token type accepted for the investing, should be stable coin; =1 USD, =2, EURO
    uint8     maxInvestOverdue;           // Max days after date the asset is onboared when the investing is still acceppted  
    uint8     minInvestExit;              // Minimum days before the investing can exit  
    uint8     interestId;                 // id of the interest rate
    uint16    paramsClearance;            // MSB: maximum days delaying repayment when clearance will be triggered (MSB), LSB: Clearenace fee
    uint16    timesSlashTop;              // MSB: Top of the times of consecutive slashing , LSB: Top of the times of slashing sum 
}

struct AssetTypeMiner {
    uint16    remoteQuota;                // number of the remote sub-assets linked to one asset
    uint16    numSoldAssets;              // Number of assess of this asset type that have been sold
}

struct GlobalStatus {
    uint16  numAssetType;               // Number of the asset type that have been defined
    uint32  numAssets;                  // Total number of assets that has been setup by depositing
    uint32  numCancelled;               // Total number of assets whose deposit that has been cancelled
    uint32  numDelivered;               // Total number of assets that has been delivered
    uint32  numOnboarded;               // Total number of assets that has been onboarded
    uint16  numTokenAdded;              // Total number of tokens that have been added to the allowed token list
    uint32  numInvest;                  // Total number of investing transactions
}

struct AssetDetails {
    address         assetOwner;                 // Address of user owning the asset
    AssetStatus     status;                     // Status of the asset
    uint16          tokenId;                    // Id of the token used to invest/repay for the asset
    uint16          typeAsset;                  // type number of the asset
    uint16          numInvestings;              // number of investing transactions 
    uint16          numQuotaTotal;              // total number of quota that have been invested
    uint32          amountDeposit;              // amount of AKRE that has been deposited by the owner, in unit of 10**18 
    uint32          deliverProofId;             // proof id delivering the asset
    uint32          onboardTimestamp;           // onboarding timestamp of the asset
    uint48          sumAmountRepaid;            // sum of the amount repaid to the contract
    uint48          amountForInvestWithdraw;    // amount available for invest withdraw  
    uint48          amountInvestWithdarwed;     // amount withdrawed by investing
}

struct RepayDetails {
    uint8           monthDueRepay;              // id of the month due to repay the installment
    uint32          timestampNextDue;           // the timestamp of to repay the next due monthly
    uint48          amountRepayDue;             // amount to repay on the due timestamp
    uint48          amountDebt;                 // amount of the debt of asset owner
    uint32          timestampDebt;              // timestamp of the debt starting         
    uint48          amountPrePay;               // the amount of Pre-Pay for next months
    uint48          amountRepayTaken;           // the amount of monthly repayment tha has been taken
    uint16          numInvestTaken;             // The number of quota of the invest that has been taken
}

struct ClearanceDetails {
    uint80          productToTriggerClearance;  // threshold of the product triggering clearance
    uint80          amountDebtOverdueProduct;   // sum of the product of debt and overdue duration
    uint96          amountAKREAvailable;        // amount of AKRE staked as collateral
    uint96          amountAKREForInvester;      // AKRE amount cleared for all investers.
    uint16          timesSlashTop;              // Top of the times of slashing (LSB) and top of the times of slashing consecutively (MSB)
    uint8           timesSlashed;               // Times of slash accumulated
    uint8           timesLineSlashed;           // Times of being slashed consecutively 
    uint32          timestampLastSlash;         // Timestamp of last slashing
    uint96          amountSlashed;              // AKRE amount being slashed totally
    int24           priceTickOnClearance;       // price tick on clearance. tick might be negtive, define as in UniV3
    uint32          timestampClearance;
}

struct Invest {
    address         invester;                 // Address of the invester
    //uint32        assetId;                  // id of the investing asset, to push in a slot
    uint32          timestamp;                // the timestamp investing
    InvestStatus    status;                   // invest Status
    uint16          numQuota;                 // number of quota invested
    uint8           monthTaken;               // the last month the yeild has been taken
}

struct InvestToken {
    uint8           tokenType;                    // type of the stabel coin, = 1, USD, =2 EURO
    address         tokenAddress;                 // Address of the token erc20
}

struct InterestRate {
    uint96          ratePerSecond;                // Interest rate per second, on the base of (10^27)
}

struct Sig {
    uint8       v;
    bytes32     r;
    bytes32     s;              
}

