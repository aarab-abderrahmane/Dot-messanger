CREATE TABLE IF NOT EXISTS users (
  email TEXT PRIMARY KEY,
  ip TEXT NOT NULL,
  token TEXT NOT NULL UNIQUE,
  profile_link TEXT UNIQUE,
  avatar TEXT NOT NULL,
  password TEXT NOT NULL,
  username TEXT NOT NULL,
  creation_date BIGINT NOT NULL,
  dm_privacy TEXT NOT NULL DEFAULT 'contacts',
  request_privacy TEXT NOT NULL DEFAULT 'everyone',
  last_seen_privacy TEXT NOT NULL DEFAULT 'contacts',
  profile_photo_privacy TEXT NOT NULL DEFAULT 'everyone'
);

CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  email TEXT NOT NULL,
  username TEXT NOT NULL,
  avatar TEXT NOT NULL,
  to_email TEXT,
  chat_type TEXT NOT NULL DEFAULT 'direct',
  chat_id TEXT,
  timestamp BIGINT NOT NULL,
  reply_to TEXT,
  content TEXT,
  text TEXT,
  attachments TEXT,
  reactions TEXT,
  forwarded_from TEXT,
  edited_at BIGINT,
  read_by TEXT,
  silent SMALLINT NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS contacts (
  user_email TEXT NOT NULL,
  contact_email TEXT NOT NULL,
  created_at BIGINT NOT NULL,
  PRIMARY KEY (user_email, contact_email),
  FOREIGN KEY (user_email) REFERENCES users(email) ON DELETE CASCADE,
  FOREIGN KEY (contact_email) REFERENCES users(email) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS contact_requests (
  sender_email TEXT NOT NULL,
  recipient_email TEXT NOT NULL,
  created_at BIGINT NOT NULL,
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
  created_at BIGINT NOT NULL,
  FOREIGN KEY (owner_email) REFERENCES users(email) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS group_members (
  group_id TEXT NOT NULL,
  user_email TEXT NOT NULL,
  joined_at BIGINT NOT NULL,
  role TEXT NOT NULL DEFAULT 'member',
  PRIMARY KEY (group_id, user_email),
  FOREIGN KEY (group_id) REFERENCES chat_groups(id) ON DELETE CASCADE,
  FOREIGN KEY (user_email) REFERENCES users(email) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS archived_chats (
  user_email TEXT NOT NULL,
  chat_type TEXT NOT NULL,
  chat_id TEXT NOT NULL,
  created_at BIGINT NOT NULL,
  PRIMARY KEY (user_email, chat_type, chat_id),
  FOREIGN KEY (user_email) REFERENCES users(email) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_messages_timestamp ON messages(timestamp);
CREATE INDEX IF NOT EXISTS idx_messages_to_email ON messages(to_email);
CREATE INDEX IF NOT EXISTS idx_messages_chat_type_chat_id ON messages(chat_type, chat_id);
CREATE INDEX IF NOT EXISTS idx_users_token ON users(token);
CREATE INDEX IF NOT EXISTS idx_users_profile_link ON users(profile_link);
CREATE INDEX IF NOT EXISTS idx_contacts_user_email ON contacts(user_email);
CREATE INDEX IF NOT EXISTS idx_contact_requests_recipient_email ON contact_requests(recipient_email);
CREATE INDEX IF NOT EXISTS idx_group_members_user_email ON group_members(user_email);
CREATE INDEX IF NOT EXISTS idx_archived_chats_user_email ON archived_chats(user_email);
