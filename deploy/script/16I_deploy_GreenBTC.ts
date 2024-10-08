import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { ethers } from "hardhat";
import { GreenBTC__factory } from "../../typechain";
import { BigNumber } from "ethers";

import OpenList from "../OpenListNew.json";

const func: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {

    let GREENBTC_ADDRESS
    let USDC_ADDRESS
    let CART_ADDRESS
    let IMAGE_ADDRESS
    let ART_ADDRESS
    let MANAGER_ADDRESS
    let USDT_ADDRESS
    let WMATIC_ADDRESS
    let AKRE_ADDRESS

    const defaultGasPrice = (hre.network.name === 'matic_test') ? BigNumber.from(3_000_000_000) : BigNumber.from(250_000_000_000)

    if(hre.network.name === 'matic_test')  {    
      // 2023/10/20, Test Net Simulation 
      //GREENBTC_ADDRESS  = "0x26fa0cc54eC938DB5919b0ABc8353016f3BD81b1"    // 2023/10/20 GreenBTC address
      //GREENBTC_ADDRESS  = "0x8Cc0B065318ACf3Ac761FE5A19Caf68074034006"    // 2023/10/23 GreenBTC address re-deployed
      //GREENBTC_ADDRESS  = "0x2Bb79dB8b6149F7499CA1bA7eeBE9E736be4dBA9"    // 2023/10/24 GreenBTC address re-deployed as ERC721EnumerableUpgradeable
      GREENBTC_ADDRESS  = "0x2Bb79dB8b6149F7499CA1bA7eeBE9E736be4dBA9"      // 2024/05/06 GreenBTC address Amoy testnet

      // WMATIC_ADDRESS  = "0x9c3C9283D3e44854697Cd22D3Faa240Cfb032889"     // WMATIC address
      // AKRE_ADDRESS    = "0x54e1c534f59343c56549c76d1bdccc8717129832"     // AKRE address
         
      // USDC_ADDRESS    = "0x0FA8781a83E46826621b3BC094Ea2A0212e71B23"     // USDC address
      // CART_ADDRESS = "0x0999afb673944a7b8e1ef8eb0a7c6ffdc0b43e31"        // CART address
      // ART_ADDRESS  = "0xb0c9dD915f62d0A37792FD2ce497680E909D8c0F"        // ART address

      USDC_ADDRESS    = "0x41e94eb019c0762f9bfcf9fb1e58725bfb0e7582"        // USDC address (Amoy testnet)
      USDT_ADDRESS    = "0xc7767ae828E4830e2f800981E573f333d1E492b5"        // USDC address (Amoy testnet)
      CART_ADDRESS    = "0x78A2620C3fb96100Dc551Db657005eEeF270F0DF"        // CART address (Amoy testnet)
      ART_ADDRESS     = "0x615835Cc22064a17df5A3E8AE22F58e67bCcB778"        // ART address (Amoy testnet)

      //IMAGE_ADDRESS   = "0xC75501B7410Ff630A205245998E0CC9C4f8840ee"      // Image address
      //IMAGE_ADDRESS   = "0x27a30F0B401cC5Cd7bb5477E4fA290CeDFfA8cc7"      // 2023/10/23: Image address
      //IMAGE_ADDRESS   = "0xc44ab5E1C00f9df586b80DDbAF00220974a97bC5"      // 2023/10/25: Lucky Image changed
      //IMAGE_ADDRESS   = "0x99C26b45949073a73b98b568de399B1569fe008c"      // 2023/10/26: Add ART flag
      //IMAGE_ADDRESS  = "0x5b92c6E11A98F76CF20d878A79150A09bB24C24f"       // 2023/10/26: POWER -> ENERGY in image contract
      //IMAGE_ADDRESS  = "0xb5E55E38B3260f52884a8b74a86F9C9c3933717d"       // 2023/10/27: Change image contract, move  all svg logic to image contract
      // IMAGE_ADDRESS  = "0x0Cd8bc60c7bE8cC22D9365B7996b6E789B948f97"      // 2023/11/08: Add metadata to NFT image
      // IMAGE_ADDRESS  = "0xD6Ad5AF35a22F8630d0C9049779f8B16218D6ce9"      // 2024/04/17(Amoy): Add metadata to NFT image
      IMAGE_ADDRESS  = "0xb50663a9848A8CDa219756488406cCA19F8b2F28"         // 2024/05/06(Amoy): Upgrade to support ART disaccount
      MANAGER_ADDRESS   = "0xBAeF5d8EfA74d3cff297D88c433D7B5d90bf0e49"      // 2023/10/23: Image address, 2024/04/17(Amoy)

      const [deployer] = await ethers.getSigners();

      const GreenBTCFactory = GreenBTC__factory.connect(GREENBTC_ADDRESS as string, deployer);

/*      
      // 2023/10/20, 2023/10/23, 2023/10/24, 2023/10/, 2024/04/17
      // Approve GreenBTCContract to Tranfer-From the specified tokens
      const approveRouterTx = await GreenBTCFactory.approveBuilder(
                                        [USDC_ADDRESS, USDT_ADDRESS, ART_ADDRESS], {gasPrice: defaultGasPrice} )
      await approveRouterTx.wait()
      console.log("GreenBTCContract approveBuilder is executed: %s: ", hre.network.name, GREENBTC_ADDRESS, 
                                        [USDC_ADDRESS, USDT_ADDRESS, ART_ADDRESS] );
*/
      // 2023/10/21, 2023/10/23, 2023/10/24, 2023/10/25, 2023/20/27, 2023/11/08, 2024/04/17, 2024/05/06
      // Set Image Contract address
      
      const setImageContractTx = await GreenBTCFactory.setImageContract(IMAGE_ADDRESS, {gasPrice: defaultGasPrice})
      await setImageContractTx.wait()
      console.log("GreenBTCContract setImageContract is executed: %s: ", hre.network.name, IMAGE_ADDRESS);
/*
      //  2023/10/23, 2023/10/, 2024/04/17
      // Set Manager address
      const setManagerTx = await GreenBTCFactory.setManager(MANAGER_ADDRESS, {gasPrice: defaultGasPrice})
      await setManagerTx.wait()
      console.log("GreenBTCContract setManager is executed: %s: ", hre.network.name, MANAGER_ADDRESS);

      //  2023/10/23, 2023/10/24, 2023/20/27, 2024/04/17
      // Set mangeARTTokens
      const mangeARTTokensTx = await GreenBTCFactory.mangeARTTokens([ART_ADDRESS], true, {gasPrice: defaultGasPrice})
      await mangeARTTokensTx.wait()
      console.log("GreenBTCContract mangeARTTokens is executed: %s: ", hre.network.name, ART_ADDRESS);

      // 2023/10/25, 2024/04/17
      // Set setLuckyRate
      const setLuckyRateTx = await GreenBTCFactory.setLuckyRate(20, {gasPrice: defaultGasPrice})
      await setLuckyRateTx.wait()
      console.log("GreenBTCContract setLuckyRate is executed: %s: ", hre.network.name);
*/
  
/*        
      // 2024/04/28
      // setNewCaps
      const setNewCapsTx = await GreenBTCFactory.setNewCaps(200, 100, 500, {gasPrice: defaultGasPrice})
      await setNewCapsTx.wait()
      console.log("GreenBTCContract setNewCaps is executed: %s: ", hre.network.name);
*/

/*
      // 2024/04/28
      // setGreenBTCPro
      const  GreenBTCPro_Address = "0x4201963061ee4FB285c19D84F1b39170142e533a"
      const setGreenBTCProTx = await GreenBTCFactory.setGreenBTCPro(GreenBTCPro_Address, {gasPrice: defaultGasPrice})
      await setGreenBTCProTx.wait()
      console.log("GreenBTCContract setNewCaps is executed: %s: ", hre.network.name);

      // 2024/04/28
      // setRatioSubsidyCap
      const setRatioSubsidyCapTx = await GreenBTCFactory.setRatioSubsidyCap(90, {gasPrice: defaultGasPrice})
      await setRatioSubsidyCapTx.wait()
      console.log("GreenBTCContract setRatioSubsidyCap is executed: %s: ", hre.network.name);
*/
    }
    else if(hre.network.name === 'matic')  {        // Matic Mainnet
      
//    GREENBTC_ADDRESS  = "0xfe9341218c7Fcb6DA1eC131a72f914B7C724F200"      // GreenBTC address: HashKey Green BTC
//    GREENBTC_ADDRESS  = "0x32C4c4953c03Fa466424A9ee11BE9863EBfc55aC"      // 2023/10/27 !!!! (Abort)
      GREENBTC_ADDRESS  = "0xDf51F3DCD849f116948A5B23760B1ca0B5425BdE"      // 2023/10/27

      USDC_ADDRESS      = "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174"      // USDC address
      USDT_ADDRESS      = "0xc2132D05D31c914a87C6611C10748AEb04B58e8F"      // USDT address
      WMATIC_ADDRESS    = "0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270"      // WMATIC address
      AKRE_ADDRESS      = "0x21b101f5d61a66037634f7e1beb5a733d9987d57"      // tAKRE address

      CART_ADDRESS      = "0x0D7899F2D36344ed21829D4EBC49CC0d335B4A06"      // CART address
      ART_ADDRESS       = "0x58E4D14ccddD1E993e6368A8c5EAa290C95caFDF"      // ART address

//    IMAGE_ADDRESS     = "0xE44A9194ee572813db71496dA0D871b745e380Ac"      // 2023/10/27: (Abort)
//    IMAGE_ADDRESS     = "0x01e2D144E9414cb58FD9e90dd26b2555275bC42d"      // 2023/10/27: Moving svg logic all to image contract
      IMAGE_ADDRESS     = "0x81f0B102a4d21B1BdaC5C0C4Cb350d0c30388892"      // 2023/11/13: Add metadata to NFT image, Green BTC -> GreenBTC, and change slogan
      
      MANAGER_ADDRESS   = "0xbEBE239CA18BacA579F5B82c1c290fc951FB954C"      // 2023/10/26: Manager address

      const [deployer] = await ethers.getSigners();

      const GreenBTCFactory = GreenBTC__factory.connect(GREENBTC_ADDRESS as string, deployer);

/*
      // 2023/10/27
      // Approve GreenBTCContract to Tranfer-From the specified tokens
      const approveRouterTx = await GreenBTCFactory.approveBuilder(
                                        [USDC_ADDRESS, USDT_ADDRESS, ART_ADDRESS], {gasPrice: defaultGasPrice} )
      await approveRouterTx.wait()
      console.log("GreenBTCContract approveBuilder is executed: %s: ", hre.network.name, GREENBTC_ADDRESS, 
                                        [USDC_ADDRESS, USDT_ADDRESS, ART_ADDRESS] );
*/                                        

/*
      // 2023/10/27, 2023/11/13
      // Set Image Contract address
      const setImageContractTx = await GreenBTCFactory.setImageContract(IMAGE_ADDRESS, {gasPrice: defaultGasPrice})
      await setImageContractTx.wait()
      console.log("GreenBTCContract setImageContract is executed: %s: ", hre.network.name, IMAGE_ADDRESS);
*/

/*
      // 2024/03/07, 2024/03/08
      // Restore Overtime Box List
      //let nonce = 236     // Checking .............
      for (let index = 0 ; index < OpenList.greenBTCBlocks.length; ) {
        let length = OpenList.greenBTCBlocks.length - index
        if (length >= 100) length = 100

        const tokenIdList = OpenList.greenBTCBlocks.slice(index, index+length).map( item => item.heightBTC)
        const openHeightList = OpenList.greenBTCBlocks.slice(index, index+length).map( item => item.openBlockHeight)

//      console.log(index, tokenIdList, openHeightList)
        console.log("GreenBTCContract restoreOvertimeBoxList is executed: ", hre.network.name, index);
        const restoreOvertimeBoxListExtTx = await GreenBTCFactory.restoreOvertimeBoxListExt(index, tokenIdList, openHeightList, {gasPrice: defaultGasPrice})

        console.log("GreenBTCContract restoreOvertimeBoxList hash: ", hre.network.name, restoreOvertimeBoxListExtTx.hash);
        await restoreOvertimeBoxListExtTx.wait()

        index = index + length
      }
*/

/*
      // 2024/03/10
      // Set revealcap: overtimeRevealCap, normalRevealCap, removeRevealCap
      const overtimeRevealCap = 100
      const normalRevealCap = 200
      const removeRevealCap = 800

      console.log("GreenBTCContract setNewCaps: ", hre.network.name, normalRevealCap, overtimeRevealCap, removeRevealCap);
      const setNewCapsTx = await GreenBTCFactory.setNewCaps(normalRevealCap, overtimeRevealCap, removeRevealCap, {nonce:239, gasPrice: defaultGasPrice})

      await setNewCapsTx.wait()
      console.log("GreenBTCContract setNewCaps: ", hre.network.name, normalRevealCap, overtimeRevealCap, removeRevealCap, setNewCapsTx.hash, );
*/

/*
      // 2024/03/11
      //const hCART = "0x93b3bb6C51A247a27253c33F0d0C2FF1d4343214"                // hART

      console.log("GreenBTCContract setCARTContract: ", hre.network.name, hCART);
      const setNewCapsTx = await GreenBTCFactory.setCARTContract(hCART, {gasPrice: defaultGasPrice})

      await setNewCapsTx.wait()
      console.log("GreenBTCContract setCARTContract: ", hre.network.name, hCART);
*/
      // 2024/03/14
      const cART = "0x0D7899F2D36344ed21829D4EBC49CC0d335B4A06"                  // cART

      console.log("GreenBTCContract setCARTContract: ", hre.network.name, cART);
      const setNewCapsTx = await GreenBTCFactory.setCARTContract(cART, {gasPrice: defaultGasPrice})

      await setNewCapsTx.wait()
      console.log("GreenBTCContract setCARTContract: ", hre.network.name, cART);

/*      
      //  2023/10/27
      // Set Manager address
      const setManagerTx = await GreenBTCFactory.setManager(MANAGER_ADDRESS, {gasPrice: defaultGasPrice})
      await setManagerTx.wait()
      console.log("GreenBTCContract setManager is executed: %s: ", hre.network.name, MANAGER_ADDRESS);

      // 2023/10/27
      // Set mangeARTTokens
      const mangeARTTokensTx = await GreenBTCFactory.mangeARTTokens([ART_ADDRESS], true, {gasPrice: defaultGasPrice})
      await mangeARTTokensTx.wait()
      console.log("GreenBTCContract mangeARTTokens is executed: %s: ", hre.network.name, ART_ADDRESS);
*/
      
/*
      // 2023/10/25
      // Set setLuckyRate
      const setLuckyRateTx = await GreenBTCFactory.setLuckyRate(20, {gasPrice: defaultGasPrice})
      await setLuckyRateTx.wait()
      console.log("GreenBTCContract setImageContract is executed: %s: ", hre.network.name, ART_ADDRESS);
*/

    } 
                              
};

