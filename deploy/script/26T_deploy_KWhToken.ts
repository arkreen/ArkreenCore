import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { CONTRACTS } from "../constants";
import { BigNumber } from "ethers";
import { expandTo18Decimals } from "../../test/utils/utilities";
import { ethers } from "hardhat";
import { KWhTokenT__factory } from "../../typechain";

const func: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {

    const { deployments, getNamedAccounts } = hre;
    const { deploy } = deployments;
    const { deployer } = await getNamedAccounts();

//  const defaultGasPrice = (hre.network.name === 'celo_test') ? BigNumber.from(50_000_000_000) : BigNumber.from(50_000_000_000)
    const gasPrice = await ethers.provider.getGasPrice()  

    console.log("Deploying: ", "kWh Token Test", deployer);  

    const art = "0x57Fe6324538CeDd43D78C975118Ecf8c137fC8B2"
/*
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
      gasPrice: gasPrice.mul(130).div(100),
    });
*/  

   
    // 2025/03/06
    const IMPLEMENTATION_ADDRESS ="0xf2A4A61d7299815c9D1A5FDf39cbB1981CB78Ce3"
    const callData = KWhTokenT__factory.createInterface().encodeFunctionData("initialize", [art, 1_000_000_000, deployer, '', ''])
    const kWhTokenT = await deploy(CONTRACTS.UUPSProxy, {
            from: deployer,
            args: [IMPLEMENTATION_ADDRESS, deployer, callData],
            log: true,
            skipIfAlreadyDeployed: false,
            gasPrice: gasPrice.mul(130).div(100),
    });

    console.log("ArkreenRECToken Test deployed to %s: ", hre.network.name, kWhTokenT.address);
};

// 2025/02/24
// yarn deploy:celo_test:WKHDT         // kWh Test Token on Celo
// Proxy:                 0x44b1e6Fc8033B5ac3CE4ea5954747d02D9042E7D (UUPS) (Wrong Cap)
// Implementaion:         0x6f95b4FE0373FA84b0f332437Bf4642365D1344F

// 2025/02/24
// yarn deploy:celo_test:WKHDT         // kWh Test Token on Celo
// Proxy:                 0x6D2B7d619dc27FF926D4EAC36899a41C1D84Fce2 (UUPS) (No convert funaction)
// Implementaion:         0xc2bAF0D1f923D496e55161056Bd41BF2A4D8EC41

// 2025/02/28
// yarn deploy:bsc_test:WKHDT         // kWh Test Token on Celo
// Proxy:                 0xb50663a9848A8CDa219756488406cCA19F8b2F28        (UUPS) (No convert funaction)
// Implementaion:         0xeB53d6642D210348D8BFcDA1a408990794A4A7B9

// 2025/03/06
// yarn deploy:celo_test:WKHDT         // kWh Test Token on Celo
// Proxy:                 0x0a9E5889f0bd049583093a31E375Fd15427F8773        (UUPS) (No convert funaction)
// Implementaion:         0xf2A4A61d7299815c9D1A5FDf39cbB1981CB78Ce3

func.tags = ["WKHDT"];

export default func;
