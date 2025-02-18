import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { CONTRACTS } from "../constants";
import { BigNumber } from "ethers";

const func: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
  const { deployments, getNamedAccounts } = hre;
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();

  console.log("Deploying: ", CONTRACTS.ArtBank, deployer);  
  const defaultGasPrice = (hre.network.name === 'matic_test') 
                          ? BigNumber.from(32_000_000_000) 
                          : (hre.network.name === 'celo')
                          ? BigNumber.from(6_000_000_000) 
                          : BigNumber.from(32_000_000_000)

  const arkreenRECBank = await deploy(CONTRACTS.ArtBank, {
      from: deployer,
      args: [],
      log: true,
      skipIfAlreadyDeployed: false,
      gasPrice: defaultGasPrice
  });

  console.log("arkreenRECBank deployed to %s: ", hre.network.name, arkreenRECBank.address);
};

// 2023/07/26
// deploy:matic_test:ArtBankD
// 0x84AEAe330517A89Ab74f5eD0f805522634dF8Df6

// 2024/01/11
// deploy:matic:ArtBankD 
// 0xF845c843DaEa0cE08d2184CC1eDfe2b998B2d565

// 2024/04/03: Fix the withdraw bug 
// deploy:matic:ArtBankD 
// 0xED673Af2CD4eAEb2687DcB34e013335437463A31

// 2024/04/20: Deployed on Polygon Amoy testnet 
// deploy:matic_test:ArtBankD 
// 0xB182210EdF8dC4acbe1b92B304e2F1a6986FD093

// 2024/05/20: Deployed on Polygon Amoy testnet, support return value while buying ART
// deploy:matic_test:ArtBankD 
// 0x16BCB4B078AcDF8b5fAEd988FEcC61FB0D84d352

// 2024/09/02: Deployed on Polygon mainnet, support return value while buying ART
// yarn deploy:matic:ArtBankD 
// 0x5DbF34752CeBAeA2386337f5ea23c1dCaD48EE6A

// 2024/11/20: Deployed on Celo mainnet, support removing deposited cART from bank
// yarn deploy:celo:ArtBankD 
// 0x92131f116dC4653e1fCF9E3FdC543827105101fE

// 2024/12/21: Deployed on Polygon mainnet, support removing deposited ART from bank
// yarn deploy:matic:ArtBankD 
// 0xBa9d6d00AB8e2937644225400F5C861eb5E18554

// 2025/02/14: Deployed on Polygon mainnet, support withdrawing by owner
// yarn deploy:matic:ArtBankD 
// 0x3985696D7B4B594b9e00fC7CE19d1FF6D8A652e2

func.tags = ["ArtBankD"];

export default func;
