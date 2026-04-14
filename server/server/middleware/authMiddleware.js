const {
  isEmailTaken,
  isIpTaken,
  getUserByToken
} = require("../memory/userStore");
const { t } = require("../utils/i18n");

const ENFORCE_ONE_ACCOUNT_PER_IP =
  String(process.env.ENFORCE_ONE_ACCOUNT_PER_IP ?? "false").toLowerCase() === "true";

function authMiddleware(req , res , next){

        const {email }  = req.body ; 
        const userIp = req.ip ;

        if (isEmailTaken(email)) {
            return res.status(400).json({ error: t(req, "emailTaken") });
        }

        if (ENFORCE_ONE_ACCOUNT_PER_IP && isIpTaken(userIp)) {
          return res.status(400).json({ error: t(req, "ipTaken") })
        }


        next()


}

function requireAuthToken(req, res, next) {
        const headerToken = req.headers.authorization?.startsWith("Bearer ")
          ? req.headers.authorization.slice(7)
          : null;
        const token = headerToken || req.headers["x-auth-token"] || req.body?.token;

        if (!token) {
            return res.status(401).json({ error: t(req, "authRequired") });
        }

        const user = getUserByToken(token);
        if (!user) {
            return res.status(401).json({ error: t(req, "invalidToken") });
        }

        req.user = user;
        next();
}

module.exports = authMiddleware;
module.exports.requireAuthToken = requireAuthToken;
