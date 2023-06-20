import { time, loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { mine } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { ethers } from "hardhat";

describe("BasicDutchAuction", function () {
    const auctionDuration = 10;
    const minimumPrice = 500;
    const priceDecrement = 50;

    async function deployBasicDutchAuctionFixture() {
        const [deployer, bidder1, bidder2] = await ethers.getSigners();

        const BasicDutchAuction = await ethers.getContractFactory(
            "BasicDutchAuction"
        );

        const basicDutchAuction = await BasicDutchAuction.deploy(
            minimumPrice,
            auctionDuration,
            priceDecrement
        );

        return { basicDutchAuction, deployer, bidder1, bidder2 };
    }

    describe("Deployment", function () {
        it("Should set the correct owner", async function () {
            const { basicDutchAuction, deployer } = await loadFixture(
                deployBasicDutchAuctionFixture
            );

            expect(await basicDutchAuction.owner()).to.equal(deployer.address);
        });

        it("Should initialize the auction without a winner", async function () {
            const { basicDutchAuction } = await loadFixture(
                deployBasicDutchAuctionFixture
            );

            expect(await basicDutchAuction.winner()).to.equal(
                ethers.constants.AddressZero
            );
        });

        it("Should set the correct initial price", async function () {
            const { basicDutchAuction } = await loadFixture(
                deployBasicDutchAuctionFixture
            );

            const initialPrice = minimumPrice + auctionDuration * priceDecrement;

            expect(await basicDutchAuction.getCurrentPrice()).to.equal(initialPrice);
        });
    });

    describe("Bids", function () {
        it("Should calculate the expected current price after 5 blocks", async function () {
            const { basicDutchAuction } = await loadFixture(
                deployBasicDutchAuctionFixture
            );

            const initialPrice = minimumPrice + auctionDuration * priceDecrement;
            const priceAfter5Blocks = initialPrice - 5 * priceDecrement;

            await mine(5);

            expect(await basicDutchAuction.getCurrentPrice()).to.equal(
                priceAfter5Blocks
            );
        });

        it("Should reject low bids", async function () {
            const { basicDutchAuction, bidder1 } = await loadFixture(
                deployBasicDutchAuctionFixture
            );

            await mine(1);

            const lowBidPrice =
                minimumPrice + auctionDuration * priceDecrement - priceDecrement * 3;

            await expect(
                basicDutchAuction.connect(bidder1).bid({
                    value: lowBidPrice,
                })
            ).to.be.revertedWith("The wei value sent is not acceptable");

            await expect(
                basicDutchAuction.connect(bidder1).bid({
                    value: 50,
                })
            ).to.be.revertedWith("The wei value sent is not acceptable");
        });

        it("Should set the winner as the bidder and not accept further bids", async function () {
            const { basicDutchAuction, bidder1 } = await loadFixture(
                deployBasicDutchAuctionFixture
            );

            await mine(5);

            const initialPrice = minimumPrice + auctionDuration * priceDecrement;
            const highBidPrice = initialPrice - priceDecrement * 4;

            expect(
                await basicDutchAuction.connect(bidder1).bid({
                    value: highBidPrice,
                })
            ).to.not.be.reverted;

            expect(await basicDutchAuction.winner()).to.equal(bidder1.address);
        });

        it("Should reject bids after a winning bid is already accepted", async function () {
            const { basicDutchAuction, bidder1, bidder2 } = await loadFixture(
                deployBasicDutchAuctionFixture
            );

            await mine(5);

            const initialPrice = minimumPrice + auctionDuration * priceDecrement;
            const highBidPrice = initialPrice - priceDecrement * 4;

            expect(
                await basicDutchAuction.connect(bidder1).bid({
                    value: highBidPrice,
                })
            ).to.not.be.reverted;

            await expect(
                basicDutchAuction.connect(bidder2).bid({
                    value: highBidPrice,
                })
            ).to.be.revertedWith("Auction has already ended.");
        });

        it("Should not accept bids after the auction expires", async function () {
            const { basicDutchAuction, bidder1, bidder2 } = await loadFixture(
                deployBasicDutchAuctionFixture
            );

            await mine(auctionDuration + 1);

            const initialPrice = minimumPrice + auctionDuration * priceDecrement;
            const highBidPrice = initialPrice - priceDecrement * 4;

            await expect(
                basicDutchAuction.connect(bidder2).bid({
                    value: highBidPrice,
                })
            ).to.be.revertedWith("Auction ended.");
        });

        it("Should return the reserve price when the maximum number of auction blocks have elapsed", async function () {
            const { basicDutchAuction } = await loadFixture(
                deployBasicDutchAuctionFixture
            );

            await mine(auctionDuration);

            expect(await basicDutchAuction.getCurrentPrice()).to.equal(minimumPrice);

            await mine(5);

            expect(await basicDutchAuction.getCurrentPrice()).to.equal(minimumPrice);
        });

        it("Should transfer the bid amount from the bidder's account to the owner's account", async function () {
            const { basicDutchAuction, deployer, bidder1 } = await loadFixture(
                deployBasicDutchAuctionFixture
            );

            await mine(5);

            const initialPrice = minimumPrice + auctionDuration * priceDecrement;
            const highBidPrice = initialPrice - priceDecrement * 4;

            await expect(
                basicDutchAuction.connect(bidder1).bid({
                    value: highBidPrice,
                })
            ).to.changeEtherBalances(
                [bidder1, deployer],
                [-highBidPrice, highBidPrice]
            );
        });
    });
});
