import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { ethers, upgrades } from "hardhat";
import { CONTRACTS } from "../constants";
import { BigNumber } from "ethers";

const func: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
  // Check following address
  let AKREToken_ADDRESS
  let MANAGER_ADDRESS
  let REGISTER_ADDRESS

  const defaultGasPrice = (hre.network.name === 'matic_test') ? BigNumber.from(32_000_000_000) : BigNumber.from(80_000_000_000)

  if(hre.network.name === 'localhost') {
    AKREToken_ADDRESS = "0xa0cE9DC3d93F4c84aAACd8DA3f66Cd6dA9D5b1F8"
    MANAGER_ADDRESS   = "0x364a71eE7a1C9EB295a4F4850971a1861E9d3c7D"
    REGISTER_ADDRESS = "0x58aCE9F0f042bC3DDb1f3d929f32C7931FFdA215"    
  }  else if(hre.network.name === 'goerli')  {
    AKREToken_ADDRESS = "0xf2D4C9C2A9018F398b229D812871bf2B316D50E1"
    MANAGER_ADDRESS   = "0xc99b92e8d827aa21cd3ff8fb9576316d90120191"
    REGISTER_ADDRESS = "0x58aCE9F0f042bC3DDb1f3d929f32C7931FFdA215" 
  }    
  else if(hre.network.name === 'matic_test')  {
////// These address are game miner testing ////////////////
//    AKREToken_ADDRESS = "0xf2D4C9C2A9018F398b229D812871bf2B316D50E1"
//    MANAGER_ADDRESS   = "0xc99b92e8d827aa21cd3ff8fb9576316d90120191"
//    REGISTER_ADDRESS = "0x58aCE9F0f042bC3DDb1f3d929f32C7931FFdA215"
//////////////////////////////////////////////////////////////

////// These address are for simulation test ////////////////
//    AKREToken_ADDRESS = "0x54e1c534f59343c56549c76d1bdccc8717129832"
//    MANAGER_ADDRESS   = "0x364a71ee7a1c9eb295a4f4850971a1861e9d3c7d"
//    REGISTER_ADDRESS  = "0x364a71ee7a1c9eb295a4f4850971a1861e9d3c7d"
//////////////////////////////////////////////////////////////

////// These address are remote miner testing ////////////////
    AKREToken_ADDRESS = "0x6c28fF02d3A132FE52D022db1f25a33d91caeCA2"
    MANAGER_ADDRESS   = "0xc99b92e8d827aa21cd3ff8fb9576316d90120191"
    REGISTER_ADDRESS  = "0x58aCE9F0f042bC3DDb1f3d929f32C7931FFdA215"
//////////////////////////////////////////////////////////////

  } else if(hre.network.name === 'matic')  {
      AKREToken_ADDRESS = "0x960c67b8526e6328b30ed2c2faea0355beb62a83"
      MANAGER_ADDRESS   = "0x12ba3311431C0f29Ae8B1a57401342373C807D9B"
      REGISTER_ADDRESS  = "0x12ba3311431C0f29Ae8B1a57401342373C807D9B" 
  }    

  console.log("Deploying ArkreenMiner...");  

  const { deployments, getNamedAccounts } = hre;
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();

  /*
  const ArkreenMiner = await deploy(CONTRACTS.AMiner, {
      from: deployer,
      proxy: {
        proxyContract: "UUPSProxy",
        execute: {
          init: {
            methodName: "initialize",   // Function to call when deployed first time.
            args: [AKREToken_ADDRESS, MANAGER_ADDRESS, REGISTER_ADDRESS]
          },
          onUpgrade: {
            methodName: "postUpdate", // method to be executed when the proxy is upgraded (not first deployment)
            args: [AKREToken_ADDRESS, MANAGER_ADDRESS],
          },           
        },
      },
      log: true,
      skipIfAlreadyDeployed: false,     // do not change
  });
*/


  console.log("Deploying: ", CONTRACTS.AMiner, deployer);  

  /* // Verification is difficult in this deployment mode 
  const ArkreenMinerV10Factory = await ethers.getContractFactory("ArkreenMinerV10");
  const ArkreenMinerV10 = await ArkreenMinerV10Factory.deploy();
  await ArkreenMinerV10.deployed();
  */

  const ArkreenMiner = await deploy(CONTRACTS.AMiner, {
      from: deployer,
      args: [],
      log: true,
      skipIfAlreadyDeployed: true,
      gasPrice: defaultGasPrice
  });

  console.log("ArkreenMiner deployed to %s: ", hre.network.name, ArkreenMiner.address);

};

// 2023/04/20: yarn deploy:matic:AMinerV10 
// Add two new ABIs: RemoteMinerOnboardNative and RemoteMinerOnboardApproved 
// 0x2DEe917Da0AF2ed006FEf069Ebf2B558E27c26B5

// 2023/04/25: yarn deploy:matic:AMinerV10D 
// Add native token checking in RemoteMinerOnboardNative 
//  

