import { time, loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { mine } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { ethers } from "hardhat";

describe("NFTDutchAuction", function () {
    const auctionDuration = 10;
    const minimumPrice = 500;
    const priceDecrement = 50;
    const nftTokenId = 0;
    const TOKEN_URI = "https://pixabay.com/photos/bird-whitethroat-flowers-bloom-7881393/";

    async function deployNFTDutchAuctionFixture() {
        const [deployer, bidder1, bidder2] = await ethers.getSigners();

        const ERC721Token = await ethers.getContractFactory("ImageNFT");
        const erc721Token = await ERC721Token.deploy();
        await erc721Token.mintNFT(deployer.address, TOKEN_URI);

        const NFTDutchAuction = await ethers.getContractFactory("NFTDutchAuction");

        const nftDutchAuction = await NFTDutchAuction.deploy(
            erc721Token.address,
            nftTokenId,
            minimumPrice,
            auctionDuration,
            priceDecrement
        );
        await erc721Token.approve(nftDutchAuction.address, nftTokenId);
        return { erc721Token, nftDutchAuction, deployer, bidder1, bidder2 };
    }

    describe("Deployment", function () {
        it("Should set the correct owner", async function () {
            const { nftDutchAuction, deployer } = await loadFixture(deployNFTDutchAuctionFixture);

            expect(await nftDutchAuction.owner()).to.equal(deployer.address);
        });

        it("Should initialize the auction without a winner", async function () {
            const { nftDutchAuction } = await loadFixture(deployNFTDutchAuctionFixture);

            expect(await nftDutchAuction.winner()).to.equal(ethers.constants.AddressZero);
        });

        it("Should not allow Auction creator to deploy contract if the NFT does not belong to them", async function () {
            const { erc721Token, bidder1 } = await loadFixture(
                deployNFTDutchAuctionFixture
            );

            //Mint NFT with tokenId 1 to account1
            await expect(erc721Token.mintNFT(bidder1.address, "Test URI"))
                .to.emit(erc721Token, "Transfer")
                .withArgs(ethers.constants.AddressZero, bidder1.address, 1);

            //Deploy NFT contract with account1's tokenId, should fail
            const NFTDutchAuction = await ethers.getContractFactory(
                "NFTDutchAuction"
            );
            await expect(
                NFTDutchAuction.deploy(
                    erc721Token.address,
                    1,
                    minimumPrice,
                    auctionDuration,
                    priceDecrement
                )
            ).to.revertedWith(
                "The NFT tokenId does not belong to the Auction's Owner"
            );
        });

        it("Should set the correct initial price", async function () {
            const { nftDutchAuction } = await loadFixture(deployNFTDutchAuctionFixture);

            const initialPrice = minimumPrice + (auctionDuration - 1) * priceDecrement;

            expect(await nftDutchAuction.getCurrentPrice()).to.equal(initialPrice);
        });
    });

    describe("Bids", function () {
        it("Should calculate the expected current price after 5 blocks", async function () {
            const { nftDutchAuction } = await loadFixture(deployNFTDutchAuctionFixture);

            const initialPrice = minimumPrice + (auctionDuration - 1) * priceDecrement;
            const priceAfter5Blocks = initialPrice - 5 * priceDecrement;

            await mine(5);

            expect(await nftDutchAuction.getCurrentPrice()).to.equal(priceAfter5Blocks);
        });

        it("Should reject low bids", async function () {
            const { nftDutchAuction, bidder1 } = await loadFixture(deployNFTDutchAuctionFixture);

            await mine(1);

            const lowBidPrice = minimumPrice - priceDecrement * 3;

            await expect(
                nftDutchAuction.connect(bidder1).bid({
                    value: lowBidPrice,
                })
            ).to.be.revertedWith("The wei value sent is not acceptable");

            await expect(
                nftDutchAuction.connect(bidder1).bid({
                    value: 50,
                })
            ).to.be.revertedWith("The wei value sent is not acceptable");
        });

        it("Should set the winner as the bidder and not accept further bids", async function () {
            const { nftDutchAuction, bidder1 } = await loadFixture(deployNFTDutchAuctionFixture);

            await mine(5);

            const initialPrice = minimumPrice + (auctionDuration - 1) * priceDecrement;
            const highBidPrice = initialPrice - priceDecrement * 4;

            await expect(
                nftDutchAuction.connect(bidder1).bid({
                    value: highBidPrice,
                })
            ).to.not.be.reverted;

            expect(await nftDutchAuction.winner()).to.equal(bidder1.address);
        });

        it("Should reject bids after a winning bid is already accepted", async function () {
            const { nftDutchAuction, bidder1, bidder2 } = await loadFixture(deployNFTDutchAuctionFixture);

            await mine(5);

            const initialPrice = minimumPrice + (auctionDuration - 1) * priceDecrement;
            const highBidPrice = initialPrice - priceDecrement * 4;

            await expect(
                nftDutchAuction.connect(bidder1).bid({
                    value: highBidPrice,
                })
            ).to.not.be.reverted;

            await expect(
                nftDutchAuction.connect(bidder2).bid({
                    value: highBidPrice,
                })
            ).to.be.revertedWith("Auction has already ended.");
        });

        it("Should not accept bids after the auction expires", async function () {
            const { nftDutchAuction, bidder1, bidder2 } = await loadFixture(deployNFTDutchAuctionFixture);

            await mine(auctionDuration);

            const initialPrice = minimumPrice + (auctionDuration - 1) * priceDecrement;
            const highBidPrice = initialPrice - priceDecrement * 4;

            await expect(
                nftDutchAuction.connect(bidder2).bid({
                    value: highBidPrice,
                })
            ).to.be.revertedWith("Auction ended.");
        });

        it("Should return the reserve price when the maximum number of auction blocks have elapsed", async function () {
            const { nftDutchAuction } = await loadFixture(deployNFTDutchAuctionFixture);

            await mine(auctionDuration);

            expect(await nftDutchAuction.getCurrentPrice()).to.equal(minimumPrice);

            await mine(5);

            expect(await nftDutchAuction.getCurrentPrice()).to.equal(minimumPrice);
        });

        it("Should transfer the bid amount from the bidder's account to the owner's account", async function () {
            const { nftDutchAuction, deployer, bidder1 } = await loadFixture(deployNFTDutchAuctionFixture);

            await mine(5);

            const initialPrice = minimumPrice + (auctionDuration - 1) * priceDecrement;
            const highBidPrice = initialPrice - priceDecrement * 4;

            await expect(
                nftDutchAuction.connect(bidder1).bid({
                    value: highBidPrice,
                })
            ).to.changeEtherBalances([bidder1, deployer], [-highBidPrice, highBidPrice]);
        });
    });
});
