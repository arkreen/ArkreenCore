//import '@primitivefi/hardhat-dodoc';
import { HardhatUserConfig } from "hardhat/config"
import "@nomicfoundation/hardhat-toolbox"
import '@typechain/hardhat'
import '@nomiclabs/hardhat-ethers'
import "hardhat-deploy"
import "@nomiclabs/hardhat-etherscan"
//import "@nomicfoundation/hardhat-verify"

import "hardhat-storage-layout"
import '@nomiclabs/hardhat-waffle'
import "hardhat-contract-sizer"
import 'hardhat-ignore-warnings'
import "hardhat-gas-reporter"
import "solidity-coverage"
import "@openzeppelin/hardhat-upgrades"
//import { NetworkUserConfig } from "hardhat/types";
import * as readlineSync from 'readline-sync';
import { Wallet } from 'ethers'

import { config as dotEnvConfig } from "dotenv"

dotEnvConfig()

function getAPIKey(network: string): string {
  let apiKey: string
  if(network == 'matic') {
    apiKey = process.env.POLYGONSCAN_API_KEY as string
  } else if(network =='matic_test') {
    apiKey = process.env.POLYGONSCAN_API_KEY as string
  } else if((network == 'bsc' || network == 'bsc_test')) {
      apiKey = process.env.BSCSCAN_API_KEY as string
  } else if((network == 'celo')||(network ==='celo_test')) {
    apiKey = process.env.CELOSCAN_API_KEY as string
  } else if((network == 'dione')||(network ==='dione_test')) {
    apiKey = process.env.CELOSCAN_API_KEY as string
  } else if((network == 'hashkey')||(network =='hashkey_test')) {
    apiKey = 'abc'                                                        // Can be anything
  } else {
    apiKey = process.env.ETHERSCAN_API_KEY as string
  }
  return apiKey
}

//  url = `https://polygon-mainnet.infura.io/v3/` + projectID
//  url = `https://polygon-mumbai.infura.io/v3/` + projectID
// `https://polygon-rpc.com/`
// https://rpc-mumbai.maticvigil.com
// https://rpc.ankr.com/polygon_mumbai
// https://celo-mainnet.infura.io/v3/0ab4ce267db54906802cb43b24e5b0f7
// https://celo-alfajores.infura.io/v3/0ab4ce267db54906802cb43b24e5b0f7
// https://rpc-amoy.polygon.technology/ （OK）
// https://80002.rpc.thirdweb.com       （NOK）
// https://api-amoy.polygonscan.com/api


function getURL(network:string): string {
  let url: string
  let projectID = process.env.PROJECT_ID
  if(network === 'celo') {
    url = `https://celo-mainnet.infura.io/v3/` + projectID
  } else if(network === 'celo_test') {
    // url = `https://celo-alfajores.infura.io/v3/` + projectID
    url = `https://alfajores-forno.celo-testnet.org`
    //url = "https://celo-alfajores.drpc.org"
  } else if(network === 'dione') {
    // url = `https://odyssey.storyrpc.io`
    url = `https://api.odysseyscan.com//api/v1/`
  } else if(network === 'dione_test') {
    url = `https://api-testnet.odysseyscan.com//api/v1/`
  } else if(network === 'hashkey') {
    url = `https://mainnet.hsk.xyz`
  } else if(network === 'hashkey_test') {
    url = `https://hashkeychain-testnet.alt.technology`
  } else if(network === 'matic') {
//  url = `https://polygon-mainnet.infura.io/v3/` + projectID
    url = `https://polygon.llamarpc.com`
  } else if(network === 'matic_test') {
    url = `https://rpc-amoy.polygon.technology/`
  } else if(network === 'bsc') {
    url = `https://bsc-mainnet.infura.io/v3` + projectID
  } else if(network === 'bsc_test') {
    url = `https://bsc-testnet.infura.io/v3/` + projectID
  } else if(network === 'goerli') {
    url = `https://goerli.infura.io/v3/`+ projectID
  } else if(network === 'rinkeby') {
    url = `https://rinkeby.infura.io/v3/`+ projectID    
  } else {
    url = `https://mainnet.infura.io/v3/`+ projectID
  }
  return url
}

