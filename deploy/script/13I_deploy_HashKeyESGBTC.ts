import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { ethers } from "hardhat";
import { HashKeyESGBTC__factory } from "../../typechain";
import { BigNumber } from 'ethers'

import NFT_pic_metadata from "../NFT_pic.json";

const func: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {

    let ESGBTC_ADDRESS
    let USDC_ADDRESS
    let USDT_ADDRESS
    let WMATIC_ADDRESS
    let AKRE_ADDRESS

    if(hre.network.name === 'matic_test')  {    
      // 2023/03/05, simulation 
      //ESGBTC_ADDRESS  = "0xDe8e59dAB27EB97b2267d4230f8FE713A637e03c"         // HashKey ESG BTC address
      ESGBTC_ADDRESS  = "0x785dCa2Ca9a51513da1fef9F70E6B6ab02896F67"         // 2023/3/14 HashKey ESG BTC address

/*            
      USDC_ADDRESS    = "0x0FA8781a83E46826621b3BC094Ea2A0212e71B23"        // USDC address
      USDT_ADDRESS    = "0xD89EDB2B7bc5E80aBFD064403e1B8921004Cdb4b"        // USDT address
      WMATIC_ADDRESS  = "0x9c3C9283D3e44854697Cd22D3Faa240Cfb032889"        // WMATIC address
      AKRE_ADDRESS    = "0x54e1c534f59343c56549c76d1bdccc8717129832"        // AKRE address

      const [deployer] = await ethers.getSigners();

      // Approve HashKeyESGBTCContract to Tranfer-From the specified tokens
      const HashKeyESGBTCFactory = HashKeyESGBTC__factory.connect(ESGBTC_ADDRESS as string, deployer);
      
      const approveRouterTx = await HashKeyESGBTCFactory.approveBuilder(
                                        [USDC_ADDRESS, USDT_ADDRESS, WMATIC_ADDRESS, AKRE_ADDRESS] as string[])
      await approveRouterTx.wait()
      console.log("HashKeyESGBTCContract approveBuilder is executed: %s: ", hre.network.name, ESGBTC_ADDRESS, 
                                [USDC_ADDRESS, USDT_ADDRESS, WMATIC_ADDRESS, AKRE_ADDRESS] );

*/

      const [deployer] = await ethers.getSigners();

      // Approve HashKeyESGBTCContract to Tranfer-From the specified tokens
      const HashKeyESGBTCFactory = HashKeyESGBTC__factory.connect(ESGBTC_ADDRESS as string, deployer);

//      const level = [1, 2, 3, 4, 5, 6, 7, 8]
//      const limit = [100, 60, 60, 40, 40, 20, 20, 10]

/*
      const level = [1, 2, 3, 4, 5, 6]
      const limit = [100, 60, 60, 40, 40, 20]

      const allMetaCID = level.reduce<string>((allMeta, lvl, idx) => {
                for ( let index=1; index<=limit[idx]; index++) {
                  const key = 'L' + lvl.toString()+ '#' + index.toString().padStart(3,'0')
                  allMeta = allMeta + (NFT_pic_metadata.All_Green_BTC_NFT as any)[key].CID_META
                }
                return allMeta
            }, '')

//    console.log(NFT_pic_metadata.All_Green_BTC_NFT['L1#001'])
//    console.log(allMetaCID)



//      const levelRange = 0x0801
//      const limitList = BigNumber.from("0x0A141428283C3C64")
      
      const levelRange = 0x0601
      const limitList = BigNumber.from("0x1428283C3C64")

      const updateCIDTx = await HashKeyESGBTCFactory.updateCID(levelRange, limitList, Buffer.from(allMetaCID))
      await updateCIDTx.wait()
*/

      const level = [7, 8]
      const limit = [20, 10]

      const allMetaCID = level.reduce<string>((allMeta, lvl, idx) => {
                for ( let index=1; index<=limit[idx]; index++) {
                  const key = 'L' + lvl.toString()+ '#' + index.toString().padStart(3,'0')
                  allMeta = allMeta + (NFT_pic_metadata.All_Green_BTC_NFT as any)[key].CID_META
                }
                return allMeta
            }, '')
     
      const levelRange = 0x0807
      const limitList = BigNumber.from("0x0A14")

      const updateCIDTx = await HashKeyESGBTCFactory.updateCID(levelRange, limitList, Buffer.from(allMetaCID))
      await updateCIDTx.wait()

      console.log( "HashKeyESGBTCContract approveBuilder is executed: %s: ", hre.network.name, ESGBTC_ADDRESS, allMetaCID );      
     
    }
    else if(hre.network.name === 'matic')  {        // Matic Mainnet
      ESGBTC_ADDRESS  = ""          // HashKey ESG BTC address

      USDC_ADDRESS    = ""          // USDC address
      USDT_ADDRESS    = ""          // USDT address
      WMATIC_ADDRESS  = ""          // WMATIC address
      AKRE_ADDRESS    = ""          // AKRE address

    } 
                              
};

// 2023/04/03: Add the NFT picture and relative logic
// yarn deploy:matic_test:HskBTCI

func.tags = ["HskBTCI"];

export default func;