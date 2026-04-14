const { randomUUID } = require("crypto");
const { db } = require("../db/database");
const { areContacts } = require("./contactStore");
const { getUserByEmail } = require("./userStore");

function mapGroupRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    title: row.title,
    avatar: row.avatar || "",
    ownerEmail: row.owner_email,
    kind: row.kind || "group",
    linkedGroupId: row.linked_group_id || undefined,
    createdAt: row.created_at
  };
}

function mapMemberRow(row) {
  if (!row) return null;
  return {
    email: row.email,
    username: row.username,
    avatar: row.avatar,
    role: row.role || "member",
    profileLink: row.profile_link || undefined,
    creationDate: row.creation_date
  };
}

function listGroupsForUser(userEmail) {
  return db.prepare(`
    SELECT g.*
    FROM chat_groups g
    JOIN group_members gm ON gm.group_id = g.id
    WHERE gm.user_email = ?
    ORDER BY g.created_at DESC
  `).all(userEmail).map(mapGroupRow);
}

function listGroupMemberEmails(groupId) {
  return db.prepare(`
    SELECT user_email
    FROM group_members
    WHERE group_id = ?
  `).all(groupId).map((row) => row.user_email);
}

function listGroupMembers(groupId) {
  return db.prepare(`
    SELECT u.email, u.username, u.avatar, u.profile_link, u.creation_date, gm.role
    FROM group_members gm
    JOIN users u ON u.email = gm.user_email
    WHERE gm.group_id = ?
    ORDER BY u.username COLLATE NOCASE ASC
  `).all(groupId).map(mapMemberRow);
}

function getGroupById(groupId) {
  return mapGroupRow(
    db.prepare(`SELECT * FROM chat_groups WHERE id = ?`).get(groupId)
  );
}

function isGroupMember(groupId, userEmail) {
  return Boolean(
    db.prepare(`
      SELECT 1
      FROM group_members
      WHERE group_id = ? AND user_email = ?
    `).get(groupId, userEmail)
  );
}

