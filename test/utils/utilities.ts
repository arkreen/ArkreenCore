import { Contract } from 'ethers'
import { providers, utils, BigNumber, Signer, Wallet } from 'ethers'

import hre from 'hardhat'

export const MINIMUM_LIQUIDITY = BigNumber.from(10).pow(3)

const PERMIT_TYPEHASH = utils.keccak256(
  utils.toUtf8Bytes('Permit(address owner,address spender,uint256 value,uint256 nonce,uint256 deadline)')
)

const MINER_TYPEHASH = utils.keccak256(
  utils.toUtf8Bytes('GameMinerOnboard(address owner,address miners,bool bAirDrop,uint256 nonce,uint256 deadline)')
)

const REGISTER_TYPEHASH = utils.keccak256(
  utils.toUtf8Bytes('GameMinerOnboard(address owner,address miners,bool bAirDrop,uint256 deadline)')
)

// keccak256("RemoteMinerOnboard(address owner,address miners,address token,uint256 price,uint256 deadline)");
const REMOTE_REGISTER_TYPEHASH = utils.keccak256(
  utils.toUtf8Bytes('RemoteMinerOnboard(address owner,address miners,address token,uint256 price,uint256 deadline)')
)

// keccak256("RemoteMinerOnboardBatch(address owner,uint256 quantity,address token,uint256 value,uint256 deadline)");
const REMOTE_MINER_BATCH_TYPEHASH = utils.keccak256(
  utils.toUtf8Bytes('RemoteMinerOnboardBatch(address owner,uint256 quantity,address token,uint256 value,uint256 deadline)')
)

// keccak256("StandardMinerOnboard(address owner,address miner,uint256 deadline)");
// 0x73F94559854A7E6267266A158D1576CBCAFFD8AE930E61FB632F9EC576D2BB37
const STANDARD_REGISTER_TYPEHASH = utils.keccak256(
  utils.toUtf8Bytes('StandardMinerOnboard(address owner,address miner,uint256 deadline)')
)

const REWARD_TYPEHASH = utils.keccak256(
  utils.toUtf8Bytes('Reward(address receiver,uint256 value,uint256 nonce)')
)

const REWARD_EXT_TYPEHASH = utils.keccak256(
  utils.toUtf8Bytes('Reward(address owner,address receiver,uint256 value,uint256 nonce)')
)

// keccak256("GreenBitCoin(uint256 height,string energyStr,uint256 artCount,string blockTime,address minter,uint8 greenType)");
// 0xE645798FE54DB29ED50FD7F01A05DE6D1C5A65FAC8902DCFD7427B30FBD87C24
const GREEN_BTC_TYPEHASH = utils.keccak256(
  utils.toUtf8Bytes('GreenBitCoin(uint256 height,string energyStr,uint256 artCount,string blockTime,address minter,uint8 greenType)')
)

// keccak256("GreenBitCoinBatch((uint128,uint128,address,uint8,string,string)[])");
// 0x829ABF7A83FCBCF66649914B5A9A514ACBF6BEDA598A620AEF732202E8155D73
const GREENBTC_BATCH_TYPEHASH = utils.keccak256(
  utils.toUtf8Bytes('GreenBitCoinBatch((uint128,uint128,address,uint8,string,string)[])')
)

export function expandTo6Decimals(n: number): BigNumber {
  return BigNumber.from(n).mul(BigNumber.from(10).pow(6))
}

export function expandTo9Decimals(n: number): BigNumber {
  return BigNumber.from(n).mul(BigNumber.from(10).pow(9))
}

export function expandTo18Decimals(n: number): BigNumber {
  return BigNumber.from(n).mul(BigNumber.from(10).pow(18))
}

export function expandTo16Decimals(n: number): BigNumber {
  return BigNumber.from(n).mul(BigNumber.from(10).pow(16))
}

export function BigNumberPercent(n: BigNumber, ratio: number): BigNumber {
  return n.mul(BigNumber.from(ratio)).div(BigNumber.from(100))
}

export function RemoveOutPercent(n: BigNumber, ratio: number, Liquidity: BigNumber): BigNumber {
  return n.mul(BigNumber.from(ratio)).div(BigNumber.from(100)).mul(Liquidity.sub(MINIMUM_LIQUIDITY)).div(Liquidity)
}

export function RemoveLeftPercent(n: BigNumber, ratio: number, Liquidity: BigNumber): BigNumber {
  return n.mul(BigNumber.from(ratio)).div(BigNumber.from(100)).mul(MINIMUM_LIQUIDITY).div(Liquidity)
}

export function getDomainSeparator(name: string, contractAddress: string, version?: string, chainId?: number  ) {
  if (chainId === undefined) chainId = hre.network.config.chainId
  if (version === undefined) version = '1'

  return utils.keccak256(
    utils.defaultAbiCoder.encode(
      ['bytes32', 'bytes32', 'bytes32', 'uint256', 'address'],
      [
        utils.keccak256(utils.toUtf8Bytes('EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)')),
        utils.keccak256(utils.toUtf8Bytes(name)),
        utils.keccak256(utils.toUtf8Bytes(version)),
        chainId,
        contractAddress
      ]
    )
  )
}

export const randomSigners = (amount: number): Signer[] => {
  const signers: Signer[] = []
  for (let i = 0; i < amount; i++) {
    signers.push(Wallet.createRandom())
  }
  return signers
}

export const randomAddresses = (amount: number): string[] => {
  const addresses: string[] = []
  for (let i = 0; i < amount; i++) {
    addresses.push(Wallet.createRandom().address)
  }
  return addresses
}


export enum MinerType {
  GameMiner,                // 0
  LiteMiner,                // 1
  StandardMiner,            // 2
  RemoteMiner,              // 3
  APIMiner,                 // 4
  SocketMiner,              // 5
  SKIP_6,                   // 6
  SKIP_7,                   // 7
  SKIP_8,                   // 8
  PlantMiner                // 9
}

/*
export enum MinerType {
  Empty,              // 0
  GameMiner,          // 1
  RemoteMiner,        // 2
  StandardMiner       // 3
}
*/

export enum MinerStatus {
  Pending,            // 0
  Normal,             // 1
  Locked,             // 2
  Terminated          // 3
}

export enum RECStatus {
  Pending,            // 0
  Rejected,           // 1
  Cancelled,          // 2
  Certified,          // 3
  Retired,            // 4
  Liquidized          // 5
}

export interface GreenBTCInfo {
  height:     BigNumber
  ARTCount:   BigNumber
  minter:     string            // Minter of the respective NFT
  greenType:  number            // High nibble:  ART type: 0, CART, 1, Arkreen ART; Low nibble: mint type, 1: system, 2: user;  
  blockTime:  string            // For NFT display
  energyStr:  string            // For NTT display
}

export interface OffsetAction {
  plugMiner:      string
  offsetAmount:   BigNumber
}

export interface OffsetActionBatch {
  plugMiner:      string
  owner:          string
  tokenPayment:   string
  offsetAmount:   BigNumber
  nonce:          BigNumber
}

export interface  OffsetActionAgent {
  greener:  string
  plugMiner: string
  offsetAmount: BigNumber
}  

export interface PlugActionInfo {
  owner:          string
  tokenPay:       string
  amountPay:      BigNumber
  tokenGet:       string
  amountGet:      BigNumber
  actionType:     string
  action:         BigNumber
}

export function getCreate2Address(
  factoryAddress: string,
  [tokenA, tokenB]: [string, string],
  bytecode: string
): string {
  const [token0, token1] = tokenA < tokenB ? [tokenA, tokenB] : [tokenB, tokenA]
  const create2Inputs = [
    '0xff',
    factoryAddress,
    utils.keccak256(utils.solidityPack(['address', 'address'], [token0, token1])),
    utils.keccak256(bytecode)
  ]
  const sanitizedInputs = `0x${create2Inputs.map(i => i.slice(2)).join('')}`
  return utils.getAddress(`0x${utils.keccak256(sanitizedInputs).slice(-40)}`)
}

export function getCreate2AddressFeSwap(
  factoryAddress: string,
  [tokenA, tokenB]: [string, string],
  bytecode: string
): string {
  const create2Inputs = [
    '0xff',
    factoryAddress,
    utils.keccak256(utils.solidityPack(['address', 'address'], [tokenA, tokenB])),
    utils.keccak256(bytecode)
  ]
  const sanitizedInputsAAB = `0x${create2Inputs.map(i => i.slice(2)).join('')}`
  return utils.getAddress(`0x${utils.keccak256(sanitizedInputsAAB).slice(-40)}`)
}

export async function getMinerRegisterDigest(
  contractName: string,
  contractAddress: string,
  approve: {
    owner: string
    miners: string[]
  },
  nonce: BigNumber,
  feeRegister: BigNumber,
  deadline: BigNumber
): Promise<string> {
  const DOMAIN_SEPARATOR = getDomainSeparator(contractName, contractAddress)

  ///////////////////////////
/*
  const dataToHash = utils.defaultAbiCoder.encode(
    ['bytes32', 'address', 'address[]', 'uint256', 'uint256', 'uint256'],
    [MINER_TYPEHASH, approve.owner, approve.miners, nonce, feeRegister, deadline]
  )
  console.log('dataToHash:',  dataToHash)
  console.log('HashOfData:',  utils.keccak256(dataToHash))
  console.log('DOMAIN_SEPARATOR:', DOMAIN_SEPARATOR)
*/

  return utils.keccak256(
    utils.solidityPack(
      ['bytes1', 'bytes1', 'bytes32', 'bytes32'],
      [
        '0x19',
        '0x01',
        DOMAIN_SEPARATOR,
        utils.keccak256(
          utils.defaultAbiCoder.encode(
            ['bytes32', 'address', 'address[]', 'uint256', 'uint256', 'uint256'],
            [MINER_TYPEHASH, approve.owner, approve.miners, nonce, feeRegister, deadline]
          )
        )
      ]
    )
  )
}


export function getOnboardingGameMinerDigest(
  contractName: string,
  contractAddress: string,
  approve: {
    owner: string
    miner: string
    bAirDrop: boolean
  },
  deadline: BigNumber
): string {
  const DOMAIN_SEPARATOR = getDomainSeparator(contractName, contractAddress)

  ///////////////////////////
  /*
  const dataToHash =  utils.defaultAbiCoder.encode(
    ['bytes32', 'address', 'address', 'bool', 'uint256', 'uint256', 'uint256'],
    [MINER_TYPEHASH, approve.owner, approve.miner, approve.bAirDrop, nonce, feeRegister, deadline]
  )
  console.log('dataToHash:',  dataToHash)
  console.log('HashOfData:',  utils.keccak256(dataToHash))
  console.log('DOMAIN_SEPARATOR:', DOMAIN_SEPARATOR)
  console.log('contractAddress, chainId:', contractAddress, hre.network.config.chainId)
  */

  return utils.keccak256(
    utils.solidityPack(
      ['bytes1', 'bytes1', 'bytes32', 'bytes32'],
      [
        '0x19',
        '0x01',
        DOMAIN_SEPARATOR,
        utils.keccak256(
          utils.defaultAbiCoder.encode(
            ['bytes32', 'address', 'address', 'bool', 'uint256'],
            [REGISTER_TYPEHASH, approve.owner, approve.miner, approve.bAirDrop, deadline]
          )
        )
      ]
    )
  )
}

