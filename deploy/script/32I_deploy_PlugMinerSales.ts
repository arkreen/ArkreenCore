import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { CONTRACTS } from "../constants";
import { BigNumber } from "ethers";
import { ethers } from "hardhat";

import { PlugMinerSales__factory } from "../../typechain";

const func: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {

    const defaultGasPrice = (hre.network.name === 'matic_test') ? BigNumber.from(32_000_000_000) : BigNumber.from(32_000_000_000)
    
    if(hre.network.name === 'matic_test')  {
      // 2025/01/10: Update actionCspMiner
      const plugMinerSales = "0x1C326496695cFE4Dde70dd188F87Dc6c069778Af"
      //const NEW_IMPLEMENTATION ="0x1b6209dFb258ba757066CC8BDa987d592962b375"    // 2025/01/10: Update actionCspMiner
      const NEW_IMPLEMENTATION ="0xfA99FD9C58AF9dCBCe4019c0F5227b7263a31C08"      // 2025/01/13: add nonceCsp 

      console.log("Updating plugMinerSales: ", plugMinerSales, defaultGasPrice.toString());  

      const [deployer] = await ethers.getSigners();
 
      const plugMinerSalesFactory = PlugMinerSales__factory.connect(plugMinerSales, deployer);

      const updateTx = await plugMinerSalesFactory.upgradeTo(NEW_IMPLEMENTATION, {gasPrice: defaultGasPrice})
      await updateTx.wait()
  
      console.log("plugMinerSales Upgraded: ", hre.network.name, plugMinerSales);

    } else if(hre.network.name === 'matic')  {
      // 2025/01/10: Update actionCspMiner
      const plugMinerSales = "0x8E0b81E8400FF35B7A1af36A2031AeaD166D1594"
      const NEW_IMPLEMENTATION ="0x23D224309983ce2fC02535729420FED9462c3f63"    // 2025/01/10: Update actionCspMiner

      console.log("Updating plugMinerSales: ", plugMinerSales, defaultGasPrice.toString());  

      const [deployer] = await ethers.getSigners();
 
      const plugMinerSalesFactory = PlugMinerSales__factory.connect(plugMinerSales, deployer);

      const USDC_ADDRESS        = "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174"          // USDC address
      const USDT_ADDRESS        = "0xc2132D05D31c914a87C6611C10748AEb04B58e8F"          // USDT address

      const incomeInfoUSDC = await plugMinerSalesFactory.getIncomeInfo(USDC_ADDRESS)
      if (incomeInfoUSDC.newIncome.gt(0)) {
        await plugMinerSalesFactory.withdraw(USDC_ADDRESS, incomeInfoUSDC.newIncome, {gasPrice: defaultGasPrice})
      }

      const incomeInfoUSDT = await plugMinerSalesFactory.getIncomeInfo(USDT_ADDRESS)
      if (incomeInfoUSDT.newIncome.gt(0)) {
        await plugMinerSalesFactory.withdraw(USDT_ADDRESS, incomeInfoUSDT.newIncome, {gasPrice: defaultGasPrice})
      }
  
      console.log("plugMinerSales is withdrawed: ", hre.network.name, plugMinerSales, 
            incomeInfoUSDC.toString(), incomeInfoUSDT.toString());
    } 
};

// 2025/02/14
// yarn deploy:matic:PlugMinerSalesI    : Polygon mainnet: withdarw USDC/USDT
// Call:    withdraw USDC/USDT

func.tags = ["PlugMinerSalesI"];

export default func;
