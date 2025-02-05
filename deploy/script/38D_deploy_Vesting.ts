import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { CONTRACTS } from "../constants";
import { BigNumber } from "ethers";
import { expandTo18Decimals } from "../../test/utils/utilities";

const func: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {

    const { deployments, getNamedAccounts } = hre;
    const { deploy } = deployments;
    const { deployer } = await getNamedAccounts();

    const defaultGasPrice = (hre.network.name === 'matic_test') ? BigNumber.from(32_000_000_000) : BigNumber.from(32_000_000_000)
   
    console.log("Deploying: ", "AKREVesting", deployer);  

    const akreToken = "0xE9c21De62C5C5d0cEAcCe2762bF655AfDcEB7ab3"

    const akreVesting = await deploy('AKREVesting', {
        from: deployer,
        args: [akreToken],
        log: true,
        skipIfAlreadyDeployed: false,
        gasPrice: defaultGasPrice
    });
  
    console.log("AKREVesting deployed to %s: ", hre.network.name, akreVesting.address);
};

// 2025/02/01
// yarn deploy:matic:AKREVestD   : Polygon mainnet
// Instance:        0xD08DC235ADd096cA72B6f258C3c4A4fe460998b1
// 2025/02/05:      0x4bD433337C9C0896291e0259db9feF0f091c0175

func.tags = ["AKREVestD"];

export default func;
