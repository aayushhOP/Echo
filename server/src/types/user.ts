import { IUser } from "../models/User";

export interface UserProfileDTO {
  id: string;
  username: string;
  email: string;
  avatarUrl?: string;
  status?: string;
  isOnline: boolean;
  lastSeen: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserSearchItemDTO {
  id: string;
  username: string;
  avatarUrl?: string;
  status?: string;
  isOnline: boolean;
  lastSeen: Date;
}

export interface UpdateProfileDTO {
  status?: string;
  avatarUrl?: string;
}

export const formatUserProfile = (user: IUser & { createdAt: Date; updatedAt: Date }): UserProfileDTO => ({
  id: user._id.toString(),
  username: user.username,
  email: user.email,
  avatarUrl: user.avatarUrl,
  status: user.status,
  isOnline: user.isOnline,
  lastSeen: user.lastSeen,
  createdAt: user.createdAt,
  updatedAt: user.updatedAt,
});

export const formatUserSearchItem = (user: IUser): UserSearchItemDTO => ({
  id: user._id.toString(),
  username: user.username,
  avatarUrl: user.avatarUrl,
  status: user.status,
  isOnline: user.isOnline,
  lastSeen: user.lastSeen,
});
