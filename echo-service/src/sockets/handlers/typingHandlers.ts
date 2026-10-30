import type { Server, Socket } from "socket.io";
import { typingEventSchema } from "../../types/presence";

export const registerTypingHandlers = (_io: Server, socket: Socket) => {
  const userId = socket.data.userId;

  socket.on("typing:start", (payload: unknown) => {
    const parsed = typingEventSchema.safeParse(payload);
    if (!parsed.success) {
      return;
    }

    const { conversationId } = parsed.data;

    // Broadcast to the conversation room, excluding sender's socket
    socket.to(`conversation:${conversationId}`).emit("typing:update", {
      conversationId,
      userId,
      isTyping: true,
    });
  });

  socket.on("typing:stop", (payload: unknown) => {
    const parsed = typingEventSchema.safeParse(payload);
    if (!parsed.success) {
      return;
    }

    const { conversationId } = parsed.data;

    // Broadcast to the conversation room, excluding sender's socket
    socket.to(`conversation:${conversationId}`).emit("typing:update", {
      conversationId,
      userId,
      isTyping: false,
    });
  });
};
