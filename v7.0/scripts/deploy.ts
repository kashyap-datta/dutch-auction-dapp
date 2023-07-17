//import { ethers } from 'hardhat';
//import { HardhatRuntimeEnvironment } from 'hardhat/types';
import '@nomiclabs/hardhat-waffle';
import { task } from 'hardhat/config';
import { HardhatRuntimeEnvironment } from 'hardhat/types';


task('deploy', 'Deploy Dutch Auction contract').setAction(
    async (_, hre: HardhatRuntimeEnvironment): Promise<void> => {
        const [deployer] = await hre.ethers.getSigners();

        console.log("Deploying contracts with the account:", deployer.address);

        console.log("Account balance:", (await deployer.getBalance()).toString());

        const BasicDutchAuctionFactory = await hre.ethers.getContractFactory("BasicDutchAuction");
        const basicDutchAuction = await BasicDutchAuctionFactory.deploy(100, 10, 10);

        await basicDutchAuction.deployed();

        console.log(`Basic Dutch Auction Contract deployed at address ${basicDutchAuction.address}`);
    }
);
// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
// main().catch((error) => {
//     console.error(error);
//     process.exitCode = 1;
// });