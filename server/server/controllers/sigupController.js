const { addUser, toPublicUser: toPublicSignUpUser } = require("../memory/userStore");
const { t } = require("../utils/i18n");


function signUp (req, res) {
  
  const { email ,avatar , password , username } = req.body;
  const ip = req.ip;


  if (!email  || !avatar || !password || !username) {
    return res.status(400).json({ error: t(req, "requiredFields") });
  }

  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailPattern.test(email)) {
    return res.status(400).json({ error: t(req, "invalidEmail") });
  }

  const usernamePattern = /^[a-zA-Z0-9_]{3,15}$/;
  if (!usernamePattern.test(username)) {
    return res.status(400).json({ 
      error: t(req, "invalidUsername")
    });
  }

  const passwordPattern = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[a-zA-Z\d]{8,}$/;
  if (!passwordPattern.test(password)) {
    return res.status(400).json({ 
      error: t(req, "invalidPassword")
    });
  }

  const response = addUser(email, ip , avatar  ,password , username);
  return res.json(toPublicSignUpUser(response));
}

module.exports = {signUp};
