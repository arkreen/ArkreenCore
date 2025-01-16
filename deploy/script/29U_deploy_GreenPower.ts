import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { BigNumber } from "ethers";
import { GreenPower__factory } from "../../typechain";
import { ethers } from "hardhat";

const func: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {

    const [deployer] = await ethers.getSigners();

    const defaultGasPrice = (hre.network.name === 'matic_test') ? BigNumber.from(32_000_000_000) : BigNumber.from(50_000_000_000)

    let greenPowerAddress
    let tokenART

    let USDC_ADDRESS
    let USDT_ADDRESS
    
    if(hre.network.name === 'matic_test')  {
      // 2024/06/26: Amoy testnet                        
      greenPowerAddress                 = "0x18D14932e9444dCBc920D392cD317f5d2BB319ab"  // 06/26
      // const NEW_IMPLEMENTATION       = "0x92B3B82c322BAC3dF00F68B93C61F5B69A8dfBfa"  // 2024/07/11: Amoy testnet (Dev Anv): checkIfOffsetWon is added
      // const NEW_IMPLEMENTATION       = "0xD79601e15C761AabcfDE021Bb05e411263825E29"  // 2024/07/11: Amoy testnet (Dev Anv): checkIfOffsetWon is fixed
      // const NEW_IMPLEMENTATION       = "0xc7A014f4b823788812A9Cd08D1c819e882b13b89"  // 2024/07/12: Amoy testnet (Dev Anv): checkIfOffsetWon is changed of the return data format
      // const NEW_IMPLEMENTATION       = "0xb60adb684A682835819a8b4Be2dB6163dEaB393C"  // 2024/07/12: Amoy testnet (Dev Anv): checkIfOffsetWon is removed index limitation
      // const NEW_IMPLEMENTATION       = "0x0b647B26264F9e11F9f3186A6ef0c296205Aa452"  // 2024/08/12: Amoy testnet (Dev Anv): offsetPowerAgent/deposit/withdraw are added
      // const NEW_IMPLEMENTATION       = "0x1664A0dD344c00df424fe42382222948B6f0b27d"  // 2024/08/14: Amoy testnet (Dev Anv): change AutoOffsetChanged event
      // const NEW_IMPLEMENTATION       = "0x70A7981b5c9ca1a4250A0C9BBDC2141752deBeeb"  // 2024/08/14: Amoy testnet (Dev Anv): add deadline for offsetPowerAgent
      // const NEW_IMPLEMENTATION       = "0x3EB5789Ef5EAcC0dD4Bd314A88CBF34E14A23407"  // 2024/08/22: Amoy testnet (Dev Anv): add deposit amount
      // const NEW_IMPLEMENTATION       = "0x6c066d8Df405c5409f9264c56afDc19f355e4ec7"  // 2024/08/22: Amoy testnet (Dev Anv): remove upgrade timestamp
      // const NEW_IMPLEMENTATION       = "0x9AfF9c1EC4EC62ac0463DdEea75A216C5c7Af708"  // 2024/08/23: Amoy testnet (Dev Anv): fix bug in getUserInfo
      // const NEW_IMPLEMENTATION       = "0x54B055F9F398C99064A1276c68962426D7ccE546"  // 2024/09/24: Amoy testnet (Dev Anv): Allow auto-offset within 24 hours even if it is closed.
      const NEW_IMPLEMENTATION          = "0x39AEeb209dd31c7Ea30E6aFD42994F75526994E5"  // 2025/01/07: Amoy testnet (Dev Anv): Support withdrawing to diffrent receiver

      console.log("Updating greenPower: ", greenPowerAddress, defaultGasPrice.toString());

      const greenPowerFactory = GreenPower__factory.connect(greenPowerAddress, deployer);
      const updateTx = await greenPowerFactory.upgradeTo(NEW_IMPLEMENTATION, {gasPrice: defaultGasPrice})
      await updateTx.wait()
  
      console.log("greenPower is upgraded to %s: ", hre.network.name, greenPowerFactory.address, NEW_IMPLEMENTATION);
    } else if(hre.network.name === 'matic')  {
      // 2024/08/11: Polygon mainnet
      greenPowerAddress                 = "0x12202fDD4e3501081b346C81a64b06A689237a47"  // 08/11
      // const NEW_IMPLEMENTATION       = "0x325218927993688a3A423A97Dc2808C09C0D658F"  // 2024/08/11: offsetPowerAgent/deposit/withdraw are added
      // const NEW_IMPLEMENTATION       = "0x5EaEa14E04e6AAB4Ee590B2808d0DaFECf8317A5"  // 2024/08/12: Change Effective date
      // const NEW_IMPLEMENTATION       = "0xF935F32058B3d38794C72ac31c117CF9E126e096"  // 2024/08/14: change AutoOffsetChanged event
      // const NEW_IMPLEMENTATION       = "0xC98C91b52D8F8b42B6895c32458578b4877a2a38"  // 2024/08/15: add deadline for offsetPowerAgent
      // const NEW_IMPLEMENTATION       = "0x1b05Bb1183323e91DF6D5a7D70097d8F736243cD"  // 2024/08/22: add deposit amount
      // const NEW_IMPLEMENTATION       = "0x76A55079fAdDe2D78207A7A592D2A4BeDaD0B03c"  // 2024/08/22: remove upgrade timestamp
      // const NEW_IMPLEMENTATION       = "0xD34C6E48A9eF73f6170Eb0939c9620d174622462"  // 2024/08/23: bug in getUserInfo
      // const NEW_IMPLEMENTATION       = "0xEaa11898B68b868579c1d6883EcDCD95cD523F3c"  // 2024/08/23: Allow auto-offset within 24 hours even if it is closed.
      const NEW_IMPLEMENTATION          = "0x53Db58E5588e780CFb963dAfA5F1B88F9997aFF4"  // 2025/01/16: Support withdrawing to diffrent receiver

      console.log("Updating greenPower: ", greenPowerAddress, defaultGasPrice.toString());  

      const greenPowerFactory = GreenPower__factory.connect(greenPowerAddress, deployer);
      const updateTx = await greenPowerFactory.upgradeTo(NEW_IMPLEMENTATION, {gasPrice: defaultGasPrice})
      await updateTx.wait()
  
      console.log("greenPower is upgraded to %s: ", hre.network.name, greenPowerFactory.address, NEW_IMPLEMENTATION);
    } 

};

