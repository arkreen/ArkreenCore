import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { CONTRACTS } from "../constants";
import { BigNumber } from "ethers";

const func: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {

    const { deployments, getNamedAccounts } = hre;
    const { deploy } = deployments;
    const { deployer } = await getNamedAccounts();

    const defaultGasPrice = (hre.network.name === 'matic_test') ? BigNumber.from(32_000_000_000) : BigNumber.from(50_000_000_000)
   
    console.log("Deploying: ", "RWAssetPro", deployer);  

    const rwaAssetPro = await deploy('RWAssetPro', {
        from: deployer,
        args: [],
        log: true,
        skipIfAlreadyDeployed: false,
        gasPrice: defaultGasPrice
    });
  
    console.log("arkreenPromotion deployed to %s: ", hre.network.name, rwaAssetPro.address);
};

// 2024/12/23
// yarn deploy:matic_test:RWAssetProD   : Amoy testnet
// Implementaion:        0x3017613CDA756aF1E096F63c4604bf208dC3f28F (Discarded for SECOND_PER_DAY definition)

// 2024/12/23
// yarn deploy:matic_test:RWAssetProD   : Amoy testnet
// Implementaion:        0x23810C3553dF852242D415f89a512A6015b3EA89

func.tags = ["RWAssetProD"];

export default func;
