import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { CONTRACTS } from "../constants";
import { BigNumber } from "ethers";
import { expandTo18Decimals } from "../../test/utils/utilities";

const func: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {

    const { deployments, getNamedAccounts } = hre;
    const { deploy } = deployments;
    const { deployer } = await getNamedAccounts();

    const defaultGasPrice = (hre.network.name === 'celo_test') ? BigNumber.from(50_000_000_000) : BigNumber.from(50_000_000_000)

    console.log("Deploying: ", "kWh Token Test", deployer);  

    const art = "0x57Fe6324538CeDd43D78C975118Ecf8c137fC8B2"

    const artTest = await deploy('KWhTokenT', {
      from: deployer,
      proxy: {
        proxyContract: "UUPSProxy",
        execute: {
          init: {
            methodName: "initialize",   // Function to call when deployed first time.
            args: [art, 1_000_000_000, deployer, '', '']
          },
        },
      },
      log: true,
      skipIfAlreadyDeployed: false,
      gasPrice: defaultGasPrice,
    });
  
    console.log("ArkreenRECToken Test deployed to %s: ", hre.network.name, artTest.address);
};

// 2025/02/24
// yarn deploy:celo_test:WKHDT         // kWh Test Token on Celo
// Proxy:                 0x44b1e6Fc8033B5ac3CE4ea5954747d02D9042E7D (UUPS) (Wrong Cap)
// Implementaion:         0x6f95b4FE0373FA84b0f332437Bf4642365D1344F

// 2025/02/24
// yarn deploy:celo_test:WKHDT         // kWh Test Token on Celo
// Proxy:                 0x6D2B7d619dc27FF926D4EAC36899a41C1D84Fce2 (UUPS) (No convert funaction)
// Implementaion:         0xc2bAF0D1f923D496e55161056Bd41BF2A4D8EC41

// 2025/02/25
// yarn deploy:celo_test:WKHDT         // kWh Test Token on Celo
// Proxy:                 0x6D2B7d619dc27FF926D4EAC36899a41C1D84Fce2 (UUPS) (No convert funaction)
// Implementaion:         

func.tags = ["WKHDT"];

export default func;
