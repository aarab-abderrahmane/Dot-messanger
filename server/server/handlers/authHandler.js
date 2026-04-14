const { getUserByToken } = require("../memory/userStore");
const { pushUserState } = require('../services/broadcastService');

function safeSend(ws, payload) {
  if (!ws || typeof ws.send !== "function" || ws.readyState !== 1) {
    return false;
  }

  try {
    ws.send(JSON.stringify(payload));
    return true;
  } catch (error) {
    console.error("AUTH send error:", error);
    return false;
  }
}

function handleAuth(ws, data) {
  if (!data.token || typeof data.token !== 'string') {
    safeSend(ws, {
      type: "AUTH_ERROR",
      message: "Invalid token format"
    });
    ws.close();
    return;
  }

  const user = getUserByToken(data.token);

  if (!user) {
    safeSend(ws, {
      type: "AUTH_ERROR",
      message: "Token yaroqsiz"
    });
    ws.close();
    return;
  }

  ws.isAuthenticated = true;
  ws.userToken = data.token;
  ws.userEmail = user.email;

  safeSend(ws, {
    type: "AUTH_SUCCESS",
    email: user.email
  });

  pushUserState(user.email);
}

module.exports = { handleAuth };
