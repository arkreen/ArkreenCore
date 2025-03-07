import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { CONTRACTS } from "../constants";
import { BigNumber } from "ethers";
import { KWhToken__factory } from "../../typechain";
import { ArkreenRECToken__factory } from "../../typechain";
import { ethers } from "hardhat";

const func: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {

    const [deployer] = await ethers.getSigners();

    const defaultGasPrice = (hre.network.name === 'matic_test') ? BigNumber.from(32_000_000_000) : BigNumber.from(50_000_000_000)

    let kWhTokenAddress
    let beneficiary
    let tokenART
    let artBank
    let arkreenBuilder
    let offsetManager

    let USDC_ADDRESS
    let USDT_ADDRESS
    let WNATIVE_ADDRESS
    let AKRE_ADDRESS

    let ART_PRICE
    let USDC_PRICE
    let USDT_PRICE
    
    if(hre.network.name === 'matic_test')  {
      // 2024/05/20: Amoy testnet                        
      // kWhTokenAddress   = "0x3B109eA4298870D8dEF8b512444A58Dac909b23f"             // Amoy testnet
      kWhTokenAddress   = "0xB932CDD3c6Ad3f39d50278A76fb952A6077d1950"                // 06/12: Amoy testnet, Add Burn

      tokenART          = "0x615835Cc22064a17df5A3E8AE22F58e67bCcB778"                // Amoy testnet

      USDC_ADDRESS    = "0x41e94eb019c0762f9bfcf9fb1e58725bfb0e7582"                  // USDC address
      USDT_ADDRESS    = "0xc7767ae828E4830e2f800981E573f333d1E492b5"                  // USDT address
      WNATIVE_ADDRESS = "0x0ae690aad8663aab12a671a6a0d74242332de85f"                  // WMATIC address
      AKRE_ADDRESS    = "0xd092e1f47d4e5d1C1A3958D7010005e8e9B48206"                  // AKRE address

      ART_PRICE       = BigNumber.from(1).mul(BigNumber.from(10).pow(6))        // 0.001ART, 0.001*10**9
      USDC_PRICE      = BigNumber.from(2).mul(BigNumber.from(10).pow(1))        // 0.02 USDC, 10**6
      USDT_PRICE      = BigNumber.from(10).mul(BigNumber.from(10).pow(3))       // 10 USDT, 10**6
      
      // beneficiary    = "0x364a71eE7a1C9EB295a4F4850971a1861E9d3c7D"              // Amoy testnet // 2024/05/20, 1st version
      beneficiary       = "0x20E45e53B813788C2D169D3D861A4C0Ae3bDD4eA"              // Amoy testnet, add burn ABI
      
      const KWhToken = KWhToken__factory.connect(kWhTokenAddress, deployer);
/*      
      // 2024/05/20: Amoy testnet;   2024/06/13A:                      
      const badgeInfo =  {
        beneficiary:      beneficiary,
        offsetEntityID:   'GreenBTC Club',
        beneficiaryID:    'GreenBTC Club DAO',
        offsetMessage:    "Offset ART to mint equivalent kWh ERC20 token for Green BTC Dapp"
      }    

      await KWhToken.setBadgeInfo( badgeInfo, {gasPrice: defaultGasPrice})

      console.log("Mint KWh with ART", balanceART.toString(), balancekWh.toString(), badgeInfo)
      
      // 2024/05/20, 2024/06/13A: Amoy testnet                        
      await KWhToken.approveBank( [tokenART, USDC_ADDRESS, USDT_ADDRESS], {gasPrice: defaultGasPrice})

      // 2024/05/20, 2024/06/13A: Amoy testnet
      // ************* Must upgrade bank contract first ****************
      await KWhToken.changeSwapPrice( tokenART, ART_PRICE, {gasPrice: defaultGasPrice})
      await KWhToken.changeSwapPrice( USDC_ADDRESS, USDC_PRICE, {gasPrice: defaultGasPrice})
      await KWhToken.changeSwapPrice( USDT_ADDRESS, USDT_PRICE, {gasPrice: defaultGasPrice})
*/      

      // ************* Must upgrade bank contract first ****************
      // 2024/05/20, 2024/06/13B: Amoy testnet
      const ART = ArkreenRECToken__factory.connect(tokenART, deployer);
      const balanceART = await ART.balanceOf(kWhTokenAddress)
      await KWhToken.MintKWh( tokenART, balanceART, {gasPrice: defaultGasPrice})
      const balancekWh = await KWhToken.balanceOf(kWhTokenAddress)
      console.log("Mint KWh with ART", balanceART.toString(), balancekWh.toString())

      const amountUSDC =  BigNumber.from(2).mul(BigNumber.from(10).pow(6))        //2 USDC
      await KWhToken.MintKWh( USDC_ADDRESS, amountUSDC, {gasPrice: defaultGasPrice})

      const amountUSDT =  BigNumber.from(10000).mul(BigNumber.from(10).pow(6))    //10000 USDT
      await KWhToken.MintKWh( USDT_ADDRESS, amountUSDT, {gasPrice: defaultGasPrice})

      const balancekWhAfter = await KWhToken.balanceOf(kWhTokenAddress)
      console.log("Mint KWh with ART", balancekWhAfter.toString())
      
    } else if(hre.network.name === 'matic')  {
      kWhTokenAddress   = "0x5740A27990d4AaA4FB83044a6C699D435B9BA6F1"            // 07/14: Polygon miannet

      tokenART          = "0x58E4D14ccddD1E993e6368A8c5EAa290C95caFDF"            // Polygon testnet
      USDC_ADDRESS      = "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174"            // USDC address
      USDT_ADDRESS      = "0xc2132D05D31c914a87C6611C10748AEb04B58e8F"            // USDT address
      WNATIVE_ADDRESS   = "0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270"            // WMATIC address
      AKRE_ADDRESS      = "0xE9c21De62C5C5d0cEAcCe2762bF655AfDcEB7ab3"            // AKRE address

      ART_PRICE       = BigNumber.from(1).mul(BigNumber.from(10).pow(6))          // 1kWh = 0.001ART = 0.001*10**9 = 10**6
      USDC_PRICE      = BigNumber.from(10).mul(BigNumber.from(10).pow(3))         // 1kWh = 0.001ART = 0.01 USDC = 10**4 (10USDC/ART)
      USDT_PRICE      = BigNumber.from(10).mul(BigNumber.from(10).pow(3))         // 1kWh = 0.001ART = 0.01 USDT = 10**4 (10USDT/ART)

      beneficiary       = "0xF6f06651fA233247E793689AA710888884FCdebf"            // Polygon miannet
      
      const KWhToken = KWhToken__factory.connect(kWhTokenAddress, deployer);
  
      /*
      // 2024/07/14: Polygon mainnet                   
      const badgeInfo =  {
        beneficiary:      beneficiary,
        offsetEntityID:   'Arkreen Network',
        beneficiaryID:    'Arkreen Community',
        offsetMessage:    "Offset ART to mint equivalent kWh ERC20 token for all the Arkreen community members and applications"
      }    

      const setBadgeInfoTx = await KWhToken.setBadgeInfo( badgeInfo, {gasPrice: defaultGasPrice})
      await setBadgeInfoTx.wait()
      */

      //console.log("Mint KWh with ART", balanceART.toString(), balancekWh.toString(), badgeInfo)
      
      // 2024/07/14
      const approveBankTx = await KWhToken.approveBank( [tokenART, USDC_ADDRESS, USDT_ADDRESS], {gasPrice: defaultGasPrice})
      await approveBankTx.wait()

      // 2024/07/14
      // ************* Must upgrade bank contract first ****************
      const changeSwapPrice1 = await KWhToken.changeSwapPrice( tokenART, ART_PRICE, {gasPrice: defaultGasPrice})
      await changeSwapPrice1.wait()

      const changeSwapPrice2 = await KWhToken.changeSwapPrice( USDC_ADDRESS, USDC_PRICE, {gasPrice: defaultGasPrice})
      await changeSwapPrice2.wait()
      
      const changeSwapPrice3 = await KWhToken.changeSwapPrice( USDT_ADDRESS, USDT_PRICE, {gasPrice: defaultGasPrice})  
      await changeSwapPrice3.wait()    
    } else if(hre.network.name === 'bsc_test')  {
      // 2025/03/02: BSC testnet                        
      kWhTokenAddress   = "0xb50663a9848a8cda219756488406cca19f8b2f28"                

      tokenART          = "0x615835Cc22064a17df5A3E8AE22F58e67bCcB778"                // Amoy testnet
      USDC_ADDRESS      = "0x64544969ed7ebf5f083679233325356ebe738930"                // USDC address
      USDT_ADDRESS      = "0x93eFC409Ff44788E8b1DAF395F46965046cAe84B"                // USDT address

      USDC_PRICE      = BigNumber.from(2).mul(BigNumber.from(10).pow(1))            // 0.02 USDC, 10**6
      USDT_PRICE      = BigNumber.from(10).mul(BigNumber.from(10).pow(3))           // 10 USDT, 10**6
      
      const KWhToken = KWhToken__factory.connect(kWhTokenAddress, deployer);

      // 2025/03/02
      //await KWhToken.changeSwapPrice( tokenART, ART_PRICE, {gasPrice: defaultGasPrice})
      await KWhToken.changeSwapPrice( USDC_ADDRESS, USDC_PRICE, {gasPrice: defaultGasPrice})
      await KWhToken.changeSwapPrice( USDT_ADDRESS, USDT_PRICE, {gasPrice: defaultGasPrice})
      
    } else if(hre.network.name === 'celo_test')  {
      // 2025/03/06: Celo testnet                        
      kWhTokenAddress   = "0x0a9E5889f0bd049583093a31E375Fd15427F8773"                

      tokenART          = "0x57Fe6324538CeDd43D78C975118Ecf8c137fC8B2"                // Celo testnet
      USDC_ADDRESS      = "0x2f25deb3848c207fc8e0c34035b3ba7fc157602b"                // USDC address
      USDT_ADDRESS      = "0xf66fc9b248D2C97Fb28954c476E6E3964aB0275D"                // USDT address

      ART_PRICE       = BigNumber.from(1).mul(BigNumber.from(10).pow(6))            // 1kWh = 0.001ART = 0.001*10**9 = 10**6
      USDC_PRICE      = BigNumber.from(2).mul(BigNumber.from(10).pow(1))            // 0.02 USDC, 10**6
      USDT_PRICE      = BigNumber.from(10).mul(BigNumber.from(10).pow(3))           // 10 USDT, 10**6
      
      const KWhToken = KWhToken__factory.connect(kWhTokenAddress, deployer);

      // 2025/03/06
      await KWhToken.changeSwapPrice( tokenART, ART_PRICE, {gasPrice: defaultGasPrice})
      await KWhToken.changeSwapPrice( USDC_ADDRESS, USDC_PRICE, {gasPrice: defaultGasPrice})
      await KWhToken.changeSwapPrice( USDT_ADDRESS, USDT_PRICE, {gasPrice: defaultGasPrice})
    } else if(hre.network.name === 'hashkey_test')  {
      // 2025/03/07: Hashkey testnet                        
      kWhTokenAddress   = "0x207678fae50E34Ea254eC16B532c381445B22419"                

      tokenART          = "0x57Fe6324538CeDd43D78C975118Ecf8c137fC8B2"                // Celo testnet
      USDC_ADDRESS      = "0x7D94aeE379D083eA8027318a804e289e36638DEF"                // USDC address
      USDT_ADDRESS      = "0x5126268e5123036C56abC5ffBEBc69c08086B90a"                // USDT address

      ART_PRICE       = BigNumber.from(1).mul(BigNumber.from(10).pow(6))            // 1kWh = 0.001ART = 0.001*10**9 = 10**6
      USDC_PRICE      = BigNumber.from(2).mul(BigNumber.from(10).pow(1))            // 0.02 USDC, 10**6
      USDT_PRICE      = BigNumber.from(10).mul(BigNumber.from(10).pow(3))           // 10 USDT, 10**6
      
      const KWhToken = KWhToken__factory.connect(kWhTokenAddress, deployer);

      // 2025/03/06
//    await KWhToken.changeSwapPrice( tokenART, ART_PRICE, {gasPrice: defaultGasPrice})
      await KWhToken.changeSwapPrice( USDC_ADDRESS, USDC_PRICE, {gasPrice: defaultGasPrice})
      await KWhToken.changeSwapPrice( USDT_ADDRESS, USDT_PRICE, {gasPrice: defaultGasPrice})
    }

};

