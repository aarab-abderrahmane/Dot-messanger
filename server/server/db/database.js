const fs = require("fs");
const path = require("path");
const { DatabaseSync } = require("node:sqlite");

const dataDir = path.join(__dirname, "..", "..", "data");
fs.mkdirSync(dataDir, { recursive: true });

const dbPath = path.join(dataDir, "dot-messenger.sqlite");
const db = new DatabaseSync(dbPath);

db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;

  CREATE TABLE IF NOT EXISTS users (
    email TEXT PRIMARY KEY,
    ip TEXT NOT NULL UNIQUE,
    token TEXT NOT NULL UNIQUE,
    profile_link TEXT UNIQUE,
    avatar TEXT NOT NULL,
    password TEXT NOT NULL,
    username TEXT NOT NULL,
    creation_date INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL,
    email TEXT NOT NULL,
    username TEXT NOT NULL,
    avatar TEXT NOT NULL,
    chat_type TEXT NOT NULL DEFAULT 'direct',
    chat_id TEXT,
    timestamp INTEGER NOT NULL,
    reply_to TEXT,
    content TEXT,
    text TEXT,
    attachments TEXT,
    reactions TEXT
  );

  CREATE TABLE IF NOT EXISTS contacts (
    user_email TEXT NOT NULL,
    contact_email TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    PRIMARY KEY (user_email, contact_email),
    FOREIGN KEY (user_email) REFERENCES users(email) ON DELETE CASCADE,
    FOREIGN KEY (contact_email) REFERENCES users(email) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS contact_requests (
    sender_email TEXT NOT NULL,
    recipient_email TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    PRIMARY KEY (sender_email, recipient_email),
    FOREIGN KEY (sender_email) REFERENCES users(email) ON DELETE CASCADE,
    FOREIGN KEY (recipient_email) REFERENCES users(email) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS chat_groups (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    avatar TEXT,
    owner_email TEXT NOT NULL,
    kind TEXT NOT NULL DEFAULT 'group',
    linked_group_id TEXT,
    created_at INTEGER NOT NULL,
    FOREIGN KEY (owner_email) REFERENCES users(email) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS group_members (
    group_id TEXT NOT NULL,
    user_email TEXT NOT NULL,
    joined_at INTEGER NOT NULL,
    PRIMARY KEY (group_id, user_email),
    FOREIGN KEY (group_id) REFERENCES chat_groups(id) ON DELETE CASCADE,
    FOREIGN KEY (user_email) REFERENCES users(email) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS archived_chats (
    user_email TEXT NOT NULL,
    chat_type TEXT NOT NULL,
    chat_id TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    PRIMARY KEY (user_email, chat_type, chat_id),
    FOREIGN KEY (user_email) REFERENCES users(email) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_messages_timestamp ON messages(timestamp);
  CREATE INDEX IF NOT EXISTS idx_users_token ON users(token);
  CREATE INDEX IF NOT EXISTS idx_contacts_user_email ON contacts(user_email);
  CREATE INDEX IF NOT EXISTS idx_contact_requests_recipient_email ON contact_requests(recipient_email);
`);

const usersTableInfo = db.prepare(`
  SELECT sql
  FROM sqlite_master
  WHERE type = 'table' AND name = 'users'
`).get();
const usersTableSql = String(usersTableInfo?.sql || "").toUpperCase();
const usersIpIsUnique = usersTableSql.includes("IP TEXT NOT NULL UNIQUE");

if (usersIpIsUnique) {
  db.exec("PRAGMA foreign_keys = OFF;");
  db.exec("BEGIN;");
  try {
    db.exec(`
      CREATE TABLE users__migration (
        email TEXT PRIMARY KEY,
        ip TEXT NOT NULL,
        token TEXT NOT NULL UNIQUE,
        profile_link TEXT UNIQUE,
        avatar TEXT NOT NULL,
        password TEXT NOT NULL,
        username TEXT NOT NULL,
        creation_date INTEGER NOT NULL
      );
    `);
    db.exec(`
      INSERT INTO users__migration (email, ip, token, profile_link, avatar, password, username, creation_date)
      SELECT email, ip, token, profile_link, avatar, password, username, creation_date
      FROM users;
    `);
    db.exec(`DROP TABLE users;`);
    db.exec(`ALTER TABLE users__migration RENAME TO users;`);
    db.exec("COMMIT;");
  } catch (error) {
    db.exec("ROLLBACK;");
    throw error;
  } finally {
    db.exec("PRAGMA foreign_keys = ON;");
  }
}

const messageColumns = db.prepare(`PRAGMA table_info(messages)`).all();
const hasToEmailColumn = messageColumns.some((column) => column.name === "to_email");
const hasChatTypeColumn = messageColumns.some((column) => column.name === "chat_type");
const hasChatIdColumn = messageColumns.some((column) => column.name === "chat_id");
const hasForwardedFromColumn = messageColumns.some((column) => column.name === "forwarded_from");
const hasEditedAtColumn = messageColumns.some((column) => column.name === "edited_at");
const hasReadByColumn = messageColumns.some((column) => column.name === "read_by");
const hasSilentColumn = messageColumns.some((column) => column.name === "silent");
const groupMemberColumns = db.prepare(`PRAGMA table_info(group_members)`).all();
const hasGroupMemberRoleColumn = groupMemberColumns.some((column) => column.name === "role");
const chatGroupColumns = db.prepare(`PRAGMA table_info(chat_groups)`).all();
const hasChatGroupKind = chatGroupColumns.some((column) => column.name === "kind");
const hasChatGroupLinkedId = chatGroupColumns.some((column) => column.name === "linked_group_id");
const userColumns = db.prepare(`PRAGMA table_info(users)`).all();
const hasProfileLinkColumn = userColumns.some((column) => column.name === "profile_link");
const hasDmPrivacyColumn = userColumns.some((column) => column.name === "dm_privacy");
const hasRequestPrivacyColumn = userColumns.some((column) => column.name === "request_privacy");
const hasLastSeenPrivacyColumn = userColumns.some((column) => column.name === "last_seen_privacy");
const hasProfilePhotoPrivacyColumn = userColumns.some((column) => column.name === "profile_photo_privacy");

if (!hasToEmailColumn) {
  db.exec(`ALTER TABLE messages ADD COLUMN to_email TEXT;`);
}
if (!hasChatTypeColumn) {
  db.exec(`ALTER TABLE messages ADD COLUMN chat_type TEXT NOT NULL DEFAULT 'direct';`);
}
if (!hasChatIdColumn) {
  db.exec(`ALTER TABLE messages ADD COLUMN chat_id TEXT;`);
}
if (!hasForwardedFromColumn) {
  db.exec(`ALTER TABLE messages ADD COLUMN forwarded_from TEXT;`);
}
if (!hasEditedAtColumn) {
  db.exec(`ALTER TABLE messages ADD COLUMN edited_at INTEGER;`);
}
if (!hasReadByColumn) {
  db.exec(`ALTER TABLE messages ADD COLUMN read_by TEXT;`);
}
if (!hasSilentColumn) {
  db.exec(`ALTER TABLE messages ADD COLUMN silent INTEGER NOT NULL DEFAULT 0;`);
}
if (!hasGroupMemberRoleColumn) {
  db.exec(`ALTER TABLE group_members ADD COLUMN role TEXT NOT NULL DEFAULT 'member';`);
}
if (!hasChatGroupKind) {
  db.exec(`ALTER TABLE chat_groups ADD COLUMN kind TEXT NOT NULL DEFAULT 'group';`);
}
if (!hasChatGroupLinkedId) {
  db.exec(`ALTER TABLE chat_groups ADD COLUMN linked_group_id TEXT;`);
}
if (!hasProfileLinkColumn) {
  db.exec(`ALTER TABLE users ADD COLUMN profile_link TEXT;`);
}
if (!hasDmPrivacyColumn) {
  db.exec(`ALTER TABLE users ADD COLUMN dm_privacy TEXT NOT NULL DEFAULT 'contacts';`);
}
if (!hasRequestPrivacyColumn) {
  db.exec(`ALTER TABLE users ADD COLUMN request_privacy TEXT NOT NULL DEFAULT 'everyone';`);
}
if (!hasLastSeenPrivacyColumn) {
  db.exec(`ALTER TABLE users ADD COLUMN last_seen_privacy TEXT NOT NULL DEFAULT 'contacts';`);
}
if (!hasProfilePhotoPrivacyColumn) {
  db.exec(`ALTER TABLE users ADD COLUMN profile_photo_privacy TEXT NOT NULL DEFAULT 'everyone';`);
}

db.exec(`CREATE INDEX IF NOT EXISTS idx_messages_to_email ON messages(to_email);`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_messages_chat_type_chat_id ON messages(chat_type, chat_id);`);
db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_users_profile_link ON users(profile_link);`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_group_members_user_email ON group_members(user_email);`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_archived_chats_user_email ON archived_chats(user_email);`);

module.exports = { db };
