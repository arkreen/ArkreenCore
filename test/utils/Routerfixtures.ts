import { Wallet, Contract, providers, utils } from 'ethers'
import { ethers, network, upgrades } from "hardhat";

import { expandTo18Decimals, mineBlock } from './utilities'
import FeSwapPair from '../../artifacts/contracts/Test/AMMV2/FeSwapPair.sol/FeSwapPair.json'

/*
import ERC20 from './build/ERC20.json'
import FeSwapFactory from './build/FeSwapFactory.json'
import WETH9 from './build/WETH9.json'
import FeSwapRouter from './build/FeSwapRouter.json'
import RouterEventEmitter from './build/RouterEventEmitter.json'
import FeswapTokenCode from './build/Fesw.json'
import FeswaNFTCode from './build/FeswaNFT.json'
import MetamorphicContractFactory from './build/MetamorphicContractFactory.json'

import RouterPatchTest1 from './build/RouterPatchTest1.json'
*/

//const { deployContract } = waffle;

const overrides = {
  gasLimit: 30000000
}

interface V2Fixture {
  tokenA: Contract
  tokenB: Contract
  WETH: Contract
  WETHPartner: Contract
  factoryFeswa: Contract
  routerFeswa: Contract
  routerEventEmitter: Contract
  pairAAB: Contract
  pairABB: Contract 
  WETHPairTTE: Contract
  WETHPairTEE: Contract  
  Feswa:  Contract
  FeswaNFT:   Contract
  tokenIDMatch: string
  MetamorphicFactory: Contract
}

const initPoolPrice = expandTo18Decimals(1).div(5)
//const BidStartTime: number = 1679241600   // 2023/03/20 00/00/00
const BidStartTime: number = 1687190400   // 2023/06/20 00/00/00
const OPEN_BID_DURATION: number =  (3600 * 24 * 14)
const rateTriggerArbitrage: number = 10


