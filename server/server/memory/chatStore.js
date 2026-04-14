const { db } = require("../db/database");
const { listContactEmails } = require("./contactStore");
const { listGroupsForUser } = require("./groupStore");

const MAX_HISTORY = 500;

function parseJson(value, fallback) {
  if (!value) return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function mapMessageRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    type: row.type,
    email: row.email,
    username: row.username,
    avatar: row.avatar,
    to: row.to_email ?? undefined,
    chatType: row.chat_type || "direct",
    chatId: row.chat_id || row.to_email || undefined,
    timestamp: row.timestamp,
    replyTo: parseJson(row.reply_to, null),
    forwardedFrom: parseJson(row.forwarded_from, undefined),
    edited: Boolean(row.edited_at),
    editedAt: row.edited_at ?? undefined,
    readBy: parseJson(row.read_by, []),
    silent: Boolean(row.silent),
    content: row.content ?? undefined,
    text: row.text ?? undefined,
    attachments: parseJson(row.attachments, undefined),
    reactions: parseJson(row.reactions, undefined)
  };
}

function addMessage(message) {
  db.prepare(`
    INSERT INTO messages (
      id, type, email, username, avatar, to_email, chat_type, chat_id, timestamp, reply_to, content, text, attachments, reactions, forwarded_from, edited_at, read_by, silent
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    message.id,
    message.type,
    message.email,
    message.username,
    message.avatar,
    message.to ?? null,
    message.chatType ?? "direct",
    message.chatId ?? message.to ?? null,
    message.timestamp,
    message.replyTo ? JSON.stringify(message.replyTo) : null,
    message.content ?? null,
    message.text ?? null,
    message.attachments ? JSON.stringify(message.attachments) : null,
    message.reactions ? JSON.stringify(message.reactions) : null,
    message.forwardedFrom ? JSON.stringify(message.forwardedFrom) : null,
    message.editedAt ?? null,
    message.readBy ? JSON.stringify(message.readBy) : null,
    message.silent ? 1 : 0
  );

  db.prepare(`
    DELETE FROM messages
    WHERE id IN (
      SELECT id
      FROM messages
      ORDER BY timestamp DESC
      LIMIT -1 OFFSET ?
    )
  `).run(MAX_HISTORY);
}

function getChatHistory() {
  return db.prepare(`
    SELECT *
    FROM messages
    ORDER BY timestamp ASC
  `).all().map(mapMessageRow);
}

function getChatHistoryForUser(userEmail) {
  const contactEmails = listContactEmails(userEmail);
  const groupIds = listGroupsForUser(userEmail).map((group) => group.id);

  const directRows = db.prepare(`
    SELECT *
    FROM messages
    WHERE chat_type = 'direct'
      AND (
        email = ?
        OR to_email = ?
      )
    ORDER BY timestamp ASC
  `).all(userEmail, userEmail);

  const savedRows = db.prepare(`
    SELECT *
    FROM messages
    WHERE chat_type = 'direct'
      AND email = ?
      AND to_email = ?
    ORDER BY timestamp ASC
  `).all(userEmail, userEmail);

  const groupRows = groupIds.length === 0
    ? []
    : db.prepare(`
      SELECT *
      FROM messages
      WHERE chat_type = 'group'
        AND chat_id IN (${groupIds.map(() => "?").join(", ")})
      ORDER BY timestamp ASC
    `).all(...groupIds);

  return [...directRows, ...savedRows, ...groupRows]
    .sort((a, b) => a.timestamp - b.timestamp)
    .map(mapMessageRow);
}

function findMessageById(id) {
  return mapMessageRow(
    db.prepare(`SELECT * FROM messages WHERE id = ?`).get(id)
  );
}

function updateMessageReactions(id, reactions) {
  db.prepare(`
    UPDATE messages
    SET reactions = ?
    WHERE id = ?
  `).run(JSON.stringify(reactions), id);
}

function updateMessageContent(id, updatedMessage) {
  db.prepare(`
    UPDATE messages
    SET content = ?, edited_at = ?
    WHERE id = ?
  `).run(updatedMessage.content ?? null, updatedMessage.editedAt ?? Date.now(), id);
}

function updateMessageContentRaw(id, content) {
  db.prepare(`
    UPDATE messages
    SET content = ?
    WHERE id = ?
  `).run(content ?? null, id);
}

function markMessageAsRead(id, readBy) {
  db.prepare(`
    UPDATE messages
    SET read_by = ?
    WHERE id = ?
  `).run(JSON.stringify(readBy || []), id);
}

function deleteMessageById(id) {
  db.prepare(`DELETE FROM messages WHERE id = ?`).run(id);
}

module.exports = {
  addMessage,
  getChatHistory,
  getChatHistoryForUser,
  findMessageById,
  updateMessageReactions,
  updateMessageContent,
  updateMessageContentRaw,
  markMessageAsRead,
  deleteMessageById
};
