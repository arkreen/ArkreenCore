import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { ethers } from "hardhat";
import { HashKeyESGBTC__factory } from "../../typechain";

const func: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
  
  if(hre.network.name === 'matic_test') {
//  const ESG_PROXY_ADDRESS = "0xDe8e59dAB27EB97b2267d4230f8FE713A637e03c"          // HashKet ESG contract HskBTC; Version 1
//  const NEW_IMPLEMENTATION = "0xaB3B018Eed1216d27739CFCC8501Bb36a7A18074"         // 2023/03/05: Add getAllBrickIDs
//  const NEW_IMPLEMENTATION = "0x084726129D09976D236642CdCE648039BaE2b072"         // 2023/03/05: Fix a small bug
//  const NEW_IMPLEMENTATION = "0xd5F14899428e135B1684ba653487795eF39242B9"         // 2023/03/07: Return owners in getAllBrickIDs

    const ESG_PROXY_ADDRESS  = "0x785dca2ca9a51513da1fef9f70e6b6ab02896f67"         // HashKet ESG contract HskBTC; Version 2, support RECBank 
//  const NEW_IMPLEMENTATION = "0xF9Be1Dc7Be9659A4EB47D26581a864fCef10631E"         // 2023/03/18: add API getMVPBlocks, and the flag in brickIds to indicate MVP
//  const NEW_IMPLEMENTATION = "0x7D427484834e9d89F5777EBef16f5f2CF83E9093"         // 2023/03/18: Fix the compatibility problem in test
//  const NEW_IMPLEMENTATION = "0x3980b7c60fA541D126f1C8905f815F658d10611A"         // 2023/04/03: Add the NFT picture and relative logic
//  const NEW_IMPLEMENTATION = "0x0Cfe77bE0225A39e5Bb9aB2DEAd3a1350a90d14a"         // 2023/04/04: Change name to 'Eco Coiner', and store all CID in one bytes
//  const NEW_IMPLEMENTATION = "0x999452ad1f9ed7809100106507b5317b796e8851"         // 2023/04/04: Revert to old CID logic
//  const NEW_IMPLEMENTATION = "0x4DC958E9F1c8950e8a8976e6d81eAbE55f6f7a21"         // 2023/04/07: Update to update ESGBadgeCount in ABI
//  const NEW_IMPLEMENTATION = "0xfb214fa837539aefc9360d164f2800c768f034da"         // Wrong 2023/04/11: Upgrade to corect the bug in handling levelOffet
//  const NEW_IMPLEMENTATION = "0x5A499C5b5d4AcCB2B15437956BAE876e109e7b58"         // 2023/04/11: fix bug in_mintESGBadgeMVP
    const NEW_IMPLEMENTATION = "0xA6dF97C0a613AbEc9021a3037574Bb95f26B9968"         // 2023/04/18: Allow to transfer GBTC NFT
    
    console.log("Updating HashKey ESG BTC: ", ESG_PROXY_ADDRESS);  
    const [deployer] = await ethers.getSigners();
    const HashKeyESGBTCFactory = HashKeyESGBTC__factory.connect(ESG_PROXY_ADDRESS, deployer);
    const updateTx = await HashKeyESGBTCFactory.upgradeTo(NEW_IMPLEMENTATION)
    await updateTx.wait()

/*    
    //////////////////////////////////////////
    // 2023/04/03:  2023/04/04:  2023/04/04: 2023/04/07:  2023/04/11
    const levelOrder = [ 0x0101, 0x0102, 0x0103, 0x0104, 0x0201, 0x0202, 0x0105, 0x0203, 0x0204,
                         0x0106, 0x0601, 0x0801, 0x0301, 0x0107, 0x0108, 0x0109, 0x010A, 0x0701,
                         0x0802, 0x0803, 0x010B, 0x010C, 0x010D, 0x010E, 0x0804, 0x0805, 0x0806,
                         0x0807, 0x0808, 0x0809, 0x0501, 0x080A, 0x0302, 0x010F, 0x0110, 0x0111,
                         0x0112, 0x0113, 0x0602, 0x080B ]

//    const newLevelOrder = levelOrder.map((level)=>(level-0x0101))     // revert to old logic 

    const callData = HashKeyESGBTCFactory.interface.encodeFunctionData("postUpdate", [levelOrder])  //levelOrder
    const updateTx = await HashKeyESGBTCFactory.upgradeToAndCall(NEW_IMPLEMENTATION, callData)
    await updateTx.wait()

    console.log("Update Trx:", updateTx)
    console.log("HashKey ESG BTC Updated: ", hre.network.name, HashKeyESGBTCFactory.address, NEW_IMPLEMENTATION);
*/    
 }
 
  if(hre.network.name === 'matic') {
      const ESG_PROXY_ADDRESS  = "0xfe9341218c7Fcb6DA1eC131a72f914B7C724F200"         // HashKey ESG contract HskBTC, Mainnet
//    const NEW_IMPLEMENTATION = "0xEaA83A667eEefe4E5eFE6500C746999Cb5Da8FF7"         // 2023/04/11: fix bug in_mintESGBadgeMVP
//    const NEW_IMPLEMENTATION = "0x8912948ea73281d152314c055dc1e0233eea6473"         // 2023/04/17: Mask the check in setBrick to save gas usage for minting audience NFT
//    const NEW_IMPLEMENTATION = "0xEaA83A667eEefe4E5eFE6500C746999Cb5Da8FF7"         // 2023/04/17: revert
      const NEW_IMPLEMENTATION = "0xFF5088639F7378c66117150f066A353870B4EC61"         // 2023/04/18: Allow to transfer GBTC NFT
       
      console.log("Updating HashKey ESG BTC: ", ESG_PROXY_ADDRESS);  
      const [deployer] = await ethers.getSigners();
      const HashKeyESGBTCFactory = HashKeyESGBTC__factory.connect(ESG_PROXY_ADDRESS, deployer);
      const updateTx = await HashKeyESGBTCFactory.upgradeTo(NEW_IMPLEMENTATION)
      await updateTx.wait()
  
/*
      //////////////////////////////////////////
      // 2023/04/11: 
      const levelOrder = [ 0x0801, 0x0802, 0x0803 ]
      const callData = HashKeyESGBTCFactory.interface.encodeFunctionData("postUpdate", [levelOrder])  //levelOrder
      const updateTx = await HashKeyESGBTCFactory.upgradeToAndCall(NEW_IMPLEMENTATION, callData)
      await updateTx.wait()
*/  
      console.log("Update Trx:", updateTx)
      console.log("HashKey ESG BTC Updated: ", hre.network.name, HashKeyESGBTCFactory.address, NEW_IMPLEMENTATION);
   }

};

