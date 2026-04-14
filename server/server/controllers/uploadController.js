const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const uploadsRoot = path.join(__dirname, "..", "..", "data", "uploads");
fs.mkdirSync(uploadsRoot, { recursive: true });

const uploadSessions = new Map();
const fileIndex = new Map();

function sanitizeFilename(name) {
  return String(name || "file.bin").replace(/[^a-zA-Z0-9.\-_ ]/g, "_").slice(0, 180);
}

function cleanupOldSessions(maxAgeMs = 24 * 60 * 60 * 1000) {
  const now = Date.now();
  for (const [uploadId, session] of uploadSessions) {
    if (now - session.createdAt > maxAgeMs) {
      uploadSessions.delete(uploadId);
      try {
        if (fs.existsSync(session.tmpPath)) {
          fs.unlinkSync(session.tmpPath);
        }
      } catch (err) {
        console.error(`Failed to cleanup temp file ${session.tmpPath}:`, err);
      }
    }
  }
}

setInterval(cleanupOldSessions, 60000);

function startUpload(req, res) {
  const { name, size } = req.body || {};
  const totalSize = Number(size);
  if (!name || !Number.isFinite(totalSize) || totalSize < 0) {
    return res.status(400).json({ error: "Invalid upload metadata" });
  }

  const uploadId = crypto.randomUUID();
  const fileId = crypto.randomUUID();
  const safeName = sanitizeFilename(name);
  const tmpPath = path.join(uploadsRoot, `${uploadId}.part`);

  uploadSessions.set(uploadId, {
    fileId,
    name: safeName,
    size: totalSize,
    uploaded: 0,
    tmpPath,
    createdAt: Date.now()
  });

  return res.json({ uploadId, chunkSize: 2 * 1024 * 1024 });
}

function uploadChunk(req, res) {
  const { uploadId, chunk } = req.body || {};
  const session = uploadSessions.get(uploadId);
  if (!session) {
    return res.status(404).json({ error: "Upload session not found" });
  }
  if (typeof chunk !== "string" || chunk.length === 0) {
    return res.status(400).json({ error: "Chunk is required" });
  }

  const buffer = Buffer.from(chunk, "base64");
  fs.appendFileSync(session.tmpPath, buffer);
  session.uploaded += buffer.length;
  return res.json({ uploaded: session.uploaded });
}

function finishUpload(req, res) {
  const { uploadId } = req.body || {};
  const session = uploadSessions.get(uploadId);
  if (!session) {
    return res.status(404).json({ error: "Upload session not found" });
  }

  const finalName = `${session.fileId}_${session.name}`;
  const finalPath = path.join(uploadsRoot, finalName);
  fs.renameSync(session.tmpPath, finalPath);

  fileIndex.set(session.fileId, {
    name: session.name,
    mime: "application/octet-stream",
    path: finalPath,
    size: session.uploaded
  });
  uploadSessions.delete(uploadId);

  return res.json({
    fileId: session.fileId,
    name: session.name,
    mime: "application/octet-stream",
    size: session.uploaded,
    url: `/MV/files/${session.fileId}`
  });
}

function downloadFile(req, res) {
  const file = fileIndex.get(req.params.fileId);
  if (!file) {
    return res.status(404).json({ error: "File not found" });
  }
  res.setHeader("Content-Type", file.mime || "application/octet-stream");
  res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(file.name)}"`);
  return res.sendFile(path.resolve(file.path));
}

module.exports = { startUpload, uploadChunk, finishUpload, downloadFile };
