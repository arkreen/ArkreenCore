import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { CONTRACTS } from "../constants";
import { BigNumber } from "ethers";
import { ethers } from "hardhat";
import { UChildERC20__factory } from "../../typechain";


const func: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {

    const { deployments, getNamedAccounts } = hre;
    const { deploy } = deployments;
    const { deployer, controller } = await getNamedAccounts();

    //const defaultGasPrice = (hre.network.name === 'matic_test') ? BigNumber.from(3_000_000_000) : BigNumber.from(100000000000)
    const defaultGasPrice = (hre.network.name === 'celo_test') ? BigNumber.from(32_000_000_000) : BigNumber.from(100000000000)

    let USDT_NAME: string
    let USDT_SYMBOL
    let USDT_DECIMAL
    let USDT_MANAGER

    const provider =  ethers.provider

    const feeData = await provider.getFeeData()
    const gasPrice = await provider.getGasPrice()  

    console.log("AAAAAAAAAAAA", feeData, gasPrice)
    
//    if(hre.network.name === 'matic_test' || hre.network.name === 'celo_test' || hre.network.name === 'hashkey_test')  {
      // 2024/04/16: Amoy testnet       
      // 2025/02/14: celo testnet              
      // 2025/02/27: bsc testnet                                    
      USDT_NAME = 'Tether USD'
      USDT_SYMBOL  = "USDT"   
      USDT_DECIMAL = 6     
      USDT_MANAGER = deployer     
//    }

    console.log("Deploying: ", "UChildERC20", deployer);  
    const USDT = await deploy("UChildERC20", {
        from: deployer,   // deployer
        proxy: {
          proxyContract: "UUPSProxy",
          execute: {
            init: {
              methodName: "initialize",     // Function to call when deployed first time.
              args: [USDT_NAME, USDT_SYMBOL, USDT_DECIMAL, USDT_MANAGER]
            },
          },
        },
        log: true,
        nonce: 0,
        skipIfAlreadyDeployed: false,
        maxFeePerGas: feeData.maxFeePerGas?.mul(130).div(100),
        maxPriorityFeePerGas: feeData.maxPriorityFeePerGas?.mul(130).div(100),
    });


/*
    // 2024/12/19
    USDT_NAME = 'Tether USD'
    USDT_SYMBOL  = "USDT"   
    USDT_DECIMAL = 6     
    USDT_MANAGER = deployer     

    const IMPLEMENTATION_ADDRESS ="0x1F026ff412C90968dA34b5b09C822020693D60B2"
    const callData = UChildERC20__factory.createInterface().encodeFunctionData("initialize", [USDT_NAME, USDT_SYMBOL, USDT_DECIMAL, USDT_MANAGER])
    const USDT = await deploy(CONTRACTS.UUPSProxy, {
            from: deployer,
            args: [IMPLEMENTATION_ADDRESS, deployer, callData],
            log: true,
            skipIfAlreadyDeployed: false,
            maxFeePerGas: feeData.maxFeePerGas?.mul(130).div(100),
            maxPriorityFeePerGas: feeData.maxPriorityFeePerGas?.mul(130).div(100),
   
    });
*/
    console.log("USDT deployed to %s: ", hre.network.name, USDT.address);

};

// 2024/04/16
// yarn deploy:matic_test:USDT      : Amoy testnet (Dev Anv)
// Proxy:                 0xc7767ae828E4830e2f800981E573f333d1E492b5 
// Implementaion:         0x17098DA15e84F29a17622F423B482dE1C0B77F42

// 2025/02/24
// yarn deploy:celo_test:USDT       : Celo testnet (Dev Anv)
// Proxy:                 0xf66fc9b248D2C97Fb28954c476E6E3964aB0275D
// Implementaion:         0x4fe0c0182C4953e3527E7B1068Bd60515A1d9722

// 2025/02/25
// yarn deploy:hashkey_test:USDT    : hashkey testnet
// Proxy:                 0x5126268e5123036C56abC5ffBEBc69c08086B90a (Proxy)
// Implementaion:         0x1F026ff412C90968dA34b5b09C822020693D60B2  

// 2025/02/25
// yarn deploy:bsc_test:USDT        : bsc testnet
// Proxy:                 0x93eFC409Ff44788E8b1DAF395F46965046cAe84B (Proxy)
// Implementaion:         0xC3B5EfC5E7fC7F28C2a8321382a3c3Bd47869E03 

func.tags = ["USDT"];

export default func;
