
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { ethers } from "hardhat";
import { StakingRewards__factory } from "../../typechain";
import { GreenBTC2S__factory } from "../../typechain";
import { getGreenBitcoinClaimGifts, getGreenBitcoinClaimGiftsRaw, expandTo6Decimals, getGreenBTC2SBuyNodeDigest } from '../../test/utils/utilities'
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

  const defaultGasPrice = (hre.network.name === 'matic_test') ? BigNumber.from(32_000_000_000) : BigNumber.from(32_000_000_000)

   
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
/*
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
*/
    // 2025/02/11: Polygon Amoy test
    const domainId = 35

    const domainInfoJson = {
                            x: 256,  y: 320, w:  16, h: 16,
                            boxTop: 36220,
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

    const nodeId = BigNumber.from('0x12CAA'.toLocaleLowerCase()).and(BigNumber.from("0xffffff"))

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
                              .add(BigNumber.from(domainInfoJson.decimal + 128).shl(56))    // Pixel
                              .add(nodeId.shl(32))

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
*/                              
    const domainInfo = utils.defaultAbiCoder.encode(['uint256'], [domainInfoBigInt])
    console.log("domainInfoBigInt: ", domainInfoBigInt.toHexString(), domainInfo)
    // 0x181001010002a22800410083028f03d707ae33334ccd71270700000000000000
    // 0x18 10 01 01 0002a228 0041 0083 028f 03d7 07ae 3333 4ccd 7127 0700000000000000

    const registerDomainTx = await GreenBTC2S.registerDomain(domainId, domainInfo, {gasPrice: defaultGasPrice})
    await registerDomainTx.wait()

    console.log("GreenBTC2S registerDomain: ", hre.network.name, GreenBTC2SAddress, domainId, domainInfo );

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
/*
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
*/

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
*/

    // 2025/02/11: Polygon mainnet
/*    
    const domainId = 35
    const domainInfoJson = {
                            x: 384,  y: 320, w:  16, h: 16,
                            boxTop: 36220,
                            chance1: 66,   chance2: 131, chance3: 655, chance4: 983,
                            ratio1: 1966,   ratio2: 13107, ratio3: 19661, ratio4: 28967,
                            decimal: 7
                          }
    const nodeId = BigNumber.from('0x12CAA'.toLocaleLowerCase()).and(BigNumber.from("0xffffff"))
*/

/*
    const domainId = 67
    const domainInfoJson = {
                            x: 256,  y: 320, w:  16, h: 16,
                            boxTop: 36332,
                            chance1: 66,   chance2: 131, chance3: 655, chance4: 983,
                            ratio1: 1966,   ratio2: 13107, ratio3: 19661, ratio4: 28967,
                            decimal: 7
                          }
    const nodeId = BigNumber.from('0x11CAA'.toLocaleLowerCase()).and(BigNumber.from("0xffffff"))
  
    const domainId = 68
    const domainInfoJson = {
                            x: 272,  y: 320, w:  16, h: 16,
                            boxTop: 36603,
                            chance1: 66,   chance2: 131, chance3: 655, chance4: 983,
                            ratio1: 1966,   ratio2: 13107, ratio3: 19661, ratio4: 28967,
                            decimal: 7
                          }
    const nodeId = BigNumber.from('0x11CAB'.toLocaleLowerCase()).and(BigNumber.from("0xffffff"))
*/
    const domainId = 69
    const domainInfoJson = {
                            x: 288,  y: 320, w:  16, h: 16,
                            boxTop: 36790,
                            chance1: 66,   chance2: 131, chance3: 655, chance4: 983,
                            ratio1: 1966,   ratio2: 13107, ratio3: 19661, ratio4: 28967,
                            decimal: 7
                          }
    const nodeId = BigNumber.from('0x11CBA'.toLocaleLowerCase()).and(BigNumber.from("0xffffff"))
    
/*
    const domainId = 70
    const domainInfoJson = {
                            x: 304,  y: 320, w:  16, h: 16,
                            boxTop: 36381,
                            chance1: 66,   chance2: 131, chance3: 655, chance4: 983,
                            ratio1: 1966,   ratio2: 13107, ratio3: 19661, ratio4: 28967,
                            decimal: 7
                          }
    const nodeId = BigNumber.from('0x11CBB'.toLocaleLowerCase()).and(BigNumber.from("0xffffff"))
*/
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
                              .add(BigNumber.from(domainInfoJson.decimal + 128).shl(56))
                              .add(nodeId.shl(32))

    const domainInfo = utils.defaultAbiCoder.encode(['uint256'], [domainInfoBigInt])
    console.log("domainInfoBigInt: ", domainInfoBigInt.toHexString(), domainInfo)
    // 0x04140404000a408b00410083028f03d707ae33334ccd71270700000000000000
    // 0x04 14 04 04 000a408b 0041 0083 028f 03d7 07ae 3333 4ccd 7127 0700000000000000

    // 0x181001010002a22800410083028f03d707ae33334ccd71270700000000000000
    // 0x18 10 01 01 0002a228 0041 0083 028f 03d7 07ae 3333 4ccd 7127 0700000000000000

    const gasPrice = await ethers.provider.getGasPrice()  
    const registerDomainTx = await GreenBTC2S.registerDomain(domainId, domainInfo, {gasPrice: gasPrice.mul(130).div(100)})
    await registerDomainTx.wait()

    console.log("GreenBTC2S registerDomain: ", hre.network.name, GreenBTC2SAddress, domainId, domainInfo );    

  }

  if(hre.network.name === 'bsc_test') {
    // 2025/03/03
    const GreenBTC2SAddress  = "0xF8bd14e5aF9177FfDB9fE903a76b684986D7FB45"           // 2025/03/03: BSC Test

    const GreenBTC2S = GreenBTC2S__factory.connect(GreenBTC2SAddress, deployer);

    // 2025/03/03: Polygon mainnet
/*
    const domainId = 131
    const domainInfoJson = {
                            x: 0,  y: 448, w:  16, h: 16,
                            boxTop: 248286,
                            chance1: 66,   chance2: 131, chance3: 655, chance4: 983,
                            ratio1: 1966,   ratio2: 13107, ratio3: 19661, ratio4: 28967,
                            decimal: 7
                          }
    const nodeId = BigNumber.from('0x13CAA'.toLocaleLowerCase()).and(BigNumber.from("0xffffff"))
*/    
    const domainId = 132
    const domainInfoJson = {
                            x: 16,  y: 448, w:  16, h: 16,
                            boxTop: 247006,
                            chance1: 66,   chance2: 131, chance3: 655, chance4: 983,
                            ratio1: 1966,   ratio2: 13107, ratio3: 19661, ratio4: 28967,
                            decimal: 7
                          }
    const nodeId = BigNumber.from('0x13CAB'.toLocaleLowerCase()).and(BigNumber.from("0xffffff"))

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
//                            .add(BigNumber.from(domainInfoJson.decimal + 128).shl(56))    // Pixel flag
                              .add(BigNumber.from(domainInfoJson.decimal).shl(56))          // Pixel flag !!!!!!!!!
                              .add(nodeId.shl(32))

    const domainInfo = utils.defaultAbiCoder.encode(['uint256'], [domainInfoBigInt])
    console.log("domainInfoBigInt: ", domainInfoBigInt.toHexString(), domainInfo)
    // 0x001c01010003c9de00410083028f03d707ae33334ccd712787013caa00000000

    const gasPrice = await ethers.provider.getGasPrice()  
    const registerDomainTx = await GreenBTC2S.registerDomain(domainId, domainInfo, {gasPrice: gasPrice.mul(130).div(100)})
    await registerDomainTx.wait()

    console.log("GreenBTC2S registerDomain: ", hre.network.name, GreenBTC2SAddress, domainId, domainInfo );  

    /*
    131:  0x13CAA	2482860	BNB
    132:  0x13CAB	2470060	BNB
    133:  0x13CBA	2450430	BNB
    134:  0x13CBB	2468310	BNB
    135:  0x13DAA	2446880	Hashkey
    136:  0x13DAB	2446880	Hashkey
    137:  0x13DBA	2439640	Hashkey
    138:  0x13DBB	2423070	Hashkey
    */
/*    
    {
        // const nodeId = BigNumber.from('0x13CAA'.toLocaleLowerCase()).and(BigNumber.from("0xffffff"))
        // const percentage = BigNumber.from(20)
        // const amountEnergy = expandTo6Decimals(248286 * 2)

        const nodeId = BigNumber.from('0x13CAB'.toLocaleLowerCase()).and(BigNumber.from("0xffffff"))
        const percentage = BigNumber.from(20)
        const amountEnergy = expandTo6Decimals(247006 * 2)

        const chainId = 97
        console.log("deployer, signer", deployer.address, signer.address, nodeId.toHexString())

        const privateKeyManager = process.env.BSC_TESTNET_PRIVATE_KEY as string

        const digest = getGreenBTC2SBuyNodeDigest(
          'Green BTC Club',
          GreenBTC2SAddress,
          signer.address, nodeId, percentage, amountEnergy,
          chainId
        )

        const {v,r,s} = ecsign(Buffer.from(digest.slice(2), 'hex'), Buffer.from(privateKeyManager.slice(2), 'hex'))   

        const gasPrice = await ethers.provider.getGasPrice()  
//      const buyNodeTx = await GreenBTC2S!.connect(signer).callStatic['buyNode'](nodeId, percentage, amountEnergy, {v,r,s}, {gasPrice: gasPrice})
//      console.log("ART airdrop: ", buyNodeTx)

        let buyNodeTx = await GreenBTC2S.connect(signer).buyNode(nodeId, percentage, amountEnergy, {v,r,s}, {gasPrice: gasPrice.mul(130).div(100)})
        const receipt = await buyNodeTx.wait()
        console.log('buyNode gas usage:', receipt.gasUsed )

    }
 */
    
  }

  if(hre.network.name === 'celo_test') {
    // 2025/03/06
    const GreenBTC2SAddress  = "0x64acd7936e7e0BCFa9629dD2Ed2bf45e57CBbB3D"           // 2025/03/06: Celo Test
    const GreenBTC2S = GreenBTC2S__factory.connect(GreenBTC2SAddress, deployer);

    // 2025/03/03: Polygon mainnet
/*
    const domainId = 103
    const domainInfoJson = {
                            x: 0,  y: 384, w:  16, h: 16,
                            boxTop: 70234,
                            chance1: 66,   chance2: 131, chance3: 655, chance4: 983,
                            ratio1: 1966,   ratio2: 13107, ratio3: 19661, ratio4: 28967,
                            decimal: 7
                          }
    const nodeId = BigNumber.from('0x13BAA'.toLocaleLowerCase()).and(BigNumber.from("0xffffff"))
*/   

    const domainId = 104
    const domainInfoJson = {
                            x: 16,  y: 384, w:  16, h: 16,
                            boxTop: 70383,
                            chance1: 66,   chance2: 131, chance3: 655, chance4: 983,
                            ratio1: 1966,   ratio2: 13107, ratio3: 19661, ratio4: 28967,
                            decimal: 7
                          }
    const nodeId = BigNumber.from('0x13BAB'.toLocaleLowerCase()).and(BigNumber.from("0xffffff"))

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
//                            .add(BigNumber.from(domainInfoJson.decimal + 128).shl(56))    // Pixel flag
                              .add(BigNumber.from(domainInfoJson.decimal).shl(56))          // Pixel flag !!!!!!!!!
                              .add(nodeId.shl(32))

    const domainInfo = utils.defaultAbiCoder.encode(['uint256'], [domainInfoBigInt])
    console.log("domainInfoBigInt: ", domainInfoBigInt.toHexString(), domainInfo)
    // 0x001801010001125a00410083028f03d707ae33334ccd712707013baa00000000

    const gasPrice = await ethers.provider.getGasPrice()  
    const registerDomainTx = await GreenBTC2S.registerDomain(domainId, domainInfo, {gasPrice: gasPrice.mul(130).div(100)})
    await registerDomainTx.wait()

    console.log("GreenBTC2S registerDomain: ", hre.network.name, GreenBTC2SAddress, domainId, domainInfo );  

    /*
    131:  0x13BAA	702340	Celo
    132:  0x13BAB	703830	Celo
    133:  0x13BBA	712130	Celo
    134:  0x13BBB	711080	Celo
    */

/*    
    {

        // const nodeId = BigNumber.from('0x13BAA'.toLocaleLowerCase()).and(BigNumber.from("0xffffff"))
        // const percentage = BigNumber.from(20)
        // const amountEnergy = expandTo6Decimals(70234 * 2)
        
        const nodeId = BigNumber.from('0x13BAB'.toLocaleLowerCase()).and(BigNumber.from("0xffffff"))
        const percentage = BigNumber.from(20)
        const amountEnergy = expandTo6Decimals(70383 * 2)

        const chainId = 44787
        console.log("deployer, signer", deployer.address, signer.address, nodeId.toHexString())

        const privateKeyManager = process.env.BSC_TESTNET_PRIVATE_KEY as string

        const digest = getGreenBTC2SBuyNodeDigest(
          'Green BTC Club',
          GreenBTC2SAddress,
          signer.address, nodeId, percentage, amountEnergy,
          chainId
        )

        const {v,r,s} = ecsign(Buffer.from(digest.slice(2), 'hex'), Buffer.from(privateKeyManager.slice(2), 'hex'))   

        const gasPrice = await ethers.provider.getGasPrice()  
//      const buyNodeTx = await GreenBTC2S!.connect(signer).callStatic['buyNode'](nodeId, percentage, amountEnergy, {v,r,s}, {gasPrice: gasPrice})
//      console.log("ART airdrop: ", buyNodeTx)

        let buyNodeTx = await GreenBTC2S.connect(signer).buyNode(nodeId, percentage, amountEnergy, {v,r,s}, {gasPrice: gasPrice.mul(130).div(100)})
        const receipt = await buyNodeTx.wait()
        console.log('buyNode gas usage:', receipt.gasUsed )

    }
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

// 2025/02/11: Call registerDomain (Amoy testnet): 0x6729b2956e8Cf3d863517E4618C3d8722548D5C4
// yarn deploy:matic_test:GreenBTC2SI
// call: registerDomain to register domain 35 

// 2025/02/18: Call registerDomain (Ploygon Mainnet): 0x3221F5818A5CF99e09f5BE0E905d8F145935e3E0
// yarn deploy:matic:GreenBTC2SI
// call: registerDomain to register domain 35 

// 2025/02/18: Call registerDomain (Ploygon Mainnet): 0x3221F5818A5CF99e09f5BE0E905d8F145935e3E0
// yarn deploy:matic:GreenBTC2SI
// call: registerDomain to register domain 67/68/69/70

// 2025/03/03: Call registerDomain (BSC Testnet): 0xF8bd14e5aF9177FfDB9fE903a76b684986D7FB45
// yarn deploy:bsc_test:GreenBTC2SI
// call: buyNode

// 2025/03/04A: Call registerDomain (BSC Testnet): 0xF8bd14e5aF9177FfDB9fE903a76b684986D7FB45
// yarn deploy:bsc_test:GreenBTC2SI
// call: buyNode

// 2025/03/04B: Call registerDomain (BSC Testnet): 0xF8bd14e5aF9177FfDB9fE903a76b684986D7FB45
// yarn deploy:bsc_test:GreenBTC2SI
// call: registerDomain

// 2025/03/06: Call registerDomain (BSC Testnet): 0xF8bd14e5aF9177FfDB9fE903a76b684986D7FB45
// yarn deploy:celo_test:GreenBTC2SI
// call: buyNode: 0x13BAA / 0x13BAB:  // !!!!!!!!!!!! Need to approve and setLuckyManager First

// 2025/03/06: Call registerDomain (BSC Testnet): 0xF8bd14e5aF9177FfDB9fE903a76b684986D7FB45
// yarn deploy:celo_test:GreenBTC2SI
// call: registerDomain: 0x13BAA / 0x13BAB

func.tags = ["GreenBTC2SI"];

export default func;

//https://github.com/arkreen/greenbtc-config/blob/main/domains.json