// 2023/08/29: yarn deploy:matic_test:AMinerV10D 
// Upgrade to support: a) Socket Miner; 2) Batch sale for remote miner;
// 0xF6c90184eB83a78F184f7bC883721F23519Da067

// 2023/08/30: yarn deploy:matic_test:AMinerV10D 
// Upgrade to sign total value instead price for batch sales
// 0xFE3423Fb2ef2f1403Cd64a78124ddC1329B6BF00

// 2023/09/05: yarn deploy:matic_test:AMinerV10D 
// Upgrade to emit back all miner addresses in batch sales
// 0x8aFFe644eD9ae6D9DEC5672cDd927dd8eF29d9EF

// 2023/09/12: yarn deploy:matic:AMinerV10D 
// Upgrade to emit back all miner addresses in batch sales
// 0x604e10b67736773BD5517fF628e350F443Db85F0

// 2024/01/12: yarn deploy:matic_test:AMinerV10D 
// Upgrade to add RemoteMinerOnboardBatchClaim and UpdateMinerWhiteListBatchClaim
// 0x6661cC0df27111c67CAB8c52B1e21fAbd0354143

// 2024/01/12A: yarn deploy:matic_test:AMinerV10D 
// Upgrade to add RemoteMinerOnboardBatchClaim and UpdateMinerWhiteListBatchClaim, make public 
// 0xcCfC2109F4997F2c7Da39f1De51620d357EBE471

// 2024/01/14: yarn deploy:matic_test:AMinerV10D 
// Upgrade to add pretection in RemoteMinerOnboardBatchClaim againt replaying signature
// 0x7D4718A6430334556c27503A04B3CAf072BA4e29

// 2024/02/01: yarn deploy:matic_test:AMinerV10D 
// Upgrade to support PlantMiner, and block transferring
// 0x516846704C4e163bF37d97A6870e4b88d5598e46

// 2024/02/01A: yarn deploy:matic:AMinerV10D 
// Upgrade to support PlantMiner, and block transferring
// 0x5C3C5f4a3694B89F48D25964070aB68EF82884d4

// 2024/02/02A: yarn deploy:matic_test:AMinerV10D 
// Update to correct overlapped paramters: Dev Env
// 0x8844E2EE618C66383627016EDde27F5A4095B7d2

// 2024/02/02B: yarn deploy:matic_test:AMinerV10D 
// Update to correct overlapped paramters: Pre-Product
// 0x926B113e8fb52EfCeDe65981Fa9ef2731Ab66324

// 2024/04/12: yarn deploy:matic:AMinerV10D 
// Update to correct according audit result and prepare for upgrading on mainnet
// 0x4bfE8d12b01756A04AB9762D28ebCF4210E9A59B

// 2024/04/20: yarn deploy:matic_test:AMinerV10D 
// Deployed on Polygon Amoy testnet for verification
// 0x8a3e5FAC921E0B101778b29993eeF47b219C9e55

// 2024/05/11: yarn deploy:matic_test:AMinerV10D 
// Deployed on Polygon Amoy testnet to add Remove white list
// 0x0463729b34a867b3fd155943e0aae9790cb7bfef

// 2024/05/21: yarn deploy:matic_test:AMinerV10D 
// Deployed on Polygon Amoy testnet to upgrade to support for staking
// 0x3b4BAf0aE0D209c3F774d4f4592948450f80293b

// 2024/05/22: yarn deploy:matic_test:AMinerV10D 
// Deployed on Polygon Amoy testnet to change registerListenApps
// 0xd1348Bb43DbF51a2446DB6e40DE5F6c178cb2D47

// 2024/05/28: yarn deploy:matic:AMinerV10D 
// Deployed on Polygon mainnet to upgrade to support for staking
// 0xeCAac43Ef76a7c76613986FaaAd26707a3BFF59a

// 2024/07/26: yarn deploy:matic:AMinerV10D 
// Deployed on Polygon mainnet to fix a small bug that RemoteMinerOnboardNative did not call checkListener
// 0x0b25c74b5FF36d290320e73b1aFf14ff150C84E8

// 2024/10/21: yarn deploy:matic_test:AMinerV10D 
// Deployed on Polygon Amoy testnet to Support Miner Pro
// 0x6Aca9D31e467a1DdA381aBaA250Fcb1388618F42

// 2024/10/21: yarn deploy:matic:AMinerV10D 
// Deployed on Polygon mainnet to Support Miner Pro
// 0x7E2c63928392a7C928A442eefb488D17b1c5Fc4d

// 2024/12/17: yarn deploy:matic_test:AMinerV10D 
// Deployed on Polygon Amoy testnet to Support Airdrop by authority
// 0x039a6f3f70E6Ce71EcCC001ED4136e6dFE5DBd49

// 2024/12/17: yarn deploy:matic:AMinerV10D 
// Deployed on Polygon mainnet to Support Airdrop by authority
// 0x039a6f3f70E6Ce71EcCC001ED4136e6dFE5DBd49

export default func;
func.tags = ["AMinerV10D"];
