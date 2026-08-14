const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying TrainingUSDT with account:", deployer.address);

  const balance = await hre.ethers.provider.getBalance(deployer.address);
  console.log("Deployer ETH balance:", hre.ethers.formatEther(balance));

  const TrainingUSDT = await hre.ethers.getContractFactory("TrainingUSDT");
  const token = await TrainingUSDT.deploy();
  await token.waitForDeployment();

  const address = await token.getAddress();
  console.log("TrainingUSDT deployed to:", address);

  const supply = await token.totalSupply();
  console.log("Total supply:", hre.ethers.formatUnits(supply, 6), "USDT");

  const deployerBalance = await token.balanceOf(deployer.address);
  console.log(
    "Deployer token balance:",
    hre.ethers.formatUnits(deployerBalance, 6),
    "USDT"
  );

  console.log(
    "\nUpdate frontend/config.js CONTRACT_ADDRESS with the address above if it changed."
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
