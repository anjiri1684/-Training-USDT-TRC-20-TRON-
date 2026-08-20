const express = require("express");
const { pool } = require("../db");
const { hashPassword, requireAuth, requireTeacher } = require("../auth");
const {
  generateEthWallet,
  generateTronWallet,
  encryptSecret,
} = require("../crypto-utils");
const { addMemberOnBothChains, removeMemberOnBothChains, mintOnChain } = require("../chains");

const router = express.Router();
router.use(requireAuth, requireTeacher);

// Create a student account: generates custodial wallets on both chains,
// registers them as members on both contracts, stores the account.
router.post("/students", async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ error: "Username and password are required." });
  }

  const existing = await pool.query("SELECT id FROM users WHERE username = $1", [username]);
  if (existing.rows.length) {
    return res.status(409).json({ error: "That username is already taken." });
  }

  const eth = generateEthWallet();
  const tron = await generateTronWallet();

  try {
    await addMemberOnBothChains(eth.address, tron.address);
  } catch (err) {
    console.error("addMemberOnBothChains failed:", err.message);
    return res.status(502).json({ error: "Could not register the new wallets on-chain. Try again." });
  }

  const passwordHash = await hashPassword(password);
  const { rows } = await pool.query(
    `INSERT INTO users
      (username, password_hash, role, eth_address, eth_privkey_enc, tron_address, tron_privkey_enc)
     VALUES ($1, $2, 'student', $3, $4, $5, $6)
     RETURNING id, username, role, eth_address, tron_address, created_at`,
    [
      username,
      passwordHash,
      eth.address,
      encryptSecret(eth.privateKey),
      tron.address,
      encryptSecret(tron.privateKey),
    ]
  );

  res.status(201).json(rows[0]);
});

// Roster: list all students with their addresses (no balances here — keep it fast).
router.get("/students", async (_req, res) => {
  const { rows } = await pool.query(
    "SELECT id, username, eth_address, tron_address, created_at FROM users WHERE role = 'student' ORDER BY created_at DESC"
  );
  res.json(rows);
});

// Distribute funds: mint directly to a student's wallet on the chosen chain.
router.post("/distribute", async (req, res) => {
  const { username, chain, amount } = req.body || {};
  if (!username || !["ethereum", "tron"].includes(chain) || !amount || Number(amount) <= 0) {
    return res.status(400).json({ error: "username, chain (ethereum|tron), and a positive amount are required." });
  }

  const { rows } = await pool.query(
    "SELECT * FROM users WHERE username = $1 AND role = 'student'",
    [username]
  );
  const student = rows[0];
  if (!student) return res.status(404).json({ error: "No such student." });

  const address = chain === "ethereum" ? student.eth_address : student.tron_address;

  try {
    const txHash = await mintOnChain(chain, address, amount);
    await pool.query(
      `INSERT INTO transfers (chain, from_user_id, to_user_id, amount, tx_hash, kind)
       VALUES ($1, NULL, $2, $3, $4, 'mint')`,
      [chain, student.id, String(amount), typeof txHash === "string" ? txHash : null]
    );
    res.json({ ok: true, txHash });
  } catch (err) {
    console.error("mintOnChain failed:", err.message);
    res.status(502).json({ error: "Mint failed on-chain. Check the admin wallet has enough gas." });
  }
});

// Reset a student's password (e.g. they forgot it). Teacher sets a new one directly.
router.post("/students/:username/reset-password", async (req, res) => {
  const { username } = req.params;
  const { password } = req.body || {};
  if (!password || password.length < 4) {
    return res.status(400).json({ error: "New password must be at least 4 characters." });
  }
  const { rows } = await pool.query(
    "SELECT id FROM users WHERE username = $1 AND role = 'student'",
    [username]
  );
  if (!rows[0]) return res.status(404).json({ error: "No such student." });

  const passwordHash = await hashPassword(password);
  await pool.query("UPDATE users SET password_hash = $1 WHERE id = $2", [passwordHash, rows[0].id]);
  res.json({ ok: true });
});

// Remove a student: revokes their on-chain membership (so their wallet can
// no longer send/receive) and deletes the account. Irreversible.
router.delete("/students/:username", async (req, res) => {
  const { username } = req.params;
  const { rows } = await pool.query(
    "SELECT * FROM users WHERE username = $1 AND role = 'student'",
    [username]
  );
  const student = rows[0];
  if (!student) return res.status(404).json({ error: "No such student." });

  try {
    await removeMemberOnBothChains(student.eth_address, student.tron_address);
  } catch (err) {
    console.error("removeMemberOnBothChains failed:", err.message);
    return res.status(502).json({ error: "Could not revoke on-chain membership. Try again." });
  }

  await pool.query("DELETE FROM users WHERE id = $1", [student.id]);
  res.json({ ok: true });
});

// Class-wide transaction history — every mint and transfer across all
// students, for the teacher to audit.
router.get("/history", async (_req, res) => {
  const { rows } = await pool.query(
    `SELECT t.id, t.chain, t.amount, t.tx_hash, t.kind, t.created_at,
            fu.username AS from_username, tu.username AS to_username
     FROM transfers t
     LEFT JOIN users fu ON fu.id = t.from_user_id
     LEFT JOIN users tu ON tu.id = t.to_user_id
     ORDER BY t.created_at DESC
     LIMIT 200`
  );
  res.json(rows);
});

module.exports = router;