const config: HardhatUserConfig = {
  defaultNetwork: "hardhat",
  networks: {
    hardhat: {
      chainId: 31337,
      accounts: {
        mnemonic: "test test test test test test test test test test test junk",
      },
    },
    goerli: {
      url: getURL("goerli"),
      accounts: [process.env.ETH_RINKEBY_PRIVATE_KEY as string],
    },     
    rinkeby: {
      url: getURL("rinkeby"),
      accounts: [process.env.ETH_RINKEBY_PRIVATE_KEY as string],
    },
    celo_test: {
      url: getURL("celo_test"),
      accounts: [process.env.MATIC_TESTNET_PRIVATE_KEY as string, process.env.BSC_TESTNET_CONFIRM_KEY as string],
    },
    celo: {
      url: getURL("celo"),
      chainId: 42220,
      accounts: [process.env.MATIC_PRIVATE_KEY as string, process.env.MATIC_CONTROLLER_KEY as string],
    },
    dione_test: {
      url: getURL("dione_test"),
      chainId: 131313,
      accounts: [process.env.MATIC_TESTNET_PRIVATE_KEY as string, process.env.MATIC_TESTNET_CONFIRM_KEY as string],
//      ignition: {
//        maxFeePerGasLimit: 50_000_000_000_000_000n,
//      },
    },
    dione: {
      url: getURL("dione"),
      chainId: 153153,
      accounts: [process.env.MATIC_PRIVATE_KEY as string, process.env.MATIC_CONTROLLER_KEY as string],
    },

    hashkey_test: {
      url: getURL("hashkey_test"),
      chainId: 133,
      accounts: [process.env.MATIC_TESTNET_HSK_PRIVATE_KEY as string, process.env.BSC_TESTNET_CONFIRM_KEY as string],
    },
    hashkey: {
      url: getURL("hashkey"),
      chainId: 177,
      accounts: [process.env.MATIC_TESTNET_HSK_PRIVATE_KEY as string, process.env.BSC_TESTNET_CONFIRM_KEY as string],
    },
   
    matic_test: {
      url: getURL("matic_test"),
      accounts: [process.env.MATIC_TESTNET_PRIVATE_KEY as string, process.env.MATIC_TESTNET_CONFIRM_KEY as string],
    },
    matic: {
      url: getURL("matic"),
      chainId: 137,
      accounts: [process.env.MATIC_PRIVATE_KEY as string, process.env.MATIC_CONTROLLER_KEY as string],
    },
    bsc_test: {
      url: getURL("bsc_test"),
      accounts: [process.env.BSC_TESTNET_PRIVATE_KEY as string, process.env.BSC_TESTNET_CONFIRM_KEY as string],
    },
    bsc: {
      url: getURL("bsc"),
      accounts: [process.env.BSC_MAINNET_PRIVATE_KEY as string],
    },    
  },
  solidity: {
    compilers: [
      {
        version: "0.6.6",
        settings: {
          metadata: {
            bytecodeHash: "none",
          },
          optimizer: {
            enabled: true,
            runs: 500,
          },
        },
      },
      {
        version: "0.6.12",
        settings: {
          metadata: {
            bytecodeHash: "none",
          },
          optimizer: {
            enabled: true,
            runs: 500,
          },
        },
      },
      {
        version: "0.7.6",
        settings: {
          metadata: {
            bytecodeHash: "none",
          },
          optimizer: {
            enabled: true,
            runs: 500,
          },
        },
      },
      {
        version: "0.8.9",
        settings: {
          metadata: {
            bytecodeHash: "none",
          },
          optimizer: {
            enabled: true,
            runs: 500,
          },
        },
      },
      {
        version: "0.8.18",
        settings: {
          metadata: {
            bytecodeHash: "none",
          },
          optimizer: {
            enabled: true,
            runs: 200,
          },
        },
      },
    ],
    settings: {
        outputSelection: {
            "*": {
                "*": ["storageLayout"],
            },
        },
    },
    overrides: {
      "contracts/GreenBTC.sol": {
        version: "0.8.9",
        settings: {
          metadata: {
            bytecodeHash: "none",
            useLiteralContent: true
          },
          optimizer: {
            enabled: true,
            runs: 0,
          },
          outputSelection: {
            "*": {
                "*": ["storageLayout"],
            },
          },
        },
      },
      "contracts/ArkreenRECIssuance.sol": {
        version: "0.8.9",
        settings: {
          metadata: {
            bytecodeHash: "none",
            useLiteralContent: true
          },
          optimizer: {
            enabled: true,
            runs: 100,
          },
          outputSelection: {
            "*": {
                "*": ["storageLayout"],
            },
          },
        },
      },
      "contracts/test/ArkreenMinerU.sol": {
        version: "0.8.9",
        settings: {
          metadata: {
            bytecodeHash: "none",
          },
          optimizer: {
            enabled: true,
            runs: 200,
          },
        },
      },
    },
  },
  typechain: {
    outDir: "./typechain",
    target: "ethers-v5",
  },
  etherscan: {
    apiKey: {
      celo:         getAPIKey("celo"),
      celo_test:    getAPIKey("celo_test"),
      hashkey:      getAPIKey("hashkey"),
      hashkey_test: getAPIKey("hashkey_test"),
      dione:        getAPIKey("dione"),
      dione_test:   getAPIKey("dione_test"),
      matic:        getAPIKey("matic"),
      matic_test:   getAPIKey("matic_test"),
      bsc:          getAPIKey("bsc"),
      bsc_test:     getAPIKey("bsc_test"),
      mainnet:      getAPIKey("mainnet"),
      ropsten:      getAPIKey("ropsten"),
      rinkeby:      getAPIKey("rinkeby"),
      goerli:       getAPIKey("goerli"),
      kovan:        getAPIKey("kovan"),
    },
    customChains: [
      {
        network: "dione",
        chainId: 153153,
        urls: {
          apiURL: "https://api.odysseyscan.com//api/v1/",
          browserURL: "https://odysseyscan.com/"
        }
      },
      {
        network: "dione_test",
        chainId: 131313,
        urls: {
          apiURL: "https://api-testnet.odysseyscan.com//api/v1/",
          browserURL: "https://testnet.odysseyscan.com/"
        }
      },
      {
        network: "hashkey",
        chainId: 177,
        urls: {
          apiURL: "https://mainnet.hsk.xyz",
          browserURL: "https://hashkey.blockscout.com/"
        }
      },
      {
        network: "hashkey_test",
        chainId: 133,
        urls: {
          apiURL: "https://hashkeychain-testnet-explorer.alt.technology:443/api",
          browserURL: "https://hashkeychain-testnet-explorer.alt.technology:443/"
        }
      },
      {
        network: "celo",
        chainId: 42220,
        urls: {
          apiURL: getURL("celo"),
          browserURL: "https://celoscan.io/"
        }
      },
      {
        network: "celo_test",
        chainId: 44787,
        urls: {
          apiURL: "https://api-alfajores.celoscan.io/",
          browserURL: "https://alfajores.celoscan.io/"
        }
      },
      {
        network: "matic",
        chainId: 137,
        urls: {
          apiURL: "https://api.polygonscan.com",
          browserURL: "https://polygonscan.com/"
        }
      },
      {
        network: "matic_test",
        chainId: 80002,
        urls: {
          apiURL: "https://api-amoy.polygonscan.com",
          browserURL: "https://amoy.polygonscan.com/"
        }
      },
      {
        network: "bsc",
        chainId: 56,
        urls: {
          apiURL: "https://api.bscscan.com/api",
          browserURL: "https://bscscan.com/"
        }
      },
      {
        network: "bsc_test",
        chainId: 97,
        urls: {
          apiURL: "https://api-testnet.bscscan.com/api",
          browserURL: "https://testnet.bscscan.com/"
        }
      },
    ]
  },  
  namedAccounts: {
    deployer: 0,
    tokenOwner: 1,
  },
  contractSizer: {
    alphaSort:          false,
    runOnCompile:       false,
    disambiguatePaths:  false,
  },
  mocha: {
    timeout: 1000000
  },
  paths: {
    artifacts: "./artifacts",
    cache: "./cache",
    sources: "./contracts",
    tests: "./test",                // "./test", "./test/GreenBTC" GreenBTC
    deploy: "./deploy/script",
    deployments: "./deployments",
  },
//  ignition: {
//    requiredConfirmations: 1,
//    strategyConfig: {
//      create2: {
//        salt: "0x0000000000000000000000000000000000000000000000000000000000000000",
//      },
//    },
//  },
};

export default config;