export function getOnboardingStandardMinerDigest(
  contractName: string,
  contractAddress: string,
  approve: {
    owner: string
    miner: string
  },
  deadline: BigNumber
): string {
  const DOMAIN_SEPARATOR = getDomainSeparator(contractName, contractAddress)
  return utils.keccak256(
    utils.solidityPack(
      ['bytes1', 'bytes1', 'bytes32', 'bytes32'],
      [
        '0x19',
        '0x01',
        DOMAIN_SEPARATOR,
        utils.keccak256(
          utils.defaultAbiCoder.encode(
            ['bytes32', 'address', 'address', 'uint256'],
            [STANDARD_REGISTER_TYPEHASH, approve.owner, approve.miner, deadline]
          )
        )
      ]
    )
  )
}

export function getGreenBTC2SBuyNodeDigest(
  contractName: string,
  contractAddress: string,
  owner: string,
  nodeId: BigNumber,
  percentage: BigNumber,
  amountEnergy: BigNumber,
  chainId: number
): string {

  const version = "2"
  const DOMAIN_SEPARATOR = getDomainSeparator(contractName, contractAddress, version, chainId)

  // keccak256("buyNode(address owner,uint256 nodeId,uint256 percentage,uint256 amountEnergy)");
  // 0x47A3904864FF6B34A8BCB4F45B53B6B67C65606D703B12BDE7C0F91117646454;  
  const BUY_NODE_TYPEHASH = utils.keccak256(
    utils.toUtf8Bytes('buyNode(address owner,uint256 nodeId,uint256 percentage,uint256 amountEnergy)')
  )

  //47a3904864ff6b34a8bcb4f45b53b6b67c65606d703b12bde7c0f91117646454
  //00000000000000000000000015d34aaf54267db7d7c367839aaf71a00a2c6a65
  //0000000000000000000000000000000000000000000000000000000000012abc
  //0000000000000000000000000000000000000000000000000000000000000014
  //000000000000000000000000000000000000000000000000000000e8d4a51000

  return utils.keccak256(
    utils.solidityPack(
      ['bytes1', 'bytes1', 'bytes32', 'bytes32'],
      [
        '0x19',
        '0x01',
        DOMAIN_SEPARATOR,
        utils.keccak256(
          utils.defaultAbiCoder.encode(
            ['bytes32', 'address', 'uint24', 'uint8', 'uint64'],
            [BUY_NODE_TYPEHASH, owner, nodeId, percentage, amountEnergy]
          )
        )
      ]
    )
  )
}

export function getGreenBTC2SLuckyDigest(
  contractName: string,
  contractAddress: string,
  domainID:   BigNumber,
  boxSteps:   BigNumber,
  greener:    string,
  nonce:      BigNumber,
  deadline:   BigNumber,
): string {
  const version = "2"
  const DOMAIN_SEPARATOR = getDomainSeparator(contractName, contractAddress, version)

  // keccak256("makeGreenBoxLucky(uint256 domainID,uint256 boxSteps,address greener,uint256 nonce,uint256 deadline)");
  // 0x6A10D25EB5A7B84EB21D26AF2DB8C23A1FB80647769A40DA523EDDCFFC172A10
  const LUCKY_TYPEHASH = utils.keccak256(
    utils.toUtf8Bytes('makeGreenBoxLucky(uint256 domainID,uint256 boxSteps,address greener,uint256 nonce,uint256 deadline)')
  )

  return utils.keccak256(
    utils.solidityPack(
      ['bytes1', 'bytes1', 'bytes32', 'bytes32'],
      [
        '0x19',
        '0x01',
        DOMAIN_SEPARATOR,
        utils.keccak256(
          utils.defaultAbiCoder.encode(
            ['bytes32', 'uint256', 'uint256', 'address', 'uint256', 'uint256'],
            [LUCKY_TYPEHASH, domainID, boxSteps, greener, nonce, deadline]
          )
        )
      ]
    )
  )
}

export function getPlantStakingDigest(
  contractName: string,
  contractAddress: string,
  approve: {
    txid:     BigNumber
    staker:   string
    cspminer: string
    amount:   BigNumber
    nonce:    BigNumber
  },
  deadline:   BigNumber
): string {
  const DOMAIN_SEPARATOR = getDomainSeparator(contractName, contractAddress)

  // keccak256("stake(uint256 txid,address staker,address cspminer,uint256 amount,uint256 nonce,uint256 deadline)");
  // 0xF970E4374212202D8F38B4CD5B1067E6B25AE9F3F76C60C2C45771C286C3F19D
  const STAKE_TYPEHASH = utils.keccak256(
    utils.toUtf8Bytes('stake(uint256 txid,address staker,address cspminer,uint256 amount,uint256 nonce,uint256 deadline)')
  )

  return utils.keccak256(
    utils.solidityPack(
      ['bytes1', 'bytes1', 'bytes32', 'bytes32'],
      [
        '0x19',
        '0x01',
        DOMAIN_SEPARATOR,
        utils.keccak256(
          utils.defaultAbiCoder.encode(
            ['bytes32', 'uint256', 'address', 'address', 'uint256', 'uint256', 'uint256'],
            [STAKE_TYPEHASH, approve.txid, approve.staker, approve.cspminer, approve.amount, approve.nonce, deadline]
          )
        )
      ]
    )
  )
}

export function getPlantUnstakingDigest(
  contractName: string,
  contractAddress: string,
  approve: {
    txid:     BigNumber
    staker:   string
    cspminer: string
    amount:   BigNumber
    reward:   BigNumber
    nonce:    BigNumber
  },
  deadline:   BigNumber
): string {
  const DOMAIN_SEPARATOR = getDomainSeparator(contractName, contractAddress)

  // keccak256("unstake(uint256 txid,address staker,address cspminer,uint256 amount,uint256 reward,uint256 nonce,uint256 deadline)");
  // 0xDF27D93C407B51719EF6DE1C85A91844E20B5B3AFADCC7C5BF0828E9F5C6AAC3
  const UNSTAKE_TYPEHASH = utils.keccak256(
    utils.toUtf8Bytes('unstake(uint256 txid,address staker,address cspminer,uint256 amount,uint256 reward,uint256 nonce,uint256 deadline)')
  )

  return utils.keccak256(
    utils.solidityPack(
      ['bytes1', 'bytes1', 'bytes32', 'bytes32'],
      [
        '0x19',
        '0x01',
        DOMAIN_SEPARATOR,
        utils.keccak256(
          utils.defaultAbiCoder.encode(
            ['bytes32', 'uint256', 'address', 'address', 'uint256', 'uint256', 'uint256', 'uint256'],
            [UNSTAKE_TYPEHASH, approve.txid, approve.staker, approve.cspminer, approve.amount, approve.reward, approve.nonce, deadline]
          )
        )
      ]
    )
  )
}

export function getGreenPowerRewardDigest(
  contractName: string,
  contractAddress: string,
  approve: {
    txid:       string
    greener:    string
    amount:     BigNumber
    nonce:      BigNumber
  },
  deadline:     BigNumber
): string {
  const DOMAIN_SEPARATOR = getDomainSeparator(contractName, contractAddress)

  // keccak256("claimReward(uint256 txid,address greener,uint256 rewardAmount,uint256 nonce,uint256 deadline)")
  // 0x9A6CE8C7C5EDCB1EAA7313523B253F809B5AC0E3EC4A56F23B411D538FE25B11
  const STAKE_TYPEHASH = utils.keccak256(
    utils.toUtf8Bytes('claimReward(uint256 txid,address greener,uint256 rewardAmount,uint256 nonce,uint256 deadline)')
  )

  return utils.keccak256(
    utils.solidityPack(
      ['bytes1', 'bytes1', 'bytes32', 'bytes32'],
      [
        '0x19',
        '0x01',
        DOMAIN_SEPARATOR,
        utils.keccak256(
          utils.defaultAbiCoder.encode(
            ['bytes32', 'address', 'address', 'uint256', 'uint256', 'uint256'],
            [STAKE_TYPEHASH, approve.txid, approve.greener, approve.amount, approve.nonce, deadline]
          )
        )
      ]
    )
  )
}

export function getGreenPowerRewardDigestExt(
  contractName: string,
  contractAddress: string,
  approve: {
    txid:       string
    greener:    string
    receiver:   string
    amount:     BigNumber
    nonce:      BigNumber
  },
  deadline:     BigNumber
): string {
  const DOMAIN_SEPARATOR = getDomainSeparator(contractName, contractAddress)

  // keccak256("claimRewardExt(uint256 txid,address greener,address receiver,uint256 rewardAmount,uint256 nonce,uint256 deadline)")
  // 0xC7A88F1CA971FF53DAB58C413AF193738A9538AD0C8A3B5DC1CD27D35AF859C9
  const STAKE_TYPEHASH = utils.keccak256(
    utils.toUtf8Bytes('claimRewardExt(uint256 txid,address greener,address receiver,uint256 rewardAmount,uint256 nonce,uint256 deadline)')
  )

  return utils.keccak256(
    utils.solidityPack(
      ['bytes1', 'bytes1', 'bytes32', 'bytes32'],
      [
        '0x19',
        '0x01',
        DOMAIN_SEPARATOR,
        utils.keccak256(
          utils.defaultAbiCoder.encode(
            ['bytes32', 'address', 'address', 'address', 'uint256', 'uint256', 'uint256'],
            [STAKE_TYPEHASH, approve.txid, approve.greener, approve.receiver, approve.amount, approve.nonce, deadline]
          )
        )
      ]
    )
  )
}

export function getGreenPowerStakingDigest(
  contractName: string,
  contractAddress: string,
  approve: {
    txid:       string
    staker:     string
    plugMiner:  string
    amount:     BigNumber
    period:     BigNumber
    nonce:      BigNumber
  },
  deadline:     BigNumber
): string {
  const DOMAIN_SEPARATOR = getDomainSeparator(contractName, contractAddress)

  // keccak256("stake(uint256 txid,address greener,address plugMiner,uint256 amount,uint256 period,uint256 nonce,uint256 deadline)")
  // 0xB13D25036831D18DBC6EEF2020BA657F13C7D378CFB74B36EF4C358851961CFA
  const STAKE_TYPEHASH = utils.keccak256(
    utils.toUtf8Bytes('stake(uint256 txid,address greener,address plugMiner,uint256 amount,uint256 period,uint256 nonce,uint256 deadline)')
  )

  return utils.keccak256(
    utils.solidityPack(
      ['bytes1', 'bytes1', 'bytes32', 'bytes32'],
      [
        '0x19',
        '0x01',
        DOMAIN_SEPARATOR,
        utils.keccak256(
          utils.defaultAbiCoder.encode(
            ['bytes32', 'address', 'address', 'address', 'uint256', 'uint256', 'uint256', 'uint256'],
            [STAKE_TYPEHASH, approve.txid, approve.staker, approve.plugMiner, approve.amount, approve.period, approve.nonce, deadline]
          )
        )
      ]
    )
  )
}

