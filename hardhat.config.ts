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
  } else if((network == 'linea' || network == 'linea_test')) {
    apiKey = process.env.LINEASCAN_API_KEY as string
  } else if((network == 'xlayer' || network == 'xlayer_test')) {
    apiKey = process.env.OKXSCAN_API_KEY as string
  } else if((network == 'bsc' || network == 'bsc_test')) {
      apiKey = process.env.BSCSCAN_API_KEY as string
  } else if((network == 'base' || network == 'base_test')) {
      apiKey = process.env.BASESCAN_API_KEY as string
  } else if((network == 'op' || network == 'op_test')) {
      apiKey = process.env.OPSCAN_API_KEY as string
  } else if((network == 'arb' || network == 'arb_test')) {
      apiKey = process.env.ARBSCAN_API_KEY as string
  } else if((network == 'celo')||(network ==='celo_test')) {
    apiKey = process.env.CELOSCAN_API_KEY as string
  } else if((network == 'dione')||(network ==='dione_test')) {
    apiKey = process.env.CELOSCAN_API_KEY as string
  } else if((network == 'hashkey')||(network =='hashkey_test')) {
    apiKey = 'abc'                                                        // Can be anything
  } else if((network == 'soneium')||(network =='soneium_test')) {
    apiKey = 'abc'                                                        // Can be anything
  } else if((network == 'avx')||(network =='avx_test')) {
    apiKey = process.env.AVX_API_KEY as string
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
  } else if(network === 'soneium') {
    url = `https://rpc.soneium.org`
  } else if(network === 'soneium_test') {
    url = `https://soneium-minato.drpc.org`
  } else if(network === 'matic') {
//    url = `https://polygon-mainnet.infura.io/v3/` + projectID
    url = `https://polygon-rpc.com`
  } else if(network === 'matic_test') {
    url = `https://rpc-amoy.polygon.technology/`
  } else if(network === 'xlayer') {
    url = `https://xlayerrpc.okx.com`
  } else if(network === 'xlayer_test') {
    url = `https://testrpc.xlayer.tech`
    //url = `https://xlayertestrpc.okx.com`
  } else if(network === 'linea') {
    url = `https://linea.drpc.org`
  } else if(network === 'linea_test') {
    url = `https://rpc.sepolia.linea.build`
  } else if(network === 'bsc') {
//  url = `https://bsc-mainnet.infura.io/v3` + projectID
    url = `https://bsc-dataseed1.bnbchain.org`
//  url = `https://bsc.meowrpc.com`
  } else if(network === 'bsc_test') {
    url = `https://bsc-testnet.infura.io/v3/` + projectID
  } else if(network === 'base') {
    url = `https://mainnet.base.org`
  } else if(network === 'base_test') {
    url = `https://sepolia.base.org`
  } else if(network === 'op') {
    url = `https://mainnet.optimism.io`
  } else if(network === 'op_test') {
    url = `https://sepolia.optimism.io`
  } else if(network === 'arb') {
    url = `https://arbitrum.drpc.org`
  } else if(network === 'arb_test') {
    url = `https://arbitrum-sepolia.drpc.org`
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

    soneium_test: {
      url: getURL("soneium_test"),
      chainId: 1946,
      accounts: [process.env.MATIC_TESTNET_PRIVATE_KEY as string, process.env.MATIC_TESTNET_CONFIRM_KEY as string],
    },
    soneium: {
      url: getURL("soneium"),
      chainId: 1868, 
      accounts: [process.env.MATIC_PRIVATE_KEY as string, process.env.MATIC_CONTROLLER_KEY as string],
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
    xlayer_test: {
      url: getURL("xlayer_test"),
      accounts: [process.env.BSC_TESTNET_PRIVATE_KEY as string, process.env.BSC_TESTNET_CONFIRM_KEY as string],
    },
    xlayer: {
      url: getURL("xlayer"),
      accounts: [process.env.BSC_MAINNET_PRIVATE_KEY as string, process.env.BSC_TESTNET_CONFIRM_KEY as string],
    },
    linea_test: {
      url: getURL("linea_test"),
      accounts: [process.env.BSC_TESTNET_PRIVATE_KEY as string, process.env.BSC_TESTNET_CONFIRM_KEY as string],
    },
    linea: {
      url: getURL("linea"),
      accounts: [process.env.BSC_MAINNET_PRIVATE_KEY as string, process.env.BSC_TESTNET_CONFIRM_KEY as string],
    },
    bsc_test: {
      url: getURL("bsc_test"),
      accounts: [process.env.BSC_TESTNET_PRIVATE_KEY as string, process.env.BSC_TESTNET_CONFIRM_KEY as string],
    },
    bsc: {
      url: getURL("bsc"),
      accounts: [process.env.BSC_MAINNET_PRIVATE_KEY as string, process.env.BSC_TESTNET_CONFIRM_KEY as string],
    },
    base_test: {
      url: getURL("base_test"),
      accounts: [process.env.BSC_TESTNET_PRIVATE_KEY as string, process.env.BSC_TESTNET_CONFIRM_KEY as string],
    },
    base: {
      url: getURL("base"),
      accounts: [process.env.BSC_MAINNET_PRIVATE_KEY as string],
    }, 
    op_test: {
      url: getURL("op_test"),
      accounts: [process.env.BSC_TESTNET_PRIVATE_KEY as string, process.env.BSC_TESTNET_CONFIRM_KEY as string],
    },
    op: {
      url: getURL("op"),
      accounts: [process.env.BSC_MAINNET_PRIVATE_KEY as string],
    }, 
    arb_test: {
      url: getURL("arb_test"),
      accounts: [process.env.BSC_TESTNET_PRIVATE_KEY as string, process.env.BSC_TESTNET_CONFIRM_KEY as string],
    },
    arb: {
      url: getURL("arb"),
      accounts: [process.env.BSC_MAINNET_PRIVATE_KEY as string],
    }, 
   

  },
  solidity: {
    compilers: [
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
          //evmVersion: "cancun",
          // Suppress transient storage warnings
          metadata: { 
            bytecodeHash: "none",
            useLiteralContent: true 
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
      soneium:      getAPIKey("soneium"),
      soneium_test: getAPIKey("soneium_test"),
      dione:        getAPIKey("dione"),
      dione_test:   getAPIKey("dione_test"),
      matic:        getAPIKey("matic"),
      matic_test:   getAPIKey("matic_test"),
      xlayer:       getAPIKey("xlayer"),
      xlayer_test:  getAPIKey("xlayer_test"),
      linea:        getAPIKey("linea"),
      linea_test:   getAPIKey("linea_test"),
      bsc:          getAPIKey("bsc"),
      bsc_test:     getAPIKey("bsc_test"),
      base:         getAPIKey("base"),
      base_test:    getAPIKey("base_test"),
      op:           getAPIKey("op"),
      op_test:      getAPIKey("op_test"),
      arb:          getAPIKey("arb"),
      arb_test:     getAPIKey("arb_test"),
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
        network: "soneium",
        chainId: 1868,
        urls: {
          apiURL: "https://soneium.blockscout.com/api",
          browserURL: "https://soneium.blockscout.com"
        }
      },
      {
        network: "soneium_test",
        chainId: 1946,
        urls: {
          apiURL: "https://soneium-minato.blockscout.com/api",
          browserURL: "https://soneium-minato.blockscout.com"
        }
      },

      {
        network: "avx",
        chainId: 43114,
        urls: {
          apiURL: "https://api.routescan.io/v2/network/mainnet/evm/43114/etherscan/api",
          browserURL: "https://snowtrace.io"
        }
      },
      {
        network: "avx_test",
        chainId: 43113,
        urls: {
          apiURL: "https://api.routescan.io/v2/network/testnet/evm/43113/etherscan/api",
          browserURL: "https://testnet.snowtrace.io"
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
          apiURL: "https://api-alfajores.celoscan.io",
          browserURL: "https://alfajores.celoscan.io"
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
        network: "xlayer",
        chainId: 196,
        urls: {
          apiURL: "https://www.oklink.com/api/v5/explorer/contract/verify-source-code-plugin/XLAYER",
          browserURL: "https://www.oklink.com/xlayer"
        }
      },
      {
        network: "xlayer_test",
        chainId: 195,
        urls: {
          apiURL: "https://www.oklink.com/api/v5/explorer/contract/verify-source-code-plugin/XLAYER_TESTNET",
          browserURL: "https://www.oklink.com/xlayer-test"
        }
      },
      {
        network: "linea",
        chainId: 59144,
        urls: {
          apiURL: "https://api.lineascan.build/api",
          browserURL: "https://lineascan.build"
        }
      },
      {
        network: "linea_test",
        chainId: 59141,
        urls: {
          apiURL: "https://api-sepolia.lineascan.build/api",
          browserURL: "https://sepolia.lineascan.build/"
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

      {
        network: "base",
        chainId: 8453,
        urls: {
          apiURL: "https://api.basescan.org/api",
          browserURL: "https://basescan.org/"
        }
      },
      {
        network: "base_test",
        chainId: 84532,
        urls: {
          apiURL: "https://api-sepolia.basescan.org/api",
          browserURL: "https://sepolia.basescan.org"
        }
      },
      {
        network: "op",
        chainId: 10,
        urls: {
          apiURL: "https://api-optimistic.etherscan.io/api",
          browserURL: "https://optimistic.etherscan.io/"
        }
      },
      {
        network: "op_test",
        chainId: 11155420,
        urls: {
          apiURL: "https://api-sepolia-optimistic.etherscan.io/api",
          browserURL: "https://sepolia-optimism.etherscan.io/"
        }
      },
      {
        network: "arb",
        chainId: 42161,
        urls: {
          apiURL: "https://api.arbiscan.io/api",
          browserURL: "https://www.arbiscan.io/"
        }
      },
      {
        network: "arb_test",
        chainId: 421614,
        urls: {
          apiURL: "https://api-sepolia.arbiscan.io/api",
          browserURL: "https://sepolia.arbiscan.io/"
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
    timeout: 2000000
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