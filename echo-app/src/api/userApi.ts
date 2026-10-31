import { axiosClient } from "./axiosClient";
import { User, UserSearchItem } from "../types/user";

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
  error?: string;
}

export interface UpdateProfileDTO {
  status?: string;
  avatarUrl?: string;
}

export const userApi = {
  getMe: async (): Promise<User> => {
    const res = await axiosClient.get<ApiResponse<User>>("/users/me");
    return res.data.data;
  },

  updateMe: async (data: UpdateProfileDTO): Promise<User> => {
    const res = await axiosClient.patch<ApiResponse<User>>("/users/me", data);
    return res.data.data;
  },

  search: async (query: string): Promise<UserSearchItem[]> => {
    const res = await axiosClient.get<ApiResponse<UserSearchItem[]>>("/users/search", {
      params: { q: query },
    });
    return res.data.data;
  },

  blockUser: async (targetUserId: string): Promise<{ success: boolean; blockedUserId: string }> => {
    const res = await axiosClient.post<{ success: boolean; blockedUserId: string }>("/users/block", {
      targetUserId,
    });
    return res.data;
  },

  unblockUser: async (targetUserId: string): Promise<{ success: boolean; unblockedUserId: string }> => {
    const res = await axiosClient.post<{ success: boolean; unblockedUserId: string }>("/users/unblock", {
      targetUserId,
    });
    return res.data;
  },

  getBlockedUsers: async (): Promise<UserSearchItem[]> => {
    const res = await axiosClient.get<{ success: boolean; blockedUsers: UserSearchItem[] }>("/users/blocked");
    return res.data.blockedUsers;
  },
};
