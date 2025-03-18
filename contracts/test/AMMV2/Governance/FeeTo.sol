// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

// This contract gives owner the ability to allow tokens. For pairs in which both tokens are allowed, fees may be
// collected on that pair and send to feeRecipient, though only after burning all fees up to that point
contract FeeTo {
    address public owner;
    address public feeRecipient;

    struct TokenAllowState {
        bool    allowed;
        uint128 disallowCount;
    }
    mapping(address => TokenAllowState) public tokenAllowStates;

    struct PairAllowState {
        uint128 token0DisallowCount;
        uint128 token1DisallowCount;
    }
    mapping(address => PairAllowState) public pairAllowStates;

    constructor(address owner_) {
        owner = owner_;
    }

    function setOwner(address owner_) public {
        require(msg.sender == owner, 'FeeTo::setOwner: not allowed');
        owner = owner_;
    }

    function setFeeRecipient(address feeRecipient_) public {
        require(msg.sender == owner, 'FeeTo::setFeeRecipient: not allowed');
        feeRecipient = feeRecipient_;
    }

    function updateTokenAllowState(address token, bool allowed) public {
        require(msg.sender == owner, 'FeeTo::updateTokenAllowState: not allowed');
        TokenAllowState storage tokenAllowState = tokenAllowStates[token];
        // if allowed is not changing, the function is a no-op
        if (allowed != tokenAllowState.allowed) {
            tokenAllowState.allowed = allowed;
            // this condition will only be true on the first call to this function (regardless of the value of allowed)
            // by effectively initializing disallowCount to 1,
            // we force renounce to be called for all pairs including newly allowed token
            if (tokenAllowState.disallowCount == 0) {
                tokenAllowState.disallowCount = 1;
            } else if (allowed == false) {
                tokenAllowState.disallowCount += 1;
            }
        }
    }

    function updateTokenAllowStates(address[] memory tokens, bool allowed) public {
        for (uint i; i < tokens.length; i++) {
            updateTokenAllowState(tokens[i], allowed);
        }
    }

    function renounce(address pair) public returns (uint value) {
        PairAllowState storage pairAllowState = pairAllowStates[pair];
        TokenAllowState storage token0AllowState = tokenAllowStates[IFeswPair(pair).tokenIn()];
        TokenAllowState storage token1AllowState = tokenAllowStates[IFeswPair(pair).tokenOut()];

        // we must renounce if any of the following four conditions are true:
        // 1) tokenIn is currently disallowed
        // 2) tokenOut is currently disallowed
        // 3) tokenIn was disallowed at least once since the last time renounce was called
        // 4) tokenOut was disallowed at least once since the last time renounce was called
        if (
            token0AllowState.allowed == false ||
            token1AllowState.allowed == false ||
            token0AllowState.disallowCount > pairAllowState.token0DisallowCount ||
            token1AllowState.disallowCount > pairAllowState.token1DisallowCount
        ) {
            value = IFeswPair(pair).balanceOf(address(this));
            if (value > 0) {
                // burn balance into the pair, effectively redistributing underlying tokens pro-rata back to LPs
                // (assert because transfer cannot fail with value as balanceOf)
                assert(IFeswPair(pair).transfer(pair, value));
                IFeswPair(pair).burn(pair);
            }

            // if tokenIn is allowed, we can now update the pair's disallow count to match the token's
            if (token0AllowState.allowed) {
                pairAllowState.token0DisallowCount = token0AllowState.disallowCount;
            }
            // if tokenOut is allowed, we can now update the pair's disallow count to match the token's
            if (token1AllowState.allowed) {
                pairAllowState.token1DisallowCount = token1AllowState.disallowCount;
            }
        }
    }

    function claim(address pair) public returns (uint value) {
        PairAllowState storage pairAllowState = pairAllowStates[pair];
        TokenAllowState storage token0AllowState = tokenAllowStates[IFeswPair(pair).tokenIn()];
        TokenAllowState storage token1AllowState = tokenAllowStates[IFeswPair(pair).tokenOut()];

        // we may claim only if each of the following five conditions are true:
        // 1) tokenIn is currently allowed
        // 2) tokenOut is currently allowed
        // 3) renounce was not called since the last time tokenIn was disallowed
        // 4) renounce was not called since the last time tokenOut was disallowed
        // 5) feeHandler is not the 0 address
        if (
            token0AllowState.allowed &&
            token1AllowState.allowed &&
            token0AllowState.disallowCount == pairAllowState.token0DisallowCount &&
            token1AllowState.disallowCount == pairAllowState.token1DisallowCount &&
            feeRecipient != address(0)
        ) {
            value = IFeswPair(pair).balanceOf(address(this));
            if (value > 0) {
                // transfer tokens to the recipient (assert because transfer cannot fail with value as balanceOf)
                assert(IFeswPair(pair).transfer(feeRecipient, value));
            }
        }
    }
}

interface IFeswPair {
    function tokenIn() external view returns (address);
    function tokenOut() external view returns (address);
    function balanceOf(address owner) external view returns (uint);
    function transfer(address to, uint value) external returns (bool);
    function burn(address to) external returns (uint amount0, uint amount1);
}