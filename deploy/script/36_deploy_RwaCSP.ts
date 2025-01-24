import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { CONTRACTS } from "../constants";
import { BigNumber } from "ethers";

const func: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {

    const { deployments, getNamedAccounts } = hre;
    const { deploy } = deployments;
    const { deployer } = await getNamedAccounts();

    const defaultGasPrice = (hre.network.name === 'matic_test') ? BigNumber.from(32_000_000_000) : BigNumber.from(80_000_000_000)

    let akreToken: string = ''
    let assetManager: string = ''

    // function initialize(address kWh, address manager)
    if(hre.network.name === 'matic_test')  {
      // 2025/01/04: RwaCSP on Amoy testnet            
      akreToken = "0xd092e1f47d4e5d1C1A3958D7010005e8e9B48206"
      assetManager = deployer
    } else if(hre.network.name === 'matic')  {
      akreToken = "0xE9c21De62C5C5d0cEAcCe2762bF655AfDcEB7ab3"
      assetManager = "0x3B3e675412c78C12030ff30b4dDEF48030bf927d"
    } 

    console.log("Deploying: ", "RwaCSP", deployer);  
    
    const rwaAsset = await deploy("RwaCSP", {
        from: deployer,
        proxy: {
          proxyContract: "UUPSProxy",
          execute: {
            init: {
              methodName: "initialize",                           // Function to call when deployed first time.
              args: [akreToken, assetManager]
            },
          },
        },
        log: true,
        skipIfAlreadyDeployed: false,
        gasPrice: defaultGasPrice
    });

/*
    // 2024/12/19
    const IMPLEMENTATION_ADDRESS ="0x66f3762739E7303Ec87805CC11f4FAecB35283a3"
    const callData = RWAsset__factory.createInterface().encodeFunctionData("initialize", [akreToken, deployer, deployer])
    const rwaAsset = await deploy(CONTRACTS.UUPSProxy, {
            from: deployer,
            args: [IMPLEMENTATION_ADDRESS, deployer, callData],
            log: true,
            skipIfAlreadyDeployed: false,
            gasPrice: defaultGasPrice
    });
*/  
    console.log("arkreenPromotion deployed to %s: ", hre.network.name, rwaAsset.address);
};

// 2025/01/04
// yarn deploy:matic_test:RwaCSP    : Amoy testnet
// Proxy:                 0xDd0597927E27d5870198Be48C594F7155D3904EB
// Implementaion:         0x7BC7a7610408fC45d89677598BC3CC292591550d

// 2025/01/24
// yarn deploy:matic:RwaCSP    : Amoy testnet
// Proxy:                 0x8508E0d63743f084c09FCAE8c2ABbd897D6Ad138
// Implementaion:         0x66b46Eb813f15f63407CF8Bd69725295D37eE9e0

func.tags = ["RwaCSP"];

export default func;
