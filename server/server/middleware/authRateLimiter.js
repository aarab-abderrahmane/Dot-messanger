const WINDOW_MS = Number(process.env.AUTH_RATE_LIMIT_WINDOW_MS ?? 60_000);
const MAX_ATTEMPTS = Number(process.env.AUTH_RATE_LIMIT_MAX ?? 10);

const attempts = new Map();

function authRateLimiter(req, res, next) {
  const now = Date.now();
  const key = `${req.ip}:${req.path}`;
  const existing = attempts.get(key) || { count: 0, resetAt: now + WINDOW_MS };

  if (now > existing.resetAt) {
    existing.count = 0;
    existing.resetAt = now + WINDOW_MS;
  }

  if (existing.count >= MAX_ATTEMPTS) {
    const retryAfter = Math.ceil((existing.resetAt - now) / 1000);
    return res.status(429).json({
      error: "Kirish urinishlari juda ko'p. Keyinroq urinib ko'ring.",
      retryAfter
    });
  }

  existing.count += 1;
  attempts.set(key, existing);
  next();
}

module.exports = { authRateLimiter };
