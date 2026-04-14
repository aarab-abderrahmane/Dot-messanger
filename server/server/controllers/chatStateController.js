const { listGroupsForUser, listGroupMembers, createGroup, createChannel, getGroupById, getGroupMemberRole, setGroupMemberRole, addMemberToGroup, removeMemberFromGroup } = require("../memory/groupStore");
const { listArchivedChats, archiveChat, unarchiveChat } = require("../memory/archiveStore");
const { pushUserState } = require("../services/broadcastService");
const { findUserByIdentifier } = require("../utils/userLookup");

function getChatState(req, res) {
  const groups = listGroupsForUser(req.user.email).map((group) => ({
    ...group,
    members: listGroupMembers(group.id)
  }));

  return res.json({
    groups,
    archivedChats: listArchivedChats(req.user.email)
  });
}

function postCreateGroup(req, res) {
  const title = req.body?.title;
  const memberEmails = Array.isArray(req.body?.memberEmails) ? req.body.memberEmails : [];
  const result = createGroup(req.user.email, title, memberEmails);

  if (!result.ok) {
    const messages = {
      invalid_title: "Invalid group title",
      not_enough_members: "Select at least one contact",
      member_not_found: "Group member not found",
      member_not_contact: "You can only add contacts to a group"
    };
    return res.status(400).json({ error: messages[result.reason] || "Could not create group" });
  }

  const groups = listGroupsForUser(req.user.email);
  groups.forEach((group) => {
    const members = listGroupMembers(group.id);
    members.forEach((member) => pushUserState(member.email));
  });

  return res.json({
    group: {
      ...result.group,
      members: listGroupMembers(result.group.id)
    }
  });
}

function postCreateChannel(req, res) {
  const title = req.body?.title;
  const memberEmails = Array.isArray(req.body?.memberEmails) ? req.body.memberEmails : [];
  const enableComments = Boolean(req.body?.enableComments);
  const result = createChannel(req.user.email, title, memberEmails, enableComments);
  if (!result.ok) {
    const messages = {
      invalid_title: "Invalid channel title",
      not_enough_members: "Add at least one member",
      member_not_found: "Member not found"
    };
    return res.status(400).json({ error: messages[result.reason] || "Could not create channel" });
  }
  const targetGroups = [result.group, result.linkedGroup].filter(Boolean);
  targetGroups.forEach((group) => {
    listGroupMembers(group.id).forEach((member) => pushUserState(member.email));
  });
  return res.json({
    group: {
      ...result.group,
      members: listGroupMembers(result.group.id)
    },
    linkedGroup: result.linkedGroup ? {
      ...result.linkedGroup,
      members: listGroupMembers(result.linkedGroup.id)
    } : null
  });
}

function postArchiveChat(req, res) {
  const chatType = req.body?.chatType;
  const chatId = String(req.body?.chatId || "").trim();
  if (!["direct", "group"].includes(chatType) || !chatId) {
    return res.status(400).json({ error: "Invalid chat target" });
  }

  if (req.body?.archived) {
    archiveChat(req.user.email, chatType, chatId);
  } else {
    unarchiveChat(req.user.email, chatType, chatId);
  }

  return res.json({
    archivedChats: listArchivedChats(req.user.email)
  });
}

function patchGroupMemberRole(req, res) {
  const groupId = String(req.params.groupId || "").trim();
  const targetEmail = String(req.body?.targetEmail || "").trim().toLowerCase();
  const role = String(req.body?.role || "").trim().toLowerCase();

  if (!groupId || !targetEmail || !role) {
    return res.status(400).json({ error: "Invalid request" });
  }

  const group = getGroupById(groupId);
  if (!group) {
    return res.status(404).json({ error: "Group not found" });
  }
  if (group.ownerEmail !== req.user.email) {
    return res.status(403).json({ error: "Only group owner can change roles" });
  }

  const result = setGroupMemberRole(groupId, targetEmail, role);
  if (!result.ok) {
    const messages = {
      invalid_role: "Invalid role",
      cannot_change_owner: "Owner role cannot be changed",
      member_not_found: "Member not found",
      group_not_found: "Group not found"
    };
    return res.status(400).json({ error: messages[result.reason] || "Could not change role" });
  }

  return res.json({
    ok: true,
    group: {
      ...group,
      members: listGroupMembers(groupId)
    },
    changedBy: req.user.email,
    changedByRole: getGroupMemberRole(groupId, req.user.email)
  });
}

function postGroupMember(req, res) {
  const groupId = String(req.params.groupId || "").trim();
  const query = String(req.body?.query || "").trim();
  const target = findUserByIdentifier(query);
  if (!target) return res.status(404).json({ error: "User not found" });
  const result = addMemberToGroup(groupId, req.user.email, target.email);
  if (!result.ok) {
    const errorMap = {
      group_not_found: "Group not found",
      forbidden: "Not allowed",
      member_not_found: "User not found",
      member_not_contact: "You can only add contacts to groups"
    };
    return res.status(400).json({ error: errorMap[result.reason] || "Could not add member" });
  }
  listGroupMembers(groupId).forEach((member) => pushUserState(member.email));
  return res.json({
    ok: true,
    alreadyMember: Boolean(result.alreadyMember),
    group: {
      ...getGroupById(groupId),
      members: listGroupMembers(groupId)
    }
  });
}

function deleteGroupMember(req, res) {
  const groupId = String(req.params.groupId || "").trim();
  const targetEmail = String(req.params.targetEmail || "").trim().toLowerCase();
  const result = removeMemberFromGroup(groupId, req.user.email, targetEmail);
  if (!result.ok) {
    const errorMap = {
      group_not_found: "Group not found",
      forbidden: "Not allowed",
      member_not_found: "Member not found",
      cannot_remove_owner: "Owner cannot be removed"
    };
    return res.status(400).json({ error: errorMap[result.reason] || "Could not remove member" });
  }
  listGroupMembers(groupId).forEach((member) => pushUserState(member.email));
  pushUserState(targetEmail);
  return res.json({
    ok: true,
    group: {
      ...getGroupById(groupId),
      members: listGroupMembers(groupId)
    }
  });
}

module.exports = {
  getChatState,
  postCreateGroup,
  postCreateChannel,
  postArchiveChat,
  patchGroupMemberRole,
  postGroupMember,
  deleteGroupMember
};