// 2023/10/20: call approveBuilder
// yarn deploy:matic_test:GreenBTCI

// 2023/10/21: call setImageContract: manually as method name changed
// yarn deploy:matic_test:GreenBTCI

// 2023/10/23: call approveBuilder and setImageContract
// yarn deploy:matic_test:GreenBTCI

// 2023/10/23: call setManager
// yarn deploy:matic_test:GreenBTCI

// 2023/10/24: call approveBuilder, setImageContract, setManager, mangeARTTokens
// yarn deploy:matic_test:GreenBTCI

// 2023/10/25: call setLuckyRate
// yarn deploy:matic_test:GreenBTCI

// 2023/10/25: call setImageContract
// yarn deploy:matic_test:GreenBTCI

// 2023/10/26: call setImageContract
// yarn deploy:matic_test:GreenBTCI

// 2023/10/26: call setImageContract:  0x5b92c6E11A98F76CF20d878A79150A09bB24C24f
// yarn deploy:matic_test:GreenBTCI

// 2023/10/27: call setImageContract:  
// yarn deploy:matic:GreenBTCI

// 2023/10/27:1: 0xb5E55E38B3260f52884a8b74a86F9C9c3933717d
// call setImageContract:  Change image contract, move  all svg logic to image contract
// yarn deploy:matic_test:GreenBTCI

