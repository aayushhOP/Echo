import { getRedisClient } from "../config/redis";
import User from "../models/User";
import Conversation from "../models/Conversation";
import { Types } from "mongoose";

// Redis key helpers
const PRESENCE_KEY = (userId: string) => `presence:${userId}`;
const USER_SOCKETS_KEY = (userId: string) => `user_sockets:${userId}`;
const DEFAULT_TTL_SECONDS = 300; // 5 minutes TTL

// Memory fallback when Redis is not available
const memorySockets = new Map<string, Set<string>>();
const memoryPresence = new Map<string, boolean>();

/**
 * Register a user socket connection.
 * Adds socketId to the user's active socket set.
 * Returns true if this is the user's FIRST active socket (came online).
 */
export const trackUserConnection = async (userId: string, socketId: string): Promise<boolean> => {
  const redis = getRedisClient();

  if (redis) {
    try {
      await redis.sAdd(USER_SOCKETS_KEY(userId), socketId);
      // Refresh presence key
      await redis.set(PRESENCE_KEY(userId), "online", { EX: DEFAULT_TTL_SECONDS });
      const socketCount = await redis.sCard(USER_SOCKETS_KEY(userId));
      return socketCount === 1;
    } catch (err) {
      console.warn("[PresenceService] Redis trackUserConnection failed, using fallback:", err);
    }
  }

  // Memory fallback
  let sockets = memorySockets.get(userId);
  if (!sockets) {
    sockets = new Set();
    memorySockets.set(userId, sockets);
  }
  sockets.add(socketId);
  memoryPresence.set(userId, true);
  return sockets.size === 1;
};

/**
 * Handle a user socket disconnection.
 * Removes socketId from the user's active socket set.
 * Returns true if NO active sockets remain (user went offline).
 */
export const trackUserDisconnection = async (
  userId: string,
  socketId: string
): Promise<{ wentOffline: boolean; lastSeen: Date }> => {
  const redis = getRedisClient();
  const lastSeen = new Date();

  if (redis) {
    try {
      await redis.sRem(USER_SOCKETS_KEY(userId), socketId);
      const remainingCount = await redis.sCard(USER_SOCKETS_KEY(userId));

      if (remainingCount === 0) {
        // No sockets left -> delete keys and persist lastSeen in DB
        await redis.del(USER_SOCKETS_KEY(userId));
        await redis.del(PRESENCE_KEY(userId));

        await User.findByIdAndUpdate(userId, {
          isOnline: false,
          lastSeen,
        });

        return { wentOffline: true, lastSeen };
      }

      return { wentOffline: false, lastSeen };
    } catch (err) {
      console.warn("[PresenceService] Redis trackUserDisconnection failed, using fallback:", err);
    }
  }

  // Memory fallback
  const sockets = memorySockets.get(userId);
  if (sockets) {
    sockets.delete(socketId);
    if (sockets.size === 0) {
      memorySockets.delete(userId);
      memoryPresence.delete(userId);

      await User.findByIdAndUpdate(userId, {
        isOnline: false,
        lastSeen,
      });

      return { wentOffline: true, lastSeen };
    }
  }

  return { wentOffline: false, lastSeen };
};

/**
 * Check if a user is currently online.
 * Reads from Redis first (hot path) before touching MongoDB.
 */
export const isUserOnline = async (userId: string): Promise<boolean> => {
  const redis = getRedisClient();

  if (redis) {
    try {
      const presence = await redis.get(PRESENCE_KEY(userId));
      if (presence !== null) {
        return presence === "online";
      }
      const socketCount = await redis.sCard(USER_SOCKETS_KEY(userId));
      return socketCount > 0;
    } catch (err) {
      console.warn("[PresenceService] Redis isUserOnline failed, using fallback:", err);
    }
  }

  // Memory fallback
  const sockets = memorySockets.get(userId);
  if (sockets && sockets.size > 0) {
    return true;
  }

  const user = await User.findById(userId).select("isOnline");
  return !!user?.isOnline;
};

/**
 * Get all online user IDs currently connected.
 */
export const getOnlineUserIds = async (): Promise<string[]> => {
  const redis = getRedisClient();

  if (redis) {
    try {
      const keys = await redis.keys("presence:*");
      const onlineIds: string[] = [];
      for (const key of keys) {
        const val = await redis.get(key);
        if (val === "online") {
          onlineIds.push(key.replace("presence:", ""));
        }
      }
      if (onlineIds.length > 0) {
        return onlineIds;
      }
    } catch (err) {
      console.warn("[PresenceService] Redis getOnlineUserIds failed, using DB/memory fallback:", err);
    }
  }

  // Memory fallback
  const memoryOnlineIds = Array.from(memoryPresence.entries())
    .filter(([_, isOnline]) => isOnline)
    .map(([uid]) => uid);

  if (memoryOnlineIds.length > 0) {
    return memoryOnlineIds;
  }

  // DB fallback
  const onlineUsers = await User.find({ isOnline: true }).select("_id");
  return onlineUsers.map((u) => u._id.toString());
};

/**
 * Get distinct contact user IDs who share a conversation with the given user.
 */
export const getUserContactIds = async (userId: string): Promise<string[]> => {
  const userObjectId = new Types.ObjectId(userId);
  const conversations = await Conversation.find(
    { participants: userObjectId },
    { participants: 1 }
  );

  const contactSet = new Set<string>();
  for (const conv of conversations) {
    for (const participantId of conv.participants) {
      const pidStr = participantId.toString();
      if (pidStr !== userId) {
        contactSet.add(pidStr);
      }
    }
  }

  return Array.from(contactSet);
};
