import { FC } from "react";
import { Outlet } from "react-router-dom";
import { NavRail } from "./NavRail";
import { useSocket } from "../../hooks/useSocket";
import { useNotifications } from "../../hooks/useNotifications";
import { useAuthStore } from "../../store/authStore";

export const AppLayout: FC = () => {
  // Mount the singleton socket connection hook across authenticated sessions
  useSocket();

  const user = useAuthStore((state) => state.user);
  const currentUserId = user?.id || (user as any)?._id || "";

  // Wire global dual notification system
  useNotifications(currentUserId);

  return (
    <div className="relative h-screen w-screen bg-[#0d0e15] flex select-none overflow-hidden">
      {/* 1. Subtle Ambient Background Glows */}
      <div className="absolute top-[-10%] left-[-5%] w-[450px] h-[450px] bg-gradient-to-br from-[#0066ff]/20 to-[#00b4d8]/10 rounded-full blur-[140px] pointer-events-none animate-pulse" />
      <div
        className="absolute bottom-[-10%] right-[-5%] w-[500px] h-[500px] bg-gradient-to-tr from-[#7928ca]/20 to-[#ff0080]/10 rounded-full blur-[150px] pointer-events-none animate-pulse"
        style={{ animationDelay: "2.5s" }}
      />
      <div className="absolute inset-0 opacity-[0.03] pointer-events-none bg-[radial-gradient(#ffffff_1px,transparent_1px)] [background-size:24px_24px]" />

      {/* 2. Main Full-Screen Layout (100% width and height without restrictive bounds, matching WhatsApp Web) */}
      <div className="relative z-10 w-full h-full flex overflow-hidden bg-[#171824]">
        <NavRail />
        <main className="flex-1 h-full overflow-hidden flex min-w-0">
          <Outlet />
        </main>
      </div>
    </div>
  );
};