export function getGreenPowerUnstakingDigest(
  contractName: string,
  contractAddress: string,
  approve: {
    txid:       string
    staker:     string
    plugMiner:  string
    amount:     BigNumber
    nonce:      BigNumber
  },
  deadline:     BigNumber
): string {
  const DOMAIN_SEPARATOR = getDomainSeparator(contractName, contractAddress)

  // keccak256("unstake(uint256 txid,address greener,address plugMiner,uint256 amount,uint256 nonce,uint256 deadline)");
  // 0xEEC4B573720D0248870523A82A8C2F6AEE40054E5D98C0334C41ACCF230D8CFC
  const UNSTAKE_TYPEHASH = utils.keccak256(
    utils.toUtf8Bytes('unstake(uint256 txid,address greener,address plugMiner,uint256 amount,uint256 nonce,uint256 deadline)')
  )

  return utils.keccak256(
    utils.solidityPack(
      ['bytes1', 'bytes1', 'bytes32', 'bytes32'],
      [
        '0x19',
        '0x01',
        DOMAIN_SEPARATOR,
        utils.keccak256(
          utils.defaultAbiCoder.encode(
            ['bytes32', 'address', 'address', 'address', 'uint256', 'uint256', 'uint256'],
            [UNSTAKE_TYPEHASH, approve.txid, approve.staker, approve.plugMiner, approve.amount, approve.nonce, deadline]
          )
        )
      ]
    )
  )
}

export function getGreenPowerOffsetDigest(
  contractName: string,
  contractAddress: string,
  approve: {
    txid:         string
    staker:       string
    offsetAction: OffsetAction[]
    tokenToPay:   string
    nonce:        BigNumber
  },
  deadline:     BigNumber
): string {
  const DOMAIN_SEPARATOR = getDomainSeparator(contractName, contractAddress)

  // keccak256("offset(uint256 txid,address greener,(address plugMiner,uint256 offsetAmount)[],address tokenToPay,uint256 nonce,uint256 deadline)");
  // 0xAA19A1F9E01266BCE4B0B002C45341A0B67477836193A3457FB9D3F248AECE80
  const UNSTAKE_TYPEHASH = utils.keccak256(
    utils.toUtf8Bytes('offset(uint256 txid,address greener,(address plugMiner,uint256 offsetAmount)[],address tokenToPay,uint256 nonce,uint256 deadline)')
  )

  return utils.keccak256(
    utils.solidityPack(
      ['bytes1', 'bytes1', 'bytes32', 'bytes32'],
      [
        '0x19',
        '0x01',
        DOMAIN_SEPARATOR,
        utils.keccak256(
          utils.defaultAbiCoder.encode(
            ['bytes32', 'address', 'address', '(address plugMiner, uint256 offsetAmount)[]', 'address', 'uint256', 'uint256'],
            [UNSTAKE_TYPEHASH, approve.txid, approve.staker, approve.offsetAction, approve.tokenToPay, approve.nonce, deadline]
          )
        )
      ]
    )
  )
}

export function getOnboardingRemoteMinerDigest(
  contractName: string,
  contractAddress: string,
  approve: {
    owner: string
    miner: string
    token: string
    price: BigNumber
    deadline: BigNumber
  }
): string {
  const DOMAIN_SEPARATOR = getDomainSeparator(contractName, contractAddress)

  ///////////////////////////
  /*
  const dataToHash =  utils.defaultAbiCoder.encode(
    ['bytes32', 'address', 'address', 'bool', 'uint256', 'uint256', 'uint256'],
    [MINER_TYPEHASH, approve.owner, approve.miner, approve.bAirDrop, nonce, feeRegister, deadline]
  )
  console.log('dataToHash:',  dataToHash)
  console.log('HashOfData:',  utils.keccak256(dataToHash))
  console.log('DOMAIN_SEPARATOR:', DOMAIN_SEPARATOR)
  console.log('contractAddress, chainId:', contractAddress, hre.network.config.chainId)
  */

  return utils.keccak256(
    utils.solidityPack(
      ['bytes1', 'bytes1', 'bytes32', 'bytes32'],
      [
        '0x19',
        '0x01',
        DOMAIN_SEPARATOR,
        utils.keccak256(
          utils.defaultAbiCoder.encode(
            ['bytes32', 'address', 'address', 'address', 'uint256', 'uint256'],
            [REMOTE_REGISTER_TYPEHASH, approve.owner, approve.miner, approve.token, approve.price, approve.deadline]
          )
        )
      ]
    )
  )
}

export function getOnboardingRemoteMinerBatchDigest(
  contractName: string,
  contractAddress: string,
  approve: {
    owner: string
    quantity: BigNumber
    token: string
    price: BigNumber
    deadline: BigNumber
  }
): string {
  const DOMAIN_SEPARATOR = getDomainSeparator(contractName, contractAddress)

  return utils.keccak256(
    utils.solidityPack(
      ['bytes1', 'bytes1', 'bytes32', 'bytes32'],
      [
        '0x19',
        '0x01',
        DOMAIN_SEPARATOR,
        utils.keccak256(
          utils.defaultAbiCoder.encode(
            ['bytes32', 'address', 'uint256', 'address', 'uint256', 'uint256'],
            [REMOTE_MINER_BATCH_TYPEHASH, approve.owner, approve.quantity, approve.token, approve.price, approve.deadline]
          )
        )
      ]
    )
  )
}

export function getOnboardingGameMinerMessage(
  contractName: string,
  contractAddress: string,
  approve: {
    owner: string
    miner: string
    bAirDrop: boolean
  },
  deadline: BigNumber
): string {
  const DOMAIN_SEPARATOR = getDomainSeparator(contractName, contractAddress)

  return utils.solidityPack(
      ['bytes1', 'bytes1', 'bytes32', 'bytes32'],
      [
        '0x19',
        '0x01',
        DOMAIN_SEPARATOR,
        utils.keccak256(
          utils.defaultAbiCoder.encode(
            ['bytes32', 'address', 'address', 'bool', 'uint256'],
            [MINER_TYPEHASH, approve.owner, approve.miner, approve.bAirDrop, deadline]
          )
        )
      ]
    )
}

export function getOnboardingDTUMinerDigest(
  contractName: string,
  contractAddress: string,
  approve: {
    owner:      string
    gameMiner:  string
    miner:      string
    minerType:  number
  },
  nonce: BigNumber,
  feeRegister: BigNumber,
  deadline: BigNumber
): string {
  const DOMAIN_SEPARATOR = getDomainSeparator(contractName, contractAddress)
  return utils.keccak256(
    utils.solidityPack(
      ['bytes1', 'bytes1', 'bytes32', 'bytes32'],
      [
        '0x19',
        '0x01',
        DOMAIN_SEPARATOR,
        utils.keccak256(
          utils.defaultAbiCoder.encode(
            ['bytes32', 'address', 'address', 'address', 'uint8', 'uint256', 'uint256', 'uint256'],
            [MINER_TYPEHASH, approve.owner, approve.gameMiner, approve.miner, approve.minerType, nonce, feeRegister, deadline]
          )
        )
      ]
    )
  )
}

export function getGreenBitcoinDigest(
  contractName: string,
  contractAddress: string,
  approve: {
    height:       BigNumber
    energyStr:    string
    artCount:     BigNumber
    blockTime:    string
    minter:       string
    greenType:    number
  }
): string {
  const DOMAIN_SEPARATOR = getDomainSeparator(contractName, contractAddress)
  return utils.keccak256(
    utils.solidityPack(
      ['bytes1', 'bytes1', 'bytes32', 'bytes32'],
      [
        '0x19',
        '0x01',
        DOMAIN_SEPARATOR,
        utils.keccak256(
          utils.defaultAbiCoder.encode(
            ['bytes32', 'uint256', 'string', 'uint256', 'string', 'address', 'uint8'],
            [GREEN_BTC_TYPEHASH, approve.height, approve.energyStr, approve.artCount, approve.blockTime, approve.minter, approve.greenType]
          )
        )
      ]
    )
  )
}

export function getGreenBitcoinDigestBatch(
  contractName: string,
  contractAddress: string,
  greenBTCInfo: GreenBTCInfo[]
): string {
  const DOMAIN_SEPARATOR = getDomainSeparator(contractName, contractAddress)
  
  return utils.keccak256(
    utils.solidityPack(
      ['bytes1', 'bytes1', 'bytes32', 'bytes32'],
      [
        '0x19',
        '0x01',
        DOMAIN_SEPARATOR,
        utils.keccak256(
          utils.defaultAbiCoder.encode(
            ['bytes32', '(uint256 height,uint256 ARTCount,address minter,uint256 greenType,string blockTime,string energyStr)[]'],
            [GREENBTC_BATCH_TYPEHASH, greenBTCInfo]
          )
        )
      ]
    )
  )
}

export function getGreenBitcoinClaimGifts(
  contractName:     string,
  contractAddress:  string,
  actionID:         number,
  blockHeight:      number,
  blockHash:        string,
  chainID?:         number
): string {

  const DOMAIN_SEPARATOR = getDomainSeparator(contractName, contractAddress, '2', chainID)

  // keccak256("GreenBTC2(uint256 actionID,uint256 height,bytes32 hash)");
  // 0x41D00AA645EF8AD83D826C2FAD36C1C82793DDBB47D097CF4D59FBD45A50F974
  const GREENBTC2_HASH = utils.keccak256(
    utils.toUtf8Bytes('GreenBTC2(uint256 actionID,uint256 height,bytes32 hash)')
  )

  return utils.keccak256(
    utils.solidityPack(
      ['bytes1', 'bytes1', 'bytes32', 'bytes32'],
      [
        '0x19',
        '0x01',
        DOMAIN_SEPARATOR,
        utils.keccak256(
          utils.defaultAbiCoder.encode(
            ['bytes32', 'uint256', 'uint256', 'bytes32'],
            [GREENBTC2_HASH, actionID, blockHeight, blockHash]
          )
        )
      ]
    )
  )
}

export function getGreenBitcoinClaimGiftsRaw(
  contractName:     string,
  contractAddress:  string,
  actionID:         number,
  blockHeight:      number,
  blockHash:        string,
  chainID?:         number
): string {

  const DOMAIN_SEPARATOR = getDomainSeparator(contractName, contractAddress, '2', chainID)

  // keccak256("GreenBTC2(uint256 height,bytes32 hash)");
  // 0xC06BCEF3A0C6ADEEA66203210D224C78DCC6461AC236D0B3451FC8707E963A22
  const GREENBTC2_HASH = utils.keccak256(
    utils.toUtf8Bytes('GreenBTC2(uint256 height,bytes32 hash)')
  )

  return utils.solidityPack(
      ['bytes1', 'bytes1', 'bytes32', 'bytes32'],
      [
        '0x19',
        '0x01',
        DOMAIN_SEPARATOR,
        utils.keccak256(
          utils.defaultAbiCoder.encode(
            ['bytes32', 'uint256', 'uint256', 'bytes32'],
            [GREENBTC2_HASH, actionID, blockHeight, blockHash]
          )
        )
      ]
    )
}




