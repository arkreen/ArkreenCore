import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { CONTRACTS } from "../constants";
import { ethers } from "hardhat";
import { ArkreenRegistry__factory } from "../../typechain";
import { BigNumber, constants } from "ethers";

// Initialize 
const func: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {

    console.log("Initialize ArkreenRegistry: ", CONTRACTS.gRegistry );  

    const defaultGasPrice = (hre.network.name === 'matic_test') ? BigNumber.from(32_000_000_000) : BigNumber.from(300_000_000_000)

    if(hre.network.name === 'matic_test') {
        // Simulation mode 
//      const ArkreenRegistry_address    = '0x047eb5205251c5fc8a21ba8f8d46f57df62013c8'
//      const issuer  = 	"0x576Ab950B8B3B18b7B53F7edd8A47986a44AE6F4"
//      const tokenREC = 	"0x0999afb673944a7b8e1ef8eb0a7c6ffdc0b43e31"
//      const tokenPay = 	"0x54e1c534f59343c56549c76d1bdccc8717129832"

/*
        // 2023/03/28:  Matic testnet Simu
        const ArkreenRegistry_address     = '0x61a914363ef99aabca69504cee5ccfd5523c845d'
        const issuer                      = "0x0AF6Fad1e63De91d5C53Af1dD2e55BB1b278b131"
        const tokenREC                    = "0x58Ac4e54a70b98960Ed5ecF9B9A2cd1AE83879Db"
        const tokenPay                    = "0x6c28fF02d3A132FE52D022db1f25a33d91caeCA2"

        const idAsset =   "AREC_HSK_ESG_BTC"
        const rateToIssue = BigNumber.from(100).mul(BigNumber.from(10).pow(18))
        const rateToLiquidize = 1000
        const description = 	"I-REC ERC20 token to greenize the BTC block while HashKey opening ceremony is held."                        
*/

/*
        // 2023/12/12:  Matic testnet Dev Env for hART
        const ArkreenRegistry_address     = '0xfEcbD33525d9B869e5f3CaB895cd6D7A666209ee'
        const issuer                      = "0x4710E7Fd7A4FBF55ddCcA3105919E2488E5c7D17"
        const tokenREC                    = "0xCAABA1AC075Ba045e8C21F9Ae00347EB4FADA3A1"
        const tokenPay                    = "0x8Ab2299351585097101c91FE4b098d95c18D28a7"

        const idAsset =   "AREC_HSK_ESG_BTC"
        const rateToIssue = BigNumber.from(100).mul(BigNumber.from(10).pow(18))
        const rateToLiquidize = 1000
        const description = "HashKey AREC ERC20 token based on redeemed I-REC."      
*/        
/* 
        // 2023/12/12B:  Matic testnet Dev Env for cART
        const ArkreenRegistry_address     = '0xfEcbD33525d9B869e5f3CaB895cd6D7A666209ee'
        const issuer                      = "0x392a051d030629188d60299232C3bFB34b8Af1e6"
        const tokenREC                    = "0x9031550a0aE38337a19E4eFA372B3e6b0FE94D3f"
        const tokenPay                    = "0x8Ab2299351585097101c91FE4b098d95c18D28a7"
*/
/*
        // 2024/04/15:  Amoy testnet
        const ArkreenRegistry_address     = '0x908C77c31bA81C2FC0Ec15Ce53cFd65f9c4aEECc'
        const issuer                      = "0x392a051d030629188d60299232C3bFB34b8Af1e6"
        const tokenREC                    = "0x78A2620C3fb96100Dc551Db657005eEeF270F0DF"
        const tokenPay                    = "0xd092e1f47d4e5d1C1A3958D7010005e8e9B48206"

        const idAsset =  "Classic Based AREC Token"
        const rateToIssue = BigNumber.from(100).mul(BigNumber.from(10).pow(18))
        const rateToLiquidize = 1000
        const description = 	"Bridged AREC ERC20 token based on redeemed classic REC assets."      

        const [deployer] = await ethers.getSigners();
        const ArkreenRegistryFactory = ArkreenRegistry__factory.connect(ArkreenRegistry_address, deployer);

//      function newAssetAREC(string calldata idAsset, address issuer, address tokenREC, address tokenPay,
//                              uint128 rateToIssue, uint16 rateToLiquidize, string calldata description)
        const updateTxIssuance = await ArkreenRegistryFactory.newAssetAREC(idAsset, issuer, tokenREC,
                                                        tokenPay, rateToIssue, rateToLiquidize, description)
        await updateTxIssuance.wait()
        console.log("ArkreenRegistry newAssetAREC is executed: %s: ", hre.network.name, ArkreenRegistry_address);
*/

        // 2024/04/15:  Amoy testnet dev env, new asset: Universal Arkreen REC Token
        const ArkreenRegistry_address     = '0x908C77c31bA81C2FC0Ec15Ce53cFd65f9c4aEECc'
        const issuer                      = "0xF1CF65Dbfa9cCEe650a053E218F5788F63bDA60E"
        const tokenREC                    = "0x615835Cc22064a17df5A3E8AE22F58e67bCcB778"
        const tokenPay                    = "0xd092e1f47d4e5d1C1A3958D7010005e8e9B48206"    // 2024/05/16: AKRE Amoy

        /*
        const idAsset =  "Universal Arkreen REC Token"
        const rateToIssue = BigNumber.from(100).mul(BigNumber.from(10).pow(18))
        const rateToLiquidize = 1000
        const description = 	"Universal AREC ERC20 token based on redeemed classic REC assets."                        
        */

/*        
        const idAsset =  "ECC Based AREC Asset"
        const rateToIssue = BigNumber.from(100).mul(BigNumber.from(10).pow(18))
        const rateToLiquidize = 1000
        const description = 	"Bridged AREC Asset based on redeemed ECC (Energy Conservation Certificate)."                        

        const [deployer] = await ethers.getSigners();
        const ArkreenRegistryFactory = ArkreenRegistry__factory.connect(ArkreenRegistry_address, deployer);
        
//      function newAssetAREC(string calldata idAsset, address issuer, address tokenREC, address tokenPay,
//                              uint128 rateToIssue, uint16 rateToLiquidize, string calldata description)
        const newAssetARECTx = await ArkreenRegistryFactory.newAssetAREC(idAsset, issuer, tokenREC,
                                                        tokenPay, rateToIssue, rateToLiquidize, description, 
                                                        {gasPrice: defaultGasPrice}
                                                        )
                                                        
        console.log("newAssetAREC: ", newAssetARECTx)
        await newAssetARECTx.wait()
        console.log("ArkreenRegistry newAssetAREC is executed: %s: ", hre.network.name, ArkreenRegistry_address);

        const newAsset1 = await ArkreenRegistryFactory.allAssets(1)
        const newAsset2 = await ArkreenRegistryFactory.allAssets(2)
        const newAsset3 = await ArkreenRegistryFactory.allAssets(3)
        
        const newAsset1A = await ArkreenRegistryFactory.getAssetInfo(1)
        const newAsset2A = await ArkreenRegistryFactory.getAssetInfo(2)
        const newAsset3A = await ArkreenRegistryFactory.getAssetInfo(3)

        console.log("Asset Info:", newAsset1, newAsset2, newAsset3, newAsset1A, newAsset2A, newAsset3A )                                                        
*/
        // 2023/05/05:    Dev Environment
        // const ArkreenRegistry_address     = '0xfEcbD33525d9B869e5f3CaB895cd6D7A666209ee'
        // const ArkreenMiner_address        = '0x682e01f8ecc0524085F51CC7dFB54fDB8729ac22'
        // const ArkreenRECIssuance_address  = '0x32Dbe18BBc2C752203b6e1bE87EdE5655A091dFa'
        // const ArkreenRECToken_address     = '0x70FdFE7DA492080A8F0233F67C5B48D36d8ceE8b'
        // const ArkreenRECBadge_address     = '0x626f470Ae1427d01f0Fab4D79BC0c9748b07325d'

        // const Issuer_address              = '0xF1CF65Dbfa9cCEe650a053E218F5788F63bDA60E'
        // const Issuer_name                 = 'Arkreen DAO REC Issuer'

/*
        // 2023/06/08:    Pre-Production
        const ArkreenRegistry_address     = '0x4590B2d8251963E249967D1fa8122974dE574aC6'
        const ArkreenMiner_address        = '0x1F742C5f32C071A9925431cABb324352C6e99953'
        const ArkreenRECIssuance_address  = '0x9745918BAF66e3634502bF9a6C07AD320291D211'
        const ArkreenRECToken_address     = '0x2cf7D8C6122a9026d875a8AF0967D8fd6648d9C4'
        const ArkreenRECBadge_address     = '0x70A7981b5c9ca1a4250A0C9BBDC2141752deBeeb'

        const Issuer_address              = '0x8EEb03d79B08dD763fA549fFA57e5ffF4350B13e'
        const Issuer_name                 = 'Arkreen DAO REC Issuer'
*/

/*
        // 2024/04/15:    Amoy testnet
        const ArkreenRegistry_address     = '0x908C77c31bA81C2FC0Ec15Ce53cFd65f9c4aEECc'
        const ArkreenMiner_address        = '0xF390caaF4FF0d297e0b4C3c1527D707C75541736'
        const ArkreenRECIssuance_address  = '0x4fc1d9188610377eA22C577054Fe42627eE49459'
        const ArkreenRECToken_address     = '0x615835Cc22064a17df5A3E8AE22F58e67bCcB778'
        const ArkreenRECBadge_address     = '0x8a459D94F30dB4FC5b6e8F1950d67287AF0Bc77C'

        const Issuer_address              = '0xF1CF65Dbfa9cCEe650a053E218F5788F63bDA60E'
        const Issuer_name                 = 'Arkreen DAO REC Issuer'

        // 2023/06/08, 2024/04/15:    Amoy testnet
        const [deployer] = await ethers.getSigners();
        const ArkreenRegistryFactory = ArkreenRegistry__factory.connect(ArkreenRegistry_address, deployer);

        const updateTxIssuance = await ArkreenRegistryFactory.setRECIssuance(ArkreenRECIssuance_address)
        await updateTxIssuance.wait()
        console.log("ArkreenRECIssuance Initialized: %s: ", hre.network.name, ArkreenRECIssuance_address);

        const updateTxMiner = await ArkreenRegistryFactory.setArkreenMiner(ArkreenMiner_address)
        await updateTxMiner.wait()
        console.log("ArkreenMiner Initialized: %s: ", hre.network.name, ArkreenMiner_address);        

        const updateTxBadge = await ArkreenRegistryFactory.setArkreenRetirement(ArkreenRECBadge_address)
        await updateTxBadge.wait()
        console.log("updateTxBadge Initialized: %s: ", hre.network.name, ArkreenRECBadge_address);        

        const updateTxAddRECIssuer = await ArkreenRegistryFactory.addRECIssuer(Issuer_address, ArkreenRECToken_address, 
                                            Issuer_name, {gasPrice: defaultGasPrice})
        await updateTxAddRECIssuer.wait()
        console.log("AddRECIssuer Initialized: %s: ", hre.network.name, Issuer_address, ArkreenRECToken_address, Issuer_name);        

        console.log("ArkreenRegistry Initialized to %s: ", hre.network.name, ArkreenRegistryFactory.address);
*/
        const [deployer] = await ethers.getSigners();
        const ArkreenRegistryFactory = ArkreenRegistry__factory.connect(ArkreenRegistry_address, deployer);

//      function manageAssetAREC( uint256 idxAsset, uint256 flag, uint128 rateToIssue, 
//                    uint16 rateToLiquidize, bool bActive, string calldata description)

        let rateToIssue = BigNumber.from(1000).mul(BigNumber.from(10).pow(18))

        let idxAsset = 1
        const manageAssetAREC1Tx = await ArkreenRegistryFactory.manageAssetAREC(idxAsset, 1, rateToIssue, 0, false, '',
                                                        {gasPrice: defaultGasPrice}
                                                        )
        console.log("Asset Type 1 manageAssetARECTx: ", manageAssetAREC1Tx)
        await manageAssetAREC1Tx.wait()

        idxAsset = 2
        const manageAssetAREC2Tx = await ArkreenRegistryFactory.manageAssetAREC(idxAsset, 1, rateToIssue, 0, false, '',
                                                        {gasPrice: defaultGasPrice}
                                                        )
        console.log("Asset Type 2 manageAssetARECTx: ", manageAssetAREC2Tx)
        await manageAssetAREC2Tx.wait()

        idxAsset = 3
        const manageAssetAREC3Tx = await ArkreenRegistryFactory.manageAssetAREC(idxAsset, 1, rateToIssue, 0, false, '',
                                                        {gasPrice: defaultGasPrice}
                                                        )
        console.log("Asset Type 3 manageAssetARECTx: ", manageAssetAREC3Tx)
        await manageAssetAREC3Tx.wait()

        console.log("ArkreenRegistry newAssetAREC is executed: %s: ", hre.network.name, ArkreenRegistry_address);

        const newAsset1 = await ArkreenRegistryFactory.allAssets(1)
        const newAsset2 = await ArkreenRegistryFactory.allAssets(2)
        const newAsset3 = await ArkreenRegistryFactory.allAssets(3)
        const newAsset4 = await ArkreenRegistryFactory.allAssets(4)
        
        const newAsset1A = await ArkreenRegistryFactory.getAssetInfo(1)
        const newAsset2A = await ArkreenRegistryFactory.getAssetInfo(2)
        const newAsset3A = await ArkreenRegistryFactory.getAssetInfo(3)
        const newAsset34 = await ArkreenRegistryFactory.getAssetInfo(4)

        console.log("Asset Info:", newAsset1, newAsset2, newAsset3, newAsset4, newAsset1A, newAsset2A, newAsset3A, newAsset34 )                                                        

    }

    if(hre.network.name === 'matic') {

        // Version Test 
//      const ArkreenRegistry_address     = '0x3E8A27dA0BF241f588141659cBb6Bd39717527F1'
//      const ArkreenMiner_address        = '0xAc4da3681e51278f82288617c7185a7a119E5b7B'
//      const ArkreenRECIssuance_address  = '0x45D0c0E2480212A60F1a9f2A820F1d7d6472CA6B'
//      const ArkreenRECToken_address     = '0x815bFE3aaCF765c9E0A4DdEb98Ad710a4Fb860d3'
//      const ArkreenRECBadge_address     = '0x3d5531cF0bC2e8d0658fEc0D1a9995211Ac1f337'

        // 2023/03/22: Normal release, 2024/02/27
        const ArkreenRegistry_address     = '0xb17faCaCA106fB3D216923DB6CaBFC7C0517029d'

/*        
        const ArkreenMiner_address        = '0xAc4da3681e51278f82288617c7185a7a119E5b7B'
        const ArkreenRECIssuance_address  = '0x954585adF9425F66a0a2FD8e10682EB7c4F1f1fD'
        const ArkreenRECToken_address     = '0x58E4D14ccddD1E993e6368A8c5EAa290C95caFDF'
        const ArkreenRECBadge_address     = '0x1e5132495cdaBac628aB9F5c306722e33f69aa24'

        const Issuer_address              = '0xec9254677d252df0dCaEb067dFC8b4ea5F6edAfC'
        const Issuer_name                 = 'Arkreen DAO REC Issuer'

        const [deployer] = await ethers.getSigners();
        const ArkreenRegistryFactory = ArkreenRegistry__factory.connect(ArkreenRegistry_address, deployer);

        const updateTxIssuance = await ArkreenRegistryFactory.setRECIssuance(ArkreenRECIssuance_address)
        await updateTxIssuance.wait()
        console.log("ArkreenRECIssuance Initialized: %s: ", hre.network.name, ArkreenRECIssuance_address);

        const updateTxMiner = await ArkreenRegistryFactory.setArkreenMiner(ArkreenMiner_address)
        await updateTxMiner.wait()
        console.log("ArkreenMiner Initialized: %s: ", hre.network.name, ArkreenMiner_address);        

        const updateTxBadge = await ArkreenRegistryFactory.setArkreenRetirement(ArkreenRECBadge_address)
        await updateTxBadge.wait()
        console.log("updateTxBadge Initialized: %s: ", hre.network.name, ArkreenRECBadge_address);        

        const updateTxAddRECIssuer = await ArkreenRegistryFactory.addRECIssuer(Issuer_address, ArkreenRECToken_address, Issuer_name)
        await updateTxAddRECIssuer.wait()
        console.log("AddRECIssuer Initialized: %s: ", hre.network.name, Issuer_address, ArkreenRECToken_address, Issuer_name);        

        console.log("ArkreenRegistry Initialized to %s: ", hre.network.name, ArkreenRegistryFactory.address);
*/

/*
        // 2023/05/10:   Update MinerContract address and Update AREC Issuer/Certifier address, remove old issuer address
        const ArkreenMiner_address        = '0xbf8eF5D950F78eF8edBB8674a48cDACa675831Ae'
        const ArkreenRECToken_address     = '0x58E4D14ccddD1E993e6368A8c5EAa290C95caFDF'

        const Issuer_address              = '0xFedD52848Cb44dcDBA95df4cf2BCBD71D58df879'
        const Issuer_name                 = 'Arkreen DAO REC Issuer'

        const remove_Issuer_address       = '0xec9254677d252df0dCaEb067dFC8b4ea5F6edAfC'

        
        const [deployer] = await ethers.getSigners();
        const ArkreenRegistryFactory = ArkreenRegistry__factory.connect(ArkreenRegistry_address, deployer);

        const updateTxMiner = await ArkreenRegistryFactory.setArkreenMiner(ArkreenMiner_address)
        await updateTxMiner.wait()
        console.log("ArkreenMiner Initialized: %s: ", hre.network.name, ArkreenMiner_address);        

        const updateTxAddRECIssuer = await ArkreenRegistryFactory.addRECIssuer(Issuer_address, ArkreenRECToken_address, Issuer_name)
        await updateTxAddRECIssuer.wait()
        console.log("AddRECIssuer Initialized: %s: ", hre.network.name, Issuer_address, ArkreenRECToken_address, Issuer_name);        

        const removeTxAddRECIssuer = await ArkreenRegistryFactory.removeRECIssuer(remove_Issuer_address)
        await removeTxAddRECIssuer.wait()
        console.log("AddRECIssuer removed: ", hre.network.name, remove_Issuer_address);        

        console.log("ArkreenRegistry Initialized to %s: ", hre.network.name, ArkreenRegistryFactory.address);
*/        

        //////////////////////////////////////////////////
       
/*        
        // 2023/04/04:  Matic mainnet Normal release
        const issuer                      = "0xec9254677d252df0dCaEb067dFC8b4ea5F6edAfC"
        const tokenREC                    = "0x93b3bb6C51A247a27253c33F0d0C2FF1d4343214"
        const tokenPay                    = "0xA906175C2f72BB2D8d16427dda524CBD324Cc510"    // 2023/04/04:  tAKRE
*/


//        // 2023/10/18:  Matic mainnet Normal release
//        const issuer                      = "0xaa65582453e121d463A51251E9d8C2BAd27ad99c"
//        const tokenREC                    = "0x0D7899F2D36344ed21829D4EBC49CC0d335B4A06"
//        const tokenPay                    = "0x21b101f5d61a66037634f7e1beb5a733d9987d57"    // 2023/10/18:  tAKRE

//        const idAsset =  "Classic Based AREC Token"
//        const rateToIssue = BigNumber.from(100).mul(BigNumber.from(10).pow(18))
//        const rateToLiquidize = 1000
//        const description = 	"Bridged AREC ERC20 token based on redeemed classic REC assets."                        

/*
        // 2024/03/28:  Matic mainnet Normal release, new asset: Universal Arkreen REC Token
        const issuer                      = "0xaa65582453e121d463A51251E9d8C2BAd27ad99c"
        const tokenREC                    = "0x58E4D14ccddD1E993e6368A8c5EAa290C95caFDF"
        const tokenPay                    = "0xE9c21De62C5C5d0cEAcCe2762bF655AfDcEB7ab3"    // 2024/03/28: AKRE Mainnet

        const idAsset =  "Universal Arkreen REC Token"
        const rateToIssue = BigNumber.from(100).mul(BigNumber.from(10).pow(18))
        const rateToLiquidize = 1000
        const description = 	"Universal AREC ERC20 token based on redeemed classic REC assets."                        

        const [deployer] = await ethers.getSigners();
        const ArkreenRegistryFactory = ArkreenRegistry__factory.connect(ArkreenRegistry_address, deployer);

//      function newAssetAREC(string calldata idAsset, address issuer, address tokenREC, address tokenPay,
//                              uint128 rateToIssue, uint16 rateToLiquidize, string calldata description)
        const newAssetARECTx = await ArkreenRegistryFactory.newAssetAREC(idAsset, issuer, tokenREC,
                                                        tokenPay, rateToIssue, rateToLiquidize, description, 
                                                        // {gasPrice: defaultGasPrice} 
                                                        )
                                                        
        console.log("newAssetAREC: ", newAssetARECTx)
        await newAssetARECTx.wait()
        console.log("ArkreenRegistry newAssetAREC is executed: %s: ", hre.network.name, ArkreenRegistry_address);
*/

/*
        // 2023/04/04:  Matic Mainnet Normal release, 2024/02/27
        //function manageAssetARECExt( uint256 idxAsset, uint256 flag, string calldata idAsset, address issuer, 
        //  address tokenREC, address tokenPay)
        // const tokenPay                 = "0x21B101f5d61A66037634f7e1BeB5a733d9987D57"       // 2023/04/04:  new tAKRE
        const tokenPay                    = "0xE9c21De62C5C5d0cEAcCe2762bF655AfDcEB7ab3"       // 2024/02/27:  AKRE

        const [deployer] = await ethers.getSigners();
        const ArkreenRegistryFactory = ArkreenRegistry__factory.connect(ArkreenRegistry_address, deployer);

        // 2024/02/27(idxAsset = 1), 2024/02/27A(idxAsset = 2)
//        const manageAssetARECExtTx = await ArkreenRegistryFactory.manageAssetARECExt(2, 0x08, 
//                                              '', constants.AddressZero, constants.AddressZero, tokenPay, {gasPrice: defaultGasPrice})

        // 2024/03/29: call manageAssetARECExt to update the issuer of Universal ART
        const issuerART = "0xFedD52848Cb44dcDBA95df4cf2BCBD71D58df879"
        const manageAssetARECExtTx = await ArkreenRegistryFactory.manageAssetARECExt(3, 0x02, 
                                              '', issuerART, constants.AddressZero, constants.AddressZero,
                                              {nonce: 246, gasPrice: defaultGasPrice}
                                              )


        console.log("manageAssetARECExt", manageAssetARECExtTx)
        await manageAssetARECExtTx.wait()
        console.log("ArkreenRegistry newAssetAREC is executed: %s: ", hre.network.name, ArkreenRegistry_address);
*/

/*
        // 2024/10/24:  Matic mainnet Normal release, new asset: Universal Arkreen REC Token
        const issuer                      = "0xFedD52848Cb44dcDBA95df4cf2BCBD71D58df879"
        const tokenREC                    = "0x58E4D14ccddD1E993e6368A8c5EAa290C95caFDF"
        const tokenPay                    = "0xE9c21De62C5C5d0cEAcCe2762bF655AfDcEB7ab3"    // AKRE

        // 2024/10/24: ECC Asset
        const idAsset =  "ECC Based AREC Asset"
        const rateToIssue = BigNumber.from(1000).mul(BigNumber.from(10).pow(18))
        const rateToLiquidize = 1000
        const description = 	"Bridged AREC Asset based on redeemed ECC (Energy Conservation Certificate)."                        

        const [deployer] = await ethers.getSigners();
        const ArkreenRegistryFactory = ArkreenRegistry__factory.connect(ArkreenRegistry_address, deployer);
        
//      function newAssetAREC(string calldata idAsset, address issuer, address tokenREC, address tokenPay,
//                              uint128 rateToIssue, uint16 rateToLiquidize, string calldata description)
        const newAssetARECTx = await ArkreenRegistryFactory.newAssetAREC(idAsset, issuer, tokenREC,
                                                        tokenPay, rateToIssue, rateToLiquidize, description, 
                                                        {gasPrice: defaultGasPrice}
                                                        )
                                                        
        console.log("newAssetAREC: ", newAssetARECTx)
        await newAssetARECTx.wait()
        console.log("ArkreenRegistry newAssetAREC is executed: %s: ", hre.network.name, ArkreenRegistry_address);
*/

        const [deployer] = await ethers.getSigners();
        const ArkreenRegistryFactory = ArkreenRegistry__factory.connect(ArkreenRegistry_address, deployer);

//      function manageAssetAREC( uint256 idxAsset, uint256 flag, uint128 rateToIssue, 
//                    uint16 rateToLiquidize, bool bActive, string calldata description)

        let rateToIssue = BigNumber.from(1000).mul(BigNumber.from(10).pow(18))

        let idxAsset = 1
        const manageAssetAREC1Tx = await ArkreenRegistryFactory.manageAssetAREC(idxAsset, 1, rateToIssue, 0, false, '',
                                                        {gasPrice: defaultGasPrice}
                                                        )
        console.log("Asset Type 1 manageAssetARECTx: ", manageAssetAREC1Tx)
        await manageAssetAREC1Tx.wait()

        idxAsset = 2
        const manageAssetAREC2Tx = await ArkreenRegistryFactory.manageAssetAREC(idxAsset, 1, rateToIssue, 0, false, '',
                                                        {gasPrice: defaultGasPrice}
                                                        )
        console.log("Asset Type 2 manageAssetARECTx: ", manageAssetAREC2Tx)
        await manageAssetAREC2Tx.wait()

        idxAsset = 3
        const manageAssetAREC3Tx = await ArkreenRegistryFactory.manageAssetAREC(idxAsset, 1, rateToIssue, 0, false, '',
                                                        {gasPrice: defaultGasPrice}
                                                        )
        console.log("Asset Type 3 manageAssetARECTx: ", manageAssetAREC3Tx)
        await manageAssetAREC3Tx.wait()

        console.log("ArkreenRegistry newAssetAREC is executed: %s: ", hre.network.name, ArkreenRegistry_address);

        const newAsset1 = await ArkreenRegistryFactory.allAssets(1)
        const newAsset2 = await ArkreenRegistryFactory.allAssets(2)
        const newAsset3 = await ArkreenRegistryFactory.allAssets(3)
        const newAsset4 = await ArkreenRegistryFactory.allAssets(4)
        
        const newAsset1A = await ArkreenRegistryFactory.getAssetInfo(1)
        const newAsset2A = await ArkreenRegistryFactory.getAssetInfo(2)
        const newAsset3A = await ArkreenRegistryFactory.getAssetInfo(3)
        const newAsset34 = await ArkreenRegistryFactory.getAssetInfo(4)

        console.log("Asset Info:", newAsset1, newAsset2, newAsset3, newAsset4, newAsset1A, newAsset2A, newAsset3A, newAsset34 )                                                        

    } 

    if(hre.network.name === 'celo_test') {
      // 2023/08/21:  celo testnet
      const ArkreenRegistry_address     = '0x572e9B8B210414b2D76ddf578925D769D96982E6'
      const issuer                      = "0x576Ab950B8B3B18b7B53F7edd8A47986a44AE6F4"
      // const tokenREC                 = "0x58Ac4e54a70b98960Ed5ecF9B9A2cd1AE83879Db"
      const tokenHART                   = "0x57Fe6324538CeDd43D78C975118Ecf8c137fC8B2"
      const tokenPay                    = "0x874069Fa1Eb16D44d622F2e0Ca25eeA172369bC1"    // cUSD

//    const ArkreenMiner_address        = '0x1F742C5f32C071A9925431cABb324352C6e99953'    // No miner contract for Celo
//    const ArkreenRECToken_address     = '0x2cf7D8C6122a9026d875a8AF0967D8fd6648d9C4'    // No ART Token for Celo
      const ArkreenRECIssuance_address  = '0x66e9c20DE3711e7C8c886d461aACd6E092E161BE'
      const ArkreenRECBadge_address     = '0x9b5EE14b0B23876F39747747b227dDe12B62143d'

//    const Issuer_address              = '0x576Ab950B8B3B18b7B53F7edd8A47986a44AE6F4'
//    const Issuer_name                 = 'Arkreen DAO REC Issuer'

/*      
      // 2023/08/21:    New asset
      const idAsset =   "AREC_ESG_BTC"
      const rateToIssue = BigNumber.from(2).mul(BigNumber.from(10).pow(17))     // 0.2 cUSD / 1MWh
      const rateToLiquidize = 1000                                             // 10 %
      const description = 	"I-REC ERC20 token to greenize the BTC mining power consumption."                        

      const [deployer] = await ethers.getSigners();
      const ArkreenRegistryFactory = ArkreenRegistry__factory.connect(ArkreenRegistry_address, deployer);

//      function newAssetAREC(string calldata idAsset, address issuer, address tokenREC, address tokenPay,
//                              uint128 rateToIssue, uint16 rateToLiquidize, string calldata description)
      const updateTxIssuance = await ArkreenRegistryFactory.newAssetAREC(idAsset, issuer, tokenHART,
                                                      tokenPay, rateToIssue, rateToLiquidize, description)
      await updateTxIssuance.wait()
      console.log("ArkreenRegistry newAssetAREC is executed: %s: ", hre.network.name, ArkreenRegistry_address);
*/

/*
      // 2023/08/25:    Celo_Test
      const [deployer] = await ethers.getSigners();
      const ArkreenRegistryFactory = ArkreenRegistry__factory.connect(ArkreenRegistry_address, deployer);

      const updateTxIssuance = await ArkreenRegistryFactory.setRECIssuance(ArkreenRECIssuance_address)
      await updateTxIssuance.wait()
      console.log("ArkreenRECIssuance Initialized: %s: ", hre.network.name, ArkreenRECIssuance_address);

//    const updateTxMiner = await ArkreenRegistryFactory.setArkreenMiner(ArkreenMiner_address)
//    await updateTxMiner.wait()
//    console.log("ArkreenMiner Initialized: %s: ", hre.network.name, ArkreenMiner_address);

      const updateTxBadge = await ArkreenRegistryFactory.setArkreenRetirement(ArkreenRECBadge_address)
      await updateTxBadge.wait()
      console.log("updateTxBadge Initialized: %s: ", hre.network.name, ArkreenRECBadge_address);
*/

//    const updateTxAddRECIssuer = await ArkreenRegistryFactory.addRECIssuer(Issuer_address, ArkreenRECToken_address, Issuer_name)
//    await updateTxAddRECIssuer.wait()
//    console.log("AddRECIssuer Initialized: %s: ", hre.network.name, Issuer_address, ArkreenRECToken_address, Issuer_name);
//    console.log("ArkreenRegistry Initialized to %s: ", hre.network.name, ArkreenRegistryFactory.address);


      // 2023/12/12:  Celo Test net 
      //function manageAssetARECExt( uint256 idxAsset, uint256 flag, string calldata idAsset, address issuer, 
      //                                  address tokenREC, address tokenPay)
      const newIssuer           = "0x392a051d030629188d60299232C3bFB34b8Af1e6"    // 2023/12/12:  new newIssuer

      const [deployer] = await ethers.getSigners();
      const ArkreenRegistryFactory = ArkreenRegistry__factory.connect(ArkreenRegistry_address, deployer);

      // 2023/12/12:  Celo Test net
      const manageAssetARECExtTx = await ArkreenRegistryFactory.manageAssetARECExt(1, 0x02, 
                                              '', newIssuer, constants.AddressZero, constants.AddressZero)
                                                        
      console.log("manageAssetARECExt", manageAssetARECExtTx)
      await manageAssetARECExtTx.wait()

      console.log("ArkreenRegistry manageAssetARECExt is executed: %s: ", hre.network.name, ArkreenRegistry_address, newIssuer);

  }

  if(hre.network.name === 'celo') {
    // 2023/11/01:  celo mainnet
    const ArkreenRegistry_address     = '0x960C67B8526E6328b30Ed2c2fAeA0355BEB62A83'
    const issuer                      = "0xaa65582453e121d463A51251E9d8C2BAd27ad99c"
    // const tokenREC                 = "0x58Ac4e54a70b98960Ed5ecF9B9A2cd1AE83879Db"
    const tokenCART                   = "0x9BBF9f544F3ceD640090f43FF6B820894f66Aaef"
    const tokenPay                    = "0x765DE816845861e75A25fCA122bb6898B8B1282a"    // cUSD

//  const ArkreenMiner_address        = '0x1F742C5f32C071A9925431cABb324352C6e99953'    // No miner contract for Celo
//  const ArkreenRECToken_address     = '0x2cf7D8C6122a9026d875a8AF0967D8fd6648d9C4'    // No ART Token for Celo
    const ArkreenRECIssuance_address  = '0xbB4b287Fdd601662eCf17fB6EDF3943A15D1b63e'
    const ArkreenRECBadge_address     = '0x5EfbbB0a60110cCda7342A7230A32A4E78815f76'

//    const Issuer_address              = '0x576Ab950B8B3B18b7B53F7edd8A47986a44AE6F4'
//    const Issuer_name                 = 'Arkreen DAO REC Issuer'
      
    // 2023/11/01:    New asset
    const idAsset =   "Classic Based AREC Token"
    const rateToIssue = BigNumber.from(0).mul(BigNumber.from(10).pow(18))     // 0 cUSD / 1MWh, free in trial phase
    const rateToLiquidize = 1000                                              // 10 %
    const description = 	"Bridged AREC ERC20 token based on redeemed classic REC assets."   

    const [deployer] = await ethers.getSigners();
    const ArkreenRegistryFactory = ArkreenRegistry__factory.connect(ArkreenRegistry_address, deployer);

//      function newAssetAREC(string calldata idAsset, address issuer, address tokenREC, address tokenPay,
//                              uint128 rateToIssue, uint16 rateToLiquidize, string calldata description)
    const newAssetARECTx = await ArkreenRegistryFactory.newAssetAREC(idAsset, issuer, tokenCART,
                                                    tokenPay, rateToIssue, rateToLiquidize, description)
    await newAssetARECTx.wait()
    console.log("ArkreenRegistry newAssetAREC is executed: %s: ", hre.network.name, ArkreenRegistry_address);
    
    // 2023/08/25:    Celo
    const updateTxIssuance = await ArkreenRegistryFactory.setRECIssuance(ArkreenRECIssuance_address)
    await updateTxIssuance.wait()
    console.log("ArkreenRECIssuance Initialized: %s: ", hre.network.name, ArkreenRECIssuance_address);

//    const updateTxMiner = await ArkreenRegistryFactory.setArkreenMiner(ArkreenMiner_address)
//    await updateTxMiner.wait()
//    console.log("ArkreenMiner Initialized: %s: ", hre.network.name, ArkreenMiner_address);

    const updateTxBadge = await ArkreenRegistryFactory.setArkreenRetirement(ArkreenRECBadge_address)
    await updateTxBadge.wait()
    console.log("updateTxBadge Initialized: %s: ", hre.network.name, ArkreenRECBadge_address);

//    const updateTxAddRECIssuer = await ArkreenRegistryFactory.addRECIssuer(Issuer_address, ArkreenRECToken_address, Issuer_name)
//    await updateTxAddRECIssuer.wait()
//    console.log("AddRECIssuer Initialized: %s: ", hre.network.name, Issuer_address, ArkreenRECToken_address, Issuer_name);
//    console.log("ArkreenRegistry Initialized to %s: ", hre.network.name, ArkreenRegistryFactory.address);

  }

};

