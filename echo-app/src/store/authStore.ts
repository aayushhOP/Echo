import { create } from "zustand";
import { User } from "../types/user";
import { authApi } from "../api/authApi";
import { configureAxiosAuth } from "../api/axiosClient";

interface AuthState {
  user: User | null;
  accessToken: string | null;
  isLoading: boolean;
  isInitialized: boolean;
  setAuth: (user: User, accessToken: string) => void;
  setAccessToken: (token: string | null) => void;
  updateUser: (updatedUser: Partial<User>) => void;
  logout: () => Promise<void>;
  initializeAuth: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => {
  // Wire axios auth helper to authStore state
  configureAxiosAuth(
    () => get().accessToken,
    (token) => {
      set({ accessToken: token });
      if (!token) {
        set({ user: null });
      }
    }
  );

  return {
    user: null,
    accessToken: null,
    isLoading: false,
    isInitialized: false,

    setAuth: (user, accessToken) => {
      set({ user, accessToken });
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

    logout: async () => {
      try {
        await authApi.logout();
      } catch (err) {
        // Continue clearing state even if server logout errored
        console.error("Logout error", err);
      } finally {
        set({ user: null, accessToken: null });
      }
    },

    initializeAuth: async () => {
      set({ isLoading: true });
      try {
        // Try to obtain a fresh access token from httpOnly refresh cookie with a fallback timeout
        const refreshPromise = authApi.refresh();
        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("Auth initialization timed out")), 5000)
        );

        const refreshData = await Promise.race([refreshPromise, timeoutPromise]);
        set({ accessToken: refreshData.accessToken });
        const user = refreshData.user || (await authApi.me());
        set({ user, isInitialized: true, isLoading: false });
      } catch {
        // Not authenticated or timed out
        set({ user: null, accessToken: null, isInitialized: true, isLoading: false });
      }
    },
  };
});
