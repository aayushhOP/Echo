import { axiosClient } from "./axiosClient";
import { User, UserSearchItem } from "../types/user";

export interface UpdateProfileDTO {
  status?: string;
  avatarUrl?: string;
}

export const userApi = {
  getMe: async (): Promise<User> => {
    const res = await axiosClient.get<User>("/users/me");
    return res.data;
  },

  updateMe: async (data: UpdateProfileDTO): Promise<User> => {
    const res = await axiosClient.patch<User>("/users/me", data);
    return res.data;
  },

  search: async (query: string): Promise<UserSearchItem[]> => {
    const res = await axiosClient.get<UserSearchItem[]>("/users/search", {
      params: { q: query },
    });
    return res.data;
  },
};
