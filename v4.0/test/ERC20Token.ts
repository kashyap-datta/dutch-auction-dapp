import { ethers } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { ERC20Token } from "../typechain-types/contracts/ERC20Token";

describe("ERC20Token", function () {
    async function deployTokenFixture() {
        const [owner, account1, account2] = await ethers.getSigners();

        const ERC20Token = await ethers.getContractFactory("ERC20Token");

        const bnbToken = await ERC20Token.deploy(1000);

        return { bnbToken, owner, account1, account2 };
    }

    describe("Deployment", function () {
        it("Should set the right owner", async function () {
            const { bnbToken, owner } = await loadFixture(deployTokenFixture);

            expect(await bnbToken.owner()).to.equal(owner.address);
        });

        it("Should allow owner to mint tokens and emit minting/transfer event", async function () {
            const { bnbToken, owner } = await loadFixture(deployTokenFixture);

            await expect(bnbToken.mint(owner.address, 1000))
                .to.emit(bnbToken, "Transfer")
                .withArgs(ethers.constants.AddressZero, owner.address, 1000);
        });

        it("Should not allow non-owner addresses to mint Tokens", async function () {
            const { bnbToken, owner, account1 } = await loadFixture(
                deployTokenFixture
            );

            await expect(
                bnbToken.connect(account1).mint(owner.address, 1000)
            ).to.be.revertedWith("Ownable: caller is not the owner");
        });
    });

    describe("Transfers & Approvals", function () {
        it("Should allow owner to transfer the NFT", async function () {
            const { bnbToken, owner, account1 } = await loadFixture(
                deployTokenFixture
            );

            await bnbToken.mint(account1.address, 1000);

            await expect(bnbToken.transfer(account1.address, 50))
                .to.emit(bnbToken, "Transfer")
                .withArgs(owner.address, account1.address, 50);
        });

        it("Should not allow non-token-owning addresses to transfer the NFT unless approved", async function () {
            const { bnbToken, owner, account1, account2 } = await loadFixture(
                deployTokenFixture
            );

            await bnbToken.mint(account1.address, 100);

            await bnbToken.connect(account1).transfer(account2.address, 50);

            await expect(
                bnbToken
                    .connect(account2)
                    .transferFrom(account1.address, account2.address, 25)
            ).to.be.revertedWith("ERC20: insufficient allowance");
        });

        it("Should allow approved addresses to transfer tokens", async function () {
            const { bnbToken, owner, account1, account2 } = await loadFixture(
                deployTokenFixture
            );

            await bnbToken.mint(account1.address, 1000);

            bnbToken.connect(account1).approve(account2.address, 500);

            await expect(
                bnbToken
                    .connect(account2)
                    .transferFrom(account1.address, account2.address, 500)
            )
                .to.emit(bnbToken, "Transfer")
                .withArgs(account1.address, account2.address, 500);
        });
    });
});