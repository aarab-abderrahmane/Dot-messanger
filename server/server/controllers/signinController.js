const {
  getUserByEmail,
  verifyPassword: verifySignInPassword,
  toPublicUser: toPublicSignInUser,
  rotateUserToken
} = require("../memory/userStore");
const { t } = require("../utils/i18n");


function signIn(req, res) {

    const { email, password } = req.body;

    const user = getUserByEmail(email);

    if (!user) {
        return res.status(400).json({ error: t(req, "invalidCredentials") });
    }

    if (!verifySignInPassword(password, user.password)) {
        return res.status(400).json({
            error: t(req, "invalidCredentials")
        });
    }

    const updatedUser = rotateUserToken(user);
    return res.json(toPublicSignInUser(updatedUser));
}

module.exports = {signIn};
