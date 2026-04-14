const {
  validateTextMessage,
  validateImageMessage,
  validateVoiceMessage,
  validatePdfMessage,
  validateGenericFileMessage,
  validateStickerMessage
} = require("../middleware/validateMessage");
const { getUserByToken } = require("../memory/userStore");
const { areContacts } = require("../memory/contactStore");
const { addMessage } = require("../memory/chatStore");
const { broadcastToUsers } = require("../services/broadcastService");
const { createBaseMessage } = require("../services/messageFactory");
const { findUserByIdentifier } = require("../utils/userLookup");
const { getGroupById, isGroupMember, listGroupMemberEmails, getGroupMemberRole } = require("../memory/groupStore");

function safeSend(ws, payload) {
  if (!ws || typeof ws.send !== "function" || ws.readyState !== 1) {
    return false;
  }

  try {
    ws.send(JSON.stringify(payload));
    return true;
  } catch (error) {
    console.error("Message handler send error:", error);
    return false;
  }
}

function resolveChatTarget(ws, data, user) {
  const chatType = data.chatType === "group" ? "group" : "direct";
  const targetRaw = String(data.to || "").trim();
  if (!targetRaw) {
    safeSend(ws, { type: "error", message: "Recipient is required" });
    return null;
  }

  if (chatType === "group") {
    const group = getGroupById(targetRaw);
    if (!group || !isGroupMember(group.id, user.email)) {
      safeSend(ws, { type: "error", message: "Group not found" });
      return null;
    }
    if (group.kind === "channel") {
      const role = getGroupMemberRole(group.id, user.email);
      if (!["owner", "admin"].includes(role || "")) {
        safeSend(ws, { type: "error", message: "Only channel admins can post" });
        return null;
      }
    }
    return {
      chatType: "group",
      chatId: group.id,
      to: group.id,
      recipients: listGroupMemberEmails(group.id)
    };
  }

  if (targetRaw.toLowerCase() === user.email.toLowerCase()) {
    return {
      chatType: "direct",
      chatId: user.email,
      to: user.email,
      recipients: [user.email]
    };
  }

  const targetUser = findUserByIdentifier(targetRaw);
  if (!targetUser) {
    safeSend(ws, { type: "error", message: "Recipient not found" });
    return null;
  }

  const dmPrivacy = targetUser.dmPrivacy || "contacts";
  if (dmPrivacy === "nobody") {
    safeSend(ws, { type: "error", message: "This user does not accept direct messages" });
    return null;
  }
  if (dmPrivacy === "contacts" && !areContacts(user.email, targetUser.email)) {
    safeSend(ws, { type: "error", message: "Add this user to contacts first" });
    return null;
  }

  return {
    chatType: "direct",
    chatId: targetUser.email,
    to: targetUser.email,
    recipients: [user.email, targetUser.email]
  };
}

function persistAndBroadcast(message, recipients) {
  addMessage(message);
  broadcastToUsers(recipients, message);
}

function normalizeForwardedFrom(forwardedFrom) {
  if (!forwardedFrom || typeof forwardedFrom !== "object") return undefined;
  const email = String(forwardedFrom.email || "").trim().toLowerCase();
  const username = String(forwardedFrom.username || "").trim();
  if (!email || !username) return undefined;
  return { email, username };
}

function handleChatMessage(ws, data) {
  const user = getUserByToken(ws.userToken);
  if (!user) return;

  const target = resolveChatTarget(ws, data, user);
  if (!target) return;
  const forwardedFrom = normalizeForwardedFrom(data.forwardedFrom);
  const silent = Boolean(data.silent);

  if (data.type === "text") {
    const sanitizedText = validateTextMessage(data);
    if (!sanitizedText) {
      safeSend(ws, { type: "error", message: "Invalid text message" });
      return;
    }

    const message = createBaseMessage(user, "text", {
      content: sanitizedText,
      to: target.to,
      chatType: target.chatType,
      chatId: target.chatId,
      replyTo: data.replyTo,
      forwardedFrom,
      silent
    });
    if (!message) {
      safeSend(ws, { type: "error", message: "Invalid text message" });
      return;
    }
    persistAndBroadcast(message, target.recipients);
    return;
  }

  if (data.type === "gift" || data.type === "nudge") {
    const message = createBaseMessage(user, data.type, {
      text: typeof data.text === "string" ? data.text.trim().slice(0, 200) : data.type,
      to: target.to,
      chatType: target.chatType,
      chatId: target.chatId,
      replyTo: data.replyTo,
      forwardedFrom,
      silent
    });
    if (!message) {
      safeSend(ws, { type: "error", message: "Invalid message" });
      return;
    }
    persistAndBroadcast(message, target.recipients);
    return;
  }

  if (data.type === "image") {
    if (!validateImageMessage(data)) {
      safeSend(ws, { type: "error", message: "Invalid image or image is too large" });
      return;
    }
    const message = createBaseMessage(user, "image", {
      text: data.text,
      content: data.content,
      to: target.to,
      chatType: target.chatType,
      chatId: target.chatId,
      replyTo: data.replyTo,
      forwardedFrom,
      silent
    });
    if (!message) {
      safeSend(ws, { type: "error", message: "Invalid image" });
      return;
    }
    persistAndBroadcast(message, target.recipients);
    return;
  }

  if (data.type === "voice") {
    if (!validateVoiceMessage(data)) {
      safeSend(ws, { type: "error", message: "Invalid voice message or voice is too large" });
      return;
    }
    const message = createBaseMessage(user, "voice", {
      text: data.text,
      content: data.content,
      to: target.to,
      chatType: target.chatType,
      chatId: target.chatId,
      replyTo: data.replyTo,
      forwardedFrom,
      silent
    });
    if (!message) {
      safeSend(ws, { type: "error", message: "Invalid voice" });
      return;
    }
    persistAndBroadcast(message, target.recipients);
    return;
  }

  if (data.type === "pdf") {
    if (!validatePdfMessage(data)) {
      safeSend(ws, { type: "error", message: "Invalid PDF payload or PDF exceeds limit" });
      return;
    }
    const message = createBaseMessage(user, "pdf", {
      text: data.text,
      attachments: data.attachments,
      to: target.to,
      chatType: target.chatType,
      chatId: target.chatId,
      replyTo: data.replyTo,
      forwardedFrom,
      silent
    });
    if (!message) {
      safeSend(ws, { type: "error", message: "Invalid PDF" });
      return;
    }
    persistAndBroadcast(message, target.recipients);
    return;
  }

  if (data.type === "file") {
    if (!validateGenericFileMessage(data)) {
      safeSend(ws, { type: "error", message: "Invalid file payload or file exceeds 200MB" });
      return;
    }
    const message = createBaseMessage(user, "file", {
      text: data.text,
      attachments: data.attachments,
      to: target.to,
      chatType: target.chatType,
      chatId: target.chatId,
      replyTo: data.replyTo,
      forwardedFrom,
      silent
    });
    if (!message) {
      safeSend(ws, { type: "error", message: "Invalid file" });
      return;
    }
    persistAndBroadcast(message, target.recipients);
    return;
  }

  if (data.type === "sticker" || data.type === "gif") {
    if (data.type === "sticker" && !validateStickerMessage(data)) {
      safeSend(ws, { type: "error", message: "Invalid sticker" });
      return;
    }
    const message = createBaseMessage(user, data.type, {
      content: data.content,
      to: target.to,
      chatType: target.chatType,
      chatId: target.chatId,
      replyTo: data.replyTo,
      forwardedFrom,
      silent
    });
    if (!message) {
      safeSend(ws, { type: "error", message: "Invalid message" });
      return;
    }
    persistAndBroadcast(message, target.recipients);
    return;
  }

  if (data.type === "poll") {
    const poll = data.poll;
    const question = String(poll?.question || "").trim().slice(0, 300);
    const options = Array.isArray(poll?.options) ? poll.options.map((x) => String(x || "").trim().slice(0, 120)).filter(Boolean) : [];
    if (!question || options.length < 2 || options.length > 10) {
      safeSend(ws, { type: "error", message: "Invalid poll payload" });
      return;
    }
    const correctIndex = Number.isInteger(poll?.correctIndex) ? Number(poll.correctIndex) : null;
    if (Boolean(poll?.quiz) && (correctIndex === null || correctIndex < 0 || correctIndex >= options.length)) {
      safeSend(ws, { type: "error", message: "Invalid quiz answer index" });
      return;
    }
    const payload = {
      question,
      options,
      multiple: Boolean(poll?.multiple),
      quiz: Boolean(poll?.quiz),
      correctIndex,
      anonymous: poll?.anonymous !== false,
      allowRevote: poll?.allowRevote !== false,
      closed: false,
      createdBy: user.email,
      votes: options.map(() => [])
    };
    const message = createBaseMessage(user, "poll", {
      content: JSON.stringify(payload),
      text: question,
      to: target.to,
      chatType: target.chatType,
      chatId: target.chatId,
      replyTo: data.replyTo,
      forwardedFrom,
      silent
    });
    if (!message) {
      safeSend(ws, { type: "error", message: "Invalid poll message" });
      return;
    }
    persistAndBroadcast(message, target.recipients);
    return;
  }

  safeSend(ws, { type: "error", message: "Unsupported message type" });
}

module.exports = { handleChatMessage };