// 2023/03/28: call newAssetAREC for Matic testnet

// 2023/04/04: call newAssetAREC for Matic mainnet
// yarn deploy:matic:gRegistryI

// 2023/04/04: call manageAssetARECExt for Matic mainnet to update new tAKRE
// yarn deploy:matic:gRegistryI

// 2023/05/09: Initialize ArkreenRegistry: setRECIssuance, setArkreenMiner, setArkreenRetirement, addRECIssuer
// yarn deploy:matic_test:gRegistryI

// 2023/05/10: Update MinerContract address and Update AREC Issuer/Certifier address, remove old issuer address
// yarn deploy:matic:gRegistryI

// 2023/06/08: Initialize ArkreenRegistry: setRECIssuance, setArkreenMiner, setArkreenRetirement, addRECIssuer
// for Pre-Production Env
// yarn deploy:matic_test:gRegistryI

// 2023/08/21: call newAssetAREC for celo testnet
// yarn deploy:celo_test:gRegistryI

// 2023/08/25: call setRECIssuance and setArkreenRetirement for celo testnet
// yarn deploy:celo_test:gRegistryI

// 2023/10/18: call newAssetAREC for Matic mainnet: CART: 0x0D7899F2D36344ed21829D4EBC49CC0d335B4A06
// yarn deploy:matic:gRegistryI

