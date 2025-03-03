import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { CONTRACTS } from "../constants";
import { BigNumber } from "ethers";
import { ethers } from "hardhat";

import { GreenBTC2S__factory } from "../../typechain";

const func: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {

    const { deployments, getNamedAccounts } = hre;
    const { deploy } = deployments;
    const { deployer } = await getNamedAccounts();

    const defaultGasPrice = (hre.network.name === 'matic_test') ? BigNumber.from(32_000_000_000) : BigNumber.from(100_000_000_000)

    let gbtc : string = ''
    let akre: string = ''
    
    //function initialize(address gbtc, address akre)
    if(hre.network.name === 'matic_test')  {
      // 2024/10/14: fix the huge gas problem and makeGreenBoxLucky is added.
      const greenPowerAddress = "0x6729b2956e8Cf3d863517E4618C3d8722548D5C4"
      //const NEW_IMPLEMENTATION ="0xA649E9B886d2A1A1713268Ef6BC05E89A22a5436"
      //const NEW_IMPLEMENTATION ="0x9ab6a15F421FA92eE8111cD096dc37C7859Cb4c9"
      //const NEW_IMPLEMENTATION ="0xb6505E881680a45eCb0469dd8BB4b39a85105a3a"      // 2024/11/06: DomainGreenizedLucky changed
      //const NEW_IMPLEMENTATION ="0xaaD01c0431d832641708E8d288bd37e2FA91D9cD"      // 2025/01/10: Support Node feature
      //const NEW_IMPLEMENTATION ="0x138E8e06F64ef9aAd795b7bF90E04004eb5E7463"      // 2024/01/17: Change the order of Node event data  
      //const NEW_IMPLEMENTATION ="0x6645962068FCeD51bCaE0537850Bcfc442A76fd8"      // 2025/02/08: Add pixels feature
      //const NEW_IMPLEMENTATION ="0xA6219B1648Ee04F99B83253c8aC6507cfC9b215A"      // 2025/02/10: Add pixels flag
      const NEW_IMPLEMENTATION ="0x00e74f864bD9Ce0E10231F942C56C72D06397c1e"        // 2025/02/11: Add node_id checking

      console.log("Updating GreenBTC2S: ", greenPowerAddress, defaultGasPrice.toString());  

      const [deployer] = await ethers.getSigners();
 
      const GreenBTC2SFactory = GreenBTC2S__factory.connect(greenPowerAddress, deployer);

      //const callData = GreenBTC2SFactory.interface.encodeFunctionData("postUpdate")
      //const updateTx = await GreenBTC2SFactory.upgradeToAndCall(NEW_IMPLEMENTATION, callData)
      //await updateTx.wait()

      const updateTx = await GreenBTC2SFactory.upgradeTo(NEW_IMPLEMENTATION, {gasPrice: defaultGasPrice})
      await updateTx.wait()
  
      console.log("GreenBTC2S Upgraded: ", hre.network.name, GreenBTC2SFactory.address);

    } else if(hre.network.name === 'matic')  {
      // 2024/10/13: GreenBTC2S on Polygon mainnet
      const greenBTC2S = "0x3221F5818A5CF99e09f5BE0E905d8F145935e3E0"
      //const NEW_IMPLEMENTATION ="0xFaCb924cd91EA15CaD4524f52C68b91530288c4d"
      //const NEW_IMPLEMENTATION ="0x7ea0fE45cA251EB7aFe633D70361F7D5548475aB"
      //const NEW_IMPLEMENTATION ="0xa7181d53d4451973Adf130eB5a56DdA7C41B4b3D"                  // 2024/10/23
      //const NEW_IMPLEMENTATION ="0xC1C64F4e9627221deefab278107f8Ddea3B25Ab2"                  // 2024/11/13
      //const NEW_IMPLEMENTATION ="0x48DF869C1c8c1eecBFFbc6d2E62857D30bc83dAa"                  // 2024/12/12
      //const NEW_IMPLEMENTATION ="0x86F6E189EFAe31747c6e3fE8A39D323958eC2680"                  // 2024/01/15
      //const NEW_IMPLEMENTATION ="0xe1714362D4ce1412760619681e6731B71863b596"                  // 2024/01/15
      //const NEW_IMPLEMENTATION ="0x511De1993153F096eBa7651f8779a738474C91Df"                  // 2024/02/18, Add pixels feature
      const NEW_IMPLEMENTATION ="0x639f0B82Ad034aE8fA2F795d960176c1e4E2cD41"                    // 2024/02/19, add checking that Pixel domain can only call pixel ABI

      console.log("Updating GreenBTC2S: ", greenBTC2S, defaultGasPrice.toString());

      const [deployer] = await ethers.getSigners();
 
      const GreenBTC2SFactory = GreenBTC2S__factory.connect(greenBTC2S, deployer);

      //const callData = GreenBTC2SFactory.interface.encodeFunctionData("postUpdate")
      //const updateTx = await GreenBTC2SFactory.upgradeToAndCall(NEW_IMPLEMENTATION, callData)
      //await updateTx.wait()

      const updateTx = await GreenBTC2SFactory.upgradeTo(NEW_IMPLEMENTATION, {gasPrice: defaultGasPrice})
      await updateTx.wait()
  
      console.log("greenBTC2S is upgraded: ", hre.network.name, GreenBTC2SFactory.address);
    } else if(hre.network.name === 'bsc_test')  {
      // 2025/03/03: GreenBTC2S on BSC testnet
      const greenBTC2S = "0xF8bd14e5aF9177FfDB9fE903a76b684986D7FB45"
      const NEW_IMPLEMENTATION ="0x6B1Fc7b2eF80B9941A2dD90502b77733557255AB"

      const [deployer] = await ethers.getSigners();
      const GreenBTC2SFactory = GreenBTC2S__factory.connect(greenBTC2S, deployer);

      const gasPrice = await ethers.provider.getGasPrice()  

      const callData = GreenBTC2SFactory.interface.encodeFunctionData("postUpdate")
      const updateTx = await GreenBTC2SFactory.upgradeToAndCall(NEW_IMPLEMENTATION, callData, { gasPrice: gasPrice.mul(130).div(100) } )
      await updateTx.wait()

      //const updateTx = await GreenBTC2SFactory.upgradeTo(NEW_IMPLEMENTATION, {gasPrice: defaultGasPrice})
      //await updateTx.wait()

      console.log("greenBTC2S is upgraded: ", hre.network.name, GreenBTC2SFactory.address);
    } 

};