function createGroup(ownerEmail, title, memberEmails) {
  const cleanTitle = String(title || "").trim().slice(0, 80);
  if (!cleanTitle) {
    return { ok: false, reason: "invalid_title" };
  }

  const uniqueMembers = Array.from(new Set([ownerEmail, ...memberEmails].filter(Boolean)));
  if (uniqueMembers.length < 2) {
    return { ok: false, reason: "not_enough_members" };
  }

  for (const memberEmail of uniqueMembers) {
    const user = getUserByEmail(memberEmail);
    if (!user) {
      return { ok: false, reason: "member_not_found" };
    }
    if (memberEmail !== ownerEmail && !areContacts(ownerEmail, memberEmail)) {
      return { ok: false, reason: "member_not_contact" };
    }
  }

  const groupId = randomUUID();
  const now = Date.now();
  const insertMember = db.prepare(`
    INSERT INTO group_members (group_id, user_email, joined_at, role)
    VALUES (?, ?, ?, ?)
  `);

  db.exec("BEGIN");
  try {
    db.prepare(`
      INSERT INTO chat_groups (id, title, avatar, owner_email, kind, linked_group_id, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(groupId, cleanTitle, "", ownerEmail, "group", null, now);

    uniqueMembers.forEach((memberEmail) => {
      const role = memberEmail === ownerEmail ? "owner" : "member";
      insertMember.run(groupId, memberEmail, now, role);
    });
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }

  return {
    ok: true,
    group: getGroupById(groupId)
  };
}

function createChannel(ownerEmail, title, memberEmails, enableComments = false) {
  const cleanTitle = String(title || "").trim().slice(0, 80);
  if (!cleanTitle) return { ok: false, reason: "invalid_title" };
  const uniqueMembers = Array.from(new Set([ownerEmail, ...memberEmails].filter(Boolean)));
  if (uniqueMembers.length < 1) return { ok: false, reason: "not_enough_members" };
  for (const memberEmail of uniqueMembers) {
    const user = getUserByEmail(memberEmail);
    if (!user) return { ok: false, reason: "member_not_found" };
  }

  const channelId = randomUUID();
  const now = Date.now();
  const insertMember = db.prepare(`
    INSERT INTO group_members (group_id, user_email, joined_at, role)
    VALUES (?, ?, ?, ?)
  `);

  let linkedGroupId = null;
  db.exec("BEGIN");
  try {
    if (enableComments) {
      linkedGroupId = randomUUID();
      db.prepare(`
        INSERT INTO chat_groups (id, title, avatar, owner_email, kind, linked_group_id, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(linkedGroupId, `${cleanTitle} Discussion`, "", ownerEmail, "group", null, now);
      uniqueMembers.forEach((memberEmail) => {
        const role = memberEmail === ownerEmail ? "owner" : "member";
        insertMember.run(linkedGroupId, memberEmail, now, role);
      });
    }

    db.prepare(`
      INSERT INTO chat_groups (id, title, avatar, owner_email, kind, linked_group_id, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(channelId, cleanTitle, "", ownerEmail, "channel", linkedGroupId, now);

    uniqueMembers.forEach((memberEmail) => {
      const role = memberEmail === ownerEmail ? "owner" : "member";
      insertMember.run(channelId, memberEmail, now, role);
    });
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }

  return {
    ok: true,
    group: getGroupById(channelId),
    linkedGroup: linkedGroupId ? getGroupById(linkedGroupId) : null
  };
}

function getGroupMemberRole(groupId, userEmail) {
  const row = db.prepare(`
    SELECT role
    FROM group_members
    WHERE group_id = ? AND user_email = ?
  `).get(groupId, userEmail);
  return row?.role || null;
}

function setGroupMemberRole(groupId, targetEmail, role) {
  const allowed = new Set(["member", "admin"]);
  if (!allowed.has(role)) {
    return { ok: false, reason: "invalid_role" };
  }

  const group = getGroupById(groupId);
  if (!group) {
    return { ok: false, reason: "group_not_found" };
  }
  if (targetEmail === group.ownerEmail) {
    return { ok: false, reason: "cannot_change_owner" };
  }
  if (!isGroupMember(groupId, targetEmail)) {
    return { ok: false, reason: "member_not_found" };
  }

  db.prepare(`
    UPDATE group_members
    SET role = ?
    WHERE group_id = ? AND user_email = ?
  `).run(role, groupId, targetEmail);

  return { ok: true };
}

function addMemberToGroup(groupId, requesterEmail, targetEmail) {
  const group = getGroupById(groupId);
  if (!group) return { ok: false, reason: "group_not_found" };
  if (!isGroupMember(groupId, requesterEmail)) return { ok: false, reason: "forbidden" };
  const requesterRole = getGroupMemberRole(groupId, requesterEmail);
  const canManage = requesterRole === "owner" || requesterRole === "admin";
  if (!canManage) return { ok: false, reason: "forbidden" };
  if (isGroupMember(groupId, targetEmail)) return { ok: true, alreadyMember: true };
  const target = getUserByEmail(targetEmail);
  if (!target) return { ok: false, reason: "member_not_found" };
  if (group.kind !== "channel" && !areContacts(requesterEmail, targetEmail)) {
    return { ok: false, reason: "member_not_contact" };
  }
  db.prepare(`
    INSERT INTO group_members (group_id, user_email, joined_at, role)
    VALUES (?, ?, ?, ?)
  `).run(groupId, targetEmail, Date.now(), "member");
  return { ok: true, alreadyMember: false };
}

function removeMemberFromGroup(groupId, requesterEmail, targetEmail) {
  const group = getGroupById(groupId);
  if (!group) return { ok: false, reason: "group_not_found" };
  if (!isGroupMember(groupId, requesterEmail)) return { ok: false, reason: "forbidden" };
  const requesterRole = getGroupMemberRole(groupId, requesterEmail);
  const targetRole = getGroupMemberRole(groupId, targetEmail);
  if (!targetRole) return { ok: false, reason: "member_not_found" };
  if (targetRole === "owner") return { ok: false, reason: "cannot_remove_owner" };
  const canManage = requesterRole === "owner" || requesterRole === "admin";
  if (!canManage) return { ok: false, reason: "forbidden" };
  if (requesterRole === "admin" && targetRole === "admin") return { ok: false, reason: "forbidden" };
  db.prepare(`
    DELETE FROM group_members
    WHERE group_id = ? AND user_email = ?
  `).run(groupId, targetEmail);
  return { ok: true };
}

module.exports = {
  listGroupsForUser,
  listGroupMemberEmails,
  listGroupMembers,
  getGroupById,
  isGroupMember,
  createGroup,
  createChannel,
  getGroupMemberRole,
  setGroupMemberRole,
  addMemberToGroup,
  removeMemberFromGroup
};
