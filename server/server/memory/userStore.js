const { scryptSync, randomBytes, timingSafeEqual } = require("crypto");
const { db } = require("../db/database");
const { issueAuthToken, verifyAuthToken } = require("../utils/jwt");

const { v4: uuidv4 } = require('uuid');

function hashPassword(password) {
    const salt = randomBytes(16).toString("hex");
    const hash = scryptSync(password, salt, 64).toString("hex");
    return `${salt}:${hash}`;
}

function verifyPassword(password, hashedPassword) {
    if (typeof hashedPassword !== "string" || !hashedPassword.includes(":")) {
        return false;
    }

    const [salt, storedHash] = hashedPassword.split(":");
    const derivedHash = scryptSync(password, salt, 64).toString("hex");

    return timingSafeEqual(
        Buffer.from(storedHash, "hex"),
        Buffer.from(derivedHash, "hex")
    );
}

function toPublicUser(user) {
    return {
        email: user.email,
        token: issueAuthToken({
            email: user.email,
            sessionId: user.token
        }),
        avatar: user.avatar,
        username: user.username,
        profileLink: user.profileLink,
        creationDate: user.creationDate,
        privacy: {
            dm: user.dmPrivacy || "contacts",
            requests: user.requestPrivacy || "everyone",
            lastSeen: user.lastSeenPrivacy || "contacts",
            profilePhoto: user.profilePhotoPrivacy || "everyone"
        }
    };
}

function mapUserRow(row) {
    if (!row) return null;

    return {
        email: row.email,
        ip: row.ip,
        token: row.token,
        profileLink: row.profile_link,
        avatar: row.avatar,
        dmPrivacy: row.dm_privacy || "contacts",
        requestPrivacy: row.request_privacy || "everyone",
        lastSeenPrivacy: row.last_seen_privacy || "contacts",
        profilePhotoPrivacy: row.profile_photo_privacy || "everyone",
        password: row.password,
        username: row.username,
        creationDate: row.creation_date
    };
}

function normalizeProfileLink(value) {
    return String(value || "")
        .trim()
        .toLowerCase()
        .replace(/^@+/, "")
        .replace(/[^a-z0-9_]/g, "")
        .slice(0, 32);
}

function createUniqueProfileLink(seed) {
    const base = normalizeProfileLink(seed) || `user${Math.floor(Math.random() * 1e6)}`;
    let candidate = base;
    let index = 1;
    while (isProfileLinkTaken(candidate)) {
        candidate = `${base}${index}`;
        index += 1;
    }
    return candidate;
}

function getUserBySessionId(sessionId) {
    return mapUserRow(
        db.prepare(`SELECT * FROM users WHERE token = ?`).get(sessionId)
    );
}

function createUniqueSessionId() {
    let sessionId;
    do {
        sessionId = uuidv4();
    } while (getUserBySessionId(sessionId));

    return sessionId;
}

function addUser(email, ip, avatar, password, username) {
    const profileLink = createUniqueProfileLink(username);
    const newUser = {
        email,
        ip,
        token: createUniqueSessionId(),
        profileLink,
        avatar,
        password: hashPassword(password),
        username,
        creationDate: Date.now()
    };

    db.prepare(`
        INSERT INTO users (email, ip, token, profile_link, avatar, password, username, creation_date)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
        newUser.email,
        newUser.ip,
        newUser.token,
        newUser.profileLink,
        newUser.avatar,
        newUser.password,
        newUser.username,
        newUser.creationDate
    );

    return newUser;
}

function removeUser(token) {
    const user = getUserBySessionId(token);
    if (!user) return;

    db.prepare(`DELETE FROM users WHERE token = ?`).run(token);
}


function getUserByToken(token) {
    const payload = verifyAuthToken(token);
    if (!payload) return null;

    const user = getUserByEmail(payload.sub);
    if (!user) return null;
    if (user.token !== payload.sid) return null;

    return user;
}

function getRegistredUsers() {
    return db.prepare(`
        SELECT email, ip, token, profile_link, avatar, password, username, creation_date
        FROM users
        ORDER BY username COLLATE NOCASE ASC
    `).all().map(mapUserRow);
}


function getUserByEmail(email){
    return mapUserRow(
        db.prepare(`SELECT * FROM users WHERE email = ?`).get(email)
    );
}

function isEmailTaken(email) {
    return Boolean(
        db.prepare(`SELECT 1 FROM users WHERE email = ?`).get(email)
    );
}

function isIpTaken(ip) {
    return Boolean(
        db.prepare(`SELECT 1 FROM users WHERE ip = ?`).get(ip)
    );
}

function isProfileLinkTaken(profileLink, excludeEmail = null) {
    const normalized = normalizeProfileLink(profileLink);
    if (!normalized) return false;

    const row = db.prepare(`SELECT email FROM users WHERE profile_link = ?`).get(normalized);
    if (!row) return false;
    if (excludeEmail && row.email === excludeEmail) return false;
    return true;
}

function getUserByProfileLink(profileLink) {
    const normalized = normalizeProfileLink(profileLink);
    if (!normalized) return null;
    return mapUserRow(
        db.prepare(`SELECT * FROM users WHERE profile_link = ?`).get(normalized)
    );
}

function getUserByUsername(username) {
    const normalized = String(username || "").trim().toLowerCase();
    if (!normalized) return null;
    return mapUserRow(
        db.prepare(`SELECT * FROM users WHERE lower(username) = ?`).get(normalized)
    );
}

function rotateUserToken(user) {
    const token = createUniqueSessionId();

    db.prepare(`
        UPDATE users
        SET token = ?
        WHERE email = ?
    `).run(token, user.email);

    return getUserByEmail(user.email);
}

function updateUserProfile(token, updates) {
    const user = getUserBySessionId(token);
    if (!user) return null;

    const nextUsername = updates.username ?? user.username;
    const nextProfileLink = updates.profileLink !== undefined
        ? normalizeProfileLink(updates.profileLink)
        : user.profileLink;
    const nextAvatar = updates.avatar ?? user.avatar;
    const nextPassword = updates.password ? hashPassword(updates.password) : user.password;
    const nextDmPrivacy = updates.dmPrivacy ?? user.dmPrivacy;
    const nextRequestPrivacy = updates.requestPrivacy ?? user.requestPrivacy;
    const nextLastSeenPrivacy = updates.lastSeenPrivacy ?? user.lastSeenPrivacy;
    const nextProfilePhotoPrivacy = updates.profilePhotoPrivacy ?? user.profilePhotoPrivacy;

    db.prepare(`
        UPDATE users
        SET username = ?, profile_link = ?, avatar = ?, password = ?, dm_privacy = ?, request_privacy = ?, last_seen_privacy = ?, profile_photo_privacy = ?
        WHERE token = ?
    `).run(nextUsername, nextProfileLink || null, nextAvatar, nextPassword, nextDmPrivacy, nextRequestPrivacy, nextLastSeenPrivacy, nextProfilePhotoPrivacy, token);

    return getUserBySessionId(token);
}





module.exports = {
    getRegistredUsers,
    getUserByToken,
    removeUser,
    getUserByEmail,
    addUser,
    verifyPassword,
    toPublicUser,
    isEmailTaken,
    isIpTaken,
    isProfileLinkTaken,
    normalizeProfileLink,
    getUserByProfileLink,
    getUserByUsername,
    rotateUserToken,
    updateUserProfile
};
