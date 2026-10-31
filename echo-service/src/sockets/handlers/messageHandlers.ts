import type { Server, Socket } from "socket.io";
import { z } from "zod";
import * as messageService from "../../services/messageService";
import Conversation from "../../models/Conversation";
import Message from "../../models/Message";
import { Types } from "mongoose";

const sendMessageSchema = z.object({
  conversationId: z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid conversationId"),
  content: z.string().max(4000).optional().default(""),
  type: z.enum(["text", "image", "file"]).default("text"),
  mediaUrl: z.string().url().optional().nullable(),
  fileName: z.string().max(255).optional().nullable(),
  fileSize: z.number().max(10485760).optional().nullable(),
  replyTo: z.string().regex(/^[0-9a-fA-F]{24}$/).optional().nullable(),
});

const reactMessageSchema = z.object({
  conversationId: z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid conversationId"),
  messageId: z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid messageId"),
  emoji: z.string().min(1).max(8),
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

      const { conversationId, content, type, mediaUrl, fileName, fileSize, replyTo } = parsed.data;

      const savedMessage = await messageService.createMessage(userId, {
        conversationId,
        content,
        type,
        mediaUrl: mediaUrl ?? undefined,
        fileName: fileName ?? undefined,
        fileSize: fileSize ?? undefined,
        replyTo: replyTo ?? undefined,
      });

      // Confirm to sender socket immediately (1 Tick: "sent")
      if (ack) {
        ack({ success: true, message: savedMessage });
      }

      const conversation = await Conversation.findById(conversationId);
      if (!conversation) return;

      // If blocked in 1-on-1 direct conversation, STOP HERE. Do not broadcast or deliver to recipient.
      if (savedMessage.isDroppedDueToBlock && conversation.type === "direct") {
        return;
      }

      if (conversation.type === "direct") {
        const recipientId = conversation.participants
          .find((pid) => pid.toString() !== userId)
          ?.toString();

        if (recipientId) {
          const recipientSockets = await io.in(`user:${recipientId}`).allSockets();
          const isRecipientConnected = recipientSockets.size > 0;

          // Relay to recipient's personal room and conversation room (excluding sender)
          io.to(`user:${recipientId}`).emit("message:new", {
            message: savedMessage,
          });

          // Also emit to conversation room if anyone else is subscribed
          socket.to(`conversation:${conversationId}`).emit("message:new", {
            message: savedMessage,
          });

          // If recipient is connected, transition immediately to Double Grey Tick ("delivered")
          if (isRecipientConnected) {
            savedMessage.status = "delivered";
            if (!savedMessage.deliveredTo) {
              savedMessage.deliveredTo = [];
            }
            savedMessage.deliveredTo.push({
              userId: new Types.ObjectId(recipientId),
              deliveredAt: new Date(),
            });
            await Message.findByIdAndUpdate(savedMessage._id, {
              status: "delivered",
              $push: {
                deliveredTo: {
                  userId: new Types.ObjectId(recipientId),
                  deliveredAt: new Date(),
                },
              },
            });

            // Notify sender of the 2nd tick
            io.to(`user:${userId}`).emit("message:status_update", {
              messageId: savedMessage._id,
              conversationId,
              status: "delivered",
            });
          }
        }
      } else {
        // Group Chat: Broadcast to the conversation room excluding sender
        socket.to(`conversation:${conversationId}`).emit("message:new", {
          message: savedMessage,
        });
      }
    } catch (err: any) {
      console.error("[Socket message:send Error]:", err.message || err);
      if (ack) {
        ack({ success: false, error: err.message || "Failed to send message" });
      }
    }
  });

  socket.on("message:react", async (payload: unknown, ack?: (res: any) => void) => {
    try {
      const parsed = reactMessageSchema.safeParse(payload);
      if (!parsed.success) {
        if (ack) ack({ success: false, error: parsed.error.issues[0]?.message || "Invalid payload" });
        return;
      }

      const { conversationId, messageId, emoji } = parsed.data;

      const updatedMessage = await messageService.toggleReaction(messageId, userId, emoji);

      // Broadcast reaction update to conversation room
      io.to(`conversation:${conversationId}`).emit("message:reaction:update", {
        conversationId,
        messageId,
        reactions: updatedMessage.reactions,
        userId,
      });

      if (ack) {
        ack({ success: true, reactions: updatedMessage.reactions });
      }
    } catch (err: any) {
      console.error("[Socket message:react Error]:", err.message || err);
      if (ack) {
        ack({ success: false, error: err.message || "Failed to update reaction" });
      }
    }
  });

  // Handle both message:mark_read and message:read
  const handleMarkRead = async (payload: unknown, ack?: (res: any) => void) => {
    try {
      const parsed = readMessageSchema.safeParse(payload);
      if (!parsed.success) {
        if (ack) ack({ success: false, error: parsed.error.issues[0]?.message || "Invalid payload" });
        return;
      }

      const { conversationId, messageIds } = parsed.data;

      const conversation = await Conversation.findById(conversationId);
      if (!conversation) {
        if (ack) ack({ success: false, error: "Conversation not found" });
        return;
      }

      // Mutual block check in direct conversation:
      // If blocked, read acks across 1:1 boundary must NOT transition status
      if (conversation.type === "direct") {
        const counterpartId = conversation.participants.find((p) => p.toString() !== userId);
        if (counterpartId) {
          const User = (await import("../../models/User.js")).default;
          const isBlocked = await (User as any).isBlockedRelationship(userId, counterpartId);
          if (isBlocked) {
            if (ack) ack({ success: true, updatedCount: 0 });
            return;
          }
        }
      }

      const updatedIds = await messageService.markMessagesAsRead(
        userId,
        conversationId,
        messageIds
      );

      if (updatedIds.length > 0) {
        // Emit legacy event for backward compatibility
        io.to(`conversation:${conversationId}`).emit("message:read:update", {
          conversationId,
          messageIds: updatedIds,
          readerId: userId,
        });

        // Also emit message:status_batch_update matching specification
        io.to(`conversation:${conversationId}`).emit("message:status_batch_update", {
          conversationId,
          messageIds: updatedIds,
          status: "read",
          readByUserId: userId,
        });
      }

      if (ack) {
        ack({ success: true, updatedCount: updatedIds.length });
      }
    } catch (err: any) {
      console.error("[Socket markRead Error]:", err.message || err);
      if (ack) {
        ack({ success: false, error: err.message || "Failed to mark messages as read" });
      }
    }
  };

  socket.on("message:read", handleMarkRead);
  socket.on("message:mark_read", handleMarkRead);
};
