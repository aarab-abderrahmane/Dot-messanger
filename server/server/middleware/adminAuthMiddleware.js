const { timingSafeEqual } = require("crypto");
const { verifyAuthToken } = require("../utils/jwt");

const ADMIN_PANEL_EMAIL = process.env.ADMIN_PANEL_EMAIL || "admin@local";
const ADMIN_PANEL_SESSION = process.env.ADMIN_PANEL_SESSION || "admin-panel-session";
const ADMIN_PANEL_KEY = String(process.env.ADMIN_PANEL_KEY || "");

function safeCompare(a, b) {
  const left = Buffer.from(String(a || ""));
  const right = Buffer.from(String(b || ""));
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

function requireAdminKey(req, res, next) {
  if (!ADMIN_PANEL_KEY) {
    return res.status(503).json({ error: "Admin panel is not configured" });
  }

  const key = req.body?.key || req.headers["x-admin-key"];
  if (!safeCompare(key, ADMIN_PANEL_KEY)) {
    return res.status(401).json({ error: "Invalid admin key" });
  }

  next();
}

function requireAdminToken(req, res, next) {
  const headerToken = req.headers.authorization?.startsWith("Bearer ")
    ? req.headers.authorization.slice(7)
    : null;
  const token = headerToken || req.headers["x-admin-token"];
  const payload = verifyAuthToken(token);

  if (!payload) {
    return res.status(401).json({ error: "Admin auth required" });
  }

  if (payload.sub !== ADMIN_PANEL_EMAIL || payload.sid !== ADMIN_PANEL_SESSION) {
    return res.status(401).json({ error: "Invalid admin session" });
  }

  next();
}

module.exports = {
  requireAdminKey,
  requireAdminToken,
  ADMIN_PANEL_EMAIL,
  ADMIN_PANEL_SESSION
};
