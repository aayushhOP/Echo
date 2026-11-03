import { FC } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useClerk } from "@clerk/clerk-react";
import { useAuthStore } from "../../store/authStore";
import { useChatStore } from "../../store/chatStore";
import { useConfirm } from "../../store/confirmDialogStore";
import { MessageSquare, ContactRound, Users, LogOut } from "lucide-react";
import { Avatar } from "../common/Avatar";
import { cn } from "../../utils/cn";
import echoLogo from "../../assets/echo_logo_icon.png";

export const NavRail: FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { signOut } = useClerk();
  const currentUser = useAuthStore((state) => state.user);
  const clearAuth = useAuthStore((state) => state.clearAuth);
  const conversations = useChatStore((state) => state.conversations);
  const confirm = useConfirm();

  // Compute count of unread conversations (conversations with unread messages > 0)
  const unreadDirectConversationsCount = conversations.filter(
    (c) => c.type === "direct" && (c.unreadCount || 0) > 0
  ).length;

  const unreadGroupConversationsCount = conversations.filter(
    (c) => c.type === "group" && (c.unreadCount || 0) > 0
  ).length;

  const totalUnreadConversationsCount =
    unreadDirectConversationsCount + unreadGroupConversationsCount;

  const handleLogout = async () => {
    const shouldLogout = await confirm({
      title: "Log out of Echo Chat?",
      message: "You will need to sign back in to access your conversations.",
      confirmText: "Log Out",
      cancelText: "Stay Signed In",
      variant: "danger",
    });

    if (!shouldLogout) return;

    try {
      await signOut();
    } finally {
      clearAuth();
      navigate("/login");
    }
  };

  const navItems = [
    { label: "Chats", path: "/chat", icon: MessageSquare, unreadCount: totalUnreadConversationsCount },
    { label: "Contacts", path: "/contacts", icon: ContactRound, unreadCount: 0 },
    { label: "Groups", path: "/groups", icon: Users, unreadCount: unreadGroupConversationsCount },
  ];

  return (
    <aside className="w-16 h-full bg-[#1b1c27]/95 border-r border-white/[0.06] flex flex-col items-center py-4 justify-between shrink-0 select-none z-20">
      {/* Top: Brand Logo / App Monogram */}
      <div className="flex flex-col items-center gap-6 w-full">
        <Link
          to="/chat"
          className="relative group w-11 h-11 flex items-center justify-center hover:scale-105 active:scale-95 transition-transform"
          title="Echo Chat"
        >
          <img
            src={echoLogo}
            alt="Echo Logo"
            className="w-10 h-10 object-contain rounded-xl"
          />
        </Link>

        {/* Middle Navigation switches */}
        <nav className="flex flex-col gap-2.5 w-full px-2">
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
                  "w-11 h-11 flex items-center justify-center rounded-xl transition-all duration-200 mx-auto group relative cursor-pointer",
                  isActive
                    ? "bg-gradient-to-tr from-[#0052cc] to-[#0066ff] text-white shadow-lg shadow-[#0066ff]/35 scale-105"
                    : "text-[#767b93] hover:text-[#f0f2f8] hover:bg-white/[0.06] hover:scale-102"
                )}
                title={item.label}
              >
                <Icon className="w-5 h-5 stroke-[2]" />
                {isActive && (
                  <span className="absolute -left-2 w-1 h-5 bg-[#38bdf8] rounded-r-full shadow-[0_0_8px_#38bdf8]" />
                )}
                {item.unreadCount > 0 && (
                  <span
                    className={cn(
                      "absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold flex items-center justify-center text-white shadow-md animate-in zoom-in-75 duration-150 ring-2 ring-[#1b1c27]",
                      isActive
                        ? "bg-[#38bdf8] text-[#0d0e15] shadow-[#38bdf8]/40"
                        : "bg-[#0066ff] text-white shadow-[#0066ff]/40"
                    )}
                  >
                    {item.unreadCount > 99 ? "99+" : item.unreadCount}
                  </span>
                )}
                <span className="sr-only">{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Bottom: Logout button & Current user avatar with glowing online badge */}
      <div className="flex flex-col items-center gap-4 w-full px-2">
        <button
          onClick={handleLogout}
          className="w-10 h-10 rounded-xl flex items-center justify-center text-[#767b93] hover:text-rose-400 hover:bg-rose-500/10 transition-all cursor-pointer hover:scale-105 active:scale-95"
          title="Sign out"
        >
          <LogOut className="w-5 h-5" />
        </button>

        {currentUser && (
          <div
            className="relative group cursor-pointer flex items-center justify-center shrink-0"
            onClick={() => navigate("/profile")}
          >
            <div className="flex items-center justify-center rounded-full ring-2 ring-[#0066ff]/50 p-0.5 shadow-md shadow-[#0066ff]/20 group-hover:ring-[#0066ff] transition-all">
              <Avatar
                name={currentUser.username}
                avatarUrl={currentUser.avatarUrl}
                size="sm"
              />
            </div>
            {/* Glowing online indicator badge */}
            <span
              className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-emerald-500 ring-2 ring-[#1b1c27] shadow-[0_0_8px_#10b981]"
              title="Online"
            />
          </div>
        )}
      </div>
    </aside>
  );
};