// 2023/10/27:2 
// call approveBuilder(USDC,USDT,ART), setImageContract, setManager, mangeARTTokens(ART)
// yarn deploy:matic:GreenBTCI

// 2023/11/08
// call setImageContract
// yarn deploy:matic_test:GreenBTCI

// 2023/11/13: Add metadata to NFT image, Green BTC -> GreenBTC, and change slogan
// call setImageContract:   0xDf51F3DCD849f116948A5B23760B1ca0B5425BdE
// yarn deploy:matic:GreenBTCI

// 2024/03/07: Restore Overtime Box List
// call restoreOvertimeBoxList: 0xDf51F3DCD849f116948A5B23760B1ca0B5425BdE
// yarn deploy:matic:GreenBTCI

// 2024/03/08: Restore OvertimeBox list by updating
// call restoreOvertimeBoxList: 0xDf51F3DCD849f116948A5B23760B1ca0B5425BdE
// yarn deploy:matic:GreenBTCI

// 2024/03/10: Set revealcap: overtimeRevealCap, normalRevealCap, removeRevealCap
// call restoreOvertimeBoxList: 0xDf51F3DCD849f116948A5B23760B1ca0B5425BdE
// yarn deploy:matic:GreenBTCI

// 2024/03/11: Set setCARTContract to HART
// call setCARTContract: 0xDf51F3DCD849f116948A5B23760B1ca0B5425BdE
// yarn deploy:matic:GreenBTCI

