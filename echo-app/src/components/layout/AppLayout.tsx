import { FC } from "react";
import { Outlet } from "react-router-dom";
import { NavRail } from "./NavRail";
import { useSocket } from "../../hooks/useSocket";

export const AppLayout: FC = () => {
  // Mount the singleton socket connection hook across authenticated sessions
  useSocket();

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#0b0e14] text-slate-100 select-none">
      <NavRail />
      <main className="flex-1 h-full overflow-hidden flex min-w-0">
        <Outlet />
      </main>
    </div>
  );
};
