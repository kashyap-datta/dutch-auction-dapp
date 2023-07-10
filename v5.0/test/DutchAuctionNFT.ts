import { time, loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import "@nomicfoundation/hardhat-chai-matchers";
import { mine } from "@nomicfoundation/hardhat-network-helpers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { BigNumber } from "ethers";
import { ethers, upgrades } from "hardhat";
import { ERC20Token } from "../typechain-types";
import { NFTDutchAuction_ERC20Bids } from "../typechain-types/contracts/DutchAuctionNFT_ERC20Bids.sol";

async function getPermitSignature(
    signer: SignerWithAddress,
    token: ERC20Token,
    spender: string,
    value: string,
    deadline: BigNumber
) {
    const [nonce, name, version, chainId] = await Promise.all([
        token.nonces(signer.address),
        token.name(),
        "1",
        signer.getChainId(),
    ]);

    return ethers.utils.splitSignature(
        await signer._signTypedData(
            {
                name,
                version,
                chainId,
                verifyingContract: token.address,
            },
            {
                Permit: [
                    {
                        name: "owner",
                        type: "address",
                    },
                    {
                        name: "spender",
                        type: "address",
                    },
                    {
                        name: "value",
                        type: "uint256",
                    },
                    {
                        name: "nonce",
                        type: "uint256",
                    },
                    {
                        name: "deadline",
                        type: "uint256",
                    },
                ],
            },
            {
                owner: signer.address,
                spender,
                value,
                nonce,
                deadline,
            }
        )
    );
}

describe("NFTDutchAuction", function () {
    const auctionDuration = 10;
    const minimumPrice = 500;
    const priceDecrement = 50;
    const nftTokenId = 0;
    const TOKEN_URI = "https://pixabay.com/photos/bird-whitethroat-flowers-bloom-7881393/";
    const DEADLINE = ethers.constants.MaxUint256;
    const PERMIT_ALLOWANCE = "1000";

    async function deployNFTDutchAuctionFixture() {
        const [deployer, bidder1, bidder2] = await ethers.getSigners();

        const ERC721Token = await ethers.getContractFactory("ImageNFT");
        const erc721Token = await ERC721Token.deploy();
        await erc721Token.mintNFT(deployer.address, TOKEN_URI);

        const ERC20Token = await ethers.getContractFactory("ERC20Token");
        const erc20Token = await ERC20Token.deploy(10000); // Adjust the initial supply as needed
        await erc20Token.mint(bidder1.address, 1000);

        const NFTDutchAuction = await ethers.getContractFactory("NFTDutchAuction_ERC20Bids");

        const nftDutchAuction = await upgrades.deployProxy(NFTDutchAuction, [
            erc20Token.address,
            erc721Token.address,
            nftTokenId,
            minimumPrice,
            auctionDuration,
            priceDecrement
        ]
        );
        const { v, r, s } = await getPermitSignature(
            bidder1,
            erc20Token,
            nftDutchAuction.address,
            PERMIT_ALLOWANCE,
            DEADLINE
        );

        erc20Token.permit(
            bidder1.address,
            nftDutchAuction.address,
            PERMIT_ALLOWANCE,
            DEADLINE,
            v,
            r,
            s
        );

        await erc721Token.approve(nftDutchAuction.address, nftTokenId);
        return { erc721Token, erc20Token, nftDutchAuction, deployer, bidder1, bidder2 };
    }

    describe("Deployment", function () {
        it("Should set the correct owner", async function () {
            const { nftDutchAuction, deployer } = await loadFixture(deployNFTDutchAuctionFixture);

            expect(await nftDutchAuction.owner()).to.equal(deployer.address);
        });
        it("Should not allow initialize to be called more than once", async function () {
            const { erc20Token, erc721Token, nftDutchAuction, deployer } =
                await loadFixture(deployNFTDutchAuctionFixture);

            await expect(
                nftDutchAuction.initialize(
                    erc20Token.address,
                    erc721Token.address,
                    nftTokenId,
                    minimumPrice,
                    auctionDuration,
                    priceDecrement
                )
            ).to.be.revertedWith("Initializable: contract is already initialized");
        });
        it("Should initialize the auction without a winner", async function () {
            const { nftDutchAuction } = await loadFixture(deployNFTDutchAuctionFixture);

            expect(await nftDutchAuction.winner()).to.equal(ethers.constants.AddressZero);
        });

        it("Should not allow Auction creator to deploy contract if the NFT does not belong to them", async function () {
            const { erc20Token, erc721Token, bidder1 } = await loadFixture(
                deployNFTDutchAuctionFixture
            );

            // Mint NFT with tokenId 1 to bidder1
            await expect(erc721Token.mintNFT(bidder1.address, "Test URI"))
                .to.emit(erc721Token, "Transfer")
                .withArgs(ethers.constants.AddressZero, bidder1.address, 1);

            // Deploy NFT contract with bidder1's tokenId, should fail
            const NFTDutchAuction = await ethers.getContractFactory(
                "NFTDutchAuction_ERC20Bids"
            );
            await expect(
                upgrades.deployProxy(NFTDutchAuction, [
                    erc20Token.address,
                    erc721Token.address,
                    1,
                    minimumPrice,
                    auctionDuration,
                    priceDecrement
                ]
                )
            ).to.be.revertedWith(
                "The NFT tokenId does not belong to the Auction's Owner"
            );
        });

        it("Should set the correct initial price", async function () {
            const { nftDutchAuction } = await loadFixture(deployNFTDutchAuctionFixture);

            const initialPrice = minimumPrice + (auctionDuration - 2) * priceDecrement;

            expect(await nftDutchAuction.getCurrentPrice()).to.equal(initialPrice);
        });
    });

    describe("Bids", function () {
        it("Should calculate the expected current price after 5 blocks", async function () {
            const { nftDutchAuction } = await loadFixture(deployNFTDutchAuctionFixture);

            const initialPrice = minimumPrice + (auctionDuration - 2) * priceDecrement;
            const priceAfter5Blocks = initialPrice - 5 * priceDecrement;

            await mine(5);

            expect(await nftDutchAuction.getCurrentPrice()).to.equal(priceAfter5Blocks);
        });

        it("Should reject low bids", async function () {
            const { nftDutchAuction, bidder1 } = await loadFixture(deployNFTDutchAuctionFixture);

            await mine(1);

            const lowBidPrice = minimumPrice - priceDecrement * 3;

            await expect(
                nftDutchAuction.connect(bidder1).bid(lowBidPrice)
            ).to.be.revertedWith("The ERC20 value sent is not acceptable");

            await expect(
                nftDutchAuction.connect(bidder1).bid(50)
            ).to.be.revertedWith("The ERC20 value sent is not acceptable");
        });
        it("Should not allow unauthorized tokens to bid", async function () {
            const { nftDutchAuction, erc20Token, bidder1, bidder2 } =
                await loadFixture(deployNFTDutchAuctionFixture);
            //mine 5 blocks
            await mine(5);

            const initialPrice =
                minimumPrice + (auctionDuration - 2) * priceDecrement;
            //Get price after 4 blocks
            const highBidPrice = initialPrice - priceDecrement * 4;

            //Bid function should succeed
            await expect(
                nftDutchAuction.connect(bidder2).bid(highBidPrice)
            ).to.be.revertedWith(
                "Bid amount was accepted, but bid failed as not enough balance/allowance to transfer erc20 token E20Tkn"
            );

            await expect(
                nftDutchAuction.connect(bidder2).bid(highBidPrice)
            ).to.be.revertedWith(
                "Bid amount was accepted, but bid failed as not enough balance/allowance to transfer erc20 token E20Tkn"
            );
        });

        it("Should accept bids higher than currentPrice and set winner as bidder's address", async function () {
            const {
                nftDutchAuction,
                erc20Token,
                erc721Token,
                deployer,
                bidder1,
            } = await loadFixture(deployNFTDutchAuctionFixture);

            await erc721Token
                .connect(deployer)
                .approve(nftDutchAuction.address, nftTokenId);

            //mine 5 blocks
            await mine(5);

            const initialPrice =
                minimumPrice + (auctionDuration - 2) * priceDecrement;
            const highBidPrice = initialPrice - priceDecrement * 4;

            await erc20Token
                .connect(bidder1)
                .approve(nftDutchAuction.address, highBidPrice);

            await expect(nftDutchAuction.connect(bidder1).bid(highBidPrice))
                .to.not.be.reverted;

            expect(await nftDutchAuction.winner()).to.equal(
                bidder1.address
            );
        });

        it("Should reject bids after a winning bid is already accepted", async function () {
            const {
                nftDutchAuction,
                erc20Token,
                erc721Token,
                deployer,
                bidder1,
                bidder2,
            } = await loadFixture(deployNFTDutchAuctionFixture);

            await erc721Token
                .connect(deployer)
                .approve(nftDutchAuction.address, nftTokenId);

            //mine 5 blocks
            await mine(5);

            const initialPrice =
                minimumPrice + auctionDuration * priceDecrement;
            const highBidPrice = initialPrice - priceDecrement * 4;

            await erc20Token
                .connect(bidder1)
                .approve(nftDutchAuction.address, highBidPrice);

            await expect(nftDutchAuction.connect(bidder1).bid(highBidPrice))
                .to.not.be.reverted;

            await expect(
                nftDutchAuction.connect(bidder2).bid(highBidPrice)
            ).to.be.revertedWith("Auction has already ended.");
        });

        it("Bids should not be accepted after the auction expires", async function () {
            const { nftDutchAuction, bidder1, bidder2 } =
                await loadFixture(deployNFTDutchAuctionFixture);
            //mine 5 blocks
            await mine(auctionDuration + 1);

            const initialPrice =
                minimumPrice + auctionDuration * priceDecrement;
            //Get price after 4 blocks
            const highBidPrice = initialPrice - priceDecrement * 4;

            await expect(
                nftDutchAuction.connect(bidder2).bid(highBidPrice)
            ).to.be.revertedWith("Auction ended.");
        });

        it("Should return reservePrice when max number of auction blocks have elapsed", async function () {
            const { nftDutchAuction } = await loadFixture(
                deployNFTDutchAuctionFixture
            );
            //mine 10 blocks
            await mine(auctionDuration);
            expect(await nftDutchAuction.getCurrentPrice()).to.equal(
                minimumPrice
            );

            //Mine 5 more blocks
            await mine(5);
            expect(await nftDutchAuction.getCurrentPrice()).to.equal(
                minimumPrice
            );
        });

        it("Should send the accepted bid amount in ERC20Tkn tokens from bidder's account to owner's account", async function () {
            const {
                nftDutchAuction,
                erc20Token,
                erc721Token,
                deployer,
                bidder1,
            } = await loadFixture(deployNFTDutchAuctionFixture);

            await erc721Token
                .connect(deployer)
                .approve(nftDutchAuction.address, nftTokenId);

            //mine 5 blocks
            await mine(5);

            const ownerTMP = (await erc20Token.balanceOf(deployer.address)).toNumber();
            const bidderTMP = (await erc20Token.balanceOf(bidder1.address)).toNumber();

            const initialPrice =
                minimumPrice + auctionDuration * priceDecrement;
            const highBidPrice = initialPrice - priceDecrement * 4;

            await erc20Token
                .connect(bidder1)
                .approve(nftDutchAuction.address, highBidPrice);

            await expect(nftDutchAuction.connect(bidder1).bid(highBidPrice))
                .to.not.be.reverted;

            expect(await erc20Token.balanceOf(deployer.address)).to.equal(
                ownerTMP + highBidPrice
            );

            expect(await erc20Token.balanceOf(bidder1.address)).to.equal(
                bidderTMP - highBidPrice
            );
        });

        it("Should transfer the NFT from Owner's account to Bidder's account", async function () {
            const {
                nftDutchAuction,
                erc20Token,
                erc721Token,
                deployer,
                bidder1,
            } = await loadFixture(deployNFTDutchAuctionFixture);

            await erc721Token
                .connect(deployer)
                .approve(nftDutchAuction.address, nftTokenId);

            //mine 5 blocks
            await mine(5);

            const initialPrice =
                minimumPrice + auctionDuration * priceDecrement;
            const highBidPrice = initialPrice - priceDecrement * 4;

            await erc20Token
                .connect(bidder1)
                .approve(nftDutchAuction.address, highBidPrice);

            //Bid function should succeed and transfer NFT from owner to bidder1
            await expect(nftDutchAuction.connect(bidder1).bid(highBidPrice))
                .to.emit(erc721Token, "Transfer")
                .withArgs(deployer.address, bidder1.address, nftTokenId);

            expect(await erc721Token.ownerOf(nftTokenId)).to.equal(
                bidder1.address
            );
        });

        it("Owner should still own the NFT after the auction expires if there is no winning bid", async function () {
            const {
                nftDutchAuction,
                erc721Token,
                deployer,
                bidder2,
            } = await loadFixture(deployNFTDutchAuctionFixture);
            //mine 5 blocks
            await mine(auctionDuration + 1);

            const initialPrice =
                minimumPrice + auctionDuration * priceDecrement;

            const highBidPrice = initialPrice - priceDecrement * 4;

            await expect(
                nftDutchAuction.connect(bidder2).bid(highBidPrice)
            ).to.be.revertedWith("Auction ended.");

            expect(await erc721Token.ownerOf(nftTokenId)).to.equal(
                deployer.address
            );
        });
    });
    // ERC20 Permit
    describe("NFT & Dutch Auction Deployment with ERC20 Permit functionality ", function () {

        it("token Balance Check", async function () {
            //const {tempoToken, account1} = await loadFixture(deployNFTDAFixture);
            const { nftDutchAuction, erc20Token, deployer, bidder1 } =
                await loadFixture(deployNFTDutchAuctionFixture);

            expect(await erc20Token.balanceOf(bidder1.address)).to.equal(1000);

        });
        it("token Allowance Check", async function () {
            const { nftDutchAuction, erc20Token, deployer, bidder1 } = await loadFixture(deployNFTDutchAuctionFixture);

            const deadline = ethers.constants.MaxUint256

            const { v, r, s } = await getPermitSignature(
                bidder1,
                erc20Token,
                nftDutchAuction.address,
                PERMIT_ALLOWANCE,
                DEADLINE
            );

            await erc20Token.permit(
                bidder1.address,
                nftDutchAuction.address,
                PERMIT_ALLOWANCE,
                DEADLINE,
                v,
                r,
                s
            );

            expect(await erc20Token.allowance(bidder1.address, nftDutchAuction.address)).to.equal(await erc20Token.balanceOf(bidder1.address));
        });
    });
    describe("Upgradable", () => {
        it("Checking if the contract is successfully upgraded", async () => {
            const { nftDutchAuction } = await loadFixture(deployNFTDutchAuctionFixture);
            const auctionContractUpgrade = await ethers.getContractFactory("NFTDutchAuctionERC20BidsUpgradable");

            //console.log(auctionContractUpgradeDeploy)
            // expect(await auctionContractUpgradeDeploy.currentVersion()).to.equal(ethers.BigNumber.from("2"))
            // Call _authorizeUpgrade with an invalid address
            // expect(await upgrades.upgradeProxy(ethers.constants.AddressZero, auctionContractUpgrade))
            //     .to.

            const auctionContractUpgradeDeploy = await upgrades.upgradeProxy(nftDutchAuction.address, auctionContractUpgrade);
            expect(await auctionContractUpgradeDeploy.currentVersion()).to.equal(ethers.BigNumber.from("2"))
        });

    });
});

