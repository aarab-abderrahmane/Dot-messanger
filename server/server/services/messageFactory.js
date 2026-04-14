const { z } = require("zod");
const { v4: uuidv4 } = require("uuid");

function createBaseMessage(user, type, extra = {}) {
  const messageSchema = z.object({
    id: z.string(),
    type: z.enum(["text", "pdf", "file", "image", "voice", "sticker", "gif", "gift", "nudge", "poll"]),
    email: z.string().email(),
    username: z.string().min(1),
    avatar: z.string().optional(),
    to: z.string().optional(),
    chatType: z.enum(["direct", "group"]),
    chatId: z.string().min(1),
    timestamp: z.number(),
    replyTo: z.any().nullable().optional(),
    forwardedFrom: z.object({
      email: z.string().email(),
      username: z.string().min(1)
    }).optional(),
    silent: z.boolean().optional(),
    content: z.string().optional(),
    text: z.string().optional(),
    attachments: z.array(
      z.object({
        name: z.string(),
        content: z.string(),
        mime: z.string().optional()
      })
    ).min(1).max(3).optional()
  });

  const message = {
    id: uuidv4(),
    type,
    email: user.email,
    username: user.username || user.email,
    avatar: user.avatar || "",
    chatType: "direct",
    timestamp: Date.now(),
    replyTo: extra.replyTo || null,
    ...extra
  };

  const result = messageSchema.safeParse(message);

  if (!result.success) {
    return false;
  }
  return result.data;
}

module.exports = { createBaseMessage };
