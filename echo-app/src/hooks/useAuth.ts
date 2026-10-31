import { useAuth as useClerkAuth, useUser as useClerkUser } from "@clerk/clerk-react";
import { useAuthStore } from "../store/authStore";

export const useAuth = () => {
  const clerkAuth = useClerkAuth();
  const clerkUser = useClerkUser();

  const user = useAuthStore((state) => state.user);
  const accessToken = useAuthStore((state) => state.accessToken);
  const isLoading = useAuthStore((state) => state.isLoading) || !clerkAuth.isLoaded;
  const isInitialized = useAuthStore((state) => state.isInitialized) && clerkAuth.isLoaded;
  const setAuth = useAuthStore((state) => state.setAuth);
  const updateUser = useAuthStore((state) => state.updateUser);

  const logout = async () => {
    await clerkAuth.signOut();
    useAuthStore.getState().clearAuth();
  };

  return {
    user,
    accessToken,
    isAuthenticated: !!clerkAuth.isSignedIn,
    isLoading,
    isInitialized,
    setAuth,
    logout,
    updateUser,
    clerkUser: clerkUser.user,
    getToken: clerkAuth.getToken,
    userId: clerkAuth.userId,
  };
};
