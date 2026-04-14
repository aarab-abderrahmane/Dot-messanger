const { db } = require("../db/database");
const { getUserByEmail } = require("./userStore");

function mapContactUserRow(row) {
  if (!row) return null;

  return {
    email: row.email,
    username: row.username,
    avatar: row.avatar,
    profileLink: row.profile_link || undefined,
    creationDate: row.creation_date
  };
}

function listContacts(userEmail) {
  return db.prepare(`
    SELECT u.email, u.username, u.avatar, u.profile_link, u.creation_date
    FROM contacts c
    JOIN users u ON u.email = c.contact_email
    WHERE c.user_email = ?
    ORDER BY u.username COLLATE NOCASE ASC
  `).all(userEmail).map(mapContactUserRow);
}

function listContactEmails(userEmail) {
  return listContacts(userEmail).map((contact) => contact.email);
}

function areContacts(firstEmail, secondEmail) {
  if (!firstEmail || !secondEmail) return false;

  return Boolean(
    db.prepare(`
      SELECT 1
      FROM contacts
      WHERE user_email = ? AND contact_email = ?
    `).get(firstEmail, secondEmail)
  );
}

function listIncomingRequests(userEmail) {
  return db.prepare(`
    SELECT u.email, u.username, u.avatar, u.profile_link, u.creation_date, r.created_at
    FROM contact_requests r
    JOIN users u ON u.email = r.sender_email
    WHERE r.recipient_email = ?
    ORDER BY r.created_at DESC
  `).all(userEmail).map((row) => ({
    ...mapContactUserRow(row),
    createdAt: row.created_at
  }));
}

function listOutgoingRequests(userEmail) {
  return db.prepare(`
    SELECT u.email, u.username, u.avatar, u.profile_link, u.creation_date, r.created_at
    FROM contact_requests r
    JOIN users u ON u.email = r.recipient_email
    WHERE r.sender_email = ?
    ORDER BY r.created_at DESC
  `).all(userEmail).map((row) => ({
    ...mapContactUserRow(row),
    createdAt: row.created_at
  }));
}

function hasPendingRequest(senderEmail, recipientEmail) {
  return Boolean(
    db.prepare(`
      SELECT 1
      FROM contact_requests
      WHERE sender_email = ? AND recipient_email = ?
    `).get(senderEmail, recipientEmail)
  );
}

function createContactRequest(senderEmail, recipientEmail) {
  if (!senderEmail || !recipientEmail) {
    return { ok: false, reason: "invalid" };
  }

  if (senderEmail === recipientEmail) {
    return { ok: false, reason: "self" };
  }

  if (!getUserByEmail(senderEmail) || !getUserByEmail(recipientEmail)) {
    return { ok: false, reason: "not_found" };
  }

  if (areContacts(senderEmail, recipientEmail)) {
    return { ok: true, alreadyContacts: true };
  }

  if (hasPendingRequest(senderEmail, recipientEmail)) {
    return { ok: true, alreadySent: true };
  }

  if (hasPendingRequest(recipientEmail, senderEmail)) {
    acceptContactRequest(recipientEmail, senderEmail);
    return { ok: true, autoAccepted: true };
  }

  db.prepare(`
    INSERT INTO contact_requests (sender_email, recipient_email, created_at)
    VALUES (?, ?, ?)
  `).run(senderEmail, recipientEmail, Date.now());

  return { ok: true, autoAccepted: false };
}

function acceptContactRequest(senderEmail, recipientEmail) {
  if (areContacts(senderEmail, recipientEmail)) {
    return { ok: true, alreadyContacts: true };
  }

  if (!hasPendingRequest(senderEmail, recipientEmail)) {
    return { ok: false, reason: "not_found" };
  }

  const now = Date.now();
  const insertContact = db.prepare(`
    INSERT OR IGNORE INTO contacts (user_email, contact_email, created_at)
    VALUES (?, ?, ?)
  `);

  db.exec("BEGIN");
  try {
    db.prepare(`
      DELETE FROM contact_requests
      WHERE (sender_email = ? AND recipient_email = ?)
         OR (sender_email = ? AND recipient_email = ?)
    `).run(senderEmail, recipientEmail, recipientEmail, senderEmail);

    insertContact.run(senderEmail, recipientEmail, now);
    insertContact.run(recipientEmail, senderEmail, now);
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }

  return { ok: true, alreadyContacts: false };
}

module.exports = {
  listContacts,
  listContactEmails,
  listIncomingRequests,
  listOutgoingRequests,
  areContacts,
  createContactRequest,
  acceptContactRequest
};
