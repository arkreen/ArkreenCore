import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { ethers } from "hardhat";
import { ArkreenRECBank__factory } from "../../typechain";
import { ArkreenRECToken__factory } from "../../typechain";

import { BigNumber, constants } from "ethers";

function expandTo18Decimals(n: number): BigNumber {
  return BigNumber.from(n).mul(BigNumber.from(10).pow(18))
}

const func: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {

    let RECBANK_ADDRESS
    let HART_REC      
    let ART_CONTROLLER
    let BUILDER_ADDRESS

    let USDC_ADDRESS
    let USDT_ADDRESS
    let WMATIC_ADDRESS
    let AKRE_ADDRESS

    let USDC_PRICE
    let USDT_PRICE
    let MATIC_PRICE    
    let AKRE_PRICE

    if(hre.network.name === 'matic_test') {    
      // 2023/03/14, simulation 
      RECBANK_ADDRESS   = "0x7ee6D2A14d6Db71339a010d44793B27895B36d50"          // 2023/3/14 HashKey ESG BTC address
      ART_CONTROLLER    = "0xB53B96e1eF29cB14313c18Fa6374AB87df59BcD9"          // HART_Controller
      HART_REC          = "0x0999afb673944a7b8e1ef8eb0a7c6ffdc0b43e31"          // HART REC Token
      BUILDER_ADDRESS   = "0xA05A9677a9216401CF6800d28005b227F7A3cFae"          // ArkreenBuilder

      USDC_ADDRESS    = "0x0FA8781a83E46826621b3BC094Ea2A0212e71B23"          // USDC address
      USDT_ADDRESS    = "0xD89EDB2B7bc5E80aBFD064403e1B8921004Cdb4b"          // USDT address
      WMATIC_ADDRESS  = "0x9c3C9283D3e44854697Cd22D3Faa240Cfb032889"          // WMATIC address
      AKRE_ADDRESS    = "0x54e1c534f59343c56549c76d1bdccc8717129832"          // AKRE address

      USDC_PRICE      = BigNumber.from(2).mul(BigNumber.from(10).pow(6))      // 2 USDC, 10**6
      USDT_PRICE      = BigNumber.from(2).mul(BigNumber.from(10).pow(6))      // 2 USDT, 10**6
      MATIC_PRICE     = BigNumber.from(5).mul(BigNumber.from(10).pow(16))     // 0.05 MATIC, as Test MATIC is too less
      AKRE_PRICE      = expandTo18Decimals(200)                               // 200 AKRE
    }

    else if(hre.network.name === 'matic')  {        // Matic Mainnet
      RECBANK_ADDRESS   = ""          // HashKey ESG BTC address
      ART_CONTROLLER    = ""
      HART_REC          = ""
      BUILDER_ADDRESS   = ""          // ArkreenBuilder

      USDC_ADDRESS      = ""          // USDC address
      USDT_ADDRESS      = ""          // USDT address
      WMATIC_ADDRESS    = ""          // WMATIC address
      AKRE_ADDRESS      = ""          // AKRE address

      USDC_PRICE =      expandTo18Decimals(2)                                 // 2 USDC
      USDT_PRICE =      expandTo18Decimals(2)                                 // 2 USDT
      MATIC_PRICE      = BigNumber.from(5).mul(BigNumber.from(10).pow(16))    // 0.05 MATIC, as Test MATIC is too less
      AKRE_PRICE =      expandTo18Decimals(200)                               // 200 AKRE
    } 
    
    const [deployer] = await ethers.getSigners();

    console.log("Deployer is", deployer.address)

    // Approve HashKeyESGBTCContract to Tranfer-From the specified tokens
    const ArkreenRECBankFactory = ArkreenRECBank__factory.connect(RECBANK_ADDRESS as string, deployer);

/*  
    //  CAN NOT Set BUILDER_ADDRESS !!!!!!!!!!!!!!!!!!!
    const addNewARTTRx = await ArkreenRECBankFactory.addNewART(HART_REC as string , ART_CONTROLLER as string);
    await addNewARTTRx.wait()

    const setForwarderTrx = await ArkreenRECBankFactory.setForwarder(BUILDER_ADDRESS as string, true)
    await setForwarderTrx.wait()
*/

/*
    // Called by controller, Account 2
    const changeSalePriceUSDSC = await ArkreenRECBankFactory.changeSalePrice(HART_REC as string, 
                                    USDC_ADDRESS as string, USDC_PRICE as BigNumber)
    await changeSalePriceUSDSC.wait()
    
    const changeSalePriceUSDST = await ArkreenRECBankFactory.changeSalePrice(HART_REC as string, 
                                    USDT_ADDRESS as string, USDT_PRICE as BigNumber)
    await changeSalePriceUSDST.wait()

    const changeSalePriceMATIC = await ArkreenRECBankFactory.changeSalePrice(HART_REC as string, 
                                    WMATIC_ADDRESS as string, MATIC_PRICE as BigNumber)
    await changeSalePriceMATIC.wait()   

    const changeSalePriceAKRE = await ArkreenRECBankFactory.changeSalePrice(HART_REC as string, 
                                    AKRE_ADDRESS as string, AKRE_PRICE as BigNumber)
    await changeSalePriceAKRE.wait()
*/    

/*
    const ArkreenRECTokenFactory = ArkreenRECToken__factory.connect(HART_REC as string, deployer);
    const approveTrx = await ArkreenRECTokenFactory.approve(RECBANK_ADDRESS as string, constants.MaxUint256)
    await approveTrx.wait()
*/
    const depositARTTrx = await ArkreenRECBankFactory.depositART(HART_REC as string, 
                                      BigNumber.from(3000).mul(BigNumber.from(10).pow(9)))      // 1000 HART
    await depositARTTrx.wait()

    console.log("ArkreenRECBank Price is updated: ", hre.network.name, new Date().toLocaleString(),
                              RECBANK_ADDRESS, HART_REC, ART_CONTROLLER, BUILDER_ADDRESS,
                              [USDC_ADDRESS, USDT_ADDRESS, WMATIC_ADDRESS, AKRE_ADDRESS],
                              [USDC_PRICE, USDT_PRICE, MATIC_PRICE, AKRE_PRICE] );                              

};

func.tags = ["ArtBankI"];

export default func;