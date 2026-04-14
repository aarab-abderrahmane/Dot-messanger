require("dotenv").config();

const MAX_TOKENS = Number(process.env.MAX_TOKENS ?? 10);
const TOKEN_REFILL_RATE = Number(process.env.TOKEN_REFILL_RATE ?? 2);

const REFILL_INTERVAL_MS = TOKEN_REFILL_RATE * 60 * 1000;

function canYuborish(client) {
  const now = Date.now();

  if (client.tokens === undefined) {
    client.tokens = MAX_TOKENS;  
    client.lastRefill = now;  
  }
  const timePassed = now - client.lastRefill;
  const tokensToAdd = Math.floor(timePassed / REFILL_INTERVAL_MS);

  if (tokensToAdd > 0) {
    client.tokens = Math.min(client.tokens + tokensToAdd, MAX_TOKENS);
    client.lastRefill += tokensToAdd * REFILL_INTERVAL_MS;
  }

  if (client.tokens <= 0) {
    const nextRefillIn = REFILL_INTERVAL_MS - (now - client.lastRefill);
    client.retryAfter = Math.ceil(nextRefillIn / 1000);
    return false;
  }

  client.tokens -= 1;
  client.retryAfter = 0;
  return true;
}

module.exports = { canYuborish };
