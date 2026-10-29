import type { Server, Socket } from "socket.io";
import * as presenceService from "../../services/presenceService";

export const registerPresenceHandlers = async (io: Server, socket: Socket) => {
  const userId = socket.data.userId;

  // Track connection synchronously during connection handling
  try {
    const isFirstConnection = await presenceService.trackUserConnection(userId, socket.id);
    const contactIds = await presenceService.getUserContactIds(userId);

    // 1. Tell all my contacts that I am online
    if (isFirstConnection) {
      for (const contactId of contactIds) {
        io.to(`user:${contactId}`).emit("presence:online", { userId });
      }
    }

    // 2. Also tell THIS newly connected socket which of their contacts are ALREADY online
    for (const contactId of contactIds) {
      const isOnline = await presenceService.isUserOnline(contactId);
      if (isOnline) {
        socket.emit("presence:online", { userId: contactId });
      }
    }
  } catch (err: any) {
    console.error("[Socket Presence Connect Error]:", err.message || err);
  }

  // Handle disconnect
  socket.on("disconnect", async (reason) => {
    console.log(`[Socket] User disconnected: ${userId} (socketId: ${socket.id}, reason: ${reason})`);
    try {
      const { wentOffline, lastSeen } = await presenceService.trackUserDisconnection(
        userId,
        socket.id
      );

      if (wentOffline) {
        // Broadcast presence:offline to all contacts
        const contactIds = await presenceService.getUserContactIds(userId);
        for (const contactId of contactIds) {
          io.to(`user:${contactId}`).emit("presence:offline", {
            userId,
            lastSeen: lastSeen.toISOString(),
          });
        }
      }
    } catch (err: any) {
      console.error("[Socket Presence Disconnect Error]:", err.message || err);
    }
  });
};
