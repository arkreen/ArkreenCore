import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { ethers } from "hardhat";
import { ArkreenRECBank__factory } from "../../typechain";

const func: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
  
  if(hre.network.name === 'matic_test') {
    const RECBANK_PROXY_ADDRESS   = "0x7ee6D2A14d6Db71339a010d44793B27895B36d50"    // 2023/3/14 Arkreen REC bank proxy
    // const NEW_IMPLEMENTATION = "0xCdacE7DB767e77BD938e488925B6b00f98D4063C"      // 2023/3/14 Arkreen REC Bank implementation
    const NEW_IMPLEMENTATION = "0x84AEAe330517A89Ab74f5eD0f805522634dF8Df6"         // 2023/07/26: Upgrade to add new event

    console.log("Updating Arkreen REC Bank: ", RECBANK_PROXY_ADDRESS);  

    const [deployer] = await ethers.getSigners();
    const ArkreenBankFactory = ArkreenRECBank__factory.connect(RECBANK_PROXY_ADDRESS, deployer);
    const updateTx = await ArkreenBankFactory.upgradeTo(NEW_IMPLEMENTATION)
    await updateTx.wait()

    // const ARKREEN_REC_BANK = "0x7ee6D2A14d6Db71339a010d44793B27895B36d50"
    // const callData = ArkreenBankFactory.interface.encodeFunctionData("postUpdate", [ARKREEN_REC_BANK])
    // const updateTx = await ArkreenBankFactory.upgradeToAndCall(NEW_IMPLEMENTATION, callData)
    // await updateTx.wait()

    console.log("Update Trx:", updateTx)
    console.log("Arkreen REC Bank: ", hre.network.name, ArkreenBankFactory.address, NEW_IMPLEMENTATION);
 } 
};

// 2023/07/26: Upgrade to add new events for subgraph and 3rd API
// yarn deploy:matic_test:ArtBankU

export default func;
func.tags = ["ArtBankU"];

