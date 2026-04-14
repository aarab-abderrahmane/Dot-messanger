
const { getUserByToken } = require("../memory/userStore");
const { findMessageById, updateMessageReactions } = require("../memory/chatStore");
const { broadcast, broadcastToUsers } = require("../services/broadcastService");

function handleReaction(ws, data) {

    const { messageId, emoji } = data;
    const user = getUserByToken(ws.userToken);
    if (!user) return;

    const message = findMessageById(messageId);
    if (!message) return;
    if (message.to && message.email !== user.email && message.to !== user.email) return;

    if (!message.reactions) message.reactions = {};

    // Safely check emoji reactions
    if (!Array.isArray(message.reactions[emoji])) {
      message.reactions[emoji] = [];
    }
    
    const hasThisEmoji = message.reactions[emoji].includes(user.email);

    if (hasThisEmoji) {
        // RULE: TOGGLE OFF
        const index = message.reactions[emoji].indexOf(user.email);
        message.reactions[emoji].splice(index, 1);
    } else {
        // RULE: ONLY ONE EMOJI
        Object.keys(message.reactions).forEach(key => {
            if (Array.isArray(message.reactions[key])) {
              const otherIndex = message.reactions[key].indexOf(user.email);
              if (otherIndex > -1) {
                  message.reactions[key].splice(otherIndex, 1);
              }
            }
        });

        // Now add the new one
        if (!Array.isArray(message.reactions[emoji])) message.reactions[emoji] = [];
        message.reactions[emoji].push(user.email);
    }

    updateMessageReactions(messageId, message.reactions);

    const updatePayload = {
        type: "update_message",
        messageId: messageId,
        reactions: message.reactions
    };

    if (message.to) {
      broadcastToUsers([message.email, message.to], updatePayload);
      return;
    }

    broadcast(updatePayload);
}

module.exports = { handleReaction };
