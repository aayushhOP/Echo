import { create } from "zustand";
import { User } from "../types/user";
import { userApi } from "../api/userApi";

interface AuthState {
  user: User | null;
  accessToken: string | null;
  isLoading: boolean;
  isInitialized: boolean;
  setAuth: (user: User, accessToken: string) => void;
  setAccessToken: (token: string | null) => void;
  updateUser: (updatedUser: Partial<User>) => void;
  addBlockedUser: (userId: string) => void;
  removeBlockedUser: (userId: string) => void;
  clearAuth: () => void;
  syncUserWithBackend: (token: string) => Promise<User | null>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
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

  addBlockedUser: (userId: string) => {
    const current = get().user;
    if (current) {
      const existing = current.blockedUsers || [];
      if (!existing.includes(userId)) {
        set({ user: { ...current, blockedUsers: [...existing, userId] } });
      }
    }
  },

  removeBlockedUser: (userId: string) => {
    const current = get().user;
    if (current && current.blockedUsers) {
      set({
        user: {
          ...current,
          blockedUsers: current.blockedUsers.filter((id) => id !== userId),
        },
      });
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
}));
