import { FC } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuthStore } from "../../store/authStore";
import { MessageSquare, Users, Settings, LogOut } from "lucide-react";
import { Avatar } from "../common/Avatar";
import { cn } from "../../utils/cn";

export const NavRail: FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const currentUser = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  const navItems = [
    { label: "Chats", path: "/chat", icon: MessageSquare },
    { label: "Contacts", path: "/contacts", icon: Users },
    { label: "Settings", path: "/profile", icon: Settings },
  ];

  return (
    <aside className="w-16 h-full bg-[#0e121b] border-r border-slate-800/80 flex flex-col items-center py-4 justify-between shrink-0 select-none z-20">
      {/* Top: Brand Logo / App Monogram */}
      <div className="flex flex-col items-center gap-6 w-full">
        <Link
          to="/chat"
          className="w-11 h-11 rounded-2xl bg-gradient-to-br from-indigo-500 to-indigo-700 flex items-center justify-center text-white font-extrabold text-xl shadow-lg shadow-indigo-600/30 hover:scale-105 transition-transform"
          title="Echo Chat"
        >
          E
        </Link>

        {/* Middle Navigation switches */}
        <nav className="flex flex-col gap-2 w-full px-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive =
              item.path === "/chat"
                ? location.pathname === "/chat" || location.pathname === "/"
                : location.pathname.startsWith(item.path);

            return (
              <Link
                key={item.path}
                to={item.path}
                className={cn(
                  "w-12 h-12 flex items-center justify-center rounded-xl transition-all duration-150 mx-auto group relative cursor-pointer",
                  isActive
                    ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/25"
                    : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
                )}
                title={item.label}
              >
                <Icon className="w-5 h-5 stroke-[2]" />
                {/* Active indicator dot or tooltip */}
                <span className="sr-only">{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Bottom: Logout button & Current user avatar with online badge */}
      <div className="flex flex-col items-center gap-4 w-full px-2">
        <button
          onClick={handleLogout}
          className="w-10 h-10 rounded-xl flex items-center justify-center text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
          title="Sign out"
        >
          <LogOut className="w-5 h-5" />
        </button>

        {currentUser && (
          <div className="relative group cursor-pointer" onClick={() => navigate("/profile")}>
            <Avatar
              name={currentUser.username}
              avatarUrl={currentUser.avatarUrl}
              size="sm"
            />
            {/* Absolute online indicator badge */}
            <span
              className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-emerald-500 ring-2 ring-[#0e121b]"
              title="Online"
            />
          </div>
        )}
      </div>
    </aside>
  );
};
