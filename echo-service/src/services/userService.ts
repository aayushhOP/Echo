import User from "../models/User";
import { AppError } from "../middlewares/errorHandler";
import {
  UserProfileDTO,
  UserSearchItemDTO,
  UpdateProfileDTO,
  formatUserProfile,
  formatUserSearchItem,
} from "../types/user";

export const getCurrentUserProfile = async (userId: string): Promise<UserProfileDTO> => {
  const user = await User.findById(userId);
  if (!user) {
    throw new AppError("User not found", 404);
  }
  return formatUserProfile(user as any);
};

export const updateCurrentUserProfile = async (
  userId: string,
  data: UpdateProfileDTO
): Promise<UserProfileDTO> => {
  const updateFields: any = {};
  if (data.status !== undefined) updateFields.status = data.status;
  if (data.avatarUrl !== undefined) updateFields.avatarUrl = data.avatarUrl;
  if (data.bio !== undefined) updateFields.bio = data.bio;
  if (data.phone !== undefined) updateFields.phone = data.phone;
  if (data.preferences !== undefined) {
    if (data.preferences.soundEnabled !== undefined) {
      updateFields["preferences.soundEnabled"] = data.preferences.soundEnabled;
    }
    if (data.preferences.theme !== undefined) {
      updateFields["preferences.theme"] = data.preferences.theme;
    }
    if (data.preferences.notifications !== undefined) {
      updateFields["preferences.notifications"] = data.preferences.notifications;
    }
  }

  const updatedUser = await User.findByIdAndUpdate(
    userId,
    { $set: updateFields },
    { returnDocument: "after", runValidators: true }
  );

  if (!updatedUser) {
    throw new AppError("User not found", 404);
  }

  return formatUserProfile(updatedUser as any);
};

export const searchUsersByUsername = async (
  currentUserId: string,
  query: string
): Promise<UserSearchItemDTO[]> => {
  if (!query || query.trim().length === 0) {
    return [];
  }

  // Escape special regex characters to prevent regex injection
  const escapedQuery = query.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(escapedQuery, "i");

  const users = await User.find({
    _id: { $ne: currentUserId },
    username: { $regex: regex },
  })
    .limit(20)
    .select("_id username avatarUrl status isOnline lastSeen");

  return users.map(formatUserSearchItem);
};
