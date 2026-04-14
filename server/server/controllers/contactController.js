const {
  listContacts,
  listIncomingRequests,
  listOutgoingRequests,
  createContactRequest,
  acceptContactRequest
} = require("../memory/contactStore");
const { pushUserState } = require("../services/broadcastService");
const { findUserByIdentifier } = require("../utils/userLookup");

function getContacts(req, res) {
  return res.json({
    contacts: listContacts(req.user.email),
    incomingRequests: listIncomingRequests(req.user.email),
    outgoingRequests: listOutgoingRequests(req.user.email)
  });
}

function sendRequest(req, res) {
  const target = findUserByIdentifier(req.body?.query);
  if (!target) {
    return res.status(404).json({ error: "User not found" });
  }

  const result = createContactRequest(req.user.email, target.email);
  const requestPrivacy = target.requestPrivacy || "everyone";
  if (requestPrivacy === "nobody") {
    return res.status(403).json({ error: "This user does not accept contact requests" });
  }
  if (requestPrivacy === "contacts") {
    return res.status(403).json({ error: "This user only accepts requests from contacts" });
  }
  if (!result.ok) {
    const status = result.reason === "not_found" ? 404 : 400;
    const errorMap = {
      invalid: "Invalid contact request",
      self: "You cannot add yourself",
      not_found: "User not found"
    };
    return res.status(status).json({ error: errorMap[result.reason] || "Could not send request" });
  }

  pushUserState(req.user.email);
  pushUserState(target.email);

  return res.json({
    ok: true,
    autoAccepted: Boolean(result.autoAccepted),
    alreadySent: Boolean(result.alreadySent),
    alreadyContacts: Boolean(result.alreadyContacts)
  });
}

function acceptRequest(req, res) {
  console.log(`\n========== [ACCEPT REQUEST] START ==========`);
  console.log(`Body:`, req.body);
  console.log(`User:`, req.user?.email || 'NOT SET');
  
  const query = req.body?.query;
  console.log(`Query from body:`, query);
  
  // Простой поиск - сначала как email, потом как identifier
  let senderEmail = query;
  if (query && !query.includes('@')) {
    // Это не email, ищем по username/profileLink
    const sender = findUserByIdentifier(query);
    if (!sender) {
      console.log(`❌ Sender not found by identifier`);
      return res.status(404).json({ error: "User not found" });
    }
    senderEmail = sender.email;
  }
  
  console.log(`Sender email: ${senderEmail}, Recipient email: ${req.user.email}`);
  const accepted = acceptContactRequest(senderEmail, req.user.email);
  console.log(`Result:`, accepted);
  
  if (!accepted.ok) {
    console.log(`❌ Accept failed:`, accepted.reason);
    return res.status(400).json({ error: "Request not found or already contacts" });
  }

  console.log(`✅ Accept successful`);
  pushUserState(req.user.email);
  pushUserState(senderEmail);

  console.log(`========== [ACCEPT REQUEST] END ==========\n`);
  return res.json({
    ok: true,
    alreadyContacts: Boolean(accepted.alreadyContacts)
  });
}

module.exports = {
  getContacts,
  sendRequest,
  acceptRequest
};