// 2024/10/13
// yarn deploy:matic:GreenBTC2SU:  Polygon mainnet
// Proxy:                 0x3221F5818A5CF99e09f5BE0E905d8F145935e3E0
// Implementaion:         0xFaCb924cd91EA15CaD4524f52C68b91530288c4d

// 2024/10/14
// yarn deploy:matic:GreenBTC2SU:  Polygon mainnet
// Proxy:                 0x3221F5818A5CF99e09f5BE0E905d8F145935e3E0
// Implementaion:         0x7ea0fE45cA251EB7aFe633D70361F7D5548475aB

// 2024/10/14
// yarn deploy:matic_test:GreenBTC2SU:  Amoy testnet
// Proxy:                 0x6729b2956e8Cf3d863517E4618C3d8722548D5C4
// Implementaion:         0xA649E9B886d2A1A1713268Ef6BC05E89A22a5436

// 2024/10/16
// yarn deploy:matic_test:GreenBTC2SU:  Amoy testnet, Support multiple seed mode 
// Proxy:                 0x6729b2956e8Cf3d863517E4618C3d8722548D5C4
// Implementaion:         0x9ab6a15F421FA92eE8111cD096dc37C7859Cb4c9

// 2024/10/23
// yarn deploy:matic:GreenBTC2SU:  Polygon mainnet, Support multiple seed mode 
// Proxy:                 0x3221F5818A5CF99e09f5BE0E905d8F145935e3E0
// Implementaion:         0xa7181d53d4451973Adf130eB5a56DdA7C41B4b3D

