import { FC, useEffect } from "react";
import { RouterProvider } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useAuth, useUser } from "@clerk/clerk-react";
import { Toaster } from "sonner";
import { appRouter } from "./routes/AppRouter";
import { useAuthStore } from "./store/authStore";
import { configureAxiosAuth } from "./api/axiosClient";
import { useServerWarmup } from "./hooks/useServerWarmup";
import { ServerWarmupModal } from "./components/common/ServerWarmupModal";
import { ConfirmationModal } from "./components/common/ConfirmationModal";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

export const App: FC = () => {
  const { isWarmingUp, elapsedSeconds, estimatedProgress } = useServerWarmup();
  const { isSignedIn, isLoaded, getToken } = useAuth();
  const { user: clerkUser } = useUser();
  const { setAuth, setAccessToken, clearAuth, syncUserWithBackend } = useAuthStore();

  // Configure Axios with Clerk getToken dynamically
  useEffect(() => {
    configureAxiosAuth(async () => {
      if (isSignedIn) {
        return await getToken();
      }
      return null;
    });
  }, [isSignedIn, getToken]);

  // Sync Clerk authentication state into Zustand authStore
  useEffect(() => {
    if (!isLoaded) return;

    if (!isSignedIn) {
      clearAuth();
      return;
    }

    let isMounted = true;

    const syncSession = async () => {
      try {
        const token = await getToken();
        if (!token) return;

        setAccessToken(token);

        // Fetch or create profile via backend /api/users/me
        const backendUser = await syncUserWithBackend(token);
        if (isMounted) {
          if (backendUser && clerkUser) {
            // Keep clerkId on the user object for infallible participant comparison
            setAuth(
              {
                ...backendUser,
                clerkId: clerkUser.id,
              },
              token
            );
          } else if (!backendUser && clerkUser) {
            // Fallback optimistic user profile from Clerk
            const email = clerkUser.primaryEmailAddress?.emailAddress || "";
            setAuth(
              {
                id: clerkUser.id,
                clerkId: clerkUser.id,
                username: clerkUser.username || clerkUser.firstName || email.split("@")[0] || "User",
                email,
                avatarUrl: clerkUser.imageUrl,
                isOnline: true,
              },
              token
            );
          }
        }
      } catch (err) {
        console.error("[App] Failed syncing auth session:", err);
      }
    };

    syncSession();

    return () => {
      isMounted = false;
    };
  }, [isSignedIn, isLoaded, clerkUser, getToken, setAuth, setAccessToken, clearAuth, syncUserWithBackend]);

  return (
    <QueryClientProvider client={queryClient}>
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: "transparent",
            border: "none",
            boxShadow: "none",
            padding: 0,
          },
        }}
      />
      <ConfirmationModal />
      <ServerWarmupModal
        isVisible={isWarmingUp}
        elapsedSeconds={elapsedSeconds}
        progressPercent={estimatedProgress}
      />
      <RouterProvider router={appRouter} />
    </QueryClientProvider>
  );
};
