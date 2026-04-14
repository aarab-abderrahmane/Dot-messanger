const {
  updateUserProfile,
  toPublicUser: toPublicProfileUser,
  verifyPassword: verifyProfilePassword,
  isProfileLinkTaken,
  normalizeProfileLink
} = require("../memory/userStore");
const { t } = require("../utils/i18n");

const usernamePattern = /^[a-zA-Z0-9_]{3,15}$/;
const passwordPattern = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[a-zA-Z\d]{8,}$/;

function updateProfile(req, res) {
  const { username, avatar, currentPassword, newPassword, profileLink, privacy } = req.body;
  const user = req.user;
  const allowedDm = new Set(["everyone", "contacts", "nobody"]);
  const allowedReq = new Set(["everyone", "contacts", "nobody"]);
  const allowedLastSeen = new Set(["everyone", "contacts", "nobody"]);
  const allowedPhoto = new Set(["everyone", "contacts", "nobody"]);

  if (username && !usernamePattern.test(username)) {
    return res.status(400).json({
      error: t(req, "invalidUsername")
    });
  }

  if (newPassword) {
    if (!currentPassword || !verifyProfilePassword(currentPassword, user.password)) {
      return res.status(400).json({ error: t(req, "wrongCurrentPassword") });
    }

    if (!passwordPattern.test(newPassword)) {
      return res.status(400).json({
        error: t(req, "invalidPassword")
      });
    }
  }

  if (profileLink !== undefined) {
    const normalized = normalizeProfileLink(profileLink);
    if (!normalized || normalized.length < 4) {
      return res.status(400).json({ error: t(req, "invalidProfileLink") });
    }
    if (isProfileLinkTaken(normalized, user.email)) {
      return res.status(400).json({ error: t(req, "profileLinkTaken") });
    }
  }

  if (privacy) {
    if (privacy.dm !== undefined && !allowedDm.has(String(privacy.dm))) {
      return res.status(400).json({ error: "Invalid dm privacy value" });
    }
    if (privacy.requests !== undefined && !allowedReq.has(String(privacy.requests))) {
      return res.status(400).json({ error: "Invalid request privacy value" });
    }
    if (privacy.lastSeen !== undefined && !allowedLastSeen.has(String(privacy.lastSeen))) {
      return res.status(400).json({ error: "Invalid last seen privacy value" });
    }
    if (privacy.profilePhoto !== undefined && !allowedPhoto.has(String(privacy.profilePhoto))) {
      return res.status(400).json({ error: "Invalid profile photo privacy value" });
    }
  }

  const updatedUser = updateUserProfile(user.token, {
    username,
    avatar,
    password: newPassword,
    profileLink,
    dmPrivacy: privacy?.dm,
    requestPrivacy: privacy?.requests,
    lastSeenPrivacy: privacy?.lastSeen,
    profilePhotoPrivacy: privacy?.profilePhoto
  });

  return res.json(toPublicProfileUser(updatedUser));
}

module.exports = { updateProfile };
