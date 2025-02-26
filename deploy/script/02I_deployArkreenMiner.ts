import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { CONTRACTS } from "../constants";
import { BigNumber, constants } from "ethers";
import { ArkreenMiner__factory } from "../../typechain";
import { ethers } from "hardhat";

const func: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {

    const [deployer] = await ethers.getSigners();

    const defaultGasPrice = (hre.network.name === 'matic_test') ? BigNumber.from(32_000_000_000) : BigNumber.from(80_000_000_000)

    if(hre.network.name === 'matic_test')  {
      const MINER_PROXY_ADDRESS = "0xF390caaF4FF0d297e0b4C3c1527D707C75541736"       // Miner Contract on Amoy testnet

      const arkreenMiner = ArkreenMiner__factory.connect(MINER_PROXY_ADDRESS, deployer);

      // 2024/06/21, Call registerListenApps
      // registerListenApps(uint256 appid, address newApp)

/*      
      const appid1 = 3
      const stakingRewards1 = "0x1f74d233c159Eb99a81FB067076cf2C86D5a3F06"
      await arkreenMiner.registerListenApps(appid1, stakingRewards1, {gasPrice: defaultGasPrice})

      const appid2 = 4
      const stakingRewards2 = "0x09806c44a1a87A5Db3d3b21839C8eDB6049355B5"
      await arkreenMiner.registerListenApps(appid2, stakingRewards2, {gasPrice: defaultGasPrice})

      const appid3 = 5
      const stakingRewards3 = "0xDfDe48f6A4E57989c8916D9f9f467803D36E6412"
      await arkreenMiner.registerListenApps(appid3, stakingRewards3, {gasPrice: defaultGasPrice})
*/

/*
      // 2024/09/24
      const appid4 = 6
      const stakingRewards4 = "0x83A53493180677DBF298b5C9f454DED4f73FD0F1"
      await arkreenMiner.registerListenApps(appid4, stakingRewards4, {gasPrice: defaultGasPrice})

      const appid5 = 7
      const stakingRewards5 = "0xa2c7FD9d6F9fCD50000DAaC552d931E0185D3Be6"
      await arkreenMiner.registerListenApps(appid5, stakingRewards5, {gasPrice: defaultGasPrice})
*/

/*
      // 2024/09/25
      const appid4 = 6
      const stakingRewards4 = constants.AddressZero
      await arkreenMiner.registerListenApps(appid4, stakingRewards4, {gasPrice: defaultGasPrice})

      const appid5 = 7
      const stakingRewards5 = constants.AddressZero
      await arkreenMiner.registerListenApps(appid5, stakingRewards5, {gasPrice: defaultGasPrice})

      console.log("New ArkreenMiner deployed to %s:", hre.network.name, MINER_PROXY_ADDRESS, 
                    stakingRewards4, stakingRewards5);
*/
      const arkreenPromotion = "0x2C870f4e1B716788bB7e75Ae990583A801564dF0"
      await arkreenMiner.setManager(3, arkreenPromotion, {gasPrice: defaultGasPrice})

      console.log("ArkreenMiner setManager %s:", hre.network.name, MINER_PROXY_ADDRESS, arkreenPromotion)

    }
    if(hre.network.name === 'matic')  {
      const MINER_PROXY_ADDRESS = "0xbf8eF5D950F78eF8edBB8674a48cDACa675831Ae"       // Miner Contract in production env
      const NEW_IMPLEMENTATION =  "0xeCAac43Ef76a7c76613986FaaAd26707a3BFF59a"       // 2024/05/28: Upgrade to support StakingRewards (App register/listen)

      const arkreenMiner = ArkreenMiner__factory.connect(MINER_PROXY_ADDRESS, deployer);

      // 2024/05/28, Call registerListenApps
      /*      
      const appid = 1
      const stakingRewards = "0xa777d8855456eac0E3f1C64c148dabaf8e8CcC1F"

      // registerListenApps(uint256 appid, address newApp)
      await arkreenMiner.registerListenApps(appid, stakingRewards, {gasPrice: defaultGasPrice})
      */

      /*
      // 2024/06/25, Call registerListenApps
      const appid = 2
      const stakingRewards = "0xc1dCE2f17362C2De4ab4F104f6f88223e0c28B95"

      // registerListenApps(uint256 appid, address newApp)
      await arkreenMiner.registerListenApps(appid, stakingRewards, {gasPrice: defaultGasPrice})
      */

      /*
      // 2024/07/25, Call registerListenApps
      const appid3 = 3
      const stakingRewards3 = "0x0A0688fc15794035820CaDc23Db7114bAb4dE405"

      // registerListenApps(uint256 appid, address newApp)
      await arkreenMiner.registerListenApps(appid3, stakingRewards3, {gasPrice: defaultGasPrice})
      */

      /*
      // 2024/07/25, Call registerListenApps
      const appid4 = 4
      const stakingRewards4 = "0x071Bed72c917859e73f99dDa41Fb6B2Ea4C08d33"

      // registerListenApps(uint256 appid, address newApp)
      await arkreenMiner.registerListenApps(appid4, stakingRewards4, {gasPrice: defaultGasPrice})
      */
/*
      // 2024/11/26, Delete ListenApps
//      await arkreenMiner.registerListenApps(1, constants.AddressZero, {gasPrice: defaultGasPrice})
      await arkreenMiner.registerListenApps(2, constants.AddressZero, {gasPrice: defaultGasPrice})
//      await arkreenMiner.registerListenApps(3, constants.AddressZero, {gasPrice: defaultGasPrice})
//      await arkreenMiner.registerListenApps(4, constants.AddressZero, {gasPrice: defaultGasPrice})

      console.log("New ArkreenMiner deployed to %s:", hre.network.name, NEW_IMPLEMENTATION);
*/
/*
      const arkreenPromotion = "0x88D1D2Ec7544Bc3Dede2956487B1Bf28E911F13C"
      await arkreenMiner.setManager(3, arkreenPromotion, {gasPrice: defaultGasPrice})
*/
/*
      const arkreenMinerPro = "0xe440fa4480ca4bFdbFF292bb0395246F4E2f36A9"
      await arkreenMiner.setArkreenMinerPro(arkreenMinerPro, {gasPrice: defaultGasPrice})
*/
      // 2025/02/14
      //const arkreenMinerPro = "0xc6f4ee41384c4B006a5224123860dFa4a4419922"
      //await arkreenMiner.setArkreenMinerPro(arkreenMinerPro, {gasPrice: defaultGasPrice})

      // 2025/02/21
      const USDC_ADDRESS        = "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174"          // USDC address
      const USDT_ADDRESS        = "0xc2132D05D31c914a87C6611C10748AEb04B58e8F"          // USDT address
      const WNATIVE_ADDRESS     = "0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270"          // WMATIC address

      let withdrawTx1 = await arkreenMiner.withdraw(USDC_ADDRESS, {gasPrice: defaultGasPrice, nonce: 871})
      await withdrawTx1.wait()

      let withdrawTx2 = await arkreenMiner.withdraw(USDT_ADDRESS, {gasPrice: defaultGasPrice, nonce: 872})
      await withdrawTx2.wait()
      
      let withdrawTx3 = await arkreenMiner.withdraw(WNATIVE_ADDRESS, {gasPrice: defaultGasPrice, nonce: 873})
      await withdrawTx3.wait()

      console.log("ArkreenMiner withdrawed %s:", hre.network.name, MINER_PROXY_ADDRESS, USDC_ADDRESS, USDT_ADDRESS, WNATIVE_ADDRESS)

    }
};

