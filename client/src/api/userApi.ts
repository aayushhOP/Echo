import { axiosClient } from "./axiosClient";
import { User, UserSearchItem } from "../types/user";
import { ApiResponse } from "./authApi";

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
};
