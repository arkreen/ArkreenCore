// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

interface IStakingRewards {
    function getUserStakeStatus(address owner) external view returns 
                ( uint256 userMiners, 
                  uint256 userStakes, 
                  uint256 userNormalStakes, 
                  uint256 userBoostStakes, 
                  uint256 userRewards,
                  uint256 blockTime
                );

}