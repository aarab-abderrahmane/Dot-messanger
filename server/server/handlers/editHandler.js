const { getUserByToken } = require("../memory/userStore");
const { findMessageById, updateMessageContent } = require("../memory/chatStore");
const { broadcastToUsers } = require("../services/broadcastService");

const EDIT_TIME_LIMIT_MS = 15 * 60 * 1000; // 15 minutes

function validateEditMessage(data) {
  if (!data.messageId || typeof data.messageId !== 'string') {
    return null;
  }
  if (!data.content || typeof data.content !== 'string') {
    return null;
  }
  const sanitized = data.content.trim().slice(0, 500);
  if (!sanitized) return null;
  return sanitized;
}

function handleMessageEdit(ws, data) {
  const user = getUserByToken(ws.userToken);
  if (!user) return;

  const messageId = data.messageId;
  const newContent = validateEditMessage(data);
  
  if (!newContent) {
    ws.send(JSON.stringify({ 
      type: "error", 
      message: "Invalid edit request" 
    }));
    return;
  }

  const message = findMessageById(messageId);
  if (!message) {
    ws.send(JSON.stringify({ 
      type: "error", 
      message: "Message not found" 
    }));
    return;
  }

  // Check permissions - only sender can edit
  if (message.email !== user.email) {
    ws.send(JSON.stringify({ 
      type: "error", 
      message: "You can only edit your own messages" 
    }));
    return;
  }

  // Check time limit
  const timeSinceSend = Date.now() - message.timestamp;
  if (timeSinceSend > EDIT_TIME_LIMIT_MS) {
    ws.send(JSON.stringify({ 
      type: "error", 
      message: "Edit window expired (15 minutes)" 
    }));
    return;
  }

  const updatedMessage = {
    ...message,
    content: newContent,
    edited: true,
    editedAt: Date.now()
  };

  updateMessageContent(messageId, updatedMessage);

  const updatePayload = {
    type: "message_edited",
    messageId: messageId,
    content: newContent,
    edited: true,
    editedAt: updatedMessage.editedAt
  };

  if (message.chatType === "direct") {
    broadcastToUsers([message.email, message.to], updatePayload);
  } else {
    const { listGroupMemberEmails } = require("../memory/groupStore");
    const members = listGroupMemberEmails(message.chatId);
    if (members && members.length > 0) {
      broadcastToUsers(members, updatePayload);
    }
  }
}

module.exports = { handleMessageEdit };
