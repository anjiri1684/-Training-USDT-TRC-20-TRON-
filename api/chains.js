const { ethers } = require("ethers");
const { TronWeb } = require("tronweb");
const { ETH_ABI, TRON_ABI } = require("./abi");

const ethProvider = new ethers.JsonRpcProvider(process.env.SEPOLIA_RPC_URL);
const ethAdminWallet = new ethers.Wallet(process.env.ETH_ADMIN_PRIVATE_KEY, ethProvider);
const ethContract = new ethers.Contract(
  process.env.CLASSCHAIN_ETH_ADDRESS,
  ETH_ABI,
  ethAdminWallet
);

const tronAdmin = new TronWeb({
  fullHost: "https://nile.trongrid.io",
  privateKey: process.env.TRON_ADMIN_PRIVATE_KEY,
});

function tronForUser(privateKey) {
  return new TronWeb({ fullHost: "https://nile.trongrid.io", privateKey });
}

async function tronContract(tronWebInstance) {
  return tronWebInstance.contract(TRON_ABI, process.env.CLASSCHAIN_TRON_ADDRESS);
}

const DECIMALS = 6;
const toUnits = (amount) => ethers.parseUnits(String(amount), DECIMALS);
const fromUnits = (raw) => ethers.formatUnits(raw, DECIMALS);

function tronToUnits(amount) {
  return BigInt(Math.round(Number(amount) * 10 ** DECIMALS)).toString();
}
function tronFromUnits(raw) {
  return (Number(raw) / 10 ** DECIMALS).toString();
}


async function addMemberOnBothChains(ethAddress, tronAddress) {
  const ethTx = await ethContract.addMember(ethAddress);
  await ethTx.wait();

  const tronC = await tronContract(tronAdmin);
  await tronC.addMember(tronAddress).send();
}

async function mintOnChain(chain, toAddress, amount) {
  if (chain === "ethereum") {
    const tx = await ethContract.mint(toAddress, toUnits(amount));
    const receipt = await tx.wait();
    return receipt.hash;
  }
  const tronC = await tronContract(tronAdmin);
  return tronC.mint(toAddress, tronToUnits(amount)).send();
}


async function balances(ethAddress, tronAddress) {
  const ethRaw = await ethContract.balanceOf(ethAddress);
  const tronC = await tronContract(tronAdmin); 
  const tronRaw = await tronC.balanceOf(tronAddress).call();
  return {
    ethereum: fromUnits(ethRaw),
    tron: tronFromUnits(tronRaw.toString()),
  };
}

async function transferOnChain(chain, fromPrivateKey, toAddress, amount) {
  if (chain === "ethereum") {
    const signer = new ethers.Wallet(fromPrivateKey, ethProvider);
    const c = new ethers.Contract(process.env.CLASSCHAIN_ETH_ADDRESS, ETH_ABI, signer);
    const tx = await c.transfer(toAddress, toUnits(amount));
    const receipt = await tx.wait();
    return receipt.hash;
  }
  const userTron = tronForUser(fromPrivateKey);
  const c = await tronContract(userTron);
  return c.transfer(toAddress, tronToUnits(amount)).send();
}

module.exports = {
  addMemberOnBothChains,
  mintOnChain,
  transferOnChain,
  balances,
};
