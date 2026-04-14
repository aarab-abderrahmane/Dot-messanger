const { getUserByToken } = require("../memory/userStore");
const { findMessageById, updateMessageContentRaw } = require("../memory/chatStore");
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

function handlePollVote(ws, data) {
  const user = getUserByToken(ws.userToken);
  if (!user) return;
  const messageId = String(data?.messageId || "").trim();
  const optionIndex = Number(data?.optionIndex);
  if (!messageId || !Number.isInteger(optionIndex)) return;

  const message = findMessageById(messageId);
  if (!message || message.type !== "poll") return;

  let poll;
  try {
    poll = JSON.parse(String(message.content || "{}"));
  } catch {
    return;
  }
  if (!poll || !Array.isArray(poll.options) || optionIndex < 0 || optionIndex >= poll.options.length) return;
  if (poll.closed) return;

  if (!Array.isArray(poll.votes)) {
    poll.votes = poll.options.map(() => []);
  }
  poll.votes = poll.options.map((_, i) => Array.isArray(poll.votes[i]) ? poll.votes[i] : []);
  const hasAnyVote = poll.votes.some((emails) => emails.includes(user.email));
  if (poll.allowRevote === false && hasAnyVote) {
    return;
  }
  if (poll.multiple) {
    const alreadyVoted = poll.votes[optionIndex].includes(user.email);
    if (alreadyVoted) {
      poll.votes[optionIndex] = poll.votes[optionIndex].filter((email) => email !== user.email);
    } else {
      poll.votes[optionIndex].push(user.email);
    }
  } else {
    poll.votes = poll.votes.map((emails) => emails.filter((email) => email !== user.email));
    poll.votes[optionIndex].push(user.email);
  }

  updateMessageContentRaw(messageId, JSON.stringify(poll));

  const payload = {
    type: "poll_update",
    messageId,
    poll
  };
  if (message.chatType === "group") {
    broadcastToUsers(listGroupMemberEmails(message.chatId), payload);
  } else {
    broadcastToUsers([message.email, message.to].filter(Boolean), payload);
  }
}

function handlePollClose(ws, data) {
  const user = getUserByToken(ws.userToken);
  if (!user) return;
  const messageId = String(data?.messageId || "").trim();
  if (!messageId) return;

  const message = findMessageById(messageId);
  if (!message || message.type !== "poll") return;

  let poll;
  try {
    poll = JSON.parse(String(message.content || "{}"));
  } catch {
    return;
  }
  if (!poll || poll.closed || poll.createdBy !== user.email) return;

  poll.closed = true;
  updateMessageContentRaw(messageId, JSON.stringify(poll));

  const payload = {
    type: "poll_update",
    messageId,
    poll
  };
  if (message.chatType === "group") {
    broadcastToUsers(listGroupMemberEmails(message.chatId), payload);
  } else {
    broadcastToUsers([message.email, message.to].filter(Boolean), payload);
  }
}

module.exports = { handlePollVote, handlePollClose };
