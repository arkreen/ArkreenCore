import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { BigNumber } from "ethers";

const func: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
  const { deployments, getNamedAccounts } = hre;
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();

  const defaultGasPrice = (hre.network.name === 'matic_test') ? BigNumber.from(3_000_000_000) : BigNumber.from(100000000000)

  console.log("Deploying: ", 'GreenBTCImage', deployer, defaultGasPrice.toString());  

  const GreenBTCImage = await deploy('GreenBTCImage', {
      from: deployer,
      args: [],
      log: true,
      skipIfAlreadyDeployed: false,
      gasPrice: defaultGasPrice
  });

  console.log("GreenBTCImage deployed to %s: ", hre.network.name, GreenBTCImage.address);
};

// 2023/10/23
// yarn deploy:matic_test:GreenBTCImageD:
// 0x27a30F0B401cC5Cd7bb5477E4fA290CeDFfA8cc7

// 2023/10/25
// yarn deploy:matic_test:GreenBTCImageD:
// 0xc44ab5E1C00f9df586b80DDbAF00220974a97bC5

// 2023/10/26: Add ART flag, and shown owner 
// yarn deploy:matic_test:GreenBTCImageD
// 0x99C26b45949073a73b98b568de399B1569fe008c

// 2023/10/26: revert? Abort
// yarn deploy:matic_test:GreenBTCImageD
// 0x2c5a2D33aA7CeABa69C8DE595720a8Fd621B3D00

// 2023/10/26: POWER -> ENERGY
// yarn deploy:matic_test:GreenBTCImageD
// 0x5b92c6E11A98F76CF20d878A79150A09bB24C24f

// 2023/10/27: Matic mainnet
// yarn deploy:matic:GreenBTCImageD
// 0xE44A9194ee572813db71496dA0D871b745e380Ac

// 2023/10/27:2 Change image contract, move all svg logic to image contract
// yarn deploy:matic_test:GreenBTCImageD
// 0xb5E55E38B3260f52884a8b74a86F9C9c3933717d

// 2023/10/27:3 Matic mainnet:  Moving all svg logic to image contract
// yarn deploy:matic:GreenBTCImageD
// 0x01e2D144E9414cb58FD9e90dd26b2555275bC42d

// 2023/11/08: Matic testnet:  Add metadata to NFT image
// yarn deploy:matic_test:GreenBTCImageD
// 0x0Cd8bc60c7bE8cC22D9365B7996b6E789B948f97

// 2023/11/13: Matic mainnet:  Add metadata to NFT image, Green BTC -> GreenBTC, and change slogan
// yarn deploy:matic:GreenBTCImageD
// 

// 2024/04/16: Deploy on Amoy testnet
// yarn deploy:matic_test:GreenBTCImageD
// 0xD6Ad5AF35a22F8630d0C9049779f8B16218D6ce9

// 2024/04/16: Deploy on Amoy testnet
// yarn deploy:matic_test:GreenBTCImageD
// 0xB56D6cf0539285fdC1FfC669Be58FD1631230703

// 2024/05/06: Deploy on Amoy testnet
// yarn deploy:matic_test:GreenBTCImageD
// 0xb50663a9848A8CDa219756488406cCA19F8b2F28

// 2024/05/06A: Deploy on Polygon mainnet
// yarn deploy:matic:GreenBTCImageD
// 0x66e4509f99E7b47f4c7329c7E1f35483aA7c3D34

func.tags = ["GreenBTCImageD"];

export default func;
