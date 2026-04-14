const { getUserByToken } = require("../memory/userStore");
const { findMessageById, deleteMessageById } = require("../memory/chatStore");
const { broadcastToUsers } = require("../services/broadcastService");
const { listGroupMemberEmails } = require("../memory/groupStore");

function safeSend(ws, payload) {
  if (!ws || typeof ws.send !== "function" || ws.readyState !== 1) return false;
  try {
    ws.send(JSON.stringify(payload));
    return true;
  } catch {
    return false;
  }
}

function handleMessageDelete(ws, data) {
  const user = getUserByToken(ws.userToken);
  if (!user) return;

  const messageId = String(data?.messageId || "").trim();
  if (!messageId) {
    safeSend(ws, { type: "error", message: "Invalid delete request" });
    return;
  }

  const message = findMessageById(messageId);
  if (!message) {
    safeSend(ws, { type: "error", message: "Message not found" });
    return;
  }

  if (message.email !== user.email) {
    safeSend(ws, { type: "error", message: "You can only delete your own messages" });
    return;
  }

  deleteMessageById(messageId);

  const payload = {
    type: "message_deleted",
    messageId
  };

  if (message.chatType === "group") {
    const members = listGroupMemberEmails(message.chatId);
    broadcastToUsers(members, payload);
    return;
  }

  broadcastToUsers([message.email, message.to].filter(Boolean), payload);
}

module.exports = { handleMessageDelete };
