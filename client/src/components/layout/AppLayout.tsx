import { FC } from "react";
import { Outlet } from "react-router-dom";
import { NavigationSidebar } from "./NavigationSidebar";
import { useSocket } from "../../hooks/useSocket";

export const AppLayout: FC = () => {
  // Mount the singleton socket connection hook across authenticated sessions
  useSocket();

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-950 select-none">
      <NavigationSidebar />
      <main className="flex-1 h-full overflow-hidden flex">
        <Outlet />
      </main>
    </div>
  );
};