// 2024/05/28
// yarn deploy:matic:AMinerI    : Polygon mainnet
// call registerListenApps: (1, 0xa777d8855456eac0E3f1C64c148dabaf8e8CcC1F)

// 2024/06/21
// yarn deploy:matic_test:AMinerI    : Amoy testnet: Register Proxy1, Proxy2, Proxy3
// call registerListenApps: (3, 0x1f74d233c159Eb99a81FB067076cf2C86D5a3F06)
// call registerListenApps: (4, 0x09806c44a1a87A5Db3d3b21839C8eDB6049355B5)
// call registerListenApps: (5, 0xDfDe48f6A4E57989c8916D9f9f467803D36E6412)

// 2024/06/25
// yarn deploy:matic:AMinerI    : Polygon mainnet: Register staking Proxy1
// call registerListenApps: (2, 0xc1dCE2f17362C2De4ab4F104f6f88223e0c28B95)

// 2024/07/25
// yarn deploy:matic:AMinerI    : Polygon mainnet: Register staking Proxy1
// call registerListenApps: (3, 0x0A0688fc15794035820CaDc23Db7114bAb4dE405)
// call registerListenApps: (4, 0x071Bed72c917859e73f99dDa41Fb6B2Ea4C08d33)

// 2024/09/24
// yarn deploy:matic_test:AMinerI    : Amoy testnet: Register Proxy4, Proxy5
// call registerListenApps: (6, 0x83A53493180677DBF298b5C9f454DED4f73FD0F1)
// call registerListenApps: (7, 0xa2c7FD9d6F9fCD50000DAaC552d931E0185D3Be6)

// 2024/09/25
// yarn deploy:matic_test:AMinerI    : Amoy testnet: Removing Proxy4, Proxy5
// call registerListenApps: (6, 0x83A53493180677DBF298b5C9f454DED4f73FD0F1)
// call registerListenApps: (7, 0xa2c7FD9d6F9fCD50000DAaC552d931E0185D3Be6)

// 2024/11/26
// yarn deploy:matic:AMinerI    : Polygon mainnet: Removing appid 1/2/3/4
// call registerListenApps: Remove APPID 1/2/3/4

// 2024/12/17
// yarn deploy:matic_test:AMinerI    : Amoy testnet: setManager of arkreenPromotion as authority 
// call setManager: (3, 0x2C870f4e1B716788bB7e75Ae990583A801564dF0)

// 2024/12/21
// yarn deploy:matic:AMinerI        : Polygon mainnet: Deployed on Polygon main to support withdrawing native token
// call setArkreenMinerPro: (0xe440fa4480ca4bFdbFF292bb0395246F4E2f36A9)

// 2025/02/14
// yarn deploy:matic:AMinerI        : Polygon mainnet: withdraw USDC/USDT/MATIC
// call withdraw: (USDC/USDT/MATIC) (MATIC Failed??)

// 2025/02/21
// yarn deploy:matic:AMinerI        : Polygon mainnet: withdraw USDC/USDT/MATIC
// set MinerPro to 0xc6f4ee41384c4B006a5224123860dFa4a4419922
// call withdraw: MATIC

func.tags = ["AMinerI"];

export default func;
