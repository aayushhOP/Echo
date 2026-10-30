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
    <aside className="w-full h-full flex flex-col bg-[#111622] border-r border-slate-800/70 shrink-0 select-none">
      {/* Header with Title and + New Chat button */}
      <div className="p-4 border-b border-slate-800/80 flex items-center justify-between">
        <div>
          <h1 className="text-base font-bold text-white tracking-tight">Chats</h1>
          <p className="text-[11px] text-slate-400">
            {conversations.length} conversation{conversations.length !== 1 ? "s" : ""}
          </p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white shadow-sm shadow-indigo-600/20 transition-all cursor-pointer"
          title="Start new chat"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>New Chat</span>
        </button>
      </div>

      {/* Full-width dark search container */}
      <div className="px-3 pt-3 pb-2">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search conversations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-[#181f2f] text-slate-200 placeholder-slate-500 border border-slate-700/50 rounded-lg pl-9 pr-3 py-2 text-xs focus:border-indigo-500 focus:outline-none transition-colors"
          />
        </div>
      </div>

      {/* Conversations Scroll Area */}
      <div className="flex-1 overflow-y-auto px-2 py-1 space-y-1">
        {isLoading && (
          <div className="flex flex-col items-center justify-center p-8 text-slate-400">
            <Loader2 className="w-5 h-5 animate-spin mb-2 text-indigo-400" />
            <span className="text-xs">Loading conversations...</span>
          </div>
        )}

        {!isLoading && filteredConversations.length === 0 && (
          <div className="flex flex-col items-center justify-center p-8 text-center text-slate-500">
            <MessageSquare className="w-8 h-8 mb-2 text-slate-700" />
            <p className="text-xs font-medium text-slate-400">No chats found</p>
            <p className="text-[11px] text-slate-500 mt-1 max-w-[200px]">
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
          let lastMsgSnippet = "No messages yet";
          if (lastMsg) {
            if (lastMsg.type === "image") {
              lastMsgSnippet = "📷 Photo";
            } else if (lastMsg.type === "file") {
              lastMsgSnippet = `📎 ${lastMsg.fileName || "Attachment"}`;
            } else {
              lastMsgSnippet = lastMsg.content;
            }
          }

          const lastMsgTime = lastMsg?.createdAt ? formatTime(lastMsg.createdAt) : "";
          const unreadCount = conv.unreadCount || 0;

          return (
            <div
              key={conv._id}
              onClick={() => setActiveConversationId(conv._id)}
              className={cn(
                "p-3 rounded-xl cursor-pointer transition-all flex items-center gap-3 relative",
                isSelected
                  ? "bg-[#1d263b] text-white border-l-2 border-indigo-500 shadow-sm"
                  : "text-slate-300 hover:bg-[#182030]/60 hover:text-white"
              )}
            >
              {/* Avatar + Live Online Indicator */}
              <div className="relative shrink-0">
                {isGroup ? (
                  <div className="w-10 h-10 rounded-full bg-slate-800 border border-slate-700/60 flex items-center justify-center text-slate-300">
                    <Users className="w-5 h-5 text-indigo-400" />
                  </div>
                ) : (
                  <Avatar
                    name={title}
                    avatarUrl={otherParticipant?.avatarUrl}
                    size="md"
                  />
                )}

                {!isGroup && isParticipantOnline && (
                  <span
                    className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-[#111622]"
                    title="Online"
                  />
                )}
              </div>

              {/* Title & snippet */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-1 mb-0.5">
                  <h3 className="text-xs font-semibold truncate text-white">
                    {title}
                  </h3>
                  {lastMsgTime && (
                    <span className="text-[10px] text-slate-500 shrink-0">
                      {lastMsgTime}
                    </span>
                  )}
                </div>

                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs text-slate-400 truncate">
                    {lastMsgSnippet}
                  </p>

                  {/* Unread count pill */}
                  {unreadCount > 0 && (
                    <span className="bg-indigo-600 text-white rounded-full text-[11px] font-bold px-2 py-0.5 shrink-0 shadow-sm shadow-indigo-600/30">
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
