import { FC } from "react";
import { Avatar } from "../common/Avatar";
import { Phone, Video, Search, MoreVertical, Users } from "lucide-react";
import { IConversation } from "../../types/chat";
import { useAuthStore } from "../../store/authStore";
import { useChatStore } from "../../store/chatStore";
import { formatTime } from "../../utils/date";

interface ChatHeaderProps {
  conversation: IConversation;
  onSearchClick?: () => void;
  onHeaderClick?: () => void;
  onOpenMenu?: () => void;
}

export const ChatHeader: FC<ChatHeaderProps> = ({
  conversation,
  onSearchClick,
  onHeaderClick,
  onOpenMenu,
}) => {
  const currentUser = useAuthStore((state) => state.user);
  const onlineUsers = useChatStore((state) => state.onlineUsers);
  const userLastSeen = useChatStore((state) => state.userLastSeen);

  const isGroup = conversation.type === "group";
  const myId = currentUser?.id || (currentUser as any)?._id;

  const otherParticipant = !isGroup
    ? conversation.participants.find((p) => {
        const pId = p.id || (p as any)._id;
        return pId && pId !== myId;
      })
    : null;

  const otherId = otherParticipant ? otherParticipant.id || (otherParticipant as any)._id : null;
  const isOnline = !isGroup && otherId ? onlineUsers.has(otherId) || !!otherParticipant?.isOnline : false;

  const title = isGroup
    ? conversation.groupName || "Group Chat"
    : otherParticipant?.username || "Chat";

  const lastSeenIso = otherId ? userLastSeen[otherId] || otherParticipant?.lastSeen : undefined;

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

  return (
    <header className="h-16 shrink-0 bg-[#171824]/90 backdrop-blur-md border-b border-white/[0.04] px-6 flex items-center justify-between z-10">
      {/* Left: Avatar + Title + Real-time presence indicator */}
      <div
        onClick={onHeaderClick}
        className="flex items-center gap-3.5 min-w-0 cursor-pointer group hover:opacity-90 transition-opacity"
        title="View details"
      >
        <div className="relative">
          {isGroup ? (
            <div className="w-10 h-10 rounded-full bg-[#232533] border border-white/[0.06] flex items-center justify-center text-[#767b93] group-hover:text-white transition-colors">
              <Users className="w-5 h-5 text-[#0066ff]" />
            </div>
          ) : (
            <div className="rounded-full ring-1 ring-white/10 group-hover:ring-[#0066ff]/50 transition-all">
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

      {/* Right Action controls: Audio Call, Video Call, and Conversation Search */}
      <div className="flex items-center gap-1 sm:gap-2 text-[#767b93]">
        <button
          className="p-2 rounded-xl hover:text-[#0066ff] hover:bg-white/[0.04] transition-colors cursor-pointer"
          title="Start voice call"
          onClick={() => alert("Voice call feature coming soon!")}
        >
          <Phone className="w-4 h-4" />
        </button>
        <button
          className="p-2 rounded-xl hover:text-[#0066ff] hover:bg-white/[0.04] transition-colors cursor-pointer"
          title="Start video call"
          onClick={() => alert("Video call feature coming soon!")}
        >
          <Video className="w-4 h-4" />
        </button>
        <button
          className="p-2 rounded-xl hover:text-[#0066ff] hover:bg-white/[0.04] transition-colors cursor-pointer"
          title="Search conversation"
          onClick={onSearchClick}
        >
          <Search className="w-4 h-4" />
        </button>
        <button
          onClick={onOpenMenu || onHeaderClick}
          className="p-2 rounded-xl hover:text-[#0066ff] hover:bg-white/[0.04] transition-colors cursor-pointer flex"
          title="More options / Details"
        >
          <MoreVertical className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
};
