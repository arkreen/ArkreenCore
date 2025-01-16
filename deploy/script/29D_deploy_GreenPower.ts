import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { CONTRACTS } from "../constants";
import { BigNumber } from "ethers";

import { GreenPower__factory } from "../../typechain";

const func: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {

    const { deployments, getNamedAccounts } = hre;
    const { deploy } = deployments;
    const { deployer } = await getNamedAccounts();

    const defaultGasPrice = (hre.network.name === 'matic_test') ? BigNumber.from(32_000_000_000) : BigNumber.from(35_000_000_000)

    let akre : string = ''
    let kWh : string = ''
    let manager: string = ''
    
    // function initialize(address kWh, address manager)
    if(hre.network.name === 'matic_test')  {
      // 2024/06/26: GreenPower on Amoy testnet                        
      akre = "0xd092e1f47d4e5d1C1A3958D7010005e8e9B48206"
      kWh = "0xB932CDD3c6Ad3f39d50278A76fb952A6077d1950"
      manager = "0xEe0733Aa789F70233b3eD4F7dF95f1a7e0640D7e"
    } else if(hre.network.name === 'matic')  {
      akre = ""
      kWh = ""
      manager = ""
    } 

    console.log("Deploying: ", "GreenPower", deployer);  

    const greenPower = await deploy('GreenPower', {
        from: deployer,
        args: [],
        log: true,
        skipIfAlreadyDeployed: false,
        gasPrice: defaultGasPrice
    });
  
    console.log("greenPower deployed to %s: ", hre.network.name, greenPower.address);
};

// 2024/07/11
// yarn deploy:matic_test:GreenPowerD    : Amoy testnet (Dev Anv): checkIfOffsetWon is added
// Implementaion:         0x92B3B82c322BAC3dF00F68B93C61F5B69A8dfBfa

// 2024/07/11A
// yarn deploy:matic_test:GreenPowerD    : Amoy testnet (Dev Anv): checkIfOffsetWon is fixed
// Implementaion:         0xD79601e15C761AabcfDE021Bb05e411263825E29

// 2024/07/12
// yarn deploy:matic_test:GreenPowerD    : Amoy testnet (Dev Anv): checkIfOffsetWon is changed of the return data format
// Implementaion:         0xc7A014f4b823788812A9Cd08D1c819e882b13b89

// 2024/07/12A
// yarn deploy:matic_test:GreenPowerD    : Amoy testnet (Dev Anv): checkIfOffsetWon is removed index limitation
// Implementaion:         0xb60adb684A682835819a8b4Be2dB6163dEaB393C

// 2024/08/11
// yarn deploy:matic:GreenPowerD    : Polygon mainnet: offsetPowerAgent/deposit/withdraw are added
// Implementaion:         0x325218927993688a3A423A97Dc2808C09C0D658F

// 2024/08/12
// yarn deploy:matic_test:GreenPowerD    : Amoy testnet (Dev Anv): offsetPowerAgent/deposit/withdraw are added
// Implementaion:         0x0b647B26264F9e11F9f3186A6ef0c296205Aa452

// 2024/08/12
// yarn deploy:matic:GreenPowerD    : Polygon mainnet: change effective date
// Implementaion:         0x5EaEa14E04e6AAB4Ee590B2808d0DaFECf8317A5

// 2024/08/14
// yarn deploy:matic_test:GreenPowerD    : Amoy testnet (Dev Anv): change AutoOffsetChanged event
// Implementaion:         0x1664A0dD344c00df424fe42382222948B6f0b27d

// 2024/08/14
// yarn deploy:matic:GreenPowerD          : Polygon mainnet: change AutoOffsetChanged event
// Implementaion:         0xF935F32058B3d38794C72ac31c117CF9E126e096

// 2024/08/15
// yarn deploy:matic:GreenPowerD          : Polygon mainnet: add deadline for offsetPowerAgent
// Implementaion:         0xC98C91b52D8F8b42B6895c32458578b4877a2a38

// 2024/08/15
// yarn deploy:matic_test:GreenPowerD     : Amoy testnet (Dev Anv): add deadline for offsetPowerAgent
// Implementaion:         0x70A7981b5c9ca1a4250A0C9BBDC2141752deBeeb

// 2024/08/22
// yarn deploy:matic_test:GreenPowerD     : Amoy testnet (Dev Anv): add deposit amount
// Implementaion:        0x3EB5789Ef5EAcC0dD4Bd314A88CBF34E14A23407

// 2024/08/22
// yarn deploy:matic:GreenPowerD          : Polygon mainnet: add deposit amount
// Implementaion:        0x1b05Bb1183323e91DF6D5a7D70097d8F736243cD

// 2024/08/22
// yarn deploy:matic_test:GreenPowerD     : Amoy testnet (Dev Anv): Remove upgrade timestamp
// Implementaion:        0x6c066d8Df405c5409f9264c56afDc19f355e4ec7

// 2024/08/22
// yarn deploy:matic:GreenPowerD          : Polygon mainnet: Remove upgrade timestamp
// Implementaion:        0x76A55079fAdDe2D78207A7A592D2A4BeDaD0B03c

// 2024/08/23
// yarn deploy:matic_test:GreenPowerD     : Amoy testnet (Dev Anv): fix bug in getUserInfo
// Implementaion:        0x9AfF9c1EC4EC62ac0463DdEea75A216C5c7Af708

// 2024/08/23
// yarn deploy:matic:GreenPowerD          : Polygon mainnet: fix bug in getUserInfo
// Implementaion:        0xD34C6E48A9eF73f6170Eb0939c9620d174622462

// 2024/09/24
// yarn deploy:matic:GreenPowerD          : Polygon mainnet: Allow auto-offset within 24 hours even if it is closed.
// Implementaion:        0xEaa11898B68b868579c1d6883EcDCD95cD523F3c

// 2024/09/24
// yarn deploy:matic_test:GreenPowerD     : Amoy testnet (Dev Anv): Allow auto-offset within 24 hours even if it is closed.
// Implementaion:        0x54B055F9F398C99064A1276c68962426D7ccE546

// 2025/01/07
// yarn deploy:matic_test:GreenPowerD     : Amoy testnet (Dev Anv): Support withdrawing to diffrent receiver
// Implementaion:        0x39AEeb209dd31c7Ea30E6aFD42994F75526994E5

// 2025/01/16
// yarn deploy:matic:GreenPowerD          : Polygon mainnet: Support withdrawing to diffrent receiver
// Implementaion:        0x53Db58E5588e780CFb963dAfA5F1B88F9997aFF4

func.tags = ["GreenPowerD"];

export default func;
