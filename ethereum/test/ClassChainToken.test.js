const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("ClassChainToken", function () {
  let token, owner, alice, bob, outsider;

  beforeEach(async function () {
    [owner, alice, bob, outsider] = await ethers.getSigners();
    const ClassChainToken = await ethers.getContractFactory("ClassChainToken");
    token = await ClassChainToken.deploy(owner.address);
    await token.waitForDeployment();
  });

  it("has correct name, symbol, decimals, and starts at zero supply", async function () {
    expect(await token.name()).to.equal("ClassChain Token");
    expect(await token.symbol()).to.equal("CCT");
    expect(await token.decimals()).to.equal(6);
    expect(await token.totalSupply()).to.equal(0n);
  });

  it("only the owner can add members", async function () {
    await expect(token.connect(alice).addMember(alice.address)).to.be.reverted;
    await expect(token.addMember(alice.address)).to.not.be.reverted;
    expect(await token.isMember(alice.address)).to.equal(true);
  });

  it("mint fails if the recipient is not a member", async function () {
    await expect(token.mint(alice.address, 1000)).to.be.revertedWith(
      "ClassChainToken: recipient is not a member"
    );
  });

  it("mint succeeds for a member and increases supply", async function () {
    await token.addMember(alice.address);
    await token.mint(alice.address, 1000);
    expect(await token.balanceOf(alice.address)).to.equal(1000n);
    expect(await token.totalSupply()).to.equal(1000n);
  });

  it("transfer between two members succeeds", async function () {
    await token.addMember(alice.address);
    await token.addMember(bob.address);
    await token.mint(alice.address, 1000);
    await token.connect(alice).transfer(bob.address, 400);
    expect(await token.balanceOf(alice.address)).to.equal(600n);
    expect(await token.balanceOf(bob.address)).to.equal(400n);
  });

  it("rejects a transfer to a non-member (cannot leave the class)", async function () {
    await token.addMember(alice.address);
    await token.mint(alice.address, 1000);
    await expect(token.connect(alice).transfer(outsider.address, 100)).to.be.revertedWith(
      "ClassChainToken: recipient is not a member"
    );
  });

  it("rejects a transfer from a removed member", async function () {
    await token.addMember(alice.address);
    await token.addMember(bob.address);
    await token.mint(alice.address, 1000);
    await token.removeMember(alice.address);
    await expect(token.connect(alice).transfer(bob.address, 100)).to.be.revertedWith(
      "ClassChainToken: sender is not a member"
    );
  });

  it("approve + transferFrom works between members and blocks non-member recipients", async function () {
    await token.addMember(alice.address);
    await token.addMember(bob.address);
    await token.mint(alice.address, 1000);
    await token.connect(alice).approve(bob.address, 500);
    await token.connect(bob).transferFrom(alice.address, bob.address, 300);
    expect(await token.balanceOf(bob.address)).to.equal(300n);
    expect(await token.allowance(alice.address, bob.address)).to.equal(200n);

    await expect(
      token.connect(bob).transferFrom(alice.address, outsider.address, 100)
    ).to.be.revertedWith("ClassChainToken: recipient is not a member");
  });
});