export function getPlugActionInfoHash(
  contractName:     string,
  contractAddress:  string,
  txid:             string,
  plugActionInfo:   PlugActionInfo,
  nonce:            BigNumber,
  deadline:         BigNumber
): string {

  const DOMAIN_SEPARATOR = getDomainSeparator(contractName, contractAddress, '1')

  // keccak256("ActionPlugMiner(address txid,(address owner,address tokenPay,uint256 amountPay,address tokenGet,uint256 amountGet,bytes32 actionType,uint256 action),uint256 nonce,uint256 deadline)");
  // 0x64A18406540DF9EECF4B948EEAA4A0A8B9F9FB7421B7756B9E38A22656D64CEF
  const ACTION_PLUG = utils.keccak256(
    utils.toUtf8Bytes("ActionPlugMiner(address txid,(address owner,address tokenPay,uint256 amountPay,address tokenGet,uint256 amountGet,bytes32 actionType,uint256 action),uint256 nonce,uint256 deadline)")
  )
 
  return utils.keccak256( 
    utils.solidityPack(
      ['bytes1', 'bytes1', 'bytes32', 'bytes32'],
      [
        '0x19',
        '0x01',
        DOMAIN_SEPARATOR,
        utils.keccak256(
          utils.defaultAbiCoder.encode(
            ['bytes32', 'address', '(address owner,address tokenPay,uint256 amountPay,address tokenGet,uint256 amountGet,bytes32 actionType,uint256 action)', 'uint256', 'uint256'],
            [ACTION_PLUG, txid, plugActionInfo, nonce, deadline]
          )
        )
      ]
    )
  )
}

export function getCspActionInfoHash(
  contractName:     string,
  contractAddress:  string,
  txid:             string,
  plugActionInfo:   PlugActionInfo,
  nonce:            BigNumber,
  deadline:         BigNumber
): string {

  const DOMAIN_SEPARATOR = getDomainSeparator(contractName, contractAddress, '1')

  // keccak256("ActionCspMiner(address txid,(address owner,address tokenPay,uint256 amountPay,address tokenGet,uint256 amountGet,bytes32 actionType,uint256 action),uint256 nonce,uint256 deadline)");
  //bytes32 public constant  ACTION_CSP = 0x71DA2AA7B96FEC98E3D7F21F1A93BF6C84209CCACCC3991C9A403EA7D0D0E652;

  const ACTION_PLUG = utils.keccak256(
    utils.toUtf8Bytes("ActionCspMiner(address txid,(address owner,address tokenPay,uint256 amountPay,address tokenGet,uint256 amountGet,bytes32 actionType,uint256 action),uint256 nonce,uint256 deadline)")
  )
 
  return utils.keccak256( 
    utils.solidityPack(
      ['bytes1', 'bytes1', 'bytes32', 'bytes32'],
      [
        '0x19',
        '0x01',
        DOMAIN_SEPARATOR,
        utils.keccak256(
          utils.defaultAbiCoder.encode(
            ['bytes32', 'address', '(address owner,address tokenPay,uint256 amountPay,address tokenGet,uint256 amountGet,bytes32 actionType,uint256 action)', 'uint256', 'uint256'],
            [ACTION_PLUG, txid, plugActionInfo, nonce, deadline]
          )
        )
      ]
    )
  )
}

export interface ActionInfo {
  actionID:             BigNumber,
  domainID:             BigNumber,
  boxStart:             BigNumber,
  boxAmount:            BigNumber,
  actor:                string,
  blockHash:            string,
  blockHeigh:           BigNumber,
  domainInfo:           BigNumber
}

export function UtilCalculateGifts(actionInfo: ActionInfo) {
    const actionInfoBN = actionInfo.actionID.shl(224).add(actionInfo.domainID.shl(208))
                        .add(actionInfo.boxStart.shl(176)).add(actionInfo.boxAmount.shl(160))
                        .add(BigNumber.from(actionInfo.actor))

    let luckyNumber =  utils.keccak256(
                          utils.defaultAbiCoder.encode(
                            ['bytes32', 'uint256'],
                            [actionInfo.blockHash, actionInfoBN]
                          )
                        )

//    console.log("AAAAAAAAAAA", actionInfoBN.toHexString(), actionInfo.blockHash, luckyNumber)                        

    const ratio1 =  actionInfo.domainInfo.shr(176).and(65535)
    const ratio2 =  actionInfo.domainInfo.shr(160).and(65535)
    const ratio3 =  actionInfo.domainInfo.shr(144).and(65535)
    const ratio4 =  actionInfo.domainInfo.shr(128).and(65535)
    const ratio5 =  actionInfo.domainInfo.shr(112).and(65535)
    const ratio6 =  actionInfo.domainInfo.shr(96).and(65535)
    const ratio7 =  actionInfo.domainInfo.shr(80).and(65535)
    const ratio8 =  actionInfo.domainInfo.shr(64).and(65535)

    let luckyTemp = BigNumber.from(luckyNumber);

    let result = new Array<number>(actionInfo.boxAmount.toNumber()).fill(0);        // save the gift type of each won box
    let counters = new Array<number>(8).fill(0);                                    // save the won number of 8 gift types

    for (let index = 0; index < actionInfo.boxAmount.toNumber(); index++) {
     const ration = luckyTemp.and(65535)
      if (ration.lte(ratio8)) {
          if (ration.lte(ratio1)) {
            result[index] = 1
            counters[0] += 1
          } else if (ration.lte(ratio2)) {
            result[index] = 2
            counters[1] += 1
          } else if (ration.lte(ratio3)) { 
            result[index] = 3
            counters[2] += 1
          } else if (ration.lte(ratio4)) { 
            result[index] = 4
            counters[3] += 1
          } else if (ration.lte(ratio5)) {
            result[index] = 5
            counters[4] += 1
          } else if (ration.lte(ratio6)) { 
            result[index] = 6
            counters[5] += 1
          } else if (ration.lte(ratio7)) { 
            result[index] = 7
            counters[6] += 1
          } else { 
            result[index] = 8         // here must be (ration < uint16(domainInfo >> 64))
            counters[7] += 1
          }
      }
 
      if ((index & 0x0F) == 0x0F) {
        luckyNumber = utils.keccak256(luckyNumber)
        luckyTemp = BigNumber.from(luckyNumber)
      } else {
        luckyTemp = luckyTemp.shr(16)
      }
    }

    let totalWon:number = 0;
    for (let index = 0; index < 8; index++) {
        const offset = totalWon
        totalWon += counters[index];
        counters[index] = offset;
    }

    let wonList = new Array<number>(totalWon).fill(0);
    for (let index = 0; index < actionInfo.boxAmount.toNumber(); index++) {
        const wonType = result[index];
        if (wonType != 0) {
          const offset = counters[wonType-1];                                        // get won offset
          wonList[offset] = (actionInfo.boxStart.toNumber() + index);
          counters[wonType-1] = offset + 1;                                            // move the offset
        }
    }
    return { counters, wonList }

}

export async function getApprovalDigest(
  token: Contract,
  approve: {
    owner: string
    spender: string
    value: BigNumber
  },
  nonce: BigNumber,
  deadline: BigNumber
): Promise<string> {
  const name = await token.name()
  const DOMAIN_SEPARATOR = getDomainSeparator(name, token.address)

  //console.log("name, token.address, DOMAIN_SEPARATOR", name, token.address, DOMAIN_SEPARATOR)
  return utils.keccak256(
    utils.solidityPack(
      ['bytes1', 'bytes1', 'bytes32', 'bytes32'],
      [
        '0x19',
        '0x01',
        DOMAIN_SEPARATOR,
        utils.keccak256(
          utils.defaultAbiCoder.encode(
            ['bytes32', 'address', 'address', 'uint256', 'uint256', 'uint256'],
            [PERMIT_TYPEHASH, approve.owner, approve.spender, approve.value, nonce, deadline]
          )
        )
      ]
    )
  )
}

export function getPermitDigest(
  owner: string,
  spender: string,
  value: BigNumber,
  nonce: BigNumber,
  deadline: BigNumber,

  contracAddress: string,
  domainName: string,
): string {
  const DOMAIN_SEPARATOR = getDomainSeparator(domainName, contracAddress)

  //console.log("domain separator: " + DOMAIN_SEPARATOR)
  //console.log("permit type hash: " +  PERMIT_TYPEHASH)

  return utils.keccak256(
    utils.solidityPack(
      ['bytes1', 'bytes1', 'bytes32', 'bytes32'],
      [
        '0x19',
        '0x01',
        DOMAIN_SEPARATOR,
        utils.keccak256(
          utils.defaultAbiCoder.encode(
            //'Permit(address owner,address spender,uint256 value,uint256 nonce,uint256 deadline)'
            ['bytes32', 'address','address', 'uint256', 'uint256', 'uint256'],
            [PERMIT_TYPEHASH , owner, spender, value, nonce, deadline]
          )
        )
      ]
    )
  )
}

export function getWithdrawDigest( 
  //sender: string,
  receiver: string,
  value: BigNumber,
  nonce: BigNumber,
  contractAddr: string,
  domainName: string
): string {

  const DOMAIN_SEPARATOR = getDomainSeparator(domainName, contractAddr)

  return utils.keccak256(
    utils.solidityPack(
      ['bytes1', 'bytes1', 'bytes32', 'bytes32'],
      [
        '0x19',
        '0x01',
        DOMAIN_SEPARATOR,
        utils.keccak256(
          utils.defaultAbiCoder.encode(
            ['bytes32', 'address', 'uint256', 'uint256'],
            [REWARD_TYPEHASH , receiver, value, nonce]
          )
        )
      ]
    )
  )
}

export function getWithdrawDigestExt( 
  owner: string,
  receiver: string,
  value: BigNumber,
  nonce: BigNumber,
  contractAddr: string,
  domainName: string
): string {

  const DOMAIN_SEPARATOR = getDomainSeparator(domainName, contractAddr)

  return utils.keccak256(
    utils.solidityPack(
      ['bytes1', 'bytes1', 'bytes32', 'bytes32'],
      [
        '0x19',
        '0x01',
        DOMAIN_SEPARATOR,
        utils.keccak256(
          utils.defaultAbiCoder.encode(
            ['bytes32', 'address', 'address', 'uint256', 'uint256'],
            [REWARD_EXT_TYPEHASH, owner, receiver, value, nonce]
          )
        )
      ]
    )
  )
}

