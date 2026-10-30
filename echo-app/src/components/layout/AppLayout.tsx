import { FC } from "react";
import { Outlet } from "react-router-dom";
import { NavRail } from "./NavRail";
import { useSocket } from "../../hooks/useSocket";

export const AppLayout: FC = () => {
  // Mount the singleton socket connection hook across authenticated sessions
  useSocket();

  return (
    <div className="h-screen w-screen bg-[#13141d] p-2 md:p-3 flex select-none overflow-hidden">
      <div className="flex-1 flex overflow-hidden rounded-2xl md:rounded-3xl bg-[#171824] border border-white/[0.04] shadow-2xl">
        <NavRail />
        <main className="flex-1 h-full overflow-hidden flex min-w-0">
          <Outlet />
        </main>
      </div>
    </div>
  );
};
