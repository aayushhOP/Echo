import { FC, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { messageApi } from "../../api/messageApi";
import { useChatStore } from "../../store/chatStore";
import { useAuthStore } from "../../store/authStore";
import { Avatar } from "../common/Avatar";
import { NewConversationModal } from "./NewConversationModal";
import { formatTime } from "../../utils/date";
import { Plus, Users, MessageSquare, Loader2 } from "lucide-react";

export const ConversationList: FC = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
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

  return (
    <div className="w-full h-full flex flex-col bg-slate-900 border-r border-slate-800">
      {/* Top Header */}
      <div className="p-4 border-b border-slate-800 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-white tracking-tight">Chats</h1>
          <p className="text-xs text-slate-400">
            {conversations.length} conversation{conversations.length !== 1 ? "s" : ""}
          </p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="p-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white transition-colors cursor-pointer shadow-sm"
          title="New conversation"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>

      {/* Conversations Scroll Area */}
      <div className="flex-1 overflow-y-auto divide-y divide-slate-800/40">
        {isLoading && (
          <div className="flex flex-col items-center justify-center p-8 text-slate-400">
            <Loader2 className="w-6 h-6 animate-spin mb-2 text-indigo-400" />
            <span className="text-xs">Loading conversations...</span>
          </div>
        )}

        {!isLoading && conversations.length === 0 && (
          <div className="flex flex-col items-center justify-center p-8 text-center text-slate-400">
            <MessageSquare className="w-10 h-10 mb-2 text-slate-600" />
            <p className="text-sm font-medium text-slate-300">No chats yet</p>
            <p className="text-xs text-slate-500 mt-1 max-w-[200px]">
              Tap the + button to search users and start a chat.
            </p>
          </div>
        )}

        {conversations.map((conv) => {
          const isSelected = conv._id === activeConversationId;
          const isGroup = conv.type === "group";

          // Find other participant for direct chat
          const otherParticipant = !isGroup
            ? conv.participants.find((p) => p.id !== currentUser?.id)
            : null;

          const title = isGroup
            ? conv.groupName || "Group Chat"
            : otherParticipant?.username || "Direct Chat";

          // Presence check for direct chat: either stored isOnline or dynamic onlineUsers set
          const isParticipantOnline =
            !isGroup && otherParticipant
              ? onlineUsers.has(otherParticipant.id) || !!otherParticipant.isOnline
              : false;

          const lastMsg = conv.lastMessage;
          const lastMsgText = lastMsg ? lastMsg.content : "No messages yet";
          const lastMsgTime = lastMsg ? formatTime(lastMsg.createdAt) : "";

          return (
            <div
              key={conv._id}
              onClick={() => setActiveConversationId(conv._id)}
              className={`p-3.5 flex items-center gap-3 cursor-pointer transition-colors ${
                isSelected
                  ? "bg-slate-800/90 border-l-4 border-indigo-500"
                  : "hover:bg-slate-800/50"
              }`}
            >
              {isGroup ? (
                <div className="w-10 h-10 rounded-full bg-indigo-950/80 border border-indigo-700/60 flex items-center justify-center text-indigo-300 shrink-0">
                  <Users className="w-5 h-5" />
                </div>
              ) : (
                <Avatar
                  name={title}
                  avatarUrl={otherParticipant?.avatarUrl}
                  isOnline={isParticipantOnline}
                  showPresence
                  size="md"
                />
              )}

              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-0.5">
                  <h3 className="text-sm font-semibold text-white truncate">{title}</h3>
                  {lastMsgTime && (
                    <span className="text-[11px] text-slate-400 shrink-0 ml-2">
                      {lastMsgTime}
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-400 truncate">{lastMsgText}</p>
              </div>

              {conv.unreadCount && conv.unreadCount > 0 ? (
                <span className="w-5 h-5 rounded-full bg-indigo-600 text-white text-[11px] font-bold flex items-center justify-center shrink-0">
                  {conv.unreadCount}
                </span>
              ) : null}
            </div>
          );
        })}
      </div>

      <NewConversationModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />
    </div>
  );
};