// 2024/11/06
// yarn deploy:matic_test:GreenBTC2SU:  Amoy testnet, DomainGreenizedLucky changed 
// Proxy:                 0x6729b2956e8Cf3d863517E4618C3d8722548D5C4
// Implementaion:         0xb6505E881680a45eCb0469dd8BB4b39a85105a3a

// 2024/11/06
// yarn deploy:matic:GreenBTC2SU:   Polygon mainnet, DomainGreenizedLucky changed 
// Proxy:                 0x3221F5818A5CF99e09f5BE0E905d8F145935e3E0
// Implementaion:         0xC1C64F4e9627221deefab278107f8Ddea3B25Ab2

// 2024/12/12
// yarn deploy:matic:GreenBTC2SU:   Polygon mainnet, remove boxSteps limitation
// Proxy:                 0x3221F5818A5CF99e09f5BE0E905d8F145935e3E0
// Implementaion:         0x48DF869C1c8c1eecBFFbc6d2E62857D30bc83dAa

// 2025/01/10
// yarn deploy:matic_test:GreenBTC2SU:  Amoy testnet, add Buy node 
// Proxy:                 0x6729b2956e8Cf3d863517E4618C3d8722548D5C4
// Implementaion:         0xaaD01c0431d832641708E8d288bd37e2FA91D9cD

// 2024/12/12
// yarn deploy:matic:GreenBTC2SU:   Polygon mainnet, add Buy node
// Proxy:                 0x3221F5818A5CF99e09f5BE0E905d8F145935e3E0
// Implementaion:         0x86F6E189EFAe31747c6e3fE8A39D323958eC2680

// 2025/01/17
// yarn deploy:matic_test:GreenBTC2SU:  Amoy testnet, change the order of Node event data  
// Proxy:                 0x6729b2956e8Cf3d863517E4618C3d8722548D5C4
// Implementaion:         0x138E8e06F64ef9aAd795b7bF90E04004eb5E7463

// 2024/01/18
// yarn deploy:matic:GreenBTC2SU:   Polygon mainnet, change the order of Node event data
// Proxy:                 0x3221F5818A5CF99e09f5BE0E905d8F145935e3E0
// Implementaion:         0xe1714362D4ce1412760619681e6731B71863b596

// 2025/02/8
// yarn deploy:matic_test:GreenBTC2SU:  Amoy testnet, Add pixels feature
// Proxy:                 0x6729b2956e8Cf3d863517E4618C3d8722548D5C4
// Implementaion:         0x6645962068FCeD51bCaE0537850Bcfc442A76fd8

// 2025/02/10
// yarn deploy:matic_test:GreenBTC2SU:  Amoy testnet, Add pixels feature
// Proxy:                 0x6729b2956e8Cf3d863517E4618C3d8722548D5C4
// Implementaion:         0xA6219B1648Ee04F99B83253c8aC6507cfC9b215A

// 2025/02/10
// yarn deploy:matic_test:GreenBTC2SU:  Amoy testnet, Add node_id checking
// Proxy:                 0x6729b2956e8Cf3d863517E4618C3d8722548D5C4
// Implementaion:         0x00e74f864bD9Ce0E10231F942C56C72D06397c1e

// 2024/01/18
// yarn deploy:matic:GreenBTC2SU:   Polygon mainnet, Add pixels feature
// Proxy:                 0x3221F5818A5CF99e09f5BE0E905d8F145935e3E0
// Implementaion:         0x511De1993153F096eBa7651f8779a738474C91Df

// 2024/01/19
// yarn deploy:matic:GreenBTC2SU:   Polygon mainnet, add checking that Pixel domain can only call pixel ABI
// Proxy:                 0x3221F5818A5CF99e09f5BE0E905d8F145935e3E0
// Implementaion:         0x639f0B82Ad034aE8fA2F795d960176c1e4E2cD41

// 2025/03/03
// yarn deploy:bsc_test:GreenBTC2SU:   bsc testnet, call postUpdate
// Proxy:                 0xF8bd14e5aF9177FfDB9fE903a76b684986D7FB45
// Implementaion:         0x6B1Fc7b2eF80B9941A2dD90502b77733557255AB

func.tags = ["GreenBTC2SU"];

export default func;
