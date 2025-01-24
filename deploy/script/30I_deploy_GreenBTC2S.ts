
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { ethers } from "hardhat";
import { StakingRewards__factory } from "../../typechain";
import { GreenBTC2S__factory } from "../../typechain";
import { getGreenBitcoinClaimGifts, getGreenBitcoinClaimGiftsRaw  } from '../../test/utils/utilities'
import { ecsign, fromRpcSig, ecrecover } from 'ethereumjs-util'

import { BigNumber, utils } from "ethers";
import { config as dotEnvConfig } from "dotenv"
import * as fs from "fs"

interface Position { x: number, y: number, h: number, w: number }

interface DomainInfo {
  domain_id:          number
  domain_key:         string
  domain_name:        string
  domain_square:      Position
  region:             number[]
  box_price:          number
  box_top:            number
  box_prize_total:    number
  box_prize:          []
}

interface Domains { domains: DomainInfo[]}

function getDomainInfo(): Domains {
  const domainFile = './deploy/domains.json'
  const domainInfoString = fs.readFileSync(domainFile,'ascii')
  const domainInfoJson = JSON.parse(domainInfoString)
  return domainInfoJson as Domains
}

const func: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
  const [deployer, signer] = await ethers.getSigners();

  const defaultGasPrice = (hre.network.name === 'matic_test') ? BigNumber.from(32_000_000_000) : BigNumber.from(150_000_000_000)

   
  if(hre.network.name === 'matic_test') {
    // 2024/07/05
    //const GreenBTC2SAddress  = "0xf276AD41bA60e723188496318Ba0E41733C9fF3F"        // 2024/07/05: Amoy testnet: Lite Version
    const GreenBTC2SAddress  = "0x6729b2956e8Cf3d863517E4618C3d8722548D5C4"          // 2024/07/18: Amoy testnet: Change the lucky ratio handling method

    const GreenBTC2S = GreenBTC2S__factory.connect(GreenBTC2SAddress, deployer);
/*    
    // 2024/07/05: Amoy testnet
    // const domainId = 68
    // const domainInfo = "0x0303060600000bb8000f00c803e8000001f405dc000000000800000000000000"

    // 2024/07/18: Amoy testnet
    const domainId = 1

    const domainInfoJson = {
                            x: 0,  y: 320, w:  64, h: 64,
                            boxTop: 669611,
                            chance1: 655,   chance2: 655, chance3: 2621, chance4: 2621,
                            ratio1: 2621,   ratio2: 6554, ratio3: 24904, ratio4: 24905,
                            decimal: 7
                          }

    const domainInfoBigInt= BigNumber.from(domainInfoJson.x / 16).shl(248)
                              .add(BigNumber.from(domainInfoJson.y / 16).shl(240))
                              .add(BigNumber.from(domainInfoJson.w / 16).shl(232))
                              .add(BigNumber.from(domainInfoJson.h / 16).shl(224))
                              .add(BigNumber.from(domainInfoJson.boxTop).shl(192))
                              .add(BigNumber.from(domainInfoJson.chance1 - 1).shl(176))     // !!!!!!!!!!
                              .add(BigNumber.from(domainInfoJson.chance2).shl(160))
                              .add(BigNumber.from(domainInfoJson.chance3).shl(144))
                              .add(BigNumber.from(domainInfoJson.chance4).shl(128))
                              .add(BigNumber.from(domainInfoJson.ratio1).shl(112))
                              .add(BigNumber.from(domainInfoJson.ratio2).shl(96))
                              .add(BigNumber.from(domainInfoJson.ratio3).shl(80))
                              .add(BigNumber.from(domainInfoJson.ratio4).shl(64))
                              .add(BigNumber.from(domainInfoJson.decimal).shl(56))

    const domainInfo = utils.defaultAbiCoder.encode(['uint256'], [domainInfoBigInt])
    // 0x00140404000a37ab028e028f0a3d0a3d0a3d199a614861490700000000000000
    // 0x00140404000a37ab028e051d0f5a199723d43d6e9eb6ffff0700000000000000
    // 0x00 14 04 04 000a37ab 028e 028f 0a3d 0a3d 0a3d 199a 6148 6149 0700000000000000
*/

/*
    // 2024/08/29: Polygon mainnet
    const domainId = 2

    const domainInfoJson = {
                            x: 64,  y: 320, w:  64, h: 64,
                            boxTop: 671883,
                            chance1: 66,   chance2: 131, chance3: 655, chance4: 983,
                            ratio1: 1966,   ratio2: 13107, ratio3: 19661, ratio4: 28967,
                            decimal: 7
                          }

    const checkValue =  domainInfoJson.chance1 + domainInfoJson.chance2 + domainInfoJson.chance3 + domainInfoJson.chance4 +
                        domainInfoJson.ratio1 + domainInfoJson.ratio2 + domainInfoJson.ratio3 + domainInfoJson.ratio4
    if (checkValue != 65536) {
      console.log("Wrong ratio!!!!")
      return
    }

    const domainInfoBigInt= BigNumber.from(domainInfoJson.x / 16).shl(248)
                              .add(BigNumber.from(domainInfoJson.y / 16).shl(240))
                              .add(BigNumber.from(domainInfoJson.w / 16).shl(232))
                              .add(BigNumber.from(domainInfoJson.h / 16).shl(224))
                              .add(BigNumber.from(domainInfoJson.boxTop).shl(192))
                              .add(BigNumber.from(domainInfoJson.chance1 - 1).shl(176))     // !!!!!!!!!!
                              .add(BigNumber.from(domainInfoJson.chance2).shl(160))
                              .add(BigNumber.from(domainInfoJson.chance3).shl(144))
                              .add(BigNumber.from(domainInfoJson.chance4).shl(128))
                              .add(BigNumber.from(domainInfoJson.ratio1).shl(112))
                              .add(BigNumber.from(domainInfoJson.ratio2).shl(96))
                              .add(BigNumber.from(domainInfoJson.ratio3).shl(80))
                              .add(BigNumber.from(domainInfoJson.ratio4).shl(64))
                              .add(BigNumber.from(domainInfoJson.decimal).shl(56))

    const domainInfo = utils.defaultAbiCoder.encode(['uint256'], [domainInfoBigInt])
    console.log("domainInfoBigInt: ", domainInfoBigInt.toHexString(), domainInfo)
    // 0x04140404000a408b00410083028f03d707ae33334ccd71270700000000000000
    // 0x04 14 04 04 000a408b 0041 0083 028f 03d7 07ae 3333 4ccd 7127 0700000000000000

*/
    {
      const domains = getDomainInfo().domains

      const length = domains.length
      for(let index = 0; index < length; index++) {
        if (domains[index].domain_id >= 11) {
          const domainInfoJson = domains[index]
          const domainInfoJsonOld =   {
                                        chance1: 66,   chance2: 131, chance3: 655, chance4: 983,
                                        ratio1: 1966,   ratio2: 13107, ratio3: 19661, ratio4: 28967,
                                      }
          if (domainInfoJson.box_price != 10) return 

          const nodeId = BigNumber.from('0x'+domains[index].domain_name.toLocaleLowerCase()).and(BigNumber.from("0xffffff"))                                  

          const domainInfoBigInt= BigNumber.from(domainInfoJson.domain_square.x / 16).shl(248)
                  .add(BigNumber.from(domainInfoJson.domain_square.y / 16).shl(240))
                  .add(BigNumber.from(domainInfoJson.domain_square.w / 16).shl(232))
                  .add(BigNumber.from(domainInfoJson.domain_square.h / 16).shl(224))
                  .add(BigNumber.from(domainInfoJson.box_top).shl(192))
                  .add(BigNumber.from(domainInfoJsonOld.chance1 - 1).shl(176))     // !!!!!!!!!!
                  .add(BigNumber.from(domainInfoJsonOld.chance2).shl(160))
                  .add(BigNumber.from(domainInfoJsonOld.chance3).shl(144))
                  .add(BigNumber.from(domainInfoJsonOld.chance4).shl(128))
                  .add(BigNumber.from(domainInfoJsonOld.ratio1).shl(112))
                  .add(BigNumber.from(domainInfoJsonOld.ratio2).shl(96))
                  .add(BigNumber.from(domainInfoJsonOld.ratio3).shl(80))
                  .add(BigNumber.from(domainInfoJsonOld.ratio4).shl(64))
                  .add(nodeId.shl(32))
                  .add(BigNumber.from(7).shl(56))                           // 10 kWh

          const domainInfo = utils.defaultAbiCoder.encode(['uint256'], [domainInfoBigInt])
          console.log("domainInfoBigInt: ", domainInfoBigInt.toHexString(), domainInfo, nodeId.toHexString())

          const registerDomainTx = await GreenBTC2S.registerDomain(domains[index].domain_id, domainInfo, {gasPrice: defaultGasPrice})
          await registerDomainTx.wait()
      
          console.log("GreenBTC2S registerDomain: ", hre.network.name, GreenBTC2SAddress, domains[index].domain_id, domainInfo );
        }
      }
    }

/*    
    // 2025/01/06: Polygon testnet
    const domainId = 3

    const domainInfoJson = {
                            x: 384,  y: 256, w:  16, h: 16,
                            boxTop: 172584,
                            chance1: 66,   chance2: 131, chance3: 655, chance4: 983,
                            ratio1: 1966,   ratio2: 13107, ratio3: 19661, ratio4: 28967,
                            decimal: 7
                          }

    const checkValue =  domainInfoJson.chance1 + domainInfoJson.chance2 + domainInfoJson.chance3 + domainInfoJson.chance4 +
                        domainInfoJson.ratio1 + domainInfoJson.ratio2 + domainInfoJson.ratio3 + domainInfoJson.ratio4
    if (checkValue != 65536) {
      console.log("Wrong ratio!!!!")
      return
    }

    const domainInfoBigInt= BigNumber.from(domainInfoJson.x / 16).shl(248)
                              .add(BigNumber.from(domainInfoJson.y / 16).shl(240))
                              .add(BigNumber.from(domainInfoJson.w / 16).shl(232))
                              .add(BigNumber.from(domainInfoJson.h / 16).shl(224))
                              .add(BigNumber.from(domainInfoJson.boxTop).shl(192))
                              .add(BigNumber.from(domainInfoJson.chance1 - 1).shl(176))     // !!!!!!!!!!
                              .add(BigNumber.from(domainInfoJson.chance2).shl(160))
                              .add(BigNumber.from(domainInfoJson.chance3).shl(144))
                              .add(BigNumber.from(domainInfoJson.chance4).shl(128))
                              .add(BigNumber.from(domainInfoJson.ratio1).shl(112))
                              .add(BigNumber.from(domainInfoJson.ratio2).shl(96))
                              .add(BigNumber.from(domainInfoJson.ratio3).shl(80))
                              .add(BigNumber.from(domainInfoJson.ratio4).shl(64))
                              .add(BigNumber.from(domainInfoJson.decimal).shl(56))

    const domainInfo = utils.defaultAbiCoder.encode(['uint256'], [domainInfoBigInt])
    console.log("domainInfoBigInt: ", domainInfoBigInt.toHexString(), domainInfo)
    // 0x181001010002a22800410083028f03d707ae33334ccd71270700000000000000
    // 0x18 10 01 01 0002a228 0041 0083 028f 03d7 07ae 3333 4ccd 7127 0700000000000000

    const registerDomainTx = await GreenBTC2S.registerDomain(domainId, domainInfo, {gasPrice: defaultGasPrice})
    await registerDomainTx.wait()

    console.log("GreenBTC2S registerDomain: ", hre.network.name, GreenBTC2SAddress, domainId, domainInfo );
*/


//    console.log('AAAAAAAAA', deployer.address, signer.address)
//    console.log('BBBBBBBBBBB', ethers.utils.id(deployer.address +signer.address))
  }
  if(hre.network.name === 'matic') {
    // 2024/07/25
    const GreenBTC2SAddress  = "0x3221F5818A5CF99e09f5BE0E905d8F145935e3E0"           // 2024/07/25: Polygon Mainnet

    const GreenBTC2S = GreenBTC2S__factory.connect(GreenBTC2SAddress, deployer);

/*    
    // 2024/07/25: Polygon mainnet
    const domainId = 1

    const domainInfoJson = {
                            x: 0,  y: 320, w:  64, h: 64,
                            boxTop: 669611,
                            chance1: 13,   chance2: 52, chance3: 328, chance4: 655,
                            ratio1: 2621,   ratio2: 9437, ratio3: 13107, ratio4: 39323,
                            decimal: 7
                          }

    const checkValue =  domainInfoJson.chance1 + domainInfoJson.chance2 + domainInfoJson.chance3 + domainInfoJson.chance4 +
                        domainInfoJson.ratio1 + domainInfoJson.ratio2 + domainInfoJson.ratio3 + domainInfoJson.ratio4
    if (checkValue != 65536) {
      console.log("Wrong ratio!!!!")
      return
    }

    const domainInfoBigInt= BigNumber.from(domainInfoJson.x / 16).shl(248)
                              .add(BigNumber.from(domainInfoJson.y / 16).shl(240))
                              .add(BigNumber.from(domainInfoJson.w / 16).shl(232))
                              .add(BigNumber.from(domainInfoJson.h / 16).shl(224))
                              .add(BigNumber.from(domainInfoJson.boxTop).shl(192))
                              .add(BigNumber.from(domainInfoJson.chance1 - 1).shl(176))     // !!!!!!!!!!
                              .add(BigNumber.from(domainInfoJson.chance2).shl(160))
                              .add(BigNumber.from(domainInfoJson.chance3).shl(144))
                              .add(BigNumber.from(domainInfoJson.chance4).shl(128))
                              .add(BigNumber.from(domainInfoJson.ratio1).shl(112))
                              .add(BigNumber.from(domainInfoJson.ratio2).shl(96))
                              .add(BigNumber.from(domainInfoJson.ratio3).shl(80))
                              .add(BigNumber.from(domainInfoJson.ratio4).shl(64))
                              .add(BigNumber.from(domainInfoJson.decimal).shl(56))

    const domainInfo = utils.defaultAbiCoder.encode(['uint256'], [domainInfoBigInt])
    // 0x00140404000a37ab000c00340148028f0a3d24dd3333999b0700000000000000
    // 0x00 14 04 04 000a37ab 000c 0034 0148 028f 0a3d 24dd 3333 999b 0700000000000000
*/

/*
    // 2024/08/29: Polygon mainnet
    const domainId = 2

    const domainInfoJson = {
                            x: 64,  y: 320, w:  64, h: 64,
                            boxTop: 671883,
                            chance1: 66,   chance2: 131, chance3: 655, chance4: 983,
                            ratio1: 1966,   ratio2: 13107, ratio3: 19661, ratio4: 28967,
                            decimal: 7
                          }

*/

    {
      const domains = getDomainInfo().domains

      const length = domains.length
      for(let index = 0; index < length; index++) {
        if (domains[index].domain_id >= 11) {
          const domainInfoJson = domains[index]
          const domainInfoJsonOld =   {
                                        chance1: 66,   chance2: 131, chance3: 655, chance4: 983,
                                        ratio1: 1966,   ratio2: 13107, ratio3: 19661, ratio4: 28967,
                                      }
          if (domainInfoJson.box_price != 10) return 

          const nodeId = BigNumber.from('0x'+domains[index].domain_name.toLocaleLowerCase()).and(BigNumber.from("0xffffff"))                                  

          const domainInfoBigInt= BigNumber.from(domainInfoJson.domain_square.x / 16).shl(248)
                  .add(BigNumber.from(domainInfoJson.domain_square.y / 16).shl(240))
                  .add(BigNumber.from(domainInfoJson.domain_square.w / 16).shl(232))
                  .add(BigNumber.from(domainInfoJson.domain_square.h / 16).shl(224))
                  .add(BigNumber.from(domainInfoJson.box_top).shl(192))
                  .add(BigNumber.from(domainInfoJsonOld.chance1 - 1).shl(176))     // !!!!!!!!!!
                  .add(BigNumber.from(domainInfoJsonOld.chance2).shl(160))
                  .add(BigNumber.from(domainInfoJsonOld.chance3).shl(144))
                  .add(BigNumber.from(domainInfoJsonOld.chance4).shl(128))
                  .add(BigNumber.from(domainInfoJsonOld.ratio1).shl(112))
                  .add(BigNumber.from(domainInfoJsonOld.ratio2).shl(96))
                  .add(BigNumber.from(domainInfoJsonOld.ratio3).shl(80))
                  .add(BigNumber.from(domainInfoJsonOld.ratio4).shl(64))
                  .add(nodeId.shl(32))
                  .add(BigNumber.from(7).shl(56))                           // 10 kWh

          const domainInfo = utils.defaultAbiCoder.encode(['uint256'], [domainInfoBigInt])
          console.log("domainInfoBigInt: ", domainInfoBigInt.toHexString(), domainInfo, nodeId.toHexString())

          const registerDomainTx = await GreenBTC2S.registerDomain(domains[index].domain_id, domainInfo, {gasPrice: defaultGasPrice})
          await registerDomainTx.wait()
      
          console.log("GreenBTC2S registerDomain: ", hre.network.name, GreenBTC2SAddress, domains[index].domain_id, domainInfo );
        }
      }
    }

/*
    // 2025/01/07: Polygon mainnet
    const domainId = 3

    const domainInfoJson = {
                            x: 384,  y: 256, w:  16, h: 16,
                            boxTop: 172584,
                            chance1: 66,   chance2: 131, chance3: 655, chance4: 983,
                            ratio1: 1966,   ratio2: 13107, ratio3: 19661, ratio4: 28967,
                            decimal: 7
                          }

    const checkValue =  domainInfoJson.chance1 + domainInfoJson.chance2 + domainInfoJson.chance3 + domainInfoJson.chance4 +
                        domainInfoJson.ratio1 + domainInfoJson.ratio2 + domainInfoJson.ratio3 + domainInfoJson.ratio4
    if (checkValue != 65536) {
      console.log("Wrong ratio!!!!")
      return
    }

    const domainInfoBigInt= BigNumber.from(domainInfoJson.x / 16).shl(248)
                              .add(BigNumber.from(domainInfoJson.y / 16).shl(240))
                              .add(BigNumber.from(domainInfoJson.w / 16).shl(232))
                              .add(BigNumber.from(domainInfoJson.h / 16).shl(224))
                              .add(BigNumber.from(domainInfoJson.boxTop).shl(192))
                              .add(BigNumber.from(domainInfoJson.chance1 - 1).shl(176))     // !!!!!!!!!!
                              .add(BigNumber.from(domainInfoJson.chance2).shl(160))
                              .add(BigNumber.from(domainInfoJson.chance3).shl(144))
                              .add(BigNumber.from(domainInfoJson.chance4).shl(128))
                              .add(BigNumber.from(domainInfoJson.ratio1).shl(112))
                              .add(BigNumber.from(domainInfoJson.ratio2).shl(96))
                              .add(BigNumber.from(domainInfoJson.ratio3).shl(80))
                              .add(BigNumber.from(domainInfoJson.ratio4).shl(64))
                              .add(BigNumber.from(domainInfoJson.decimal).shl(56))

    const domainInfo = utils.defaultAbiCoder.encode(['uint256'], [domainInfoBigInt])
    console.log("domainInfoBigInt: ", domainInfoBigInt.toHexString(), domainInfo)
    // 0x04140404000a408b00410083028f03d707ae33334ccd71270700000000000000
    // 0x04 14 04 04 000a408b 0041 0083 028f 03d7 07ae 3333 4ccd 7127 0700000000000000

    // 0x181001010002a22800410083028f03d707ae33334ccd71270700000000000000
    // 0x18 10 01 01 0002a228 0041 0083 028f 03d7 07ae 3333 4ccd 7127 0700000000000000

    const registerDomainTx = await GreenBTC2S.registerDomain(domainId, domainInfo, {gasPrice: defaultGasPrice})
    await registerDomainTx.wait()

    console.log("GreenBTC2S registerDomain: ", hre.network.name, GreenBTC2SAddress, domainId, domainInfo );
*/    

  }
};

