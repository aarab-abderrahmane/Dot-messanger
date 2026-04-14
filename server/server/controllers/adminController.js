const { issueAuthToken } = require("../utils/jwt");
const { getRegistredUsers } = require("../memory/userStore");
const { getChatHistory } = require("../memory/chatStore");
const { getClients } = require("../services/broadcastService");
const { ADMIN_PANEL_EMAIL, ADMIN_PANEL_SESSION } = require("../middleware/adminAuthMiddleware");

function getOnlineEmails() {
  const online = new Set();
  getClients().forEach((client) => {
    if (client?.readyState === 1 && client.userEmail) {
      online.add(client.userEmail);
    }
  });
  return online;
}

function postAdminLogin(_req, res) {
  const token = issueAuthToken({
    email: ADMIN_PANEL_EMAIL,
    sessionId: ADMIN_PANEL_SESSION
  });

  return res.status(200).json({
    token,
    expiresInHours: Number(process.env.TOKEN_TTL_HOURS ?? 24)
  });
}

function getAdminUsers(_req, res) {
  const online = getOnlineEmails();
  const users = getRegistredUsers().map((user) => ({
    email: user.email,
    username: user.username,
    avatar: user.avatar,
    profileLink: user.profileLink,
    ip: user.ip,
    creationDate: user.creationDate,
    online: online.has(user.email)
  }));

  return res.status(200).json({
    total: users.length,
    online: users.filter((u) => u.online).length,
    users
  });
}

function getAdminMessages(req, res) {
  const rawLimit = Number(req.query.limit ?? 300);
  const limit = Number.isFinite(rawLimit) ? Math.max(1, Math.min(2000, Math.floor(rawLimit))) : 300;
  const history = getChatHistory();
  const messages = history.slice(-limit);

  return res.status(200).json({
    total: history.length,
    returned: messages.length,
    messages
  });
}

module.exports = {
  postAdminLogin,
  getAdminUsers,
  getAdminMessages
};
