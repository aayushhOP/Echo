import { Request, Response, NextFunction } from "express";
import { getAuth } from "@clerk/express";
import User from "../models/User";
import { AppError } from "./errorHandler";

export interface AuthenticatedRequest extends Request {
  userId?: string;
  auth?: any;
}

export const authMiddleware = async (
  req: AuthenticatedRequest,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const auth = getAuth(req);
    const clerkUserId = auth?.userId;

    if (!clerkUserId) {
      return next(new AppError("Authentication required: missing or invalid session", 401));
    }

    // Resolve or sync user in MongoDB
    let user = await User.findOne({ clerkId: clerkUserId });
    if (!user) {
      // In case webhook hasn't fired yet, create minimal user record
      user = await User.create({
        clerkId: clerkUserId,
        email: `${clerkUserId}@placeholder.echo`,
        username: `user_${clerkUserId.slice(-6)}`,
      });
    }

    // req.userId is set to the MongoDB _id string for backward compatibility with existing services
    req.userId = user._id.toString();
    next();
  } catch (error: any) {
    next(new AppError(error.message || "Authentication error", 401));
  }
};
