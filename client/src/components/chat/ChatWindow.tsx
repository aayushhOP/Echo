import { FC, useEffect, useRef, useState, UIEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { messageApi } from "../../api/messageApi";
import { useChatStore } from "../../store/chatStore";
import { useAuthStore } from "../../store/authStore";
import { useSocket } from "../../hooks/useSocket";
import { MessageBubble } from "./MessageBubble";
import { MessageInput } from "./MessageInput";
import { TypingIndicator } from "./TypingIndicator";
import { Avatar } from "../common/Avatar";
import { Message } from "../../types/message";
import { Users, Loader2, ArrowLeft, MessageSquareOff } from "lucide-react";

export const ChatWindow: FC = () => {
  const currentUser = useAuthStore((state) => state.user);
  const {
    activeConversationId,
    setActiveConversationId,
    conversations,
    messages,
    setMessages,
    prependMessages,
    addOptimisticMessage,
    reconcileMessage,
    typingUsers,
    onlineUsers,
  } = useChatStore();

  const { sendMessage, markAsRead } = useSocket();

  const messageListRef = useRef<HTMLDivElement>(null);
  const [hasMore, setHasMore] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  const activeConv = conversations.find((c) => c._id === activeConversationId);
  const currentMessages = activeConversationId ? messages[activeConversationId] || [] : [];

  // Initial fetch for the conversation messages
  const { isLoading: isInitialLoading } = useQuery({
    queryKey: ["messages", activeConversationId],
    queryFn: async () => {
      if (!activeConversationId) return [];
      const data = await messageApi.getMessages(activeConversationId, { limit: 30 });
      setMessages(activeConversationId, data);
      setHasMore(data.length >= 30);
      return data;
    },
    enabled: !!activeConversationId,
    staleTime: 1000 * 10,
  });

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (messageListRef.current) {
      messageListRef.current.scrollTop = messageListRef.current.scrollHeight;
    }
  }, [currentMessages.length]);

  // Mark unread messages as read
  useEffect(() => {
    if (!activeConversationId || !currentUser || currentMessages.length === 0) return;

    const unreadMessageIds = currentMessages
      .filter((m) => {
        const senderId = typeof m.senderId === "string" ? m.senderId : m.senderId.id;
        return senderId !== currentUser.id && !m.readBy?.includes(currentUser.id);
      })
      .map((m) => m._id);

    if (unreadMessageIds.length > 0) {
      markAsRead(activeConversationId, unreadMessageIds);
    }
  }, [activeConversationId, currentMessages, currentUser?.id]);

  // Infinite scroll upward to load older messages
  const handleScroll = async (e: UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    if (el.scrollTop === 0 && hasMore && !isLoadingMore && activeConversationId) {
      const oldestMessage = currentMessages[0];
      if (!oldestMessage) return;

      setIsLoadingMore(true);
      const prevHeight = el.scrollHeight;

      try {
        const older = await messageApi.getMessages(activeConversationId, {
          before: oldestMessage.createdAt,
          limit: 30,
        });

        if (older.length < 30) {
          setHasMore(false);
        }

        prependMessages(activeConversationId, older);

        // Preserve scroll position
        requestAnimationFrame(() => {
          if (messageListRef.current) {
            messageListRef.current.scrollTop = messageListRef.current.scrollHeight - prevHeight;
          }
        });
      } catch (err) {
        console.error("Failed to load older messages", err);
      } finally {
        setIsLoadingMore(false);
      }
    }
  };

  // Optimistic message send
  const handleSendMessage = (content: string) => {
    if (!activeConversationId || !currentUser) return;

    const tempId = `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const optimisticMessage: Message = {
      _id: tempId,
      conversationId: activeConversationId,
      senderId: {
        id: currentUser.id,
        username: currentUser.username,
        email: currentUser.email,
        avatarUrl: currentUser.avatarUrl,
        isOnline: true,
      },
      content,
      type: "text",
      readBy: [currentUser.id],
      status: "pending",
      createdAt: new Date().toISOString(),
    };

    // Render immediately in pending state
    addOptimisticMessage(optimisticMessage);

    // Emit through socket with ack reconciliation fallback
    sendMessage(activeConversationId, content, "text", (ack) => {
      if (ack?.success && ack.message) {
        reconcileMessage(tempId, ack.message);
      }
    });
  };

  // If no conversation selected
  if (!activeConversationId || !activeConv) {
    return (
      <div className="hidden md:flex flex-1 flex-col items-center justify-center bg-slate-950 p-8 text-center">
        <div className="w-16 h-16 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-500 mb-4 shadow-inner">
          <MessageSquareOff className="w-8 h-8" />
        </div>
        <h2 className="text-lg font-semibold text-white mb-1">No Chat Selected</h2>
        <p className="text-sm text-slate-400 max-w-sm">
          Select a conversation from the sidebar or click the “+” button to start a new chat.
        </p>
      </div>
    );
  }

  const isGroup = activeConv.type === "group";
  const otherParticipant = !isGroup
    ? activeConv.participants.find((p) => p.id !== currentUser?.id)
    : null;

  const headerTitle = isGroup
    ? activeConv.groupName || "Group Chat"
    : otherParticipant?.username || "Direct Chat";

  const isParticipantOnline =
    !isGroup && otherParticipant
      ? onlineUsers.has(otherParticipant.id) || !!otherParticipant.isOnline
      : false;

  const presenceSubtitle = isGroup
    ? `${activeConv.participants.length} members`
    : isParticipantOnline
    ? "Online"
    : otherParticipant?.status || "Offline";

  // Typing users list
  const activeTypingMap = typingUsers[activeConversationId] || {};
  const typingUserIds = Object.keys(activeTypingMap).filter(
    (uid) => uid !== currentUser?.id && activeTypingMap[uid]
  );
  const typingNames = typingUserIds.map((uid) => {
    const p = activeConv.participants.find((part) => part.id === uid);
    return p ? p.username : "Someone";
  });

  return (
    <div className="flex-1 h-full flex flex-col bg-slate-950">
      {/* Chat Header */}
      <div className="h-16 px-4 border-b border-slate-800 bg-slate-900/90 backdrop-blur-sm flex items-center justify-between z-10 shrink-0">
        <div className="flex items-center gap-3">
          {/* Mobile Back Button */}
          <button
            onClick={() => setActiveConversationId(null)}
            className="md:hidden p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>

          {isGroup ? (
            <div className="w-10 h-10 rounded-full bg-indigo-950/80 border border-indigo-700/60 flex items-center justify-center text-indigo-300 shrink-0">
              <Users className="w-5 h-5" />
            </div>
          ) : (
            <Avatar
              name={headerTitle}
              avatarUrl={otherParticipant?.avatarUrl}
              isOnline={isParticipantOnline}
              showPresence
              size="md"
            />
          )}

          <div>
            <h2 className="text-sm font-semibold text-white leading-tight">{headerTitle}</h2>
            <p
              className={`text-xs ${
                isParticipantOnline ? "text-emerald-400 font-medium" : "text-slate-400"
              }`}
            >
              {presenceSubtitle}
            </p>
          </div>
        </div>
      </div>

      {/* Message List */}
      <div
        ref={messageListRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto p-4 flex flex-col"
      >
        {isLoadingMore && (
          <div className="flex justify-center py-2">
            <Loader2 className="w-5 h-5 text-indigo-400 animate-spin" />
          </div>
        )}

        {isInitialLoading && (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 className="w-8 h-8 text-indigo-400 animate-spin" />
          </div>
        )}

        {!isInitialLoading && currentMessages.length === 0 && (
          <div className="flex-1 flex flex-col items-center justify-center text-center text-slate-400">
            <p className="text-sm text-slate-300">No messages yet</p>
            <p className="text-xs text-slate-500 mt-1">Say hello and start the conversation!</p>
          </div>
        )}

        {currentMessages.map((msg) => (
          <MessageBubble key={msg._id} message={msg} />
        ))}
      </div>

      {/* Typing Indicator */}
      <TypingIndicator names={typingNames} />

      {/* Message Input */}
      <MessageInput
        conversationId={activeConversationId}
        onSendMessage={handleSendMessage}
      />
    </div>
  );
};
