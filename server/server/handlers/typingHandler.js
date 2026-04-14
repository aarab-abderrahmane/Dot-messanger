const { getUserByToken } = require("../memory/userStore");
const { broadcastToUsers, getClients } = require("../services/broadcastService");

function handleTypingIndicator(ws, data) {
  const { chatId, chatType, isTyping } = data;
  const user = getUserByToken(ws.userToken);
  
  if (!user) return;

  const typingPayload = {
    type: "user_typing",
    email: user.email,
    username: user.username,
    chatId: chatId,
    chatType: chatType,
    isTyping: Boolean(isTyping)
  };

  if (chatType === "direct") {
    broadcastToUsers([user.email, chatId], typingPayload);
  } else if (chatType === "group") {
    const { listGroupMemberEmails } = require("../memory/groupStore");
    const members = listGroupMemberEmails(chatId);
    if (members && members.length > 0) {
      broadcastToUsers(members, typingPayload);
    }
  }
}

module.exports = { handleTypingIndicator };
