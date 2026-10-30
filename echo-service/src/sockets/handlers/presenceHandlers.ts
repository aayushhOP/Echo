import type { Server, Socket } from "socket.io";
import User from "../../models/User";
import { presenceSyncRequestSchema } from "../../types/presence";

export const registerPresenceHandlers = (io: Server, socket: Socket) => {
  const userId = socket.data.userId;
  const personalRoom = `user:${userId}`;

  // 1. Join personal room on connection
  socket.join(personalRoom);

  const handleConnect = async () => {
    try {
      // .allSockets() safely queries across all server instances via Redis or memory adapter
      const sockets = await io.in(personalRoom).allSockets();

      // If exactly 1 socket exists, the user just came online globally
      if (sockets.size === 1) {
        socket.broadcast.emit("presence:online", { userId });
      }
    } catch (error) {
      console.error("[Socket Presence Connect Error]:", error);
    }
  };

  const handleDisconnect = async () => {
    try {
      const sockets = await io.in(personalRoom).allSockets();

      // If 0 sockets exist, ALL tabs/devices are closed
      if (sockets.size === 0) {
        const lastSeen = new Date();

        // Broadcast offline status globally
        io.emit("presence:offline", { userId, lastSeen: lastSeen.toISOString() });

        // Persist offline state and lastSeen to DB safely in the background
        await User.findByIdAndUpdate(userId, {
          isOnline: false,
          lastSeen,
        }).catch((err) => {
          console.error("[Socket Presence DB Update Error]:", err);
        });
      }
    } catch (error) {
      console.error("[Socket Presence Disconnect Error]:", error);
    }
  };

  // Listen for client requesting initial presence state (batch-check active rooms)
  socket.on("presence:request_sync", async (contactIds: unknown) => {
    const parsed = presenceSyncRequestSchema.safeParse(contactIds);
    if (!parsed.success || parsed.data.length === 0) return;

    try {
      const onlineContacts: string[] = [];

      for (const contactId of parsed.data) {
        const sockets = await io.in(`user:${contactId}`).allSockets();
        if (sockets.size > 0) {
          onlineContacts.push(contactId);
        }
      }

      // Send back the array of currently online user IDs
      socket.emit("presence:sync", { onlineUsers: onlineContacts });
    } catch (error) {
      console.error("[Socket Presence Sync Error]:", error);
    }
  });

  // Execute connect logic immediately
  handleConnect();

  // Attach disconnect listener
  socket.on("disconnect", handleDisconnect);
};

