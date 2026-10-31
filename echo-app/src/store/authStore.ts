import { create } from "zustand";
import { User } from "../types/user";
import { userApi } from "../api/userApi";
import { configureAxiosAuth } from "../api/axiosClient";

interface AuthState {
  user: User | null;
  accessToken: string | null;
  isLoading: boolean;
  isInitialized: boolean;
  setAuth: (user: User, accessToken: string) => void;
  setAccessToken: (token: string | null) => void;
  updateUser: (updatedUser: Partial<User>) => void;
  clearAuth: () => void;
  syncUserWithBackend: (token: string) => Promise<User | null>;
}

export const useAuthStore = create<AuthState>((set, get) => {
  // Wire axios auth helper
  configureAxiosAuth(() => get().accessToken);

  return {
    user: null,
    accessToken: null,
    isLoading: false,
    isInitialized: false,

    setAuth: (user, accessToken) => {
      set({ user, accessToken, isInitialized: true, isLoading: false });
    },

    setAccessToken: (accessToken) => {
      set({ accessToken });
    },

    updateUser: (updatedUser) => {
      const current = get().user;
      if (current) {
        set({ user: { ...current, ...updatedUser } });
      }
    },

    clearAuth: () => {
      set({ user: null, accessToken: null, isInitialized: true, isLoading: false });
    },

    syncUserWithBackend: async (token: string) => {
      set({ accessToken: token, isLoading: true });
      try {
        const user = await userApi.getMe();
        set({ user, isInitialized: true, isLoading: false });
        return user;
      } catch (err) {
        console.error("[AuthStore] Failed to sync user with backend:", err);
        set({ isInitialized: true, isLoading: false });
        return null;
      }
    },
  };
});
