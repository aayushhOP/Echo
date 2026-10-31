import { FC } from "react";
import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "@clerk/clerk-react";
import { AppLoader } from "../components/common/AppLoader";

export const ProtectedRoute: FC = () => {
  const { isLoaded, isSignedIn } = useAuth();

  if (!isLoaded) {
    return <AppLoader statusText="Authenticating session..." />;
  }

  if (!isSignedIn) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
};

export const PublicRoute: FC = () => {
  const { isLoaded, isSignedIn } = useAuth();

  if (!isLoaded) {
    return <AppLoader statusText="Loading..." />;
  }

  if (isSignedIn) {
    return <Navigate to="/chat" replace />;
  }

  return <Outlet />;
};
