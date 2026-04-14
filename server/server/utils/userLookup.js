const {
  getUserByEmail,
  getRegistredUsers,
  getUserByProfileLink,
  getUserByUsername,
  normalizeProfileLink
} = require("../memory/userStore");

function findUserByIdentifier(rawValue) {
  const value = String(rawValue || "").trim();
  if (!value) return null;

  let targetUser = getUserByEmail(value);
  if (!targetUser) {
    const normalizedLink = normalizeProfileLink(value);
    if (normalizedLink) {
      targetUser = getUserByProfileLink(normalizedLink);
    }
  }
  if (!targetUser) {
    targetUser = getUserByUsername(value);
  }
  if (!targetUser) {
    const allUsers = getRegistredUsers();
    targetUser = allUsers.find(
      (candidate) =>
        String(candidate.email).toLowerCase() === value.toLowerCase() ||
        String(candidate.profileLink || "").toLowerCase() === normalizeProfileLink(value)
    ) || null;
  }

  return targetUser;
}

module.exports = { findUserByIdentifier };