// 2024/07/05: Call registerDomain (Amoy testnet): 0xf276AD41bA60e723188496318Ba0E41733C9fF3F
// yarn deploy:matic_test:GreenBTC2SI
// call: registerDomain

// 2024/07/25: Call registerDomain (Polygon mainnet): 0x3221F5818A5CF99e09f5BE0E905d8F145935e3E0
// yarn deploy:matic:GreenBTC2SI
// call: registerDomain

// 2024/07/29: Call registerDomain (Amoy testnet): 0xf276AD41bA60e723188496318Ba0E41733C9fF3F
// yarn deploy:matic_test:GreenBTC2SI
// call: registerDomain

// 2024/07/29: Call registerDomain (Amoy testnet): 0x3221F5818A5CF99e09f5BE0E905d8F145935e3E0
// yarn deploy:matic:GreenBTC2SI
// call: registerDomain

// 2024/10/13: Call registerDomain (Polygon Mainnet): 
// yarn deploy:matic:GreenBTC2SI
// call: registerDomain

// 2025/01/06: Call registerDomain (Amoy testnet): 0x6729b2956e8Cf3d863517E4618C3d8722548D5C4
// yarn deploy:matic_test:GreenBTC2SI
// call: registerDomain to register domain 3

// 2025/01/07: Call registerDomain (Ploygon Mainnet): 0x3221F5818A5CF99e09f5BE0E905d8F145935e3E0
// yarn deploy:matic:GreenBTC2SI
// call: registerDomain to register domain 3

// 2025/01/18: Call registerDomain (Amoy testnet): 0x6729b2956e8Cf3d863517E4618C3d8722548D5C4
// yarn deploy:matic_test:GreenBTC2SI
// call: registerDomain to register 24 domains 

// 2025/01/21: Call registerDomain (Ploygon Mainnet): 0x3221F5818A5CF99e09f5BE0E905d8F145935e3E0
// yarn deploy:matic:GreenBTC2SI
// call: registerDomain to register 24 domains 

func.tags = ["GreenBTC2SI"];

export default func;

//https://github.com/arkreen/greenbtc-config/blob/main/domains.json
