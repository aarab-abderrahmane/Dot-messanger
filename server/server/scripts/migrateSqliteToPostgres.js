/**
 * One-shot: SQLite (server/data/dot-messenger.sqlite) -> PostgreSQL (DATABASE_URL / PG*).
 * Run from repo: cd server && npm run db:migrate
 */
const fs = require("fs");
const path = require("path");
const { DatabaseSync } = require("node:sqlite");
const { Client } = require("pg");
require("dotenv").config({ path: path.join(__dirname, "..", "..", ".env") });

const sqlitePath = path.join(__dirname, "..", "..", "data", "dot-messenger.sqlite");
const schemaPath = path.join(__dirname, "..", "..", "postgres", "init", "001_schema.sql");

function pgClient() {
  console.log("PG:", {
    host: process.env.PGHOST,
    port: process.env.PGPORT,
    user: process.env.PGUSER,
    password: process.env.PGPASSWORD,
    database: process.env.PGDATABASE,
    databaseUrl: process.env.DATABASE_URL
  });

  return new Client({
    host: process.env.PGHOST,
    port: Number(process.env.PGPORT || 5432),
    user: process.env.PGUSER,
    password: process.env.PGPASSWORD,
    database: process.env.PGDATABASE
  });
}

async function ensureSchema(client) {
  const sql = fs.readFileSync(schemaPath, "utf8");
  await client.query(sql);
}

async function truncateAll(client) {
  await client.query(`
    TRUNCATE TABLE
      messages,
      contacts,
      contact_requests,
      group_members,
      chat_groups,
      archived_chats,
      users
    RESTART IDENTITY CASCADE;
  `);
}

function chunk(array, size) {
  const out = [];
  for (let i = 0; i < array.length; i += size) out.push(array.slice(i, i + size));
  return out;
}

async function insertRows(client, table, columns, rows, chunkSize = 300, onConflict = '') {
  if (!rows.length) {
    console.log(`  ${table}: 0 rows`);
    return;
  }
  const colList = columns.map((c) => `"${c}"`).join(", ");
  const conflictClause = onConflict ? ` ${onConflict}` : '';
  for (const part of chunk(rows, chunkSize)) {
    const placeholders = part
      .map((_, ri) => {
        const base = ri * columns.length;
        return `(${columns.map((_, ci) => `$${base + ci + 1}`).join(", ")})`;
      })
      .join(", ");
    const flat = part.flatMap((row) => columns.map((c) => row[c]));
    await client.query(`INSERT INTO ${table} (${colList}) VALUES ${placeholders}${conflictClause}`, flat);
  }
  console.log(`  ${table}: ${rows.length} rows`);
}

function openSqlite() {
  if (!fs.existsSync(sqlitePath)) {
    throw new Error(`SQLite file not found: ${sqlitePath}`);
  }
  return new DatabaseSync(sqlitePath);
}

async function main() {
  const append = process.argv.includes("--append");
  const sqlite = openSqlite();

  const users = sqlite
    .prepare(
      `
    SELECT
      email, ip, token, profile_link, avatar, password, username, creation_date,
      COALESCE(dm_privacy, 'contacts') AS dm_privacy,
      COALESCE(request_privacy, 'everyone') AS request_privacy,
      COALESCE(last_seen_privacy, 'contacts') AS last_seen_privacy,
      COALESCE(profile_photo_privacy, 'everyone') AS profile_photo_privacy
    FROM users
  `
    )
    .all();

  const messages = sqlite
    .prepare(
      `
    SELECT
      id, type, email, username, avatar,
      to_email, chat_type, chat_id, timestamp, reply_to, content, text,
      attachments, reactions, forwarded_from, edited_at, read_by,
      COALESCE(silent, 0) AS silent
    FROM messages
  `
    )
    .all();

  const contacts = sqlite
    .prepare(`SELECT user_email, contact_email, created_at FROM contacts`)
    .all();

  const contactRequests = sqlite
    .prepare(`SELECT sender_email, recipient_email, created_at FROM contact_requests`)
    .all();

  const chatGroups = sqlite
    .prepare(
      `
    SELECT id, title, avatar, owner_email, kind, linked_group_id, created_at
    FROM chat_groups
  `
    )
    .all();

  const groupMembers = sqlite
    .prepare(`SELECT group_id, user_email, joined_at, role FROM group_members`)
    .all();

  const archivedChats = sqlite
    .prepare(`SELECT user_email, chat_type, chat_id, created_at FROM archived_chats`)
    .all();

  sqlite.close();

  const client = pgClient();
  await client.connect();
  try {
    await ensureSchema(client);
    if (!append) {
      await truncateAll(client);
      console.log("Truncated existing PostgreSQL tables (use --append to skip).");
    }

    console.log("Copying...");
    await insertRows(client, "users", [
      "email",
      "ip",
      "token",
      "profile_link",
      "avatar",
      "password",
      "username",
      "creation_date",
      "dm_privacy",
      "request_privacy",
      "last_seen_privacy",
      "profile_photo_privacy"
    ], users, undefined, append ? 'ON CONFLICT DO NOTHING' : '');

    await insertRows(client, "messages", [
      "id",
      "type",
      "email",
      "username",
      "avatar",
      "to_email",
      "chat_type",
      "chat_id",
      "timestamp",
      "reply_to",
      "content",
      "text",
      "attachments",
      "reactions",
      "forwarded_from",
      "edited_at",
      "read_by",
      "silent"
    ], messages, undefined, append ? 'ON CONFLICT DO NOTHING' : '');

    await insertRows(client, "contacts", ["user_email", "contact_email", "created_at"], contacts, undefined, append ? 'ON CONFLICT DO NOTHING' : '');
    await insertRows(
      client,
      "contact_requests",
      ["sender_email", "recipient_email", "created_at"],
      contactRequests,
      undefined,
      append ? 'ON CONFLICT DO NOTHING' : ''
    );
    await insertRows(
      client,
      "chat_groups",
      ["id", "title", "avatar", "owner_email", "kind", "linked_group_id", "created_at"],
      chatGroups,
      undefined,
      append ? 'ON CONFLICT DO NOTHING' : ''
    );
    await insertRows(
      client,
      "group_members",
      ["group_id", "user_email", "joined_at", "role"],
      groupMembers,
      undefined,
      append ? 'ON CONFLICT DO NOTHING' : ''
    );
    await insertRows(
      client,
      "archived_chats",
      ["user_email", "chat_type", "chat_id", "created_at"],
      archivedChats,
      undefined,
      append ? 'ON CONFLICT DO NOTHING' : ''
    );

    console.log("Done. Refresh pgAdmin — data should be in public schema.");
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
