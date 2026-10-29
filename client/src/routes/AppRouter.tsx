import { createBrowserRouter, Navigate } from "react-router-dom";
import { LoginPage } from "../pages/LoginPage";
import { RegisterPage } from "../pages/RegisterPage";
import { ChatPage } from "../pages/ChatPage";
import { ProfilePage } from "../pages/ProfilePage";
import { AppLayout } from "../components/layout/AppLayout";
import { ProtectedRoute, PublicRoute } from "./RouteGuards";

export const appRouter = createBrowserRouter([
  // Public routes (login, register)
  {
    element: <PublicRoute />,
    children: [
      {
        path: "/login",
        element: <LoginPage />,
      },
      {
        path: "/register",
        element: <RegisterPage />,
      },
    ],
  },

  // Protected routes (chat, profile) inside AppLayout
  {
    element: <ProtectedRoute />,
    children: [
      {
        element: <AppLayout />,
        children: [
          {
            path: "/chat",
            element: <ChatPage />,
          },
          {
            path: "/profile",
            element: <ProfilePage />,
          },
        ],
      },
    ],
  },

  // Fallback redirects
  {
    path: "/",
    element: <Navigate to="/chat" replace />,
  },
  {
    path: "*",
    element: <Navigate to="/chat" replace />,
  },
]);
