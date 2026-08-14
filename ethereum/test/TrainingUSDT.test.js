const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("TrainingUSDT", function () {
  let token, deployer, alice, bob;

  beforeEach(async function () {
    [deployer, alice, bob] = await ethers.getSigners();
    const TrainingUSDT = await ethers.getContractFactory("TrainingUSDT");
    token = await TrainingUSDT.deploy();
    await token.waitForDeployment();
  });

  it("has correct name, symbol, decimals", async function () {
    expect(await token.name()).to.equal("Training USDT");
    expect(await token.symbol()).to.equal("USDT");
    expect(await token.decimals()).to.equal(6);
  });

  it("mints full supply to deployer", async function () {
    const supply = await token.totalSupply();
    expect(supply).to.equal(ethers.parseUnits("100000000", 6));
    expect(await token.balanceOf(deployer.address)).to.equal(supply);
  });

  it("supports wallet-to-wallet transfer", async function () {
    await token.transfer(alice.address, ethers.parseUnits("1000", 6));
    expect(await token.balanceOf(alice.address)).to.equal(
      ethers.parseUnits("1000", 6)
    );
  });

  it("supports approve + transferFrom", async function () {
    await token.approve(alice.address, ethers.parseUnits("500", 6));
    await token
      .connect(alice)
      .transferFrom(deployer.address, bob.address, ethers.parseUnits("500", 6));
    expect(await token.balanceOf(bob.address)).to.equal(
      ethers.parseUnits("500", 6)
    );
    expect(await token.allowance(deployer.address, alice.address)).to.equal(0);
  });

  it("exposes simulated reference price of $1 (6 decimals)", async function () {
    expect(await token.simulatedUsdPrice()).to.equal(1_000_000);
  });
});
