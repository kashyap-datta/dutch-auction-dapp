# DutchAuction NFT Marketplace

This repository contains a series of versions showcasing the development of a DutchAuction NFT Marketplace. Each version adds new functionality and features to the smart contracts, and a ReactJS user interface is implemented in Version 6.0 to interact with the contracts.

## Version 1.0

- Create a new directory in your Github repo called v1.0 and initialize a new hardhat project.
- Implement a new contract called BasicDutchAuction.sol, which facilitates a Dutch auction for a single, physical item at a single event.
- Write test cases to thoroughly test your contracts and generate a Solidity coverage report.

## Version 2.0

- Read the ERC721 EIP and OpenZeppellin implementation.
- Create a new directory in your Github repo called v2.0 and initialize a new hardhat project.
- Understand how the ERC721 contract works by downloading an off-the-shelf version from OpenZeppelin and write test cases to explore its functionalities.
- Create a new contract called NFTDutchAuction.sol, which is similar to BasicDutchAuction.sol but sells an NFT instead of a physical item.

## Version 3.0

- Create a new directory in your Github repo called v3.0 and initialize a new hardhat project.
- Copy over any reusable files from the previous versions.
- Implement a new contract called NFTDutchAuction_ERC20Bids.sol, which is similar to NFTDutchAuction.sol but only accepts ERC20 bids instead of Ether.

## Version 4.0

- Add an upgrade proxy to make your NFTDutchAuction_ERC20Bids.sol upgradeable using the UUPS proxy.

## Version 5.0

- Read EIP-2612 and EIP-712.
- Add ERC20Permit functionality to your ERC20 implementation, following OpenZeppelin's implementation.
- Write test cases to cover the permit functionality in the context of submitting a bid to your NFTDutchAuction_ERC20Bids.

## Version 6.0

- Create a new directory in your Github repo called v6.0 and initialize a new hardhat project.
- Implement a ReactJS user interface for your BasicDutchAuction.sol.
- The UI should enable users to deploy a new BasicDutchAuction, look up specific auctions, and submit bids.
- Use the starter repo or similar resources as a starting point for your implementation.
- The UI should not require a server and should interact with the contracts using web3.

## Version 7.0

- Deploy your Version 6.0 dapp on an Ethereum testnet, acquiring test ETH from a faucet if needed.
- Host your UI through IPFS to enable others to access it through an ipfs:// URL.
- Generate a fixed name for your UI using IPNS.
- Present your fully functioning app to the TA, showcasing contract deployment, UI accessibility, and user interaction through Metamask plugin.

## Instructions for Version 6.0:

1. Clone the repository and navigate to the specific version directory.
2. Install the required dependencies using `npm install` or `yarn install`.
3. Generate build files for the UI using `npm run build` or `yarn build`.
4. Install IPFS desktop and browser plugin for hosting your UI.
5. Pin your UI build files to your IPFS Desktop node.
6. Add the IPFS URL to your README.md file in your repository.
7. Use IPNS to generate a fixed name for your UI.
8. Test the contract deployment, UI accessibility, and user interaction through Metamask plugin.

Please note that each version builds upon the previous one, adding new features and functionalities. Make sure to follow the instructions for each version to set up and test your project accordingly.

