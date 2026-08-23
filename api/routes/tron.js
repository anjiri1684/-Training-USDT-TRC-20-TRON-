const express = require("express");
const {
  NILE_HOST,
  TOKEN_ID,
  treasuryStatus,
  getAccountBalances,
  sendTrx,
  sendTrc10,
  isAddress,
} = require("../tron-training");

const router = express.Router();


function optionalApiKey(req, res, next) {
  const expected = process.env.TRAINING_API_KEY;
  if (!expected) return next();
  const given = req.get("x-api-key");
  if (!given || given !== expected) {
    return res.status(401).json({ error: "Missing or invalid x-api-key." });
  }
  next();
}

router.get("/status", async (_req, res) => {
  try {
    const status = await treasuryStatus();
    res.json({
      ok: true,
      network: "TRON Nile",
      host: NILE_HOST,
      token: {
        id: status.id,
        name: status.name,
        abbr: status.abbr,
        precision: status.precision,
        totalSupply: status.totalSupply,
        owner: status.owner,
      },
      treasury: status.treasury,
    });
  } catch (err) {
    console.error("TRON status failed:", err.message);
    res.status(502).json({ error: err.message });
  }
});

router.get("/balance", async (req, res) => {
  const address = String(req.query.address || "").trim();
  if (!address || !isAddress(address)) {
    return res
      .status(400)
      .json({ error: "A valid TRON address is required (?address=T...)." });
  }
  try {
    const balances = await getAccountBalances(address);
    res.json({ ok: true, ...balances });
  } catch (err) {
    console.error("TRON balance failed:", err.message);
    res.status(502).json({ error: err.message });
  }
});

async function handleSend(req, res, sendFn) {
  const { to, amount } = req.body || {};
  if (!to || !amount) {
    return res.status(400).json({ error: "`to` and `amount` are required." });
  }
  try {
    const result = await sendFn(String(to).trim(), amount);
    res.json({ ok: true, ...result });
  } catch (err) {
    console.error("TRON send failed:", err.message);
    res.status(400).json({ error: err.message });
  }
}

router.post("/send-trx", optionalApiKey, (req, res) => handleSend(req, res, sendTrx));
router.post("/send-trc10", optionalApiKey, (req, res) => handleSend(req, res, sendTrc10));

module.exports = router;
