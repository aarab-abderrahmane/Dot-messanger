const { getUserByToken } = require("../memory/userStore");
const { findMessageById, markMessageAsRead } = require("../memory/chatStore");
const { broadcastToUsers } = require("../services/broadcastService");

function handleReadReceipt(ws, data) {
  const user = getUserByToken(ws.userToken);
  if (!user) return;

  const { messageId } = data;
  if (!messageId || typeof messageId !== 'string') {
    return;
  }

  const message = findMessageById(messageId);
  if (!message) return;

  // Mark as read
  if (!message.readBy) {
    message.readBy = [];
  }

  if (!message.readBy.includes(user.email)) {
    message.readBy.push(user.email);
    markMessageAsRead(messageId, message.readBy);
  }

  // Notify sender
  const readPayload = {
    type: "message_read",
    messageId: messageId,
    readBy: user.email,
    readAt: Date.now()
  };

  if (message.chatType === "direct") {
    broadcastToUsers([message.email], readPayload);
  } else {
    const { listGroupMemberEmails } = require("../memory/groupStore");
    const members = listGroupMemberEmails(message.chatId);
    if (members && members.length > 0) {
      broadcastToUsers(members, readPayload);
    }
  }
}

module.exports = { handleReadReceipt };
