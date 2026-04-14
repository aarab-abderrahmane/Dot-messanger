const crypto = require("crypto");

const JWT_SECRET = process.env.JWT_SECRET || "dev-insecure-secret";
const TOKEN_TTL_HOURS = Number(process.env.TOKEN_TTL_HOURS ?? 24);
const TOKEN_TTL_SECONDS = Math.max(1, Math.floor(TOKEN_TTL_HOURS * 60 * 60));

function base64url(input) {
  return Buffer.from(input)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function base64urlToUtf8(value) {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64 + "=".repeat((4 - (base64.length % 4 || 4)) % 4);
  return Buffer.from(padded, "base64").toString("utf8");
}

function sign(payload) {
  return base64url(
    crypto.createHmac("sha256", JWT_SECRET).update(payload).digest()
  );
}

function issueAuthToken({ email, sessionId }) {
  const now = Math.floor(Date.now() / 1000);

  const header = { alg: "HS256", typ: "JWT" };
  const payload = {
    sub: email,
    sid: sessionId,
    iat: now,
    exp: now + TOKEN_TTL_SECONDS
  };

  const encodedHeader = base64url(JSON.stringify(header));
  const encodedPayload = base64url(JSON.stringify(payload));
  const signature = sign(`${encodedHeader}.${encodedPayload}`);

  return `${encodedHeader}.${encodedPayload}.${signature}`;
}

function verifyAuthToken(token) {
  if (typeof token !== "string") return null;

  const parts = token.split(".");
  if (parts.length !== 3) return null;

  const [encodedHeader, encodedPayload, receivedSignature] = parts;
  const expectedSignature = sign(`${encodedHeader}.${encodedPayload}`);

  const received = Buffer.from(receivedSignature);
  const expected = Buffer.from(expectedSignature);
  if (received.length !== expected.length) return null;
  if (!crypto.timingSafeEqual(received, expected)) return null;

  try {
    const payload = JSON.parse(base64urlToUtf8(encodedPayload));
    const now = Math.floor(Date.now() / 1000);

    if (!payload || typeof payload !== "object") return null;
    if (typeof payload.sub !== "string" || typeof payload.sid !== "string") return null;
    if (typeof payload.exp !== "number" || payload.exp <= now) return null;

    return payload;
  } catch {
    return null;
  }
}

module.exports = {
  issueAuthToken,
  verifyAuthToken
};