export function getWithdrawDepositDigest(
  contractAddr: string,
  domainName: string,
  orderID:  number,
  owner: string,
  amount: BigNumber,
  deadline: BigNumber,
): string {

  const DOMAIN_SEPARATOR = getDomainSeparator(domainName, contractAddr)

  // keccak256("WithdrawDeposit(uint256 orderId,address owner,uint256 amount,uint256 deadline)");
  const WITHDRAW_DEPOSIT_TYPEHASH = utils.keccak256(
    utils.toUtf8Bytes('WithdrawDeposit(uint256 orderId,address owner,uint256 amount,uint256 deadline)')
  )
  
  return utils.keccak256(
    utils.solidityPack(
      ['bytes1', 'bytes1', 'bytes32', 'bytes32'],
      [
        '0x19',
        '0x01',
        DOMAIN_SEPARATOR,
        utils.keccak256(
          utils.defaultAbiCoder.encode(
            ['bytes32', 'uint256', 'address', 'uint256', 'uint256'],
            [WITHDRAW_DEPOSIT_TYPEHASH , orderID, owner, amount, deadline]
          )
        )
      ]
    )
  )
}


export async function mineBlock(provider: providers.Web3Provider, timestamp: number): Promise<void> {
  return provider.send('evm_mine', [timestamp])
}

export function encodePrice(reserve0: BigNumber, reserve1: BigNumber) {
  return [reserve1.mul(BigNumber.from(2).pow(112)).div(reserve0), reserve0.mul(BigNumber.from(2).pow(112)).div(reserve1)]
}


export function sqrt(y: BigNumber): BigNumber {
  let x: BigNumber
  let z: BigNumber
  
  if (y.gt(3)) {
    z = y;
    x = y.div(2).add(1);
    while (x.lt(z)) {
      z = x;
      x = y.div(x).add(x).div(2);
    }
  } else if (y.isZero()) {
    z = BigNumber.from(0);
  } else {
    z = BigNumber.from(1);
  }
  return z
}

export function rpow(x: BigNumber, n: BigNumber): BigNumber {
  let base = BigNumber.from(10).pow(27)
  if (x.eq(0)) {
    if (n.eq(0)) return base
    else return BigNumber.from(0)
  }

  const half = base.div(2)
  let z = n.mod(2).eq(0) ? base: x

  n = n.div(2)
  while(!n.eq(0)) {
    let xx = x.mul(x).add(half)
    x = xx.div(base)
    if (n.mod(2).eq(1)) {
      let zx = z.mul(x).add(half)
      z = zx.div(base)
    }
    n = n.div(2)
  }
  return z
}

/*
    function rpow(uint256 x, uint256 n) internal pure returns (uint256 z) {
        uint256 base = 10 ** 27;
        assembly {
            switch x case 0 {switch n case 0 {z := base} default {z := 0}}
            default {
                switch mod(n, 2) case 0 { z := base } default { z := x }
                let half := div(base, 2)  // for rounding.
                for { n := div(n, 2) } n { n := div(n,2) } {
                    let xx := mul(x, x)
                    if iszero(eq(div(xx, x), x)) { revert(0,0) }
                    let xxRound := add(xx, half)
                    if lt(xxRound, xx) { revert(0,0) }
                    x := div(xxRound, base)
                    if mod(n,2) {
                        let zx := mul(z, x)
                        if and(iszero(iszero(x)), iszero(eq(div(zx, x), z))) { revert(0,0) }
                        let zxRound := add(zx, half)
                        if lt(zxRound, zx) { revert(0,0) }
                        z := div(zxRound, base)
                    }
                }
            }
        }
    }
*/
  
/* 
  library Babylonian {
    function sqrt(uint y) internal pure returns (uint z) {
        if (y > 3) {
            z = y;
            uint x = y / 2 + 1;
            while (x < z) {
                z = x;
                x = (y / x + x) / 2;
            }
        } else if (y != 0) {
            z = 1;
        }
        // else z = 0
    }
}
*/

