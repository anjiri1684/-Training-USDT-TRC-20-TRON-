/**
 * One-time script to create the first teacher account. There is no public
 * signup route on purpose — every account after this one is created by a
 * teacher through the admin API.
 *
 * Usage: npm run seed
 * Reads TEACHER_USERNAME / TEACHER_PASSWORD from .env.
 */
require("dotenv").config();
const { pool, initSchema } = require("./db");
const { hashPassword } = require("./auth");
const { generateEthWallet, generateTronWallet, encryptSecret } = require("./crypto-utils");
const { addMemberOnBothChains } = require("./chains");

async function main() {
  const username = process.env.TEACHER_USERNAME;
  const password = process.env.TEACHER_PASSWORD;
  if (!username || !password) {
    throw new Error("Set TEACHER_USERNAME and TEACHER_PASSWORD in .env before seeding.");
  }

  await initSchema();

  const existing = await pool.query("SELECT id FROM users WHERE username = $1", [username]);
  if (existing.rows.length) {
    console.log(`Teacher "${username}" already exists — nothing to do.`);
    process.exit(0);
  }

  console.log("Generating wallets for the teacher account...");
  const eth = generateEthWallet();
  const tron = await generateTronWallet();

  console.log("Registering wallets on-chain as members...");
  await addMemberOnBothChains(eth.address, tron.address);

  const passwordHash = await hashPassword(password);
  await pool.query(
    `INSERT INTO users
      (username, password_hash, role, eth_address, eth_privkey_enc, tron_address, tron_privkey_enc)
     VALUES ($1, $2, 'teacher', $3, $4, $5, $6)`,
    [
      username,
      passwordHash,
      eth.address,
      encryptSecret(eth.privateKey),
      tron.address,
      encryptSecret(tron.privateKey),
    ]
  );

  console.log(`Teacher account "${username}" created.`);
  console.log("Eth address:", eth.address);
  console.log("Tron address:", tron.address);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
