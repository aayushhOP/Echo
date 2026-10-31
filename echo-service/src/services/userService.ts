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

export const blockUser = async (currentUserId: string, targetIdentifier: string): Promise<string> => {
  if (currentUserId === targetIdentifier) {
    throw new AppError("You cannot block yourself", 400);
  }

  // Find target user by _id or clerkId
  let targetUser = null;
  if (targetIdentifier.match(/^[0-9a-fA-F]{24}$/)) {
    targetUser = await User.findById(targetIdentifier);
  }
  if (!targetUser) {
    targetUser = await User.findOne({ clerkId: targetIdentifier });
  }

  if (!targetUser) {
    throw new AppError("User to block not found", 404);
  }

  const targetObjectId = targetUser._id;

  if (targetObjectId.toString() === currentUserId) {
    throw new AppError("You cannot block yourself", 400);
  }

  await User.findByIdAndUpdate(
    currentUserId,
    { $addToSet: { blockedUsers: targetObjectId } },
    { runValidators: true }
  );

  return targetObjectId.toString();
};

export const unblockUser = async (currentUserId: string, targetIdentifier: string): Promise<string> => {
  let targetUser = null;
  if (targetIdentifier.match(/^[0-9a-fA-F]{24}$/)) {
    targetUser = await User.findById(targetIdentifier);
  }
  if (!targetUser) {
    targetUser = await User.findOne({ clerkId: targetIdentifier });
  }

  const targetObjectId = targetUser ? targetUser._id : targetIdentifier;

  await User.findByIdAndUpdate(
    currentUserId,
    { $pull: { blockedUsers: targetObjectId } },
    { runValidators: true }
  );

  return targetObjectId.toString();
};

export const getBlockedUsers = async (currentUserId: string): Promise<UserSearchItemDTO[]> => {
  const user = await User.findById(currentUserId).populate<{ blockedUsers: any[] }>(
    "blockedUsers",
    "_id username avatarUrl status isOnline lastSeen"
  );

  if (!user) {
    throw new AppError("User not found", 404);
  }

  const blocked = user.blockedUsers || [];
  return blocked.map(formatUserSearchItem);
};
