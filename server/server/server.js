const http = require('http');
const express = require("express");
// const WebSocket = require('ws');
const cors = require("cors");
require("dotenv").config();

const { securityMiddleware } = require('./middleware/securityMiddleware');

const START_PORT = Number(process.env.PORT) || 5000;


const chatRoutes = require('./routes/chatRoutes')
const {setupSocket} = require('./config/socket')

const app = express();
app.use(cors());
app.use(securityMiddleware);
app.use(express.json({ limit: "6mb" }));

const server = http.createServer(app);

app.get("/", (_req, res) => {
  res.redirect(302, "/MV");
});

app.use("/MV", chatRoutes);
setupSocket(server);

app.use((err, _req, res, _next) => {
  console.error("Unhandled HTTP error:", err);
  if (res.headersSent) {
    return;
  }
  res.status(500).json({ error: "Internal server error" });
});

// ======================
// START SERVER
// ======================
function startServer(port) {
  server.listen(port, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${port}`);
  });
}

server.on("error", (error) => {
  if (error.code === "EADDRINUSE") {
    console.error(`Port ${START_PORT} is already in use. Stop the old process or run "npm run dev:clean" in /server.`);
    return;
  }
  console.error("Server startup error:", error);
});

server.on("clientError", (error, socket) => {
  console.error("HTTP client error:", error.message);
  if (socket.writable) {
    socket.end("HTTP/1.1 400 Bad Request\r\n\r\n");
  }
});

process.on("unhandledRejection", (reason) => {
  console.error("Unhandled promise rejection:", reason);
});

process.on("uncaughtException", (error) => {
  console.error("Uncaught exception:", error);
});

startServer(START_PORT);
