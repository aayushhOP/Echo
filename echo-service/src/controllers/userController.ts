import { Response, NextFunction } from "express";
import { z } from "zod";
import fs from "fs";
import { v2 as cloudinary } from "cloudinary";
import { AuthenticatedRequest } from "../middlewares/authMiddleware";
import { AppError } from "../middlewares/errorHandler";
import * as userService from "../services/userService";
import { getOnlineUserIds } from "../services/presenceService";
import { getIO } from "../sockets";
import { ENV } from "../config/env";

const updateProfileSchema = z
  .object({
    status: z.string().max(200, "Status must be at most 200 characters").optional(),
    about: z.string().max(200).optional(),
    avatarUrl: z.string().url("Must be a valid URL").or(z.literal("")).or(z.string().startsWith("/uploads/")).optional(),
    bio: z.string().max(500, "Bio must be at most 500 characters").optional(),
    phone: z.string().max(30).optional(),
    phoneNumber: z.string().max(30).optional(),
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

    // Inform BOTH users: the blocked user can't see blocker, and the blocker can't see the blocked user
    try {
      const io = getIO();
      // Mask blocker for blocked user (User B is told User A blocked them)
      io.to(`user:${blockedUserId}`).emit("presence:masked", {
        userId: req.userId,
        isOnline: false,
        lastSeen: null,
        blockedByUserId: req.userId,
      });
      // Mask blocked user for blocker (User A is told User B is masked)
      io.to(`user:${req.userId}`).emit("presence:masked", {
        userId: blockedUserId,
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
        unblockedByUserId: req.userId,
      });

      // Also unmask the unblocked user for the current user
      const targetSockets = await io.in(`user:${unblockedUserId}`).allSockets();
      io.to(`user:${req.userId}`).emit("presence:unmasked", {
        userId: unblockedUserId,
        isOnline: targetSockets.size > 0,
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
      blockedContacts: blockedUsers,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/users/profile/avatar
 * Uploads custom cropped profile picture
 */
export const updateAvatarHandler = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.userId) {
      throw new AppError("Authentication required", 401);
    }
    if (!req.file) {
      res.status(400).json({ success: false, message: "No avatar image uploaded" });
      return;
    }

    let avatarUrl: string;

    // If Cloudinary is configured, upload to Cloudinary so images persist on Render / ephemeral disks
    if (ENV.CLOUDINARY_URL) {
      try {
        try {
          const parsed = new URL(ENV.CLOUDINARY_URL);
          cloudinary.config({
            cloud_name: parsed.hostname,
            api_key: parsed.username,
            api_secret: parsed.password,
          });
        } catch {
          cloudinary.config({ cloudinary_url: ENV.CLOUDINARY_URL });
        }

        const uploadResult = await cloudinary.uploader.upload(req.file.path, {
          folder: "echo-avatars",
          resource_type: "image",
        });

        avatarUrl = uploadResult.secure_url;

        try {
          fs.unlinkSync(req.file.path);
        } catch {}
      } catch (cloudErr) {
        console.error("[Cloudinary Avatar Upload Error]:", cloudErr);
        const protocol = req.protocol;
        const host = req.get("host");
        avatarUrl = `${protocol}://${host}/uploads/avatars/${req.file.filename}`;
      }
    } else {
      const protocol = req.protocol;
      const host = req.get("host");
      avatarUrl = `${protocol}://${host}/uploads/avatars/${req.file.filename}`;
    }

    const updatedUser = await userService.updateCurrentUserProfile(req.userId, {
      avatarUrl,
    });

    res.status(200).json({
      success: true,
      avatarUrl: updatedUser.avatarUrl,
      user: updatedUser,
      message: "Avatar updated successfully",
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /api/users/profile/details
 * Update bio/status/about, phone/phoneNumber
 */
export const updateProfileDetailsHandler = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.userId) {
      throw new AppError("Authentication required", 401);
    }
    const { about, phoneNumber, phone, status, bio } = req.body;
    const updatedUser = await userService.updateCurrentUserProfile(req.userId, {
      about: typeof about === "string" ? about.trim() : undefined,
      status: typeof status === "string" ? status.trim() : (typeof about === "string" ? about.trim() : undefined),
      bio: typeof bio === "string" ? bio.trim() : undefined,
      phoneNumber: typeof phoneNumber === "string" ? phoneNumber.trim() : undefined,
      phone: typeof phone === "string" ? phone.trim() : (typeof phoneNumber === "string" ? phoneNumber.trim() : undefined),
    });

    res.status(200).json({
      success: true,
      user: updatedUser,
      message: "Profile details updated successfully",
    });
  } catch (error) {
    next(error);
  }
};