// 2024/05/20A: Call setBadgeInfo, MintKWh (ART)
// yarn deploy:matic_test:WKHI    : Amoy testnet (Dev Anv)

// 2024/05/20B: Call approveBank, MintKWh
// yarn deploy:matic_test:WKHI    : Amoy testnet (Dev Anv)

// 2024/05/20C: Call changeSwapPrice (ART/USDC/USDT)
// yarn deploy:matic_test:WKHI    : Amoy testnet (Dev Anv)

// 2024/05/20D: Call MintKWh (USDC/USDT)
// yarn deploy:matic_test:WKHI    : Amoy testnet (Dev Anv)

// 2024/05/20E: Call changeSwapPrice (ART/USDC/USDT)
// yarn deploy:matic_test:WKHI    : Amoy testnet (Dev Anv)

// 2024/06/13A: Call setBadgeInfo, approveBank, changeSwapPrice (ART/USDC/USDT)
// yarn deploy:matic_test:WKHI    : Amoy testnet (Dev Anv)

// 2024/06/13B: Call MintKWh (ART/USDC/USDT)
// yarn deploy:matic_test:WKHI    : Amoy testnet (Dev Anv)

// 2024/07/14: Call setBadgeInfo, approveBank, changeSwapPrice (tokenART, USDC_ADDRESS, USDT_ADDRESS)
// yarn deploy:matic:WKHI     : Ploygon mainnet

// 2025/03/02: Call changeSwapPrice (USDC_ADDRESS, USDT_ADDRESS)
// yarn deploy:bsc_test:WKHI     : BSC testnet

// 2025/03/06: Call changeSwapPrice (tokenART, USDC_ADDRESS, USDT_ADDRESS)
// yarn deploy:celo_test:WKHI     : BSC testnet

// 2025/03/07: Call changeSwapPrice (USDC_ADDRESS, USDT_ADDRESS)
// yarn deploy:hashkey_test:WKHI     : HashKey testnet

func.tags = ["WKHI"];

export default func;
