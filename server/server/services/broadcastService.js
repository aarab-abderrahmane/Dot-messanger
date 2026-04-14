// services/broadcastService.js
const WebSocket = require("ws");
const { listContacts, listIncomingRequests, listOutgoingRequests } = require("../memory/contactStore");
const { getChatHistoryForUser } = require("../memory/chatStore");

const clients = new Set();

function safeSend(client, message) {
  if (!client || client.readyState !== WebSocket.OPEN) {
    return false;
  }

  try {
    client.send(JSON.stringify(message));
    return true;
  } catch (error) {
    console.error("Broadcast send error:", error);
    return false;
  }
}

function addClient(ws) {
  clients.add(ws);
}

function removeClient(ws) {
  clients.delete(ws);
}

function getClients() {
  return clients;
}

function broadcast(message) {
  clients.forEach(client => {
    safeSend(client, message);
  });
}

function broadcastToUsers(userEmails, message) {
  const targets = new Set(
    (Array.isArray(userEmails) ? userEmails : [])
      .filter((email) => typeof email === "string" && email.length > 0)
  );

  clients.forEach((client) => {
    if (client.readyState !== WebSocket.OPEN) return;
    if (!client.userEmail || !targets.has(client.userEmail)) return;
    safeSend(client, message);
  });
}

function sendToUser(userEmail, message) {
  clients.forEach((client) => {
    if (client.readyState !== WebSocket.OPEN) return;
    if (client.userEmail !== userEmail) return;
    safeSend(client, message);
  });
}

function pushUserState(userEmail) {
  if (!userEmail) return;

  const contacts = listContacts(userEmail);
  const connectedEmails = new Set();

  clients.forEach((client) => {
    if (client.userEmail && client.readyState === WebSocket.OPEN) {
      connectedEmails.add(client.userEmail);
    }
  });

  const online = [];
  const offline = [];

  contacts.forEach((contact) => {
    const target = connectedEmails.has(contact.email) ? online : offline;
    target.push(contact);
  });

  sendToUser(userEmail, {
    type: "USER_STATUS_UPDATE",
    online,
    offline
  });

  sendToUser(userEmail, {
    type: "CONTACT_REQUESTS_UPDATE",
    incoming: listIncomingRequests(userEmail),
    outgoing: listOutgoingRequests(userEmail)
  });

  sendToUser(userEmail, {
    type: "HISTORY",
    messages: getChatHistoryForUser(userEmail)
  });
}

function broadcastUserStates(){
    const uniqueEmails = new Set();

    clients.forEach((client) => {
      if (client.userEmail && client.readyState === WebSocket.OPEN) {
        uniqueEmails.add(client.userEmail);
      }
    });

    uniqueEmails.forEach((email) => {
      pushUserState(email);
    });
}


module.exports = {
  addClient,
  removeClient,
  getClients,
  broadcast,
  broadcastToUsers,
  broadcastUserStates,
  pushUserState
};
