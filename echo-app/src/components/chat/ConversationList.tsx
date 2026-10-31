import { FC, useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { messageApi } from "../../api/messageApi";
import { useChatStore } from "../../store/chatStore";
import { useAuthStore } from "../../store/authStore";
import { Avatar } from "../common/Avatar";
import { CreateChatModal } from "./CreateChatModal";
import { formatTime } from "../../utils/date";
import { Plus, Users, MessageSquare, Loader2, Search } from "lucide-react";
import { cn } from "../../utils/cn";

export const ConversationList: FC = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const currentUser = useAuthStore((state) => state.user);
  const {
    conversations,
    setConversations,
    activeConversationId,
    setActiveConversationId,
    onlineUsers,
  } = useChatStore();

  const { isLoading } = useQuery({
    queryKey: ["conversations"],
    queryFn: async () => {
      const data = await messageApi.getConversations();
      setConversations(data);
      return data;
    },
    staleTime: 1000 * 30, // 30s
  });

  // Filter conversations by search term
  const filteredConversations = useMemo(() => {
    const myId = currentUser?.id || (currentUser as any)?._id;
    const query = searchQuery.toLowerCase().trim();

    return conversations.filter((conv) => {
      if (!query) return true;

      const isGroup = conv.type === "group";
      if (isGroup) {
        return conv.groupName?.toLowerCase().includes(query);
      }

      const otherParticipant = conv.participants.find((p) => {
        const pId = p.id || (p as any)._id;
        return pId && pId !== myId;
      });

      return otherParticipant?.username.toLowerCase().includes(query);
    });
  }, [conversations, searchQuery, currentUser]);

  return (
    <aside className="w-full h-full flex flex-col bg-[#161722] border-r border-white/[0.04] shrink-0 select-none">
      {/* Header with Title and + New Chat button */}
      <div className="p-4 border-b border-white/[0.04] flex items-center justify-between">
        <div>
          <h1 className="text-base font-bold text-white tracking-tight">Chats</h1>
          <p className="text-[11px] text-[#767b93]">
            {conversations.length} conversation{conversations.length !== 1 ? "s" : ""}
          </p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-[#0066ff] hover:bg-[#005ce6] text-xs font-semibold text-white shadow-md shadow-[#0066ff]/25 transition-all cursor-pointer"
          title="Start new chat"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>New Chat</span>
        </button>
      </div>

      {/* Full-width dark search container */}
      <div className="px-3 pt-3 pb-2">
        <div className="relative">
          <Search className="w-4 h-4 text-[#505469] absolute left-3 top-3" />
          <input
            type="text"
            placeholder="Search conversations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-[#13141d] text-white placeholder-[#505469] border border-transparent focus:border-white/[0.06] rounded-xl pl-9 pr-3 py-2.5 text-xs focus:outline-none transition-colors"
          />
        </div>
      </div>

      {/* Conversations Scroll Area */}
      <div className="flex-1 overflow-y-auto px-2.5 py-1.5 space-y-1">
        {isLoading && (
          <div className="flex flex-col items-center justify-center p-8 text-[#767b93]">
            <Loader2 className="w-5 h-5 animate-spin mb-2 text-[#0066ff]" />
            <span className="text-xs">Loading conversations...</span>
          </div>
        )}

        {!isLoading && filteredConversations.length === 0 && (
          <div className="flex flex-col items-center justify-center p-8 text-center text-[#505469]">
            <MessageSquare className="w-8 h-8 mb-2 text-[#505469]/50" />
            <p className="text-xs font-medium text-[#767b93]">No chats found</p>
            <p className="text-[11px] text-[#505469] mt-1 max-w-[200px]">
              {searchQuery ? "Try a different search keyword." : "Tap New Chat to start messaging."}
            </p>
          </div>
        )}

        {filteredConversations.map((conv) => {
          const isSelected = conv._id === activeConversationId;
          const isGroup = conv.type === "group";
          const myId = currentUser?.id || (currentUser as any)?._id;

          const otherParticipant = !isGroup
            ? conv.participants.find((p) => {
                const pId = p.id || (p as any)._id;
                return pId && pId !== myId;
              })
            : null;

          const title = isGroup
            ? conv.groupName || "Group Chat"
            : otherParticipant?.username || "Direct Chat";

          const otherId = otherParticipant ? otherParticipant.id || (otherParticipant as any)._id : null;
          const isParticipantOnline =
            !isGroup && otherId
              ? onlineUsers.has(otherId) || !!otherParticipant?.isOnline
              : false;

          const lastMsg = conv.lastMessage;
          const senderId =
            typeof lastMsg?.senderId === "string"
              ? lastMsg.senderId
              : (lastMsg?.senderId as any)?._id || (lastMsg?.senderId as any)?.id;
          const isSentByMe = Boolean(myId && senderId && myId === senderId);

          let lastMsgSnippet = "No messages yet";
          if (lastMsg) {
            let bodyText = "";
            if (lastMsg.type === "image") {
              bodyText = "📷 Photo";
            } else if (lastMsg.type === "file") {
              bodyText = `📎 ${lastMsg.fileName || "Attachment"}`;
            } else {
              bodyText = lastMsg.content;
            }

            // WhatsApp Desktop convention: prefix with "You: " if message is from the logged in user
            lastMsgSnippet = isSentByMe ? `You: ${bodyText}` : bodyText;
          }

          const lastMsgTime = lastMsg?.createdAt ? formatTime(lastMsg.createdAt) : "";
          const unreadCount = conv.unreadCount || 0;
          const hasUnread = unreadCount > 0 && !isSelected;

          return (
            <div
              key={conv._id}
              onClick={() => setActiveConversationId(conv._id)}
              className={cn(
                "flex items-center gap-3.5 p-3.5 rounded-2xl cursor-pointer transition-all relative",
                isSelected
                  ? "bg-[#0066ff] text-white shadow-md shadow-[#0066ff]/25"
                  : hasUnread
                  ? "bg-[#0066ff]/10 hover:bg-[#0066ff]/15 text-[#f0f2f8] border border-[#0066ff]/20"
                  : "hover:bg-white/[0.02] text-[#f0f2f8]"
              )}
            >
              {/* Avatar + Live Online Indicator */}
              <div className="relative shrink-0">
                {isGroup ? (
                  <div
                    className={cn(
                      "w-11 h-11 rounded-full flex items-center justify-center",
                      isSelected
                        ? "bg-white/20 text-white ring-2 ring-white/30"
                        : "bg-[#232533] text-[#767b93] ring-1 ring-white/10"
                    )}
                  >
                    <Users className="w-5 h-5" />
                  </div>
                ) : (
                  <div
                    className={cn(
                      "rounded-full",
                      isSelected
                        ? "ring-2 ring-white/30"
                        : hasUnread
                        ? "ring-2 ring-[#0066ff]/60"
                        : "ring-1 ring-white/10"
                    )}
                  >
                    <Avatar
                      name={title}
                      avatarUrl={otherParticipant?.avatarUrl}
                      size="md"
                    />
                  </div>
                )}

                {!isGroup && isParticipantOnline && (
                  <span
                    className={cn(
                      "absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-400",
                      isSelected ? "ring-2 ring-[#0066ff]" : "ring-2 ring-[#161722]"
                    )}
                    title="Online"
                  />
                )}
              </div>

              {/* Title & snippet */}
              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-baseline mb-0.5">
                  <span
                    className={cn(
                      "text-sm truncate",
                      isSelected
                        ? "font-semibold text-white"
                        : hasUnread
                        ? "font-bold text-white"
                        : "font-semibold text-[#f0f2f8]"
                    )}
                  >
                    {title}
                  </span>
                  {lastMsgTime && (
                    <span
                      className={cn(
                        "text-[11px] shrink-0",
                        isSelected
                          ? "text-white/80"
                          : hasUnread
                          ? "text-[#38bdf8] font-semibold"
                          : "text-[#767b93]"
                      )}
                    >
                      {lastMsgTime}
                    </span>
                  )}
                </div>

                <div className="flex items-center justify-between gap-2">
                  <p
                    className={cn(
                      "text-xs truncate",
                      isSelected
                        ? "text-white/90"
                        : hasUnread
                        ? "text-slate-100 font-medium"
                        : "text-[#767b93]"
                    )}
                  >
                    {lastMsgSnippet}
                  </p>

                  {/* Unread count badge (vanishes instantly when conversation is active) */}
                  {hasUnread && (
                    <span
                      className="rounded-full text-[11px] font-bold px-2 py-0.5 shrink-0 bg-[#0066ff] text-white shadow-sm shadow-[#0066ff]/40 animate-in fade-in zoom-in-95 duration-150"
                    >
                      {unreadCount}
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* New conversation modal */}
      <CreateChatModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />
    </aside>
  );
};
