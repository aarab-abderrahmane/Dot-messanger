// config/socket.js
const WebSocket = require("ws");
require("dotenv").config();
const { canYuborish } = require("../middleware/rateLimiter");

const  MAX_TOKENS  = process.env.MAX_TOKENS

const {
  addClient,
  removeClient
} = require("../services/broadcastService");

const { handleAuth } = require("../handlers/authHandler");
const { handleChatMessage } = require("../handlers/messageHandler");
const { handleReaction } = require("../handlers/reactionHandler");
const { handleTypingIndicator } = require("../handlers/typingHandler");
const { handleMessageDelete } = require("../handlers/deleteHandler");
const { handleMessageEdit } = require("../handlers/editHandler");
const { handleReadReceipt } = require("../handlers/readReceiptHandler");
const { handlePollVote, handlePollClose } = require("../handlers/pollHandler");
const { broadcastUserStates } = require("../services/broadcastService");

function safeSend(ws, payload) {
  if (!ws || ws.readyState !== WebSocket.OPEN) {
    return false;
  }

  try {
    ws.send(JSON.stringify(payload));
    return true;
  } catch (error) {
    console.error("Failed to send WS payload:", error);
    return false;
  }
}

function setupSocket(server) {
  const wss = new WebSocket.Server({
    server,
    // Default ws limit is 100MB. Increase for large LAN file transfers.
    maxPayload: 220 * 1024 * 1024
  });

  wss.on("error", (err) => {
    // server.js handles EADDRINUSE and retries with next port.
    if (err.code !== "EADDRINUSE") {
      console.error("WebSocket server error:", err);
    }
  });

  wss.on("connection", (ws, req) => {
    addClient(ws);

    ws.tokens = MAX_TOKENS;
    ws.lastRefill = Date.now();
    ws.isAuthenticated = false;
    ws.userToken = null;
    ws.userEmail = null;

    console.log("Yangi WS ulanish manzili:", req.socket.remoteAddress);

    ws.on("message", raw => {
      try {
        let data;
        try {
          data = JSON.parse(raw);
        } catch (parseErr) {
          console.error("JSON parse error:", parseErr);
          return safeSend(ws, {
            type: "error",
            message: "Invalid JSON format"
          });
        }

        if (data.type !== "AUTH") {
          if (!canYuborish(ws)) {
            // const now = Date.now();
            // const secondsLeft = Math.ceil((ws.lockUntil - now) / 1000);

            return safeSend(ws, {
              type: "error",
              message: `Limit reached! Please wait ${ws.retryAfter} seconds.`
            });
          }
        }

        if (data.type === "AUTH") {
          handleAuth(ws, data);
          return;
        }

        if (!ws.isAuthenticated) {
          safeSend(ws, { type: "AUTH_REQUIRED" });
          return;
        }

        if (data.type === "reaction") {
          handleReaction(ws, data);
          return;
        }

        if (data.type === "typing") {
          handleTypingIndicator(ws, data);
          return;
        }

        if (data.type === "delete_message") {
          handleMessageDelete(ws, data);
          return;
        }

        if (data.type === "edit_message") {
          handleMessageEdit(ws, data);
          return;
        }

        if (data.type === "read_receipt") {
          handleReadReceipt(ws, data);
          return;
        }

        if (data.type === "poll_vote") {
          handlePollVote(ws, data);
          return;
        }

        if (data.type === "poll_close") {
          handlePollClose(ws, data);
          return;
        }

        handleChatMessage(ws, data);
      } catch (err) {
        console.error("WS xatosi:", err);
        safeSend(ws, {
          type: "error",
          message: "Internal server error"
        });
      }
    });

    ws.on("error", (err) => {
      console.error("WebSocket error:", err);
    });

    ws.on("close", () => {
      removeClient(ws);
      broadcastUserStates();
      console.log("Mijoz uzildi");
    });
  });
}


module.exports = {setupSocket}
