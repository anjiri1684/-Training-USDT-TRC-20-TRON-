const express = require("express");
const { pool } = require("../db");
const { verifyPassword, signToken } = require("../auth");

const router = express.Router();

router.post("/login", async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ error: "Username and password are required." });
  }

  const { rows } = await pool.query("SELECT * FROM users WHERE username = $1", [username]);
  const user = rows[0];
  if (!user || !(await verifyPassword(password, user.password_hash))) {
    return res.status(401).json({ error: "Incorrect username or password." });
  }

  res.json({
    token: signToken(user),
    username: user.username,
    role: user.role,
  });
});

module.exports = router;
