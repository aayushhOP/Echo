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
  about?: string;
  avatarUrl?: string;
  bio?: string;
  phone?: string;
  phoneNumber?: string;
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

  updateAvatar: async (file: Blob | File): Promise<{ success: boolean; avatarUrl: string; user?: User }> => {
    const formData = new FormData();
    formData.append("avatar", file, "avatar.png");
    const res = await axiosClient.post<{ success: boolean; avatarUrl: string; user?: User; message?: string }>(
      "/users/profile/avatar",
      formData,
      {
        headers: { "Content-Type": "multipart/form-data" },
      }
    );
    return res.data;
  },

  updateProfileDetails: async (data: {
    about?: string;
    phoneNumber?: string;
    status?: string;
    bio?: string;
    phone?: string;
  }): Promise<{ success: boolean; user: User }> => {
    const res = await axiosClient.patch<{ success: boolean; user: User }>(
      "/users/profile/details",
      data
    );
    return res.data;
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

  getBlockedContacts: async (): Promise<UserSearchItem[]> => {
    const res = await axiosClient.get<{ success: boolean; blockedContacts: UserSearchItem[] }>("/users/privacy/blocked-contacts");
    return res.data.blockedContacts;
  },
};
