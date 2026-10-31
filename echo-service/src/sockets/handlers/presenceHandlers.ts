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
        // Query current user's blocked list and who blocked them
        const currentUser = await User.findById(userId).select("blockedUsers");
        const blockedUsers = (currentUser?.blockedUsers || []).map((id) => id.toString());

        // Users who blocked this user
        const usersWhoBlockedMe = await User.find({ blockedUsers: userId }).select("_id");
        const blockedByUsers = usersWhoBlockedMe.map((u) => u._id.toString());
        const excludeSet = new Set([...blockedUsers, ...blockedByUsers]);

        // Broadcast selectively or broadcast to all sockets excluding blocked ones
        const allConnectedSockets = await io.fetchSockets();
        for (const s of allConnectedSockets) {
          const remoteUserId = s.data?.userId;
          if (remoteUserId && remoteUserId !== userId && !excludeSet.has(remoteUserId)) {
            s.emit("presence:online", { userId });
          }
        }
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

        // Persist offline state and lastSeen to DB safely in the background
        await User.findByIdAndUpdate(userId, {
          isOnline: false,
          lastSeen,
        }).catch((err) => {
          console.error("[Socket Presence DB Update Error]:", err);
        });

        const currentUser = await User.findById(userId).select("blockedUsers");
        const blockedUsers = (currentUser?.blockedUsers || []).map((id) => id.toString());
        const usersWhoBlockedMe = await User.find({ blockedUsers: userId }).select("_id");
        const blockedByUsers = usersWhoBlockedMe.map((u) => u._id.toString());
        const excludeSet = new Set([...blockedUsers, ...blockedByUsers]);

        const allConnectedSockets = await io.fetchSockets();
        for (const s of allConnectedSockets) {
          const remoteUserId = s.data?.userId;
          if (remoteUserId && remoteUserId !== userId && !excludeSet.has(remoteUserId)) {
            s.emit("presence:offline", { userId, lastSeen: lastSeen.toISOString() });
          }
        }
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
      const currentUser = await User.findById(userId).select("blockedUsers");
      const blockedUsers = (currentUser?.blockedUsers || []).map((id) => id.toString());
      const usersWhoBlockedMe = await User.find({
        _id: { $in: parsed.data },
        blockedUsers: userId,
      }).select("_id");
      const blockedByUsers = usersWhoBlockedMe.map((u) => u._id.toString());
      const excludedSet = new Set([...blockedUsers, ...blockedByUsers]);

      const onlineContacts: string[] = [];

      for (const contactId of parsed.data) {
        if (excludedSet.has(contactId)) continue;
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