export const urlData = "data:application/json;base64,eyJuYW1lIjoiQXJrcmVlbkNsaW1hdGVCYWRnZSAjMiIsImRlc2NyaXB0aW9uIjoiUHJvb2Ygb2YgdGhlIGNsaW1hdGUgYWN0aW9ucyBmb3IgY2FyYm9uIG9mZnNldC4iLCJpbWFnZSI6ImRhdGE6aW1hZ2Uvc3ZnK3htbDtiYXNlNjQsUEhOMlp5QjJhV1YzUW05NFBTSXdJREFnTkRBd0lEUXdNQ0lnWm1sc2JEMGlibTl1WlNJZ2VHMXNibk05SW1oMGRIQTZMeTkzZDNjdWR6TXViM0puTHpJd01EQXZjM1puSWlCNGJXeHVjenA0YkdsdWF6MGlhSFIwY0RvdkwzZDNkeTUzTXk1dmNtY3ZNVGs1T1M5NGJHbHVheUkrUEdSbFpuTStQSEJoZEdnZ2FXUTlJbU5sYm5SbGNpSWdaRDBpVFRBZ01qQXNOREF3TERJd0lpQnpkSEp2YTJVOUluZG9hWFJsSWlCbWFXeHNQU0p1YjI1bElpOCtQSEJoZEdnZ2FXUTlJblJ2Y0NJZ2RISmhibk5tYjNKdFBTSjBjbUZ1YzJ4aGRHVW9NVFF3TERRd0tTSWdaRDBpVFNBdE56QWdNVFl5SUVFZ05UQWdOVEFnTUNBeElERWdNVGt3SURFMk1pSXZQanh3WVhSb0lHbGtQU0poWkdSeVpYTnpJaUIwY21GdWMyWnZjbTA5SW5SeVlXNXpiR0YwWlNneE5EQXNOREFwSWlCa1BTSk5JQzA1T0NBeE5qQWdRU0ExTUNBMU1DQXdJREVnTUNBeU1UZ2dNVFl3SWk4K1BDOWtaV1p6UGp4d1lYUm9JR1E5SWsweE56Z3VOVGsySURFeUxqZ3dNamxETVRreExqZzVNU0ExTGpNME5URWdNakE0TGpFd09TQTFMak0wTlRBNUlESXlNUzQwTURRZ01USXVPREF5T1V3eU16WXVNemMwSURJeExqSXdNRFZETWpReUxqazFOQ0F5TkM0NE9URTJJREkxTUM0ek5UVWdNall1T0RjME5TQXlOVGN1T0RrNUlESTJMamsyT0V3eU56VXVNRFl5SURJM0xqRTRNRFZETWprd0xqTXdOU0F5Tnk0ek5qa3pJRE13TkM0ek5TQXpOUzQwTnpnMUlETXhNaTR4TXpVZ05EZ3VOVGcwTmt3ek1qQXVPVEF4SURZekxqTTBNakpETXpJMExqYzFOQ0EyT1M0NE1qZzRJRE16TUM0eE56RWdOelV1TWpRMk15QXpNell1TmpVNElEYzVMakE1T1RKTU16VXhMalF4TlNBNE55NDROalZETXpZMExqVXlNaUE1TlM0Mk5EazRJRE0zTWk0Mk16RWdNVEE1TGpZNU5TQXpOekl1T0RFNUlERXlOQzQ1TXpoTU16Y3pMakF6TWlBeE5ESXVNVEF4UXpNM015NHhNalVnTVRRNUxqWTBOU0F6TnpVdU1UQTRJREUxTnk0d05EWWdNemM0TGpnZ01UWXpMall5Tmt3ek9EY3VNVGszSURFM09DNDFPVFpETXprMExqWTFOU0F4T1RFdU9Ea3hJRE01TkM0Mk5UVWdNakE0TGpFd09TQXpPRGN1TVRrM0lESXlNUzQwTURSTU16YzRMamdnTWpNMkxqTTNORU16TnpVdU1UQTRJREkwTWk0NU5UUWdNemN6TGpFeU5TQXlOVEF1TXpVMUlETTNNeTR3TXpJZ01qVTNMamc1T1V3ek56SXVPREU1SURJM05TNHdOakpETXpjeUxqWXpNU0F5T1RBdU16QTFJRE0yTkM0MU1qSWdNekEwTGpNMUlETTFNUzQwTVRVZ016RXlMakV6TlV3ek16WXVOalU0SURNeU1DNDVNREZETXpNd0xqRTNNU0F6TWpRdU56VTBJRE15TkM0M05UUWdNek13TGpFM01TQXpNakF1T1RBeElETXpOaTQyTlRoTU16RXlMakV6TlNBek5URXVOREUxUXpNd05DNHpOU0F6TmpRdU5USXlJREk1TUM0ek1EVWdNemN5TGpZek1TQXlOelV1TURZeUlETTNNaTQ0TVRsTU1qVTNMamc1T1NBek56TXVNRE15UXpJMU1DNHpOVFVnTXpjekxqRXlOU0F5TkRJdU9UVTBJRE0zTlM0eE1EZ2dNak0yTGpNM05DQXpOemd1T0V3eU1qRXVOREEwSURNNE55NHhPVGRETWpBNExqRXdPU0F6T1RRdU5qVTFJREU1TVM0NE9URWdNemswTGpZMU5TQXhOemd1TlRrMklETTROeTR4T1RkTU1UWXpMall5TmlBek56Z3VPRU14TlRjdU1EUTJJRE0zTlM0eE1EZ2dNVFE1TGpZME5TQXpOek11TVRJMUlERTBNaTR4TURFZ016Y3pMakF6TWt3eE1qUXVPVE00SURNM01pNDRNVGxETVRBNUxqWTVOU0F6TnpJdU5qTXhJRGsxTGpZME9UZ2dNelkwTGpVeU1pQTROeTQ0TmpVZ016VXhMalF4TlV3M09TNHdPVGt5SURNek5pNDJOVGhETnpVdU1qUTJNeUF6TXpBdU1UY3hJRFk1TGpneU9EZ2dNekkwTGpjMU5DQTJNeTR6TkRJeUlETXlNQzQ1TURGTU5EZ3VOVGcwTmlBek1USXVNVE0xUXpNMUxqUTNPRFVnTXpBMExqTTFJREkzTGpNMk9UTWdNamt3TGpNd05TQXlOeTR4T0RBMUlESTNOUzR3TmpKTU1qWXVPVFk0SURJMU55NDRPVGxETWpZdU9EYzBOU0F5TlRBdU16VTFJREkwTGpnNU1UWWdNalF5TGprMU5DQXlNUzR5TURBMUlESXpOaTR6TnpSTU1USXVPREF5T1NBeU1qRXVOREEwUXpVdU16UTFNU0F5TURndU1UQTVJRFV1TXpRMU1Ea2dNVGt4TGpnNU1TQXhNaTQ0TURJNUlERTNPQzQxT1RaTU1qRXVNakF3TlNBeE5qTXVOakkyUXpJMExqZzVNVFlnTVRVM0xqQTBOaUF5Tmk0NE56UTFJREUwT1M0Mk5EVWdNall1T1RZNElERTBNaTR4TURGTU1qY3VNVGd3TlNBeE1qUXVPVE00UXpJM0xqTTJPVE1nTVRBNUxqWTVOU0F6TlM0ME56ZzFJRGsxTGpZME9UZ2dORGd1TlRnME5pQTROeTQ0TmpWTU5qTXVNelF5TWlBM09TNHdPVGt5UXpZNUxqZ3lPRGdnTnpVdU1qUTJNeUEzTlM0eU5EWXpJRFk1TGpneU9EZ2dOemt1TURrNU1pQTJNeTR6TkRJeVREZzNMamcyTlNBME9DNDFPRFEyUXprMUxqWTBPVGdnTXpVdU5EYzROU0F4TURrdU5qazFJREkzTGpNMk9UTWdNVEkwTGprek9DQXlOeTR4T0RBMVRERTBNaTR4TURFZ01qWXVPVFk0UXpFME9TNDJORFVnTWpZdU9EYzBOU0F4TlRjdU1EUTJJREkwTGpnNU1UWWdNVFl6TGpZeU5pQXlNUzR5TURBMVRERTNPQzQxT1RZZ01USXVPREF5T1ZvaUlHWnBiR3c5SWlNeU9ESTRNa1FpSUhOMGNtOXJaVDBpSXpRd05EQTBOeUlnYzNSeWIydGxWMmxrZEdnOUlqRXVNemc0T0RraUx6NDhZMmx5WTJ4bElHTjRQU0l5TURBaUlHTjVQU0l5TURBaUlISTlJakUyTmk0Mk5qY2lJR1pwYkd3OUlpTXlPREk0TWtRaUlITjBjbTlyWlQwaUl6TTBRelEyUlNJZ2MzUnliMnRsVjJsa2RHZzlJakl1TmpZMk5qY2lMejQ4Y21WamRDQjRQU0k0T0NJZ2VUMGlPRGdpSUhkcFpIUm9QU0l5TWpRaUlHaGxhV2RvZEQwaU1qSTBJaUJ5ZUQwaU1URXlJaUJtYVd4c1BTSWpNa1l5UmpNMElpOCtQSEJoZEdnZ1pEMGlUVEU1T0M0NE1qWWdNVFkzTGpVek9Vd3hPREl1TXpZNElERTVNeTQ0T1RoRE1UZ3dMamM0T0NBeE9UWXVOREk1SURFNE1pNDJNRFlnTVRrNUxqY3hPU0F4T0RVdU5UZzRJREU1T1M0M01UbElNalEwTGpBd00wTXlORGN1TXpVM0lERTVPUzQzTVRrZ01qUTVMalF3TXlBeE9UWXVNREkwSURJME55NDJNallnTVRrekxqRTNOVXd5TURVdU5qY2dNVEkxTGprM01VTXlNRE11TURZMklERXlNUzQ0TURFZ01UazNMakF3TnlBeE1qRXVPREF4SURFNU5DNHpPVFlnTVRJMUxqazNNVXd4TlRFdU9Ua2dNVGt6TGpnNU9FTXhOVEF1TkRBNUlERTVOaTQwTWprZ01UVXlMakl5TnlBeE9Ua3VOekU1SURFMU5TNHlNRGtnTVRrNUxqY3hPVWd4TmpRdU5qa3lRekUyTlM0eE56VWdNVGs1TGpjeE9TQXhOalV1TmpVZ01UazVMalU1TmlBeE5qWXVNRGN5SURFNU9TNHpOakZETVRZMkxqUTVOU0F4T1RrdU1USTNJREUyTmk0NE5URWdNVGs0TGpjNE9TQXhOamN1TVRBMklERTVPQzR6TnpsTU1UazRMamd5TmlBeE5EY3VOVFkxUXpFNU9DNDVOVFFnTVRRM0xqTTJJREU1T1M0eE16SWdNVFEzTGpFNU1TQXhPVGt1TXpReklERTBOeTR3TnpSRE1UazVMalUxTlNBeE5EWXVPVFUySURFNU9TNDNPVElnTVRRMkxqZzVOU0F5TURBdU1ETTBJREUwTmk0NE9UVkRNakF3TGpJM05pQXhORFl1T0RrMUlESXdNQzQxTVRRZ01UUTJMamsxTmlBeU1EQXVOekkxSURFME55NHdOelJETWpBd0xqa3pOaUF4TkRjdU1Ua3hJREl3TVM0eE1UUWdNVFEzTGpNMklESXdNUzR5TkRJZ01UUTNMalUyTlV3eU1qSXVPVFF6SURFNE1pNHpNalpETWpJekxqQTNPU0F4T0RJdU5UUXlJREl5TXk0eE5UUWdNVGd5TGpjNU1TQXlNak11TVRZeUlERTRNeTR3TkRaRE1qSXpMakUyT1NBeE9ETXVNekF4SURJeU15NHhNRGdnTVRnekxqVTFNeUF5TWpJdU9UZzFJREU0TXk0M056WkRNakl5TGpnMk1TQXhPRFFnTWpJeUxqWTRJREU0TkM0eE9EWWdNakl5TGpRMk1TQXhPRFF1TXpFMVF6SXlNaTR5TkRFZ01UZzBMalEwTlNBeU1qRXVPVGt4SURFNE5DNDFNVE1nTWpJeExqY3pOaUF4T0RRdU5URXlTREl3T0M0M01URkRNakE0TGpRMU55QXhPRFF1TlRFeElESXdPQzR5TURrZ01UZzBMalEwTWlBeU1EY3VPVGt4SURFNE5DNHpNVE5ETWpBM0xqYzNNeUF4T0RRdU1UZ3pJREl3Tnk0MU9UTWdNVGd6TGprNU55QXlNRGN1TkRjeElERTRNeTQzTnpWRE1qQTNMak0wT0NBeE9ETXVOVFV6SURJd055NHlPRGNnTVRnekxqTXdNU0F5TURjdU1qazBJREU0TXk0d05EaERNakEzTGpNd01TQXhPREl1TnprMElESXdOeTR6TnpZZ01UZ3lMalUwTmlBeU1EY3VOVEVnTVRneUxqTXpNVXd5TURndU5URTVJREU0TUM0M01URkRNakE0TGpZMklERTRNQzQwT0RRZ01qQTRMamN6TlNBeE9EQXVNakl5SURJd09DNDNNelVnTVRjNUxqazFOVU15TURndU56TTFJREUzT1M0Mk9EZ2dNakE0TGpZMklERTNPUzQwTWpZZ01qQTRMalV4T1NBeE56a3VNa3d5TURFdU1qUXlJREUyTnk0MU5EUkRNakF4TGpFeE5TQXhOamN1TXpNNUlESXdNQzQ1TXpjZ01UWTNMakUyT1NBeU1EQXVOekkySURFMk55NHdOVEZETWpBd0xqVXhOU0F4TmpZdU9UTXpJREl3TUM0eU56Y2dNVFkyTGpnM01TQXlNREF1TURNMUlERTJOaTQ0TnpGRE1UazVMamM1TkNBeE5qWXVPRGNnTVRrNUxqVTFOaUF4TmpZdU9UTXlJREU1T1M0ek5EUWdNVFkzTGpBME9FTXhPVGt1TVRNeklERTJOeTR4TmpVZ01UazRMamsxTlNBeE5qY3VNek0wSURFNU9DNDRNallnTVRZM0xqVXpPVm9pSUdacGJHdzlJaU16TkVNME5rVWlMejQ4ZEdWNGRDQjBaWGgwTFdGdVkyaHZjajBpYldsa1pHeGxJaUJtYVd4c1BTSWpNelJETkRaRklqNDhkR1Y0ZEZCaGRHZ2dabTl1ZEMxbVlXMXBiSGs5SWsxdmJuUnpaWEp5WVhRaUlIaHNhVzVyT21oeVpXWTlJaU4wYjNBaUlITjBZWEowVDJabWMyVjBQU0kxTUNVaUlHWnZiblF0YzJsNlpUMGlNalFpSUdadmJuUXRkMlZwWjJoMFBTSTNNREFpUGtGeWEzSmxaVzRnUTJ4cGJXRjBaU0JCWTNScGIyNGdRbUZrWjJVOEwzUmxlSFJRWVhSb1Bqd3ZkR1Y0ZEQ0OGRHVjRkQ0IwWlhoMExXRnVZMmh2Y2owaWJXbGtaR3hsSWlCbWFXeHNQU0lqTXpSRE5EWkZJajQ4ZEdWNGRGQmhkR2dnWm05dWRDMW1ZVzFwYkhrOUlrMXZiblJ6WlhKeVlYUWlJSGhzYVc1ck9taHlaV1k5SWlOaFpHUnlaWE56SWlCemRHRnlkRTltWm5ObGREMGlOVEFsSWlCbWIyNTBMWE5wZW1VOUlqRTJJaUJtYjI1MExYZGxhV2RvZEQwaU5UQXdJajR3ZURFMVpETTBZV0ZtTlRReU5qZGtZamRrTjJNek5qYzRNemxoWVdZM01XRXdNR0V5WXpaaE5qVThMM1JsZUhSUVlYUm9Qand2ZEdWNGRENDhaeUIwY21GdWMyWnZjbTA5SW5SeVlXNXpiR0YwWlNnd0xESXlOeWtpUGp4MFpYaDBJR1p2Ym5RdFptRnRhV3g1UFNKTmIyNTBjMlZ5Y21GMElpQm1iMjUwTFhOcGVtVTlJakkyY0hnaUlHWnZiblF0ZDJWcFoyaDBQU0kzTURBaUlHWnBiR3c5SW5kb2FYUmxJaUIwWlhoMExXRnVZMmh2Y2owaWJXbGtaR3hsSWlCa2IyMXBibUZ1ZEMxaVlYTmxiR2x1WlQwaWJXbGtaR3hsSWo0OGRHVjRkRkJoZEdnZ2VHeHBibXM2YUhKbFpqMGlJMk5sYm5SbGNpSWdjM1JoY25SUFptWnpaWFE5SWpVd0pTSStNekF1TURBd0lFRlNWRHd2ZEdWNGRGQmhkR2crUEM5MFpYaDBQand2Wno0OFp5QjBjbUZ1YzJadmNtMDlJblJ5WVc1emJHRjBaU2d3TERJMU15a2lQanh5WldOMElIZHBaSFJvUFNJME1EQWlJR2hsYVdkb2REMGlOREFpTHo0OGRHVjRkQ0JtYjI1MExXWmhiV2xzZVQwaVRXOXVkSE5sY25KaGRDSWdabTl1ZEMxemFYcGxQU0l4TW5CNElpQm1iMjUwTFhkbGFXZG9kRDBpTkRBd0lpQm1hV3hzUFNJak4wWTNSamhFSWlCMFpYaDBMV0Z1WTJodmNqMGliV2xrWkd4bElpQmtiMjFwYm1GdWRDMWlZWE5sYkdsdVpUMGliV2xrWkd4bElqNDhkR1Y0ZEZCaGRHZ2dlR3hwYm1zNmFISmxaajBpSTJObGJuUmxjaUlnYzNSaGNuUlBabVp6WlhROUlqVXdKU0krVDJabWMyVjBQQzkwWlhoMFVHRjBhRDQ4TDNSbGVIUStQQzluUGp3dmMzWm5QZz09IiwiYXR0cmlidXRlcyI6W3siZGlzcGxheV90eXBlIjoibnVtYmVyIiwidHJhaXRfdHlwZSI6IkFSRUMgQmFkZ2UgSUQiLCJ2YWx1ZSI6Mn0seyJ0cmFpdF90eXBlIjoiUmVuZXdhYmxlIEVuZXJneSIsInZhbHVlIjoiMzAuMDAwIGtXaCJ9LHsiZGlzcGxheV90eXBlIjoiZGF0ZSIsInRyYWl0X3R5cGUiOiJBUkVDIEJhZGdlIFRpbWUiLCJ2YWx1ZSI6MTcwNDA5NzcxN30seyJ0cmFpdF90eXBlIjoiQ2xpbWF0ZSBBY3Rpb24gVHlwZSIsInZhbHVlIjoiT2Zmc2V0In0seyJkaXNwbGF5X3R5cGUiOiJudW1iZXIiLCJ0cmFpdF90eXBlIjoiQ2xpbWF0ZSBBY3Rpb24gTnVtYmVyIiwidmFsdWUiOjN9LHsidHJhaXRfdHlwZSI6IkNsaW1hdGUgQWN0aW9uIElEcyIsInZhbHVlIjoiMiwzLDQifSx7InRyYWl0X3R5cGUiOiJSZXRpcmVkIEFSRUMgTkZUcyIsInZhbHVlIjoiMCJ9LHsidHJhaXRfdHlwZSI6IkFSRUMgQmFkZ2UgRmlsZSIsInZhbHVlIjoiaHR0cHM6Ly9hcmVjLmFya3JlZW4uY29tL2JhZGdlcy9BUkVDX0JhZGdlXzAwMDAwMi5wZGYifV19"
export const urlBadgeData = "data:application/json;base64,eyJuYW1lIjoiQXJrcmVlbkNsaW1hdGVCYWRnZSAjMSIsImRlc2NyaXB0aW9uIjoiUHJvb2Ygb2YgdGhlIGNsaW1hdGUgYWN0aW9ucyBmb3IgY2FyYm9uIG9mZnNldC4iLCJpbWFnZSI6ImRhdGE6aW1hZ2Uvc3ZnK3htbDtiYXNlNjQsUEhOMlp5QjJhV1YzUW05NFBTSXdJREFnTkRBd0lEUXdNQ0lnWm1sc2JEMGlibTl1WlNJZ2VHMXNibk05SW1oMGRIQTZMeTkzZDNjdWR6TXViM0puTHpJd01EQXZjM1puSWlCNGJXeHVjenA0YkdsdWF6MGlhSFIwY0RvdkwzZDNkeTUzTXk1dmNtY3ZNVGs1T1M5NGJHbHVheUkrUEdSbFpuTStQSEJoZEdnZ2FXUTlJbU5sYm5SbGNpSWdaRDBpVFRBZ01qQXNOREF3TERJd0lpQnpkSEp2YTJVOUluZG9hWFJsSWlCbWFXeHNQU0p1YjI1bElpOCtQSEJoZEdnZ2FXUTlJblJ2Y0NJZ2RISmhibk5tYjNKdFBTSjBjbUZ1YzJ4aGRHVW9NVFF3TERRd0tTSWdaRDBpVFNBdE56QWdNVFl5SUVFZ05UQWdOVEFnTUNBeElERWdNVGt3SURFMk1pSXZQanh3WVhSb0lHbGtQU0poWkdSeVpYTnpJaUIwY21GdWMyWnZjbTA5SW5SeVlXNXpiR0YwWlNneE5EQXNOREFwSWlCa1BTSk5JQzA1T0NBeE5qQWdRU0ExTUNBMU1DQXdJREVnTUNBeU1UZ2dNVFl3SWk4K1BDOWtaV1p6UGp4d1lYUm9JR1E5SWsweE56Z3VOVGsySURFeUxqZ3dNamxETVRreExqZzVNU0ExTGpNME5URWdNakE0TGpFd09TQTFMak0wTlRBNUlESXlNUzQwTURRZ01USXVPREF5T1V3eU16WXVNemMwSURJeExqSXdNRFZETWpReUxqazFOQ0F5TkM0NE9URTJJREkxTUM0ek5UVWdNall1T0RjME5TQXlOVGN1T0RrNUlESTJMamsyT0V3eU56VXVNRFl5SURJM0xqRTRNRFZETWprd0xqTXdOU0F5Tnk0ek5qa3pJRE13TkM0ek5TQXpOUzQwTnpnMUlETXhNaTR4TXpVZ05EZ3VOVGcwTmt3ek1qQXVPVEF4SURZekxqTTBNakpETXpJMExqYzFOQ0EyT1M0NE1qZzRJRE16TUM0eE56RWdOelV1TWpRMk15QXpNell1TmpVNElEYzVMakE1T1RKTU16VXhMalF4TlNBNE55NDROalZETXpZMExqVXlNaUE1TlM0Mk5EazRJRE0zTWk0Mk16RWdNVEE1TGpZNU5TQXpOekl1T0RFNUlERXlOQzQ1TXpoTU16Y3pMakF6TWlBeE5ESXVNVEF4UXpNM015NHhNalVnTVRRNUxqWTBOU0F6TnpVdU1UQTRJREUxTnk0d05EWWdNemM0TGpnZ01UWXpMall5Tmt3ek9EY3VNVGszSURFM09DNDFPVFpETXprMExqWTFOU0F4T1RFdU9Ea3hJRE01TkM0Mk5UVWdNakE0TGpFd09TQXpPRGN1TVRrM0lESXlNUzQwTURSTU16YzRMamdnTWpNMkxqTTNORU16TnpVdU1UQTRJREkwTWk0NU5UUWdNemN6TGpFeU5TQXlOVEF1TXpVMUlETTNNeTR3TXpJZ01qVTNMamc1T1V3ek56SXVPREU1SURJM05TNHdOakpETXpjeUxqWXpNU0F5T1RBdU16QTFJRE0yTkM0MU1qSWdNekEwTGpNMUlETTFNUzQwTVRVZ016RXlMakV6TlV3ek16WXVOalU0SURNeU1DNDVNREZETXpNd0xqRTNNU0F6TWpRdU56VTBJRE15TkM0M05UUWdNek13TGpFM01TQXpNakF1T1RBeElETXpOaTQyTlRoTU16RXlMakV6TlNBek5URXVOREUxUXpNd05DNHpOU0F6TmpRdU5USXlJREk1TUM0ek1EVWdNemN5TGpZek1TQXlOelV1TURZeUlETTNNaTQ0TVRsTU1qVTNMamc1T1NBek56TXVNRE15UXpJMU1DNHpOVFVnTXpjekxqRXlOU0F5TkRJdU9UVTBJRE0zTlM0eE1EZ2dNak0yTGpNM05DQXpOemd1T0V3eU1qRXVOREEwSURNNE55NHhPVGRETWpBNExqRXdPU0F6T1RRdU5qVTFJREU1TVM0NE9URWdNemswTGpZMU5TQXhOemd1TlRrMklETTROeTR4T1RkTU1UWXpMall5TmlBek56Z3VPRU14TlRjdU1EUTJJRE0zTlM0eE1EZ2dNVFE1TGpZME5TQXpOek11TVRJMUlERTBNaTR4TURFZ016Y3pMakF6TWt3eE1qUXVPVE00SURNM01pNDRNVGxETVRBNUxqWTVOU0F6TnpJdU5qTXhJRGsxTGpZME9UZ2dNelkwTGpVeU1pQTROeTQ0TmpVZ016VXhMalF4TlV3M09TNHdPVGt5SURNek5pNDJOVGhETnpVdU1qUTJNeUF6TXpBdU1UY3hJRFk1TGpneU9EZ2dNekkwTGpjMU5DQTJNeTR6TkRJeUlETXlNQzQ1TURGTU5EZ3VOVGcwTmlBek1USXVNVE0xUXpNMUxqUTNPRFVnTXpBMExqTTFJREkzTGpNMk9UTWdNamt3TGpNd05TQXlOeTR4T0RBMUlESTNOUzR3TmpKTU1qWXVPVFk0SURJMU55NDRPVGxETWpZdU9EYzBOU0F5TlRBdU16VTFJREkwTGpnNU1UWWdNalF5TGprMU5DQXlNUzR5TURBMUlESXpOaTR6TnpSTU1USXVPREF5T1NBeU1qRXVOREEwUXpVdU16UTFNU0F5TURndU1UQTVJRFV1TXpRMU1Ea2dNVGt4TGpnNU1TQXhNaTQ0TURJNUlERTNPQzQxT1RaTU1qRXVNakF3TlNBeE5qTXVOakkyUXpJMExqZzVNVFlnTVRVM0xqQTBOaUF5Tmk0NE56UTFJREUwT1M0Mk5EVWdNall1T1RZNElERTBNaTR4TURGTU1qY3VNVGd3TlNBeE1qUXVPVE00UXpJM0xqTTJPVE1nTVRBNUxqWTVOU0F6TlM0ME56ZzFJRGsxTGpZME9UZ2dORGd1TlRnME5pQTROeTQ0TmpWTU5qTXVNelF5TWlBM09TNHdPVGt5UXpZNUxqZ3lPRGdnTnpVdU1qUTJNeUEzTlM0eU5EWXpJRFk1TGpneU9EZ2dOemt1TURrNU1pQTJNeTR6TkRJeVREZzNMamcyTlNBME9DNDFPRFEyUXprMUxqWTBPVGdnTXpVdU5EYzROU0F4TURrdU5qazFJREkzTGpNMk9UTWdNVEkwTGprek9DQXlOeTR4T0RBMVRERTBNaTR4TURFZ01qWXVPVFk0UXpFME9TNDJORFVnTWpZdU9EYzBOU0F4TlRjdU1EUTJJREkwTGpnNU1UWWdNVFl6TGpZeU5pQXlNUzR5TURBMVRERTNPQzQxT1RZZ01USXVPREF5T1ZvaUlHWnBiR3c5SWlNeU9ESTRNa1FpSUhOMGNtOXJaVDBpSXpRd05EQTBOeUlnYzNSeWIydGxWMmxrZEdnOUlqRXVNemc0T0RraUx6NDhZMmx5WTJ4bElHTjRQU0l5TURBaUlHTjVQU0l5TURBaUlISTlJakUyTmk0Mk5qY2lJR1pwYkd3OUlpTXlPREk0TWtRaUlITjBjbTlyWlQwaUl6TTBRelEyUlNJZ2MzUnliMnRsVjJsa2RHZzlJakl1TmpZMk5qY2lMejQ4Y21WamRDQjRQU0k0T0NJZ2VUMGlPRGdpSUhkcFpIUm9QU0l5TWpRaUlHaGxhV2RvZEQwaU1qSTBJaUJ5ZUQwaU1URXlJaUJtYVd4c1BTSWpNa1l5UmpNMElpOCtQSEJoZEdnZ1pEMGlUVEU1T0M0NE1qWWdNVFkzTGpVek9Vd3hPREl1TXpZNElERTVNeTQ0T1RoRE1UZ3dMamM0T0NBeE9UWXVOREk1SURFNE1pNDJNRFlnTVRrNUxqY3hPU0F4T0RVdU5UZzRJREU1T1M0M01UbElNalEwTGpBd00wTXlORGN1TXpVM0lERTVPUzQzTVRrZ01qUTVMalF3TXlBeE9UWXVNREkwSURJME55NDJNallnTVRrekxqRTNOVXd5TURVdU5qY2dNVEkxTGprM01VTXlNRE11TURZMklERXlNUzQ0TURFZ01UazNMakF3TnlBeE1qRXVPREF4SURFNU5DNHpPVFlnTVRJMUxqazNNVXd4TlRFdU9Ua2dNVGt6TGpnNU9FTXhOVEF1TkRBNUlERTVOaTQwTWprZ01UVXlMakl5TnlBeE9Ua3VOekU1SURFMU5TNHlNRGtnTVRrNUxqY3hPVWd4TmpRdU5qa3lRekUyTlM0eE56VWdNVGs1TGpjeE9TQXhOalV1TmpVZ01UazVMalU1TmlBeE5qWXVNRGN5SURFNU9TNHpOakZETVRZMkxqUTVOU0F4T1RrdU1USTNJREUyTmk0NE5URWdNVGs0TGpjNE9TQXhOamN1TVRBMklERTVPQzR6TnpsTU1UazRMamd5TmlBeE5EY3VOVFkxUXpFNU9DNDVOVFFnTVRRM0xqTTJJREU1T1M0eE16SWdNVFEzTGpFNU1TQXhPVGt1TXpReklERTBOeTR3TnpSRE1UazVMalUxTlNBeE5EWXVPVFUySURFNU9TNDNPVElnTVRRMkxqZzVOU0F5TURBdU1ETTBJREUwTmk0NE9UVkRNakF3TGpJM05pQXhORFl1T0RrMUlESXdNQzQxTVRRZ01UUTJMamsxTmlBeU1EQXVOekkxSURFME55NHdOelJETWpBd0xqa3pOaUF4TkRjdU1Ua3hJREl3TVM0eE1UUWdNVFEzTGpNMklESXdNUzR5TkRJZ01UUTNMalUyTlV3eU1qSXVPVFF6SURFNE1pNHpNalpETWpJekxqQTNPU0F4T0RJdU5UUXlJREl5TXk0eE5UUWdNVGd5TGpjNU1TQXlNak11TVRZeUlERTRNeTR3TkRaRE1qSXpMakUyT1NBeE9ETXVNekF4SURJeU15NHhNRGdnTVRnekxqVTFNeUF5TWpJdU9UZzFJREU0TXk0M056WkRNakl5TGpnMk1TQXhPRFFnTWpJeUxqWTRJREU0TkM0eE9EWWdNakl5TGpRMk1TQXhPRFF1TXpFMVF6SXlNaTR5TkRFZ01UZzBMalEwTlNBeU1qRXVPVGt4SURFNE5DNDFNVE1nTWpJeExqY3pOaUF4T0RRdU5URXlTREl3T0M0M01URkRNakE0TGpRMU55QXhPRFF1TlRFeElESXdPQzR5TURrZ01UZzBMalEwTWlBeU1EY3VPVGt4SURFNE5DNHpNVE5ETWpBM0xqYzNNeUF4T0RRdU1UZ3pJREl3Tnk0MU9UTWdNVGd6TGprNU55QXlNRGN1TkRjeElERTRNeTQzTnpWRE1qQTNMak0wT0NBeE9ETXVOVFV6SURJd055NHlPRGNnTVRnekxqTXdNU0F5TURjdU1qazBJREU0TXk0d05EaERNakEzTGpNd01TQXhPREl1TnprMElESXdOeTR6TnpZZ01UZ3lMalUwTmlBeU1EY3VOVEVnTVRneUxqTXpNVXd5TURndU5URTVJREU0TUM0M01URkRNakE0TGpZMklERTRNQzQwT0RRZ01qQTRMamN6TlNBeE9EQXVNakl5SURJd09DNDNNelVnTVRjNUxqazFOVU15TURndU56TTFJREUzT1M0Mk9EZ2dNakE0TGpZMklERTNPUzQwTWpZZ01qQTRMalV4T1NBeE56a3VNa3d5TURFdU1qUXlJREUyTnk0MU5EUkRNakF4TGpFeE5TQXhOamN1TXpNNUlESXdNQzQ1TXpjZ01UWTNMakUyT1NBeU1EQXVOekkySURFMk55NHdOVEZETWpBd0xqVXhOU0F4TmpZdU9UTXpJREl3TUM0eU56Y2dNVFkyTGpnM01TQXlNREF1TURNMUlERTJOaTQ0TnpGRE1UazVMamM1TkNBeE5qWXVPRGNnTVRrNUxqVTFOaUF4TmpZdU9UTXlJREU1T1M0ek5EUWdNVFkzTGpBME9FTXhPVGt1TVRNeklERTJOeTR4TmpVZ01UazRMamsxTlNBeE5qY3VNek0wSURFNU9DNDRNallnTVRZM0xqVXpPVm9pSUdacGJHdzlJaU16TkVNME5rVWlMejQ4ZEdWNGRDQjBaWGgwTFdGdVkyaHZjajBpYldsa1pHeGxJaUJtYVd4c1BTSWpNelJETkRaRklqNDhkR1Y0ZEZCaGRHZ2dabTl1ZEMxbVlXMXBiSGs5SWsxdmJuUnpaWEp5WVhRaUlIaHNhVzVyT21oeVpXWTlJaU4wYjNBaUlITjBZWEowVDJabWMyVjBQU0kxTUNVaUlHWnZiblF0YzJsNlpUMGlNalFpSUdadmJuUXRkMlZwWjJoMFBTSTNNREFpUGtGeWEzSmxaVzRnUTJ4cGJXRjBaU0JCWTNScGIyNGdRbUZrWjJVOEwzUmxlSFJRWVhSb1Bqd3ZkR1Y0ZEQ0OGRHVjRkQ0IwWlhoMExXRnVZMmh2Y2owaWJXbGtaR3hsSWlCbWFXeHNQU0lqTXpSRE5EWkZJajQ4ZEdWNGRGQmhkR2dnWm05dWRDMW1ZVzFwYkhrOUlrMXZiblJ6WlhKeVlYUWlJSGhzYVc1ck9taHlaV1k5SWlOaFpHUnlaWE56SWlCemRHRnlkRTltWm5ObGREMGlOVEFsSWlCbWIyNTBMWE5wZW1VOUlqRTJJaUJtYjI1MExYZGxhV2RvZEQwaU5UQXdJajR3ZURFMVpETTBZV0ZtTlRReU5qZGtZamRrTjJNek5qYzRNemxoWVdZM01XRXdNR0V5WXpaaE5qVThMM1JsZUhSUVlYUm9Qand2ZEdWNGRENDhaeUIwY21GdWMyWnZjbTA5SW5SeVlXNXpiR0YwWlNnd0xESXlOeWtpUGp4MFpYaDBJR1p2Ym5RdFptRnRhV3g1UFNKTmIyNTBjMlZ5Y21GMElpQm1iMjUwTFhOcGVtVTlJakkyY0hnaUlHWnZiblF0ZDJWcFoyaDBQU0kzTURBaUlHWnBiR3c5SW5kb2FYUmxJaUIwWlhoMExXRnVZMmh2Y2owaWJXbGtaR3hsSWlCa2IyMXBibUZ1ZEMxaVlYTmxiR2x1WlQwaWJXbGtaR3hsSWo0OGRHVjRkRkJoZEdnZ2VHeHBibXM2YUhKbFpqMGlJMk5sYm5SbGNpSWdjM1JoY25SUFptWnpaWFE5SWpVd0pTSStNakF1TURBd0lFRlNWRHd2ZEdWNGRGQmhkR2crUEM5MFpYaDBQand2Wno0OFp5QjBjbUZ1YzJadmNtMDlJblJ5WVc1emJHRjBaU2d3TERJMU15a2lQanh5WldOMElIZHBaSFJvUFNJME1EQWlJR2hsYVdkb2REMGlOREFpTHo0OGRHVjRkQ0JtYjI1MExXWmhiV2xzZVQwaVRXOXVkSE5sY25KaGRDSWdabTl1ZEMxemFYcGxQU0l4TW5CNElpQm1iMjUwTFhkbGFXZG9kRDBpTkRBd0lpQm1hV3hzUFNJak4wWTNSamhFSWlCMFpYaDBMV0Z1WTJodmNqMGliV2xrWkd4bElpQmtiMjFwYm1GdWRDMWlZWE5sYkdsdVpUMGliV2xrWkd4bElqNDhkR1Y0ZEZCaGRHZ2dlR3hwYm1zNmFISmxaajBpSTJObGJuUmxjaUlnYzNSaGNuUlBabVp6WlhROUlqVXdKU0krVDJabWMyVjBQQzkwWlhoMFVHRjBhRDQ4TDNSbGVIUStQQzluUGp3dmMzWm5QZz09IiwiYXR0cmlidXRlcyI6W3siZGlzcGxheV90eXBlIjoibnVtYmVyIiwidHJhaXRfdHlwZSI6IkFSRUMgQmFkZ2UgSUQiLCJ2YWx1ZSI6MX0seyJ0cmFpdF90eXBlIjoiUmVuZXdhYmxlIEVuZXJneSIsInZhbHVlIjoiMjAuMDAwIGtXaCJ9LHsiZGlzcGxheV90eXBlIjoiZGF0ZSIsInRyYWl0X3R5cGUiOiJBUkVDIEJhZGdlIFRpbWUiLCJ2YWx1ZSI6MTcwNDA5OTMyOH0seyJ0cmFpdF90eXBlIjoiQ2xpbWF0ZSBBY3Rpb24gVHlwZSIsInZhbHVlIjoiT2Zmc2V0In0seyJkaXNwbGF5X3R5cGUiOiJudW1iZXIiLCJ0cmFpdF90eXBlIjoiQ2xpbWF0ZSBBY3Rpb24gTnVtYmVyIiwidmFsdWUiOjJ9LHsidHJhaXRfdHlwZSI6IkNsaW1hdGUgQWN0aW9uIElEcyIsInZhbHVlIjoiMSwyIn0seyJ0cmFpdF90eXBlIjoiUmV0aXJlZCBBUkVDIE5GVHMiLCJ2YWx1ZSI6IjAifSx7InRyYWl0X3R5cGUiOiJBUkVDIEJhZGdlIEZpbGUiLCJ2YWx1ZSI6Imh0dHBzOi8vYXJlYy5hcmtyZWVuLmNvbS9iYWRnZXMvQVJFQ19CYWRnZV8wMDAwMDEucGRmIn1dfQ==" 
