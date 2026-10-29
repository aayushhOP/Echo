import { FC } from "react";
import { Navigate, Outlet } from "react-router-dom";
import { useAuthStore } from "../store/authStore";
import { AppLoader } from "../components/common/AppLoader";

export const ProtectedRoute: FC = () => {
  const { user, accessToken, isInitialized, isLoading } = useAuthStore();

  if (!isInitialized || isLoading) {
    return <AppLoader statusText="Authenticating session..." />;
  }

  if (!user || !accessToken) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
};

export const PublicRoute: FC = () => {
  const { user, accessToken, isInitialized, isLoading } = useAuthStore();

  if (!isInitialized || isLoading) {
    return <AppLoader statusText="Loading..." />;
  }

  if (user && accessToken) {
    return <Navigate to="/chat" replace />;
  }

  return <Outlet />;
};
