import { Server as HttpServer } from "http";
import { Server as SocketIOServer } from "socket.io";
import { socketAuthMiddleware } from "./socketAuthMiddleware";
import { registerMessageHandlers } from "./handlers/messageHandlers";
import { registerTypingHandlers } from "./handlers/typingHandlers";
import { registerPresenceHandlers } from "./handlers/presenceHandlers";
import { getConversationsForUser } from "../services/conversationService";
import { ENV } from "../config/env";

export const initSocketServer = (httpServer: HttpServer): SocketIOServer => {
  const io = new SocketIOServer(httpServer, {
    cors: {
      origin: ENV.CLIENT_ORIGIN,
      credentials: true,
    },
  });

  // Apply authentication middleware
  io.use(socketAuthMiddleware);

  io.on("connection", async (socket) => {
    const userId = socket.data.userId;
    console.log(`[Socket] User connected: ${userId} (socketId: ${socket.id})`);

    // Register event handlers immediately
    registerMessageHandlers(io, socket);
    registerTypingHandlers(io, socket);
    registerPresenceHandlers(io, socket);

    try {
      // 1. Look up conversations the user belongs to and join their rooms
      const conversations = await getConversationsForUser(userId);
      for (const conv of conversations) {
        socket.join(`conversation:${conv._id.toString()}`);
      }

      console.log(
        `[Socket] User ${userId} joined room user:${userId} and ${conversations.length} conversation rooms`
      );
    } catch (err: any) {
      console.error(`[Socket] Error setting up rooms for user ${userId}:`, err.message || err);
    }
  });

  return io;
};
