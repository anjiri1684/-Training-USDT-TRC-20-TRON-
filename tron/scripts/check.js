const { TronWeb } = require("tronweb");

async function main() {
  const tronWeb = new TronWeb({
    fullHost: "http://127.0.0.1:9090",
    privateKey:
      "8395f48b7b4e702e340825ac0c92112bdc3b79a24ef85afa8701731348ac8344",
  });

  const address = process.argv[2];
  const contract = await tronWeb.contract(
    require("../build/contracts/TrainingUSDT.json").abi,
    address
  );

  const name = await contract.name().call();
  const symbol = await contract.symbol().call();
  const decimals = await contract.decimals().call();
  const totalSupply = await contract.totalSupply().call();
  const deployerBalance = await contract
    .balanceOf(tronWeb.defaultAddress.base58)
    .call();

  console.log("name:", name);
  console.log("symbol:", symbol);
  console.log("decimals:", decimals.toString());
  console.log("totalSupply:", totalSupply.toString());
  console.log("deployer:", tronWeb.defaultAddress.base58);
  console.log("deployer balance:", deployerBalance.toString());
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