// 2024/03/14: Set setCARTContract to cART
// call setCARTContract: 0xDf51F3DCD849f116948A5B23760B1ca0B5425BdE
// yarn deploy:matic:GreenBTCI

// 2024/04/17: Executed on Amoy testnet: 
// Call approveBuilder(USDC，USDT,ART),setImageContract, setManager, mangeARTTokens, setLuckyRate
// Amoy testnet: 0x2Bb79dB8b6149F7499CA1bA7eeBE9E736be4dBA9
// yarn deploy:matic_test:GreenBTCI

// 2024/04/28: Executed on Amoy testnet: 
// Call setNewCap
// Amoy testnet: 0x2Bb79dB8b6149F7499CA1bA7eeBE9E736be4dBA9
// yarn deploy:matic_test:GreenBTCI

// 2024/04/28A: Executed on Amoy testnet: 
// Call setGreenBTCPro, setRatioSubsidyCap
// Amoy testnet: 0x2Bb79dB8b6149F7499CA1bA7eeBE9E736be4dBA9
// yarn deploy:matic_test:GreenBTCI

// 2024/05/06: Executed on Amoy testnet: 
// Call setImageContract
// Amoy testnet: 0x2Bb79dB8b6149F7499CA1bA7eeBE9E736be4dBA9
// yarn deploy:matic_test:GreenBTCI

func.tags = ["GreenBTCI"];

export default func;
