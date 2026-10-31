import { Request, Response, NextFunction } from "express";
import { getAuth } from "@clerk/express";
import { AppError } from "./errorHandler";
import { getOrProvisionUser } from "../services/userSyncService";

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

    // Resolve or sync user with full Clerk profile details in MongoDB
    const user = await getOrProvisionUser(clerkUserId);

    // req.userId is set to the MongoDB _id string for backward compatibility with existing services
    req.userId = user._id.toString();
    next();
  } catch (error: any) {
    next(new AppError(error.message || "Authentication error", 401));
  }
};
