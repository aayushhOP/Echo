import { FC, useState, useRef, useEffect } from "react";
import { Avatar } from "../common/Avatar";
import { Phone, Video, Search, MoreVertical, Users, CheckSquare, X, Ban, Trash2 } from "lucide-react";
import { IConversation } from "../../types/chat";
import { useAuthStore } from "../../store/authStore";
import { useChatStore } from "../../store/chatStore";
import { formatTime } from "../../utils/date";
import { getOtherParticipant } from "../../utils/chatUtils";

interface ChatHeaderProps {
  conversation: IConversation;
  onSearchClick?: () => void;
  onHeaderClick?: () => void;
  onOpenMenu?: () => void;
  onBlockUser?: () => void;
  onDeleteChat?: () => void;
}

export const ChatHeader: FC<ChatHeaderProps> = ({
  conversation,
  onSearchClick,
  onHeaderClick,
  onBlockUser,
  onDeleteChat,
}) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const currentUser = useAuthStore((state) => state.user);
  const onlineUsers = useChatStore((state) => state.onlineUsers);
  const userLastSeen = useChatStore((state) => state.userLastSeen);
  const {
    setActiveConversationId,
    setContactDrawerOpen,
    isContactDrawerOpen,
    toggleSearch,
    enterSelectionMode,
  } = useChatStore();

  // Close menu on outside click
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsMenuOpen(false);
      }
    };
    if (isMenuOpen) {
      document.addEventListener("mousedown", handleOutsideClick);
    }
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [isMenuOpen]);

  const isGroup = conversation.type === "group";
  const blockedUsers = currentUser?.blockedUsers || [];

  const otherParticipant = !isGroup
    ? getOtherParticipant(conversation.participants, currentUser)
    : null;

  const otherId = otherParticipant ? otherParticipant.id || (otherParticipant as any)._id : null;
  const isBlockedByMe = otherId ? blockedUsers.includes(otherId) : false;

  const isOnline =
    !isGroup && otherId && !isBlockedByMe
      ? onlineUsers.has(otherId) || !!otherParticipant?.isOnline
      : false;

  const title = isGroup
    ? conversation.groupName || "Group Chat"
    : otherParticipant?.username || "Chat";

  const lastSeenIso =
    otherId && !isBlockedByMe
      ? userLastSeen[otherId] || otherParticipant?.lastSeen
      : undefined;

  let subtitle = "";
  if (isGroup) {
    subtitle = `${conversation.participants.length} members`;
  } else if (isOnline) {
    subtitle = "Active now";
  } else if (lastSeenIso) {
    subtitle = `Last seen ${formatTime(lastSeenIso)}`;
  } else {
    subtitle = "Offline";
  }

  const handleProfileClick = () => {
    if (onHeaderClick) {
      onHeaderClick();
    } else {
      setContactDrawerOpen(!isContactDrawerOpen);
    }
  };

  return (
    <header className="h-16 shrink-0 bg-[#171824]/90 backdrop-blur-md border-b border-white/[0.04] px-6 flex items-center justify-between z-20 relative">
      {/* 1. Clickable Header Profile -> Opens Contact Info Drawer */}
      <div
        onClick={handleProfileClick}
        className="flex items-center gap-3.5 min-w-0 cursor-pointer group p-1 rounded-xl hover:bg-white/[0.03] transition-colors"
        title="View details"
      >
        <div className="relative">
          {isGroup ? (
            <div className="w-10 h-10 rounded-full bg-[#232533] border border-white/[0.06] flex items-center justify-center text-[#767b93] group-hover:text-white transition-colors">
              <Users className="w-5 h-5 text-[#0066ff]" />
            </div>
          ) : (
            <div className="rounded-full ring-1 ring-white/10 group-hover:ring-[#0066ff]/50 transition-all flex items-center justify-center">
              <Avatar
                name={title}
                avatarUrl={otherParticipant?.avatarUrl}
                size="md"
              />
            </div>
          )}

          {!isGroup && isOnline && (
            <span
              className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-emerald-500 ring-2 ring-[#171824]"
              title="Active now"
            />
          )}
        </div>

        <div className="flex flex-col min-w-0">
          <h2 className="text-sm font-semibold text-white truncate group-hover:text-[#0066ff] transition-colors">
            {title}
          </h2>
          <div className="flex items-center gap-1.5 text-xs">
            {!isGroup && isOnline && (
              <span className="w-1.5 h-1.5 rounded-full bg-[#0066ff] animate-pulse" />
            )}
            <span className={isOnline ? "text-[#0066ff] font-medium" : "text-[#767b93]"}>
              {subtitle}
            </span>
          </div>
        </div>
      </div>

      {/* Right Action controls: Call, Search, and Three-Dots Menu */}
      <div className="flex items-center gap-1 sm:gap-2 text-[#767b93]">
        <button
          type="button"
          className="p-2 rounded-xl hover:text-[#0066ff] hover:bg-white/[0.04] transition-colors cursor-pointer"
          title="Start voice call"
          onClick={() => alert("Voice call feature coming soon!")}
        >
          <Phone className="w-4 h-4" />
        </button>
        <button
          type="button"
          className="p-2 rounded-xl hover:text-[#0066ff] hover:bg-white/[0.04] transition-colors cursor-pointer"
          title="Start video call"
          onClick={() => alert("Video call feature coming soon!")}
        >
          <Video className="w-4 h-4" />
        </button>
        <button
          type="button"
          className="p-2 rounded-xl hover:text-[#0066ff] hover:bg-white/[0.04] transition-colors cursor-pointer"
          title="Search conversation"
          onClick={onSearchClick || toggleSearch}
        >
          <Search className="w-4 h-4" />
        </button>

        {/* 2. Three-Dots Menu Trigger */}
        <div className="relative" ref={menuRef}>
          <button
            type="button"
            onClick={() => setIsMenuOpen((prev) => !prev)}
            className={`p-2 rounded-xl hover:text-[#0066ff] hover:bg-white/[0.04] transition-all cursor-pointer flex ${
              isMenuOpen ? "bg-white/[0.08] text-white" : ""
            }`}
            title="Chat options"
            aria-label="Chat options"
          >
            <MoreVertical className="w-4 h-4" />
          </button>

          {/* 3. Action Dropdown Menu */}
          {isMenuOpen && (
            <div className="absolute right-0 mt-2 w-52 rounded-xl bg-[#171824] border border-white/[0.08] shadow-2xl py-1.5 z-50 animate-in fade-in zoom-in-95 duration-150">
              {/* Search messages */}
              <button
                type="button"
                onClick={() => {
                  setIsMenuOpen(false);
                  toggleSearch();
                }}
                className="w-full flex items-center gap-2.5 px-3.5 py-2 text-xs text-slate-300 hover:text-white hover:bg-white/[0.05] transition-colors cursor-pointer text-left"
              >
                <Search size={15} className="text-slate-400" />
                <span>Search messages</span>
              </button>

              {/* Select messages */}
              <button
                type="button"
                onClick={() => {
                  setIsMenuOpen(false);
                  enterSelectionMode();
                }}
                className="w-full flex items-center gap-2.5 px-3.5 py-2 text-xs text-slate-300 hover:text-white hover:bg-white/[0.05] transition-colors cursor-pointer text-left"
              >
                <CheckSquare size={15} className="text-slate-400" />
                <span>Select messages</span>
              </button>

              {/* Close chat panel */}
              <button
                type="button"
                onClick={() => {
                  setIsMenuOpen(false);
                  setActiveConversationId(null);
                }}
                className="w-full flex items-center gap-2.5 px-3.5 py-2 text-xs text-slate-300 hover:text-white hover:bg-white/[0.05] transition-colors cursor-pointer text-left"
              >
                <X size={15} className="text-slate-400" />
                <span>Close chat</span>
              </button>

              <div className="h-px bg-white/[0.06] my-1" />

              {/* Block / Unblock Contact (Direct chats only) */}
              {!isGroup && onBlockUser && (
                <button
                  type="button"
                  onClick={() => {
                    setIsMenuOpen(false);
                    onBlockUser();
                  }}
                  className="w-full flex items-center gap-2.5 px-3.5 py-2 text-xs text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer text-left"
                >
                  <Ban size={15} />
                  <span>{isBlockedByMe ? "Unblock Contact" : "Block Contact"}</span>
                </button>
              )}

              {/* Delete Chat */}
              <button
                type="button"
                onClick={() => {
                  setIsMenuOpen(false);
                  if (onDeleteChat) {
                    onDeleteChat();
                  }
                }}
                className="w-full flex items-center gap-2.5 px-3.5 py-2 text-xs text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer text-left"
              >
                <Trash2 size={15} />
                <span>Delete Chat</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
