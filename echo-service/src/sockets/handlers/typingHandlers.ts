import type { Server, Socket } from "socket.io";
import { typingEventSchema } from "../../types/presence";
import Conversation from "../../models/Conversation";
import User from "../../models/User";

export const registerTypingHandlers = (_io: Server, socket: Socket) => {
  const userId = socket.data.userId;

  socket.on("typing:start", async (payload: unknown) => {
    const parsed = typingEventSchema.safeParse(payload);
    if (!parsed.success) {
      return;
    }

    const { conversationId } = parsed.data;

    // Check if direct conversation and mutual block exists
    try {
      const conv = await Conversation.findById(conversationId).select("type participants");
      if (conv && conv.type === "direct") {
        const counterpartId = conv.participants.find((p) => p.toString() !== userId);
        if (counterpartId) {
          const isBlocked = await (User as any).isBlockedRelationship(userId, counterpartId);
          if (isBlocked) {
            return; // Drop typing indicator silently
          }
        }
      }
    } catch (err) {
      console.error("[typing:start check error]:", err);
    }

    // Broadcast to the conversation room, excluding sender's socket
    socket.to(`conversation:${conversationId}`).emit("typing:update", {
      conversationId,
      userId,
      isTyping: true,
    });
  });

  socket.on("typing:stop", async (payload: unknown) => {
    const parsed = typingEventSchema.safeParse(payload);
    if (!parsed.success) {
      return;
    }

    const { conversationId } = parsed.data;

    try {
      const conv = await Conversation.findById(conversationId).select("type participants");
      if (conv && conv.type === "direct") {
        const counterpartId = conv.participants.find((p) => p.toString() !== userId);
        if (counterpartId) {
          const isBlocked = await (User as any).isBlockedRelationship(userId, counterpartId);
          if (isBlocked) {
            return; // Drop typing indicator silently
          }
        }
      }
    } catch (err) {
      console.error("[typing:stop check error]:", err);
    }

    // Broadcast to the conversation room, excluding sender's socket
    socket.to(`conversation:${conversationId}`).emit("typing:update", {
      conversationId,
      userId,
      isTyping: false,
    });
  });
};
