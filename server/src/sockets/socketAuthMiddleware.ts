import jwt from "jsonwebtoken";
import type { Socket } from "socket.io";
import { ENV } from "../config/env";

export const socketAuthMiddleware = (socket: Socket, next: (err?: Error) => void) => {
  const token = socket.handshake.auth?.token;
  if (!token) return next(new Error("No token provided"));

  try {
    const payload = jwt.verify(token, ENV.JWT_SECRET) as { userId: string };
    socket.data.userId = payload.userId;
    next();
  } catch {
    next(new Error("Invalid token"));
  }
};
