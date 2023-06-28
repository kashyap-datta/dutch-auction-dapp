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

        const ERC20Token = await ethers.getContractFactory("ERC20Token");
        const erc20Token = await ERC20Token.deploy(100000); // Adjust the initial supply as needed
        await erc20Token.mint(bidder1.address, 10000);

        const NFTDutchAuction = await ethers.getContractFactory("NFTDutchAuction_ERC20Bids");

        const nftDutchAuction = await NFTDutchAuction.deploy(erc20Token.address,
            erc721Token.address,
            nftTokenId,
            minimumPrice,
            auctionDuration,
            priceDecrement
        );
        await erc721Token.approve(nftDutchAuction.address, nftTokenId);
        return { erc721Token, erc20Token, nftDutchAuction, deployer, bidder1, bidder2 };
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
                NFTDutchAuction.deploy(
                    erc20Token.address,
                    erc721Token.address,
                    1,
                    minimumPrice,
                    auctionDuration,
                    priceDecrement
                )
            ).to.be.revertedWith(
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
                nftDutchAuction.connect(bidder1).bid(lowBidPrice)
            ).to.be.revertedWith("The ERC20 value sent is not acceptable");

            await expect(
                nftDutchAuction.connect(bidder1).bid(50)
            ).to.be.revertedWith("The ERC20 value sent is not acceptable");
        });

        it("Should acknowledge bids higher than currentPrice but still fail if proper allowance is not set to the contract's address", async function () {
            const { nftDutchAuction, erc20Token, bidder1 } =
                await loadFixture(deployNFTDutchAuctionFixture);
            //mine 5 blocks
            await mine(5);

            const initialPrice =
                minimumPrice + (auctionDuration - 1) * priceDecrement;
            //Get price after 4 blocks
            const highBidPrice = initialPrice - priceDecrement * 4;

            await expect(
                nftDutchAuction.connect(bidder1).bid(highBidPrice)
            ).to.be.revertedWith(
                "ERC20: insufficient allowance"
            );

            await erc20Token
                .connect(bidder1)
                .approve(nftDutchAuction.address, highBidPrice - 10);

            await expect(
                nftDutchAuction.connect(bidder1).bid(highBidPrice)
            ).to.be.revertedWith(
                "ERC20: insufficient allowance"
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
                minimumPrice + auctionDuration * priceDecrement;
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

        it("Should send the accepted bid amount in TMP tokens from bidder's account to owner's account", async function () {
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
});