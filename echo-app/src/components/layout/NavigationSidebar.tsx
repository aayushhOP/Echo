import { FC } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuthStore } from "../../store/authStore";
import { MessageSquare, User, LogOut, Radio } from "lucide-react";
import { Avatar } from "../common/Avatar";
import { useSocketStore } from "../../store/socketStore";

export const NavigationSidebar: FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const currentUser = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
  const isConnected = useSocketStore((state) => state.isConnected);

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  const navItems = [
    { label: "Chats", path: "/chat", icon: MessageSquare },
    { label: "Profile", path: "/profile", icon: User },
  ];

  return (
    <aside className="w-16 bg-slate-950 border-r border-slate-800 flex flex-col items-center py-4 justify-between shrink-0">
      <div className="flex flex-col items-center gap-6 w-full">
        {/* Brand Logo / Icon */}
        <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center text-white font-bold text-lg shadow-md shadow-indigo-500/20">
          E
        </div>

        {/* Navigation links */}
        <nav className="flex flex-col gap-2 w-full px-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname.startsWith(item.path);
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`w-12 h-12 rounded-xl flex items-center justify-center transition-colors mx-auto ${
                  isActive
                    ? "bg-indigo-600/20 text-indigo-400 border border-indigo-500/30"
                    : "text-slate-400 hover:text-white hover:bg-slate-900"
                }`}
                title={item.label}
              >
                <Icon className="w-5 h-5" />
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Bottom Area: Socket status dot, Avatar & Logout */}
      <div className="flex flex-col items-center gap-4">
        {/* Real-time connection badge */}
        <div
          className={`flex items-center justify-center p-1.5 rounded-full ${
            isConnected ? "text-emerald-400 bg-emerald-950/40" : "text-amber-400 bg-amber-950/40"
          }`}
          title={isConnected ? "Socket connected" : "Socket disconnected"}
        >
          <Radio className="w-3.5 h-3.5" />
        </div>

        {currentUser && (
          <Link to="/profile" title={currentUser.username}>
            <Avatar
              name={currentUser.username}
              avatarUrl={currentUser.avatarUrl}
              size="sm"
            />
          </Link>
        )}

        <button
          onClick={handleLogout}
          className="p-2 rounded-xl text-slate-400 hover:text-rose-400 hover:bg-slate-900 transition-colors cursor-pointer"
          title="Sign out"
        >
          <LogOut className="w-5 h-5" />
        </button>
      </div>
    </aside>
  );
};
