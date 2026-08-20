const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying ClassChainToken with owner:", deployer.address);

  const balance = await hre.ethers.provider.getBalance(deployer.address);
  console.log("Deployer ETH balance:", hre.ethers.formatEther(balance));

  const ClassChainToken = await hre.ethers.getContractFactory("ClassChainToken");
  const token = await ClassChainToken.deploy(deployer.address);
  await token.waitForDeployment();

  const address = await token.getAddress();
  console.log("ClassChainToken deployed to:", address);
  console.log("Owner (admin wallet):", await token.owner());
  console.log("Total supply:", hre.ethers.formatUnits(await token.totalSupply(), 6), "CCT");

  console.log(
    "\nUpdate backend/api/.env CLASSCHAIN_ETH_ADDRESS with the address above."
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
