const { getUserByUsername, getUserByProfileLink } = require("../memory/userStore");

function extractMentions(content) {
  if (typeof content !== 'string') return [];
  
  // Match @username or @profilelink
  const mentionPattern = /@([\w._-]+)/g;
  const mentions = [];
  const mentionedUsers = new Set();

  let match;
  while ((match = mentionPattern.exec(content)) !== null) {
    const identifier = match[1].toLowerCase();
    
    // Try to find user by username or profile link
    let user = getUserByUsername(identifier);
    if (!user) {
      user = getUserByProfileLink(identifier);
    }
    
    if (user && !mentionedUsers.has(user.email)) {
      mentions.push({
        email: user.email,
        username: user.username,
        offset: match.index,
        length: match[0].length
      });
      mentionedUsers.add(user.email);
    }
  }

  return mentions;
}

function createMentionNotification(mentioner, mentionedEmails, messageId, text) {
  return {
    type: "user_mentioned",
    mentioner: {
      email: mentioner.email,
      username: mentioner.username,
      avatar: mentioner.avatar
    },
    mentionedEmails: mentionedEmails,
    messageId: messageId,
    excerpt: text.slice(0, 100) + (text.length > 100 ? '...' : ''),
    timestamp: Date.now()
  };
}

module.exports = { extractMentions, createMentionNotification };
