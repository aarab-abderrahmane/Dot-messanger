const express = require("express");
const { postAdminLogin, getAdminUsers, getAdminMessages } = require("../controllers/adminController");
const { requireAdminKey, requireAdminToken } = require("../middleware/adminAuthMiddleware");

const router = express.Router();

router.post("/login", requireAdminKey, postAdminLogin);
router.get("/users", requireAdminToken, getAdminUsers);
router.get("/messages", requireAdminToken, getAdminMessages);

module.exports = router;
