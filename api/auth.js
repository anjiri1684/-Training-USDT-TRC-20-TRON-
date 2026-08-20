const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

function hashPassword(password) {
  return bcrypt.hash(password, 10);
}

function verifyPassword(password, hash) {
  return bcrypt.compare(password, hash);
}

function signToken(user) {
  return jwt.sign(
    { id: user.id, username: user.username, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: "12h" }
  );
}

function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: "Not authenticated." });
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: "Invalid or expired session." });
  }
}

function requireTeacher(req, res, next) {
  if (req.user.role !== "teacher") {
    return res.status(403).json({ error: "Teacher access only." });
  }
  next();
}

module.exports = { hashPassword, verifyPassword, signToken, requireAuth, requireTeacher };
