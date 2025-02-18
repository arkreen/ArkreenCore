import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { ethers, upgrades } from "hardhat";
import { CONTRACTS } from "../constants";
import { BigNumber } from "ethers";

const func: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {

  const { deployments, getNamedAccounts } = hre;
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();

  const defaultGasPrice = (hre.network.name === 'matic_test') ? BigNumber.from(30_000_000_000) : BigNumber.from(32_000_000_000)
  
  console.log("Deploying ArkreenMinerPro: ", deployer);  
  
  const ArkreenMinerPro = await deploy("ArkreenMinerPro", {
      from: deployer,
      args: [],
      log: true,
      skipIfAlreadyDeployed: false,
      gasPrice: defaultGasPrice
  });

  console.log("ArkreenMinerPro deployed to %s: ", hre.network.name, ArkreenMinerPro.address);

};

// 2024/05/21: yarn deploy:matic_test:AMinerProD 
// Deployed on Polygon Amoy testnet to upgrade to support for staking
// 0xCf427e3E8B3717DE2d0d08Cc09F1A3c5853Dd90C

// 2024/05/28: yarn deploy:matic:AMinerProD 
// Deployed on Polygon main to upgrade to support for staking
// 0xB6701746312304F9f751bEe707fa0ca51Ec6724c

// 2024/10/21: yarn deploy:matic_test:AMinerProD 
// Deployed on Polygon Amoy testnet to upgrade to support for Miner Pro
// 0xB17Bf7c2ccDe7604C8885AFCe18fE9f8805FE0e6

// 2024/10/22: yarn deploy:matic:AMinerProD 
// Deployed on Polygon main to upgrade to support for Miner Pro
// 0x3CC572812faEDE06D1BEBf1F5CCECaA03BB2d65d

// 2024/11/28: yarn deploy:matic:AMinerProD 
// Deployed on Polygon main to upgrade to fix the bug in checkListener
// 0xc6f4ee41384c4B006a5224123860dFa4a4419922

// 2025/02/14: yarn deploy:matic:AMinerProD 
// Deployed on Polygon main to support withdrawing native token
// 0xe440fa4480ca4bFdbFF292bb0395246F4E2f36A9

export default func;
func.tags = ["AMinerProD"];
