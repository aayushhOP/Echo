import { createClient } from "redis";
import { ENV } from "./env";

export type RedisClient = any;

let redisClient: RedisClient | null = null;
let isRedisConnected = false;

export const connectRedis = async (): Promise<RedisClient | null> => {
  if (!ENV.REDIS_URL) {
    console.log("[Redis] No REDIS_URL configured. Continuing without Redis.");
    return null;
  }

  try {
    const client = createClient({
      url: ENV.REDIS_URL,
      socket: {
        connectTimeout: 2000,
        reconnectStrategy: false,
      },
    });

    client.on("error", (err) => {
      if (isRedisConnected) {
        console.warn("[Redis] Client error:", err.message);
      }
    });

    await Promise.race([
      client.connect(),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Redis connection timed out after 2000ms")), 2000)
      ),
    ]);

    redisClient = client;
    isRedisConnected = true;
    console.log("[Redis] Connected successfully");
    return redisClient;
  } catch (error: any) {
    console.warn(`[Redis] Optional Redis connection failed (${error?.message || error}). Continuing without Redis.`);
    redisClient = null;
    isRedisConnected = false;
    return null;
  }
};

export const getRedisClient = (): RedisClient | null => {
  return isRedisConnected && redisClient && redisClient.isOpen ? redisClient : null;
};