export async function v2Fixture(
                                  [wallet, feeTo, pairOwner]: Wallet[],
                                  provider: providers.Web3Provider): Promise<V2Fixture> 
{
  const bytecode = `${FeSwapPair.bytecode}`
  
  console.log("utils.keccak256(bytecode): ", utils.keccak256(bytecode)) 

  // deploy FeSwap Token contract, sending the total supply to the deployer
  let lastBlock = await provider.getBlock('latest')
  // const Feswa = await deployContract(wallet, FeswapTokenCode, [wallet.address, wallet.address, lastBlock.timestamp + 60 * 60])
  const FeswFactory = await ethers.getContractFactory("Fesw");
  const Feswa = await FeswFactory.deploy(wallet.address, wallet.address, lastBlock.timestamp + 60 * 60,'FESW');
  await Feswa.deployed();

  // Get Factory address
  const FeswFactoryAddress = Contract.getContractAddress({ from: wallet.address, nonce: 2 })
  const FeswRouterAddress = Contract.getContractAddress({ from: wallet.address, nonce: 5 })

  // deploy FeSwap NFT contract
  // const FeswaNFT = await deployContract(wallet, FeswaNFTCode, [Feswa.address, FeswFactoryAddress, BidStartTime], overrides)
  const FeswaNFTFactory = await ethers.getContractFactory("FeswaNFT");
  const FeswaNFT = await FeswaNFTFactory.deploy(Feswa.address, FeswFactoryAddress, BidStartTime);
  await FeswaNFT.deployed();

  // deploy FeSwap factory
  // const factoryFeswa = await deployContract(wallet, FeSwapFactory, [wallet.address, FeswRouterAddress, FeswaNFT.address], overrides)
  const FeSwapFactory = await ethers.getContractFactory("FeSwapFactory");
  const factoryFeswa = await FeSwapFactory.deploy(wallet.address, FeswRouterAddress, FeswaNFT.address);
  await factoryFeswa.deployed();

  // const WETH = await deployContract(wallet, WETH9)
  const WETH9Factory = await ethers.getContractFactory("WETH9");
  const WETH = await WETH9Factory.deploy();
  await WETH.deployed();

  // const WETHPartner = await deployContract(wallet, ERC20, [expandTo18Decimals(10000),"WETH Partner"], overrides)
  const ERC20Factory = await ethers.getContractFactory("ERC20F");
  const WETHPartner = await ERC20Factory.deploy(expandTo18Decimals(10000),"WETH Partner");
  await WETHPartner.deployed();

  // deploy FeSwap routers
  // const routerFeswa = await deployContract(wallet, FeSwapRouter, [factoryFeswa.address, WETH.address], overrides)
  const FeSwapRouterFactory = await ethers.getContractFactory("FeSwapRouter");
  const routerFeswa = await FeSwapRouterFactory.deploy(factoryFeswa.address, WETH.address);
  await routerFeswa.deployed();

  // deploy tokens
  // const tokenA = await deployContract(wallet, ERC20, [expandTo18Decimals(10000),"Token A"])
  const tokenA = await ERC20Factory.deploy(expandTo18Decimals(10000),"Token A");
  await tokenA.deployed();

  // const tokenB = await deployContract(wallet, ERC20, [expandTo18Decimals(10000),"Token B"])
  const tokenB = await ERC20Factory.deploy(expandTo18Decimals(10000),"Token B");
  await tokenB.deployed();

  await Feswa.transfer(FeswaNFT.address, expandTo18Decimals(1000_000))

  // event emitter for testing
  // const routerEventEmitter = await deployContract(wallet, RouterEventEmitter, [])
  const RouterEventEmitterFactory = await ethers.getContractFactory("RouterEventEmitter");
  const routerEventEmitter = await RouterEventEmitterFactory.deploy();
  await routerEventEmitter.deployed();

  // initialize FeSwap
  await factoryFeswa.setFeeTo(feeTo.address)
  await factoryFeswa.setRouterFeSwap(routerFeswa.address)
  // await factoryFeswa.createUpdatePair(tokenA.address, tokenB.address, pairOwner.address, rateTriggerArbitrage, overrides)

  await mineBlock(provider, BidStartTime + 1)
  const tokenIDMatch = utils.keccak256( 
                            utils.solidityPack( ['address', 'address', 'address'],
                            (tokenA.address.toLowerCase() <= tokenB.address.toLowerCase())
                            ? [FeswaNFT.address, tokenA.address, tokenB.address] 
                            : [FeswaNFT.address, tokenB.address, tokenA.address] ) )

  await FeswaNFT.connect(pairOwner).BidFeswaPair(tokenA.address, tokenB.address, pairOwner.address,
                          { ...overrides, value: initPoolPrice } )

  // BidDelaying time out
  lastBlock = await provider.getBlock('latest')
  await mineBlock(provider, lastBlock.timestamp + OPEN_BID_DURATION + 1 ) 
  await FeswaNFT.connect(pairOwner).ManageFeswaPair(tokenIDMatch, pairOwner.address, rateTriggerArbitrage, 0 )

  await factoryFeswa.createUpdatePair(tokenB.address, WETHPartner.address, pairOwner.address, rateTriggerArbitrage, 0, overrides)  
  const [pairAddressAAB, pairAddressABB] = await factoryFeswa.getPair(tokenA.address, tokenB.address)

  // const pairAddressABB = await factoryFeswa.getPair(tokenB.address, tokenA.address)
  const pairAAB = new Contract(pairAddressAAB, JSON.stringify(FeSwapPair.abi), provider).connect(wallet)
  const pairABB = new Contract(pairAddressABB, JSON.stringify(FeSwapPair.abi), provider).connect(wallet)

  await factoryFeswa.createUpdatePair(WETH.address, WETHPartner.address, pairOwner.address, rateTriggerArbitrage, 0, overrides)
  const [WETHPairAddressETHIn, WETHPairAddressETHOut] = await factoryFeswa.getPair(WETH.address, WETHPartner.address)
  const WETHPairTEE = new Contract(WETHPairAddressETHIn, JSON.stringify(FeSwapPair.abi), provider).connect(wallet)

  // const WETHPairAddressETHOut = await factoryFeswa.getPair(WETHPartner.address, WETH.address)
  const WETHPairTTE = new Contract(WETHPairAddressETHOut, JSON.stringify(FeSwapPair.abi), provider).connect(wallet)

  // deploy FeSwap MetamorphicContractFactory
  // const MetamorphicFactory = await deployContract(wallet, MetamorphicContractFactory)

  const MetamorphicContractFactory = await ethers.getContractFactory("MetamorphicContractFactory");
  const MetamorphicFactory = await MetamorphicContractFactory.deploy();
  await MetamorphicFactory.deployed();

  return {
    tokenA,
    tokenB,
    WETH,
    WETHPartner,
    factoryFeswa,
    routerFeswa,
    routerEventEmitter,
    pairAAB,
    pairABB,
    WETHPairTTE,
    WETHPairTEE,
    Feswa,
    FeswaNFT,
    tokenIDMatch,
    MetamorphicFactory
  }
}
