import { createBrowserRouter, Navigate } from "react-router-dom";
import { LoginPage } from "../pages/LoginPage";
import { RegisterPage } from "../pages/RegisterPage";
import { ChatPage } from "../pages/ChatPage";
import { ProfilePage } from "../pages/ProfilePage";
import { SettingsPage } from "../pages/SettingsPage";
import { ContactsPage } from "../pages/ContactsPage";
import { GroupsPage } from "../pages/GroupsPage";
import { InvitePage } from "../pages/InvitePage";
import { AppLayout } from "../components/layout/AppLayout";
import { ProtectedRoute, PublicRoute } from "./RouteGuards";

export const appRouter = createBrowserRouter([
  // Public routes (login, register with wildcard sub-routes for Clerk flows)
  {
    element: <PublicRoute />,
    children: [
      {
        path: "/login/*",
        element: <LoginPage />,
      },
      {
        path: "/register/*",
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
            path: "/contacts",
            element: <ContactsPage />,
          },
          {
            path: "/groups",
            element: <GroupsPage />,
          },
          {
            path: "/profile",
            element: <ProfilePage />,
          },
          {
            path: "/settings",
            element: <SettingsPage />,
          },
          {
            path: "/invite/:token",
            element: <InvitePage />,
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
