import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { CONTRACTS } from "../constants";
import { BigNumber } from "ethers";
import { UChildERC20__factory } from "../../typechain";
import { ethers } from "hardhat";
import { utils } from 'ethers'

const func: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {

    const [deployer] = await ethers.getSigners();

    //const defaultGasPrice = (hre.network.name === 'matic_test') ? BigNumber.from(3_000_000_000) : BigNumber.from(100000000000)
    //const defaultGasPrice = (hre.network.name === 'celo_test') ? BigNumber.from(32_000_000_000) : BigNumber.from(100000000000)

    const feeData = await deployer.getFeeData()
    console.log("qqqqqqqqqqqqqqq", deployer, feeData)
    if( hre.network.name === 'matic_test' || hre.network.name === 'celo_test' 
        || hre.network.name === 'hashkey_test' || hre.network.name === 'bsc_test')  {
      // 2024/04/16: Amoy testnet                        
      //const USDTAddress  = "0xc7767ae828E4830e2f800981E573f333d1E492b5"         // Amoy testnet
      //const USDTAddress  = "0xf66fc9b248D2C97Fb28954c476E6E3964aB0275D"         // Celo testnet
      //const mintAddress  = "0x364a71eE7a1C9EB295a4F4850971a1861E9d3c7D"         // Amoy testnet

      // Hashkey testnet
//    const USDTAddress  = "0x5126268e5123036C56abC5ffBEBc69c08086B90a"         // Hashkey testnet
//    const mintAddress  = "0xa9c791f20b08AB9F0Ff160B3A2b6492C9228cdF6"         // Hashkey testnet
//    const valueUSDT = "1000000000000000"

      const USDTAddress  = "0x7D94aeE379D083eA8027318a804e289e36638DEF"         // Hashkey testnet
      const mintAddress  = "0xa9c791f20b08AB9F0Ff160B3A2b6492C9228cdF6"         // Hashkey testnet
      const valueUSDT = "1000000000000000"

/*
      // BSC testnet:   2025/02/28
      const USDTAddress  = "0x93eFC409Ff44788E8b1DAF395F46965046cAe84B"         // BSC testnet
      const mintAddress  = "0x364a71eE7a1C9EB295a4F4850971a1861E9d3c7D"         // BSC testnet
      const valueUSDT = "1000000000000000"
*/
      const USDTFactory = UChildERC20__factory.connect(USDTAddress, deployer);

      const feeData = await deployer.getFeeData()
      const gasPrice = await deployer.getGasPrice()  
      const depositData = utils.defaultAbiCoder.encode(['uint256'], [valueUSDT])

      console.log("USDT deposit Tx:", mintAddress, depositData)

      // 2024/04/16, Amoy testnet
      // 2025/02/26, hashkey testnet
      // 2025/02/28, bsc testnet
      const depositTx = await USDTFactory.deposit(mintAddress, depositData, {
//                              gasPrice: gasPrice.mul(130).div(100),
                                maxFeePerGas: feeData.maxFeePerGas?.mul(130).div(100),
                                maxPriorityFeePerGas: feeData.maxPriorityFeePerGas?.mul(130).div(100),
                              })
      await depositTx.wait()

      console.log("USDT deposit Tx:", depositTx, mintAddress, depositData)
    }
};

// 2024/04/16
// yarn deploy:matic_test:USDTI    : Amoy testnet (Dev Anv)
// deposit to 0x364a71eE7a1C9EB295a4F4850971a1861E9d3c7D: 100000000 USDT

// 2025/02/24
// yarn deploy:celo_test:USDTI    : Amoy testnet (Dev Anv)
// deposit to 0x364a71eE7a1C9EB295a4F4850971a1861E9d3c7D: 100000000 USDT

// 2025/02/26
// yarn deploy:hashkey_test:USDTI     : Amoy testnet (Dev Anv)
// deposit to 0xa9c791f20b08AB9F0Ff160B3A2b6492C9228cdF6: 100000000 USDT

// 2025/02/28
// yarn deploy:bsc_test:USDTI         : bsc testnet 
// deposit to 0x93eFC409Ff44788E8b1DAF395F46965046cAe84B: 100000000 USDT

// 2025/03/07
// yarn deploy:hashkey_test:USDTI     : Amoy testnet (Dev Anv)
// deposit to 0xa9c791f20b08AB9F0Ff160B3A2b6492C9228cdF6: 100000000 USDC

func.tags = ["USDTI"];

export default func;
