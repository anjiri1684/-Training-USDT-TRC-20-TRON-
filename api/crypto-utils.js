const crypto = require("crypto");
const { ethers } = require("ethers");
const { TronWeb } = require("tronweb");

const ALGO = "aes-256-gcm";

function getKey() {
  const raw = process.env.ENCRYPTION_KEY;
  if (!raw || raw.length < 32) {
    throw new Error(
      "ENCRYPTION_KEY must be set in .env and be at least 32 characters long."
    );
  }
  return crypto.createHash("sha256").update(raw).digest(); 
}

function encryptSecret(plaintext) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGO, getKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return [iv, authTag, encrypted].map((b) => b.toString("base64")).join(".");
}

function decryptSecret(stored) {
  const [ivB64, authTagB64, dataB64] = stored.split(".");
  const iv = Buffer.from(ivB64, "base64");
  const authTag = Buffer.from(authTagB64, "base64");
  const data = Buffer.from(dataB64, "base64");
  const decipher = crypto.createDecipheriv(ALGO, getKey(), iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
}

function generateEthWallet() {
  const wallet = ethers.Wallet.createRandom();
  return { address: wallet.address, privateKey: wallet.privateKey };
}

const tronWebForKeygen = new TronWeb({ fullHost: "https://nile.trongrid.io" });

async function generateTronWallet() {
  const account = await tronWebForKeygen.createAccount();
  return { address: account.address.base58, privateKey: account.privateKey };
}

module.exports = {
  encryptSecret,
  decryptSecret,
  generateEthWallet,
  generateTronWallet,
};
