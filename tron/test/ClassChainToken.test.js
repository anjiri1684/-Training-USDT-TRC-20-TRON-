const ClassChainToken = artifacts.require("ClassChainToken");


async function expectRevert(txIdPromise) {
  const txId = await txIdPromise;
  let info;
  for (let i = 0; i < 10; i++) {
    info = await tronWeb.trx.getTransactionInfo(txId);
    if (info && info.receipt) break;
    await new Promise((r) => setTimeout(r, 1000));
  }
  assert.equal(
    info && info.receipt && info.receipt.result,
    "REVERT",
    "expected the transaction to revert, but it didn't"
  );
}

contract("ClassChainToken", (accounts) => {
  const [owner, alice, bob, outsider] = accounts;
  let token;

  beforeEach(async () => {
    token = await ClassChainToken.new();
  });

  it("has correct name, symbol, decimals, and starts at zero supply", async () => {
    assert.equal(await token.name(), "ClassChain Token");
    assert.equal(await token.symbol(), "CCT");
    assert.equal((await token.decimals()).toString(), "6");
    assert.equal((await token.totalSupply()).toString(), "0");
  });

  it("only the owner can add members", async () => {
    await expectRevert(token.addMember(alice, { from: alice }));
    await token.addMember(alice, { from: owner });
    assert.isTrue(await token.isMember(alice));
  });

  it("mint fails if the recipient is not a member", async () => {
    await expectRevert(token.mint(alice, 1000, { from: owner }));
  });

  it("mint succeeds for a member and increases supply", async () => {
    await token.addMember(alice, { from: owner });
    await token.mint(alice, 1000, { from: owner });
    assert.equal((await token.balanceOf(alice)).toString(), "1000");
    assert.equal((await token.totalSupply()).toString(), "1000");
  });

  it("transfer between two members succeeds", async () => {
    await token.addMember(alice, { from: owner });
    await token.addMember(bob, { from: owner });
    await token.mint(alice, 1000, { from: owner });
    await token.transfer(bob, 400, { from: alice });
    assert.equal((await token.balanceOf(alice)).toString(), "600");
    assert.equal((await token.balanceOf(bob)).toString(), "400");
  });

  it("rejects a transfer to a non-member (cannot leave the class)", async () => {
    await token.addMember(alice, { from: owner });
    await token.mint(alice, 1000, { from: owner });
    await expectRevert(token.transfer(outsider, 100, { from: alice }));
  });

  it("approve + transferFrom works between members and blocks non-member recipients", async () => {
    await token.addMember(alice, { from: owner });
    await token.addMember(bob, { from: owner });
    await token.mint(alice, 1000, { from: owner });
    await token.approve(bob, 500, { from: alice });
    await token.transferFrom(alice, bob, 300, { from: bob });
    assert.equal((await token.balanceOf(bob)).toString(), "300");
    assert.equal((await token.allowance(alice, bob)).toString(), "200");

    await expectRevert(token.transferFrom(alice, outsider, 100, { from: bob }));
  });
});
