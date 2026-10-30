import { Response, NextFunction } from "express";
import { z } from "zod";
import { AuthenticatedRequest } from "../middlewares/authMiddleware";
import { AppError } from "../middlewares/errorHandler";
import * as userService from "../services/userService";

const updateProfileSchema = z
  .object({
    status: z.string().max(200, "Status must be at most 200 characters").optional(),
    avatarUrl: z.string().url("Must be a valid URL").or(z.literal("")).optional(),
  })
  .strict();

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
