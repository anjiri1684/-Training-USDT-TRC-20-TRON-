const TrainingUSDT = artifacts.require("TrainingUSDT");

contract("TrainingUSDT", (accounts) => {
  const [deployer, alice, bob] = accounts;
  let token;

  beforeEach(async () => {
    token = await TrainingUSDT.new();
  });

  it("has correct name, symbol, decimals", async () => {
    assert.equal(await token.name(), "Training USDT");
    assert.equal(await token.symbol(), "USDT");
    assert.equal((await token.decimals()).toString(), "6");
  });

  it("mints full supply to deployer", async () => {
    const supply = await token.totalSupply();
    assert.equal(supply.toString(), "100000000000000");
    assert.equal((await token.balanceOf(deployer)).toString(), supply.toString());
  });

  it("supports wallet-to-wallet transfer", async () => {
    await token.transfer(alice, "1000000000", { from: deployer });
    assert.equal((await token.balanceOf(alice)).toString(), "1000000000");
  });

  it("supports approve + transferFrom", async () => {
    await token.approve(alice, "500000000", { from: deployer });
    await token.transferFrom(deployer, bob, "500000000", { from: alice });
    assert.equal((await token.balanceOf(bob)).toString(), "500000000");
    assert.equal((await token.allowance(deployer, alice)).toString(), "0");
  });

  it("exposes simulated reference price of $1 (6 decimals)", async () => {
    assert.equal((await token.simulatedUsdPrice()).toString(), "1000000");
  });
});
