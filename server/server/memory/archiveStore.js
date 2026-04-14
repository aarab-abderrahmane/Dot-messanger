const { db } = require("../db/database");

function listArchivedChats(userEmail) {
  return db.prepare(`
    SELECT chat_type AS chatType, chat_id AS chatId, created_at AS createdAt
    FROM archived_chats
    WHERE user_email = ?
    ORDER BY created_at DESC
  `).all(userEmail);
}

function isChatArchived(userEmail, chatType, chatId) {
  return Boolean(
    db.prepare(`
      SELECT 1
      FROM archived_chats
      WHERE user_email = ? AND chat_type = ? AND chat_id = ?
    `).get(userEmail, chatType, chatId)
  );
}

function archiveChat(userEmail, chatType, chatId) {
  db.prepare(`
    INSERT OR IGNORE INTO archived_chats (user_email, chat_type, chat_id, created_at)
    VALUES (?, ?, ?, ?)
  `).run(userEmail, chatType, chatId, Date.now());
}

function unarchiveChat(userEmail, chatType, chatId) {
  db.prepare(`
    DELETE FROM archived_chats
    WHERE user_email = ? AND chat_type = ? AND chat_id = ?
  `).run(userEmail, chatType, chatId);
}

module.exports = {
  listArchivedChats,
  isChatArchived,
  archiveChat,
  unarchiveChat
};
