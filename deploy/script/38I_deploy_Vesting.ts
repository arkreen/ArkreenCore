import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { BigNumber } from "ethers";
import { AKREVesting__factory } from "../../typechain";
import { ethers } from "hardhat";

import { expandTo18Decimals } from '../../test/utils/utilities'

const func: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {

    const [deployer] = await ethers.getSigners();
    const defaultGasPrice = (hre.network.name === 'matic_test') ? BigNumber.from(32_000_000_000) : BigNumber.from(250_000_000_000)

    if(hre.network.name === 'matic_test')  {
      const akreVestingAddress   = "0xD08DC235ADd096cA72B6f258C3c4A4fe460998b1"        // 2024/12/23

      const beneficiary = "0x364a71eE7a1C9EB295a4F4850971a1861E9d3c7D"
      const start = 1738425600
      const cliff = 0
      const duration = 3600 * 24 *3
      const amount = expandTo18Decimals(100)
  
      const akreVesting = AKREVesting__factory.connect(akreVestingAddress, deployer);
    
      // 2025/02/01: Polygon mainnet
      const createVestingScheduleTx =  await akreVesting.createVestingSchedule(beneficiary, 
                                    start, cliff, duration, amount, {gasPrice: defaultGasPrice})
      await createVestingScheduleTx.wait()                

      console.log("rwaAssetContract changePromotionConfig", akreVesting.address, createVestingScheduleTx)
      
    } else if(hre.network.name === 'matic')  {

      //const akreVestingAddress   = "0xD08DC235ADd096cA72B6f258C3c4A4fe460998b1"        // 2024/12/23
      const akreVestingAddress   = "0x4bD433337C9C0896291e0259db9feF0f091c0175"        // 2025/02/05

      /*
      const beneficiary = "0x364a71eE7a1C9EB295a4F4850971a1861E9d3c7D"
      const start = 1738425600
      const cliff = 0
      const duration = 3600 * 24 *3
      const amount = expandTo18Decimals(100)
      */

      const beneficiary = "0x7008c56bc884b5118058b63559d4ec3ddf9ed6d5"
      const start = 1735689600  // 2025/01/01
      const cliff = 0
      const duration = 3600 * 24 * 365 * 3
      const amount = expandTo18Decimals(10_000_000)

      const akreVesting = AKREVesting__factory.connect(akreVestingAddress, deployer);
    
      // 2025/02/01: Polygon mainnet
      const createVestingScheduleTx =  await akreVesting.createVestingSchedule(beneficiary, 
                                    start, cliff, duration, amount, {gasPrice: defaultGasPrice})
      await createVestingScheduleTx.wait()                

      console.log("rwaAssetContract changePromotionConfig", akreVesting.address, createVestingScheduleTx)
    } 
};

// 2025/02/01: Call createVestingSchedule                 
// yarn deploy:matic:AKREVestI              : Polygon mainnet

// 2025/02/07: Call createVestingSchedule                 
// yarn deploy:matic:AKREVestI              : Polygon mainnet

func.tags = ["AKREVestI"];

export default func;