// 2023/04/03: Add the NFT picture and relative logic
// yarn deploy:matic_test:HskBTCU

// 2023/04/04: Change name to 'Eco Coiner', and store all CID in one bytes
// yarn deploy:matic_test:HskBTCU

// 2023/04/04: Revert to old CID logic 
// yarn deploy:matic_test:HskBTCU

// 2023/04/07: Update to update ESGBadgeCount in ABI
// yarn deploy:matic_test:HskBTCU

// 2023/04/11: Upgrade to corect the bug in handling levelOffet
// yarn deploy:matic_test:HskBTCU

// 2023/04/11: Upgrade to fix bug in_mintESGBadgeMVP
// yarn deploy:matic_test:HskBTCU

// 2023/04/11: Upgrade to fix bug in_mintESGBadgeMVP
// yarn deploy:matic:HskBTCU

// 2023/04/17: Mask the check in setBrick to save gas usage for minting audience NFT 
// yarn deploy:matic:HskBTCU

// 2023/04/17: Revert to 4/11 version, as gas saving is still not enough
// yarn deploy:matic:HskBTCU

// 2023/04/18: Upgrade to allow to transfer GBTC NFT
// yarn deploy:matic_test:HskBTCU

// 2023/04/18: Upgrade to allow to transfer GBTC NFT
// yarn deploy:matic:HskBTCU

export default func;
func.tags = ["HskBTCU"];


