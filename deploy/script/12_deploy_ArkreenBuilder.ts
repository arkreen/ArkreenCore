import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { CONTRACTS } from "../constants";
import { BigNumber } from "ethers";

const func: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {

    let ROUTER_ADDRESS
    let NATIVE_TOKEN_ADDRESS
    let RECBANK_ADDRESS

    const defaultGasPrice = (hre.network.name === 'matic_test') ? BigNumber.from(3_000_000_000) : BigNumber.from(300_000_000_000)
    
    if(hre.network.name === 'matic_test')  {    
      /*     
      ROUTER_ADDRESS          = "0x75bcdf4e9900fac6d8e601624435d9269bad9051"       // Router address
      NATIVE_TOKEN_ADDRESS    = "0x9c3C9283D3e44854697Cd22D3Faa240Cfb032889"       // WMATIC address
      */

      // 2024/04/16 (Amoy Testnet Env Dev)
      ROUTER_ADDRESS          = "0x0000000000000000000000000000000000000000"
      RECBANK_ADDRESS         = "0xf9aAcFf1B292F82b60662e47610C570ef58d3c70"
      NATIVE_TOKEN_ADDRESS    = "0x0ae690aad8663aab12a671a6a0d74242332de85f"
    }
    else if(hre.network.name === 'matic')  {        // Matic Mainnet for test
      ROUTER_ADDRESS          = "0x938b544ce2ae40b6de0ab728a69c37a60159689a"
      RECBANK_ADDRESS         = "0xab65900A52f1DcB722CaB2e5342bB6b128630A28"
      NATIVE_TOKEN_ADDRESS    = "0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270"
    } 
    else if(hre.network.name === 'celo_test')  {    // Celo Testnet
      ROUTER_ADDRESS          = "0x0000000000000000000000000000000000000000"
      RECBANK_ADDRESS         = "0x827155A6fD0aac8AbE7beb4Ee1a95143255ed438"
      NATIVE_TOKEN_ADDRESS    = "0xB53B96e1eF29cB14313c18Fa6374AB87df59BcD9"
    } 
    else if(hre.network.name === 'celo')  {        // Celo mainnet
      ROUTER_ADDRESS          = "0x0000000000000000000000000000000000000000"
      RECBANK_ADDRESS         = "0x815bFE3aaCF765c9E0A4DdEb98Ad710a4Fb860d3"
      NATIVE_TOKEN_ADDRESS    = "0x471EcE3750Da237f93B8E339c536989b8978a438"
    } 

    const { deployments, getNamedAccounts } = hre;
    const { deploy } = deployments;
    const { deployer } = await getNamedAccounts();

    console.log("Deploying: ", CONTRACTS.ABuilder, deployer);  
    const ArkreenBuilder = await deploy(CONTRACTS.ABuilder, {
        from: deployer,
        proxy: {
          proxyContract: "UUPSProxy",
          execute: {
            init: {
              methodName: "initialize",   // Function to call when deployed first time.
              args: [ROUTER_ADDRESS, RECBANK_ADDRESS, NATIVE_TOKEN_ADDRESS]
            },
          },
        },
        log: true,
        skipIfAlreadyDeployed: true,
        gasPrice: defaultGasPrice
    });

    console.log("ArkreenBuilder deployed to %s: ", hre.network.name, ArkreenBuilder.address);
};

// 2023/04/05
// yarn deploy:matic:ABuilder
// Proxy:           0x7073Ea8C9B0612F3C3FE604425E2af7954c4c92e
// Implementation:  0x56a2005361d5f0f1f5AD6C3Cd050f7F152457a3f

// 2023/08/25
// yarn deploy:celo_test:ABuilder
// Proxy:           0xAC0B2E90b41a1b85520607e60dEf18B59e5a1c9F
// Implementation:  0xf189AaA9dA0d0651c4D4A7037711C0c9E2E33fba

// 2023/11/01
// yarn deploy:celo:ABuilder
// Proxy:           0x3d5531cF0bC2e8d0658fEc0D1a9995211Ac1f337
// Implementation:  0x8326ccd9F31e773E8B6E3ac3F252f4f3843D5Da3

// 2024/04/16
// yarn deploy:matic_test:ABuilder
// Proxy:           0x12De6c1FB46B64e3DA5bFDD274E98B9103353dF7
// Implementation:  0xf66fc9b248D2C97Fb28954c476E6E3964aB0275D

func.tags = ["ABuilder"];

export default func;
