const express = require("express");
const { pool } = require("../db");
const { requireAuth } = require("../auth");
const { decryptSecret } = require("../crypto-utils");
const { balances, transferOnChain } = require("../chains");

const router = express.Router();
router.use(requireAuth);

router.get("/me", async (req, res) => {
  const { rows } = await pool.query("SELECT * FROM users WHERE id = $1", [req.user.id]);
  const user = rows[0];
  if (!user) return res.status(404).json({ error: "Account not found." });

  const bal = await balances(user.eth_address, user.tron_address);
  res.json({
    username: user.username,
    role: user.role,
    ethAddress: user.eth_address,
    tronAddress: user.tron_address,
    balances: bal,
  });
});

router.post("/transfer", async (req, res) => {
  const { toUsername, chain, amount } = req.body || {};
  if (!toUsername || !["ethereum", "tron"].includes(chain) || !amount || Number(amount) <= 0) {
    return res.status(400).json({ error: "toUsername, chain (ethereum|tron), and a positive amount are required." });
  }
  if (toUsername === req.user.username) {
    return res.status(400).json({ error: "You can't send to yourself." });
  }

  const [{ rows: senderRows }, { rows: recipientRows }] = await Promise.all([
    pool.query("SELECT * FROM users WHERE id = $1", [req.user.id]),
    pool.query("SELECT * FROM users WHERE username = $1", [toUsername]),
  ]);
  const sender = senderRows[0];
  const recipient = recipientRows[0];
  if (!recipient) return res.status(404).json({ error: "No account with that username." });

  const fromPrivateKey = decryptSecret(
    chain === "ethereum" ? sender.eth_privkey_enc : sender.tron_privkey_enc
  );
  const toAddress = chain === "ethereum" ? recipient.eth_address : recipient.tron_address;

  try {
    const txHash = await transferOnChain(chain, fromPrivateKey, toAddress, amount);
    await pool.query(
      `INSERT INTO transfers (chain, from_user_id, to_user_id, amount, tx_hash, kind)
       VALUES ($1, $2, $3, $4, $5, 'transfer')`,
      [chain, sender.id, recipient.id, String(amount), typeof txHash === "string" ? txHash : null]
    );
    res.json({ ok: true, txHash });
  } catch (err) {
    console.error("transferOnChain failed:", err.message);
    res.status(502).json({ error: err.reason || "Transfer failed. Check your balance and try again." });
  }
});

module.exports = router;
