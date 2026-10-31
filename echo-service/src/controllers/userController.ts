import { Response, NextFunction } from "express";
import { z } from "zod";
import { AuthenticatedRequest } from "../middlewares/authMiddleware";
import { AppError } from "../middlewares/errorHandler";
import * as userService from "../services/userService";
import { getOnlineUserIds } from "../services/presenceService";
import { getIO } from "../sockets";

const updateProfileSchema = z
  .object({
    status: z.string().max(200, "Status must be at most 200 characters").optional(),
    avatarUrl: z.string().url("Must be a valid URL").or(z.literal("")).optional(),
    bio: z.string().max(500, "Bio must be at most 500 characters").optional(),
    phone: z.string().max(30).optional(),
    preferences: z
      .object({
        soundEnabled: z.boolean().optional(),
        theme: z.string().max(50).optional(),
        notifications: z.boolean().optional(),
      })
      .optional(),
  })
  .strict();

const updatePreferencesSchema = z.object({
  soundEnabled: z.boolean().optional(),
  theme: z.string().max(50).optional(),
  notifications: z.boolean().optional(),
  bio: z.string().max(500).optional(),
});

const blockUserSchema = z.object({
  targetUserId: z.string().min(1, "targetUserId is required"),
});

export const getMeHandler = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.userId) {
      throw new AppError("Authentication required", 401);
    }
    const profile = await userService.getCurrentUserProfile(req.userId);
    res.status(200).json({
      success: true,
      data: profile,
    });
  } catch (error) {
    next(error);
  }
};

export const getOnlineUsersHandler = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.userId) {
      throw new AppError("Authentication required", 401);
    }
    const onlineUserIds = await getOnlineUserIds();
    res.status(200).json({
      onlineUserIds,
    });
  } catch (error) {
    next(error);
  }
};

export const updateMeHandler = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.userId) {
      throw new AppError("Authentication required", 401);
    }
    const validatedData = updateProfileSchema.parse(req.body);
    const updatedProfile = await userService.updateCurrentUserProfile(req.userId, validatedData);
    res.status(200).json({
      success: true,
      data: updatedProfile,
    });
  } catch (error) {
    next(error);
  }
};

export const updatePreferencesHandler = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.userId) {
      throw new AppError("Authentication required", 401);
    }
    const validatedData = updatePreferencesSchema.parse(req.body);
    const updatedProfile = await userService.updateCurrentUserProfile(req.userId, {
      bio: validatedData.bio,
      preferences: {
        soundEnabled: validatedData.soundEnabled,
        theme: validatedData.theme,
        notifications: validatedData.notifications,
      },
    });
    res.status(200).json({
      success: true,
      data: updatedProfile,
    });
  } catch (error) {
    next(error);
  }
};

export const searchUsersHandler = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.userId) {
      throw new AppError("Authentication required", 401);
    }
    const query = typeof req.query.q === "string" ? req.query.q : "";
    const users = await userService.searchUsersByUsername(req.userId, query);
    res.status(200).json({
      success: true,
      data: users,
    });
  } catch (error) {
    next(error);
  }
};

export const blockUserHandler = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.userId) {
      throw new AppError("Authentication required", 401);
    }
    const { targetUserId } = blockUserSchema.parse(req.body);
    const blockedUserId = await userService.blockUser(req.userId, targetUserId);

    // Immediately inform the blocked user that this contact is offline/hidden
    try {
      const io = getIO();
      io.to(`user:${blockedUserId}`).emit("presence:masked", {
        userId: req.userId,
        isOnline: false,
        lastSeen: null,
      });
    } catch (socketErr) {
      console.error("[blockUserHandler] Failed to emit presence:masked:", socketErr);
    }

    res.status(200).json({
      success: true,
      blockedUserId,
    });
  } catch (error) {
    next(error);
  }
};

export const unblockUserHandler = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.userId) {
      throw new AppError("Authentication required", 401);
    }
    const { targetUserId } = blockUserSchema.parse(req.body);
    const unblockedUserId = await userService.unblockUser(req.userId, targetUserId);

    try {
      const io = getIO();
      const currentSockets = await io.in(`user:${req.userId}`).allSockets();
      io.to(`user:${unblockedUserId}`).emit("presence:unmasked", {
        userId: req.userId,
        isOnline: currentSockets.size > 0,
      });
    } catch (socketErr) {
      console.error("[unblockUserHandler] Failed to emit presence:unmasked:", socketErr);
    }

    res.status(200).json({
      success: true,
      unblockedUserId,
    });
  } catch (error) {
    next(error);
  }
};

export const getBlockedUsersHandler = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.userId) {
      throw new AppError("Authentication required", 401);
    }
    const blockedUsers = await userService.getBlockedUsers(req.userId);
    res.status(200).json({
      success: true,
      blockedUsers,
    });
  } catch (error) {
    next(error);
  }
};