// 2023/10/31: call newAssetAREC for celo mainnet: newAssetAREC, setRECIssuance, setArkreenRetirement
// yarn deploy:celo:gRegistryI

// 2023/12/12: call newAssetAREC for Matic testnet Dev env and hART
// yarn deploy:matic_test:gRegistryI

// 2023/12/12B: call newAssetAREC for Matic testnet Dev env and cART
// yarn deploy:matic_test:gRegistryI

// 2023/12/12C: call manageAssetARECExt for celo testnet to update new Issuer
// yarn deploy:celo_test:gRegistryI

// 2024/01/11: call manageAssetARECExt for celo testnet to update REC token Issuer
// yarn deploy:celo_test:gRegistryI

// 2024/02/27: call manageAssetARECExt for Arkreen mainnet launch to update AKRE as payment token for HART
// yarn deploy:matic:gRegistryI

// 2024/02/27A: call manageAssetARECExt for Arkreen mainnet launch to update AKRE as payment token for cART
// yarn deploy:matic:gRegistryI

// 2024/03/28: call newAssetAREC on Arkreen mainnet to add a new asset type: Universal Arkreen REC Token
// yarn deploy:matic:gRegistryI

// 2024/03/29: call manageAssetARECExt to update the issuer of Universal ART
// yarn deploy:matic:gRegistryI

// 2024/04/15A: Initialize ArkreenRegistry: setRECIssuance, setArkreenMiner, setArkreenRetirement, addRECIssuer
// yarn deploy:matic_test:gRegistryI

// 2024/04/15B: call newAssetAREC on Amoy testnet to add a new asset type: CART
// yarn deploy:matic_test:gRegistryI

// 2024/04/15C: call newAssetAREC on Amoy testnet to add a new asset type: UART
// yarn deploy:matic_test:gRegistryI

// 2024/07/30: call newAssetAREC on Amoy testnet to add a new asset type: EART
// yarn deploy:matic_test:gRegistryI

// 2024/10/24: call newAssetAREC on Arkreen mainnet to add a new asset type: ECC Based AREC Asset
// yarn deploy:matic:gRegistryI

// 2024/12/24: call manageAssetAREC to update the issuance price 
// yarn deploy:matic:gRegistryI

// 2025/02/13: call manageAssetAREC to update the issuance price 
// yarn deploy:matic_test:gRegistryI


func.tags = ["gRegistryI"];

export default func;
