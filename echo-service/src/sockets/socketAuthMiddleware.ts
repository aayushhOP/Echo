import type { Socket } from "socket.io";
import { verifyToken } from "@clerk/backend";
import { ENV } from "../config/env";
import { getOrProvisionUser } from "../services/userSyncService";

export const socketAuthMiddleware = async (
  socket: Socket,
  next: (err?: Error) => void
) => {
  const token = socket.handshake.auth?.token;
  if (!token) {
    return next(new Error("Authentication error: No token provided"));
  }

  try {
    const verified = await verifyToken(token, {
      secretKey: ENV.CLERK_SECRET_KEY || process.env.CLERK_SECRET_KEY,
    });

    const clerkId = verified.sub;
    if (!clerkId) {
      return next(new Error("Authentication error: Invalid token payload"));
    }

    // Attach clerkId to socket.data
    socket.data.clerkId = clerkId;

    // Resolve or auto-provision corresponding MongoDB user with actual profile details
    const user = await getOrProvisionUser(clerkId);

    // Attach MongoDB user ObjectId string as socket.data.userId for compatibility with all handlers
    socket.data.userId = user._id.toString();
    next();
  } catch (err: any) {
    console.error("[SocketAuthMiddleware] Verification failed:", err.message || err);
    return next(new Error("Authentication error: Invalid token"));
  }
};
