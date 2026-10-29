import type { Server, Socket } from "socket.io";
import { z } from "zod";
import * as messageService from "../../services/messageService";

const sendMessageSchema = z.object({
  conversationId: z.string().min(1, "conversationId is required"),
  content: z.string().min(1, "content cannot be empty"),
  type: z.enum(["text", "image", "file"]).optional().default("text"),
  mediaUrl: z.string().optional(),
});

const readMessageSchema = z.object({
  conversationId: z.string().min(1, "conversationId is required"),
  messageIds: z.array(z.string()).min(1, "messageIds array cannot be empty"),
});

export const registerMessageHandlers = (io: Server, socket: Socket) => {
  const userId = socket.data.userId;

  socket.on("message:send", async (payload: unknown, ack?: (res: any) => void) => {
    try {
      const parsed = sendMessageSchema.safeParse(payload);
      if (!parsed.success) {
        if (ack) ack({ success: false, error: parsed.error.issues[0]?.message || "Invalid payload" });
        return;
      }

      const { conversationId, content, type, mediaUrl } = parsed.data;

      const savedMessage = await messageService.createMessage(userId, {
        conversationId,
        content,
        type,
        mediaUrl,
      });

      // Broadcast to room conversation:<id>, which includes sender
      io.to(`conversation:${conversationId}`).emit("message:new", {
        message: savedMessage,
      });

      if (ack) {
        ack({ success: true, message: savedMessage });
      }
    } catch (err: any) {
      console.error("[Socket message:send Error]:", err.message || err);
      if (ack) {
        ack({ success: false, error: err.message || "Failed to send message" });
      }
    }
  });

  socket.on("message:read", async (payload: unknown, ack?: (res: any) => void) => {
    try {
      const parsed = readMessageSchema.safeParse(payload);
      if (!parsed.success) {
        if (ack) ack({ success: false, error: parsed.error.issues[0]?.message || "Invalid payload" });
        return;
      }

      const { conversationId, messageIds } = parsed.data;

      const updatedIds = await messageService.markMessagesAsRead(
        userId,
        conversationId,
        messageIds
      );

      if (updatedIds.length > 0) {
        // Emit message:read:update to the conversation room
        io.to(`conversation:${conversationId}`).emit("message:read:update", {
          conversationId,
          messageIds: updatedIds,
          readerId: userId,
        });
      }

      if (ack) {
        ack({ success: true, updatedCount: updatedIds.length });
      }
    } catch (err: any) {
      console.error("[Socket message:read Error]:", err.message || err);
      if (ack) {
        ack({ success: false, error: err.message || "Failed to mark messages as read" });
      }
    }
  });
};
