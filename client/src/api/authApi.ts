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

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
  error?: string;
}

export const authApi = {
  register: async (data: RegisterDTO): Promise<AuthResponse> => {
    const res = await axiosClient.post<ApiResponse<AuthResponse>>("/auth/register", data);
    return res.data.data;
  },

  login: async (data: LoginDTO): Promise<AuthResponse> => {
    const res = await axiosClient.post<ApiResponse<AuthResponse>>("/auth/login", data);
    return res.data.data;
  },

  refresh: async (): Promise<{ accessToken: string; user?: User }> => {
    const res = await axiosClient.post<ApiResponse<{ accessToken: string; user?: User }>>(
      "/auth/refresh"
    );
    return res.data.data;
  },

  logout: async (): Promise<{ message: string }> => {
    const res = await axiosClient.post<{ message: string }>("/auth/logout");
    return res.data;
  },

  me: async (): Promise<User> => {
    const res = await axiosClient.get<ApiResponse<User>>("/users/me");
    return res.data.data;
  },
};
