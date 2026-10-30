import { FC, useEffect, useRef, useState, UIEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { messageApi } from "../../api/messageApi";
import { useChatStore } from "../../store/chatStore";
import { useAuthStore } from "../../store/authStore";
import { useSocket } from "../../hooks/useSocket";
import { ChatHeader } from "./ChatHeader";
import { MessageBubble } from "./MessageBubble";
import { MessageInput } from "./MessageInput";
import { TypingIndicator } from "./TypingIndicator";
import { Message } from "../../types/message";
import { MessageSquareOff, Loader2 } from "lucide-react";

interface ChatWindowProps {
  onHeaderClick?: () => void;
  onOpenMenu?: () => void;
  onSearchClick?: () => void;
}

export const ChatWindow: FC<ChatWindowProps> = ({
  onHeaderClick,
  onOpenMenu,
  onSearchClick,
}) => {
  const currentUser = useAuthStore((state) => state.user);
  const {
    activeConversationId,
    conversations,
    messages,
    setMessages,
    prependMessages,
    addOptimisticMessage,
    reconcileMessage,
    toggleOptimisticReaction,
    typingUsers,
  } = useChatStore();

  const { sendMessage, reactMessage, markAsRead } = useSocket();

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
      // Server returns messages sorted newest first { createdAt: -1 }
      const ordered = [...data].reverse();
      setMessages(activeConversationId, ordered);
      setHasMore(data.length >= 30);
      return ordered;
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

    const myId = currentUser.id || (currentUser as any)?._id;
    const unreadMessageIds = currentMessages
      .filter((m) => {
        const senderId =
          typeof m.senderId === "string"
            ? m.senderId
            : m.senderId?._id || m.senderId?.id;
        return senderId !== myId && !m.readBy?.includes(myId);
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

        const orderedOlder = [...older].reverse();
        prependMessages(activeConversationId, orderedOlder);

        // Preserve scroll position
        requestAnimationFrame(() => {
          if (messageListRef.current) {
            messageListRef.current.scrollTop =
              messageListRef.current.scrollHeight - prevHeight;
          }
        });
      } catch (err) {
        console.error("Failed to load older messages", err);
      } finally {
        setIsLoadingMore(false);
      }
    }
  };

  const handleSendMessage = (
    content: string,
    type: "text" | "image" | "file" = "text",
    metadata?: { mediaUrl?: string; fileName?: string; fileSize?: number }
  ) => {
    if (!activeConversationId || !currentUser) return;

    const tempId = `temp-${Date.now()}-${Math.random()}`;
    const optimisticMsg: Message = {
      _id: tempId,
      conversationId: activeConversationId,
      senderId: {
        id: currentUser.id,
        _id: currentUser.id,
        username: currentUser.username,
        avatarUrl: currentUser.avatarUrl,
      },
      content,
      type,
      mediaUrl: metadata?.mediaUrl,
      fileName: metadata?.fileName,
      fileSize: metadata?.fileSize,
      reactions: [],
      readBy: [currentUser.id],
      status: "pending",
      createdAt: new Date().toISOString(),
    };

    addOptimisticMessage(optimisticMsg);

    sendMessage(
      activeConversationId,
      content,
      type,
      metadata,
      (res) => {
        if (res.success && res.message) {
          reconcileMessage(tempId, res.message);
        }
      }
    );
  };

  const handleReact = (messageId: string, emoji: string) => {
    if (!activeConversationId || !currentUser) return;
    const currentId = currentUser.id || (currentUser as any)._id;
    if (currentId) {
      toggleOptimisticReaction(messageId, emoji, {
        id: currentId,
        username: currentUser.username,
        avatarUrl: currentUser.avatarUrl,
      });
    }
    reactMessage(activeConversationId, messageId, emoji);
  };

  // Active typing user names (exclude current user so only recipients see typing indicator)
  const currentUserId = currentUser?.id || currentUser?._id;
  const activeTypingMap = (activeConversationId && typingUsers[activeConversationId]) || {};
  const activeTypingUserIds = Object.keys(activeTypingMap).filter(
    (id) => !currentUserId || id !== currentUserId
  );

  const activeTypingNames = activeConv?.participants
    .filter((p) => {
      const pId = p.id || (p as any)._id;
      return pId && pId !== currentUserId && activeTypingUserIds.includes(pId);
    })
    .map((p) => p.username) || [];

  if (!activeConversationId || !activeConv) {
    return (
      <div className="flex-1 h-screen flex flex-col items-center justify-center bg-[#0b0e14] text-slate-500 select-none p-6 text-center">
        <div className="w-16 h-16 rounded-2xl bg-[#111622] border border-slate-800/80 flex items-center justify-center text-slate-400 mb-4 shadow-xl">
          <MessageSquareOff className="w-8 h-8 stroke-1 text-slate-500" />
        </div>
        <h3 className="text-base font-semibold text-slate-300 mb-1">
          No Conversation Selected
        </h3>
        <p className="text-xs text-slate-500 max-w-sm">
          Select a chat from the left panel or click New Chat to start communicating.
        </p>
      </div>
    );
  }

  return (
    <div className="flex-1 h-screen flex flex-col bg-[#0b0e14] relative min-w-0">
      {/* Desktop Header */}
      <ChatHeader
        conversation={activeConv}
        onHeaderClick={onHeaderClick}
        onOpenMenu={onOpenMenu}
        onSearchClick={onSearchClick}
      />

      {/* Message Stream */}
      <div
        ref={messageListRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto px-4 md:px-8 py-4 flex flex-col"
      >
        {isLoadingMore && (
          <div className="flex items-center justify-center py-2 text-xs text-slate-500">
            <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5 text-indigo-400" />
            Loading older messages...
          </div>
        )}

        {isInitialLoading && currentMessages.length === 0 && (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-500">
            <Loader2 className="w-6 h-6 animate-spin text-indigo-500 mb-2" />
            <p className="text-xs">Loading messages...</p>
          </div>
        )}

        {!isInitialLoading && currentMessages.length === 0 && (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-500 text-center">
            <p className="text-sm font-medium text-slate-400 mb-1">
              Start of conversation
            </p>
            <p className="text-xs text-slate-600">
              Send a message or share a file to get the conversation going.
            </p>
          </div>
        )}

        <div className="flex-1 flex flex-col justify-end space-y-1">
          {currentMessages.map((msg) => (
            <MessageBubble
              key={msg._id}
              message={msg}
              isGroup={activeConv?.type === "group"}
              onReact={handleReact}
            />
          ))}
        </div>

        {/* Real-time typing indicators */}
        {activeTypingNames.length > 0 && (
          <div className="pt-2">
            <TypingIndicator names={activeTypingNames} />
          </div>
        )}
      </div>

      {/* Docked Bottom Input Bar with File Attachment Trigger */}
      <MessageInput
        conversationId={activeConversationId}
        onSendMessage={handleSendMessage}
      />
    </div>
  );
};
