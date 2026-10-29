import { axiosClient } from "./axiosClient";
import { AuthResponse, User } from "../types/user";

export interface RegisterDTO {
  username: string;
  email: string;
  password: string;
}

export interface LoginDTO {
  email: string;
  password: string;
}

export const authApi = {
  register: async (data: RegisterDTO): Promise<AuthResponse> => {
    const res = await axiosClient.post<AuthResponse>("/auth/register", data);
    return res.data;
  },

  login: async (data: LoginDTO): Promise<AuthResponse> => {
    const res = await axiosClient.post<AuthResponse>("/auth/login", data);
    return res.data;
  },

  refresh: async (): Promise<{ accessToken: string }> => {
    const res = await axiosClient.post<{ accessToken: string }>("/auth/refresh");
    return res.data;
  },

  logout: async (): Promise<{ message: string }> => {
    const res = await axiosClient.post<{ message: string }>("/auth/logout");
    return res.data;
  },

  me: async (): Promise<{ user: User }> => {
    const res = await axiosClient.get<{ user: User }>("/auth/me");
    return res.data;
  },
};