// 2024/07/11: upgrade:
// yarn deploy:matic_test:GreenPowerU: Amoy testnet (Dev Anv): checkIfOffsetWon is fixed

// 2024/07/11A: upgrade: , Amoy testnet (Dev Anv): checkIfOffsetWon is fixed
// yarn deploy:matic_test:GreenPowerU
// 0xD79601e15C761AabcfDE021Bb05e411263825E29

// 2024/07/12: upgrade: , Amoy testnet (Dev Anv): checkIfOffsetWon is changed of the return data format
// and checkIfOffsetWonBytes is added.
// yarn deploy:matic_test:GreenPowerU
// 0xc7A014f4b823788812A9Cd08D1c819e882b13b89

// 2024/07/12A: upgrade: , Amoy testnet (Dev Anv): checkIfOffsetWon is removed index limitation
// yarn deploy:matic_test:GreenPowerU
// 0xb60adb684A682835819a8b4Be2dB6163dEaB393C

// 2024/08/11: upgrade:  Polygon mainnet: offsetPowerAgent/deposit/withdraw are added
// yarn deploy:matic:GreenPowerU
// 0x325218927993688a3A423A97Dc2808C09C0D658F

// 2024/08/12: upgrade:  Amoy testnet: offsetPowerAgent/deposit/withdraw are added
// yarn deploy:matic_test:GreenPowerU
// 0x0b647B26264F9e11F9f3186A6ef0c296205Aa452

// 2024/08/12: upgrade:  Polygon mainnet: change effective date
// yarn deploy:matic:GreenPowerU
// 0x5EaEa14E04e6AAB4Ee590B2808d0DaFECf8317A5

// 2024/08/14: upgrade:  Amoy testnet: change AutoOffsetChanged event
// yarn deploy:matic_test:GreenPowerU
// 0x1664A0dD344c00df424fe42382222948B6f0b27d

// 2024/08/14: upgrade:  Polygon mainnet: change AutoOffsetChanged event
// yarn deploy:matic:GreenPowerU
// 0xF935F32058B3d38794C72ac31c117CF9E126e096

// 2024/08/15: upgrade:  Polygon mainnet: add deadline for offsetPowerAgent
// yarn deploy:matic:GreenPowerU
// 0xC98C91b52D8F8b42B6895c32458578b4877a2a38

// 2024/08/15: upgrade:  Amoy testnet: add deadline for offsetPowerAgent
// yarn deploy:matic_test:GreenPowerU
// 0x70A7981b5c9ca1a4250A0C9BBDC2141752deBeeb

// 2024/08/22: upgrade:  Amoy testnet: add deposit amount
// yarn deploy:matic_test:GreenPowerU
// 0x3EB5789Ef5EAcC0dD4Bd314A88CBF34E14A23407

// 2024/08/22: upgrade:  Polygon mainnet: add deposit amount
// yarn deploy:matic:GreenPowerU
// 0x1b05Bb1183323e91DF6D5a7D70097d8F736243cD

// 2024/08/22: upgrade:  Amoy testnet: remove upgrade timestamp
// yarn deploy:matic_test:GreenPowerU
// 0x6c066d8Df405c5409f9264c56afDc19f355e4ec7

// 2024/08/22: upgrade:  Polygon mainnet: remove upgrade timestamp
// yarn deploy:matic:GreenPowerU
// 0x76A55079fAdDe2D78207A7A592D2A4BeDaD0B03c

// 2024/08/23: upgrade:  Amoy testnet: fix bug in getUserInfo
// yarn deploy:matic_test:GreenPowerU
// 0x9AfF9c1EC4EC62ac0463DdEea75A216C5c7Af708

// 2024/08/23: upgrade:  Polygon mainnet: fix bug in getUserInfo
// yarn deploy:matic:GreenPowerU
// 0xD34C6E48A9eF73f6170Eb0939c9620d174622462

// 2024/09/24: upgrade:  Allow auto-offset within 24 hours even if it is closed.
// yarn deploy:matic_test:GreenPowerU
// 0x54B055F9F398C99064A1276c68962426D7ccE546

// 2024/09/24: upgrade:  Allow auto-offset within 24 hours even if it is closed.
// yarn deploy:matic:GreenPowerU
// 0xEaa11898B68b868579c1d6883EcDCD95cD523F3c

// 2025/01/07: upgrade:  Support withdrawing to diffrent receiver
// yarn deploy:matic_test:GreenPowerU
// 0x39AEeb209dd31c7Ea30E6aFD42994F75526994E5

// 2025/01/16: upgrade:  Support withdrawing to diffrent receiver
// yarn deploy:matic:GreenPowerU
// 0x53Db58E5588e780CFb963dAfA5F1B88F9997aFF4

func.tags = ["GreenPowerU"];

export default func;