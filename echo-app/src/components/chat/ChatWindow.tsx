import { FC, useEffect, useRef, useState, useCallback, UIEvent } from "react";
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
import { formatDateSeparator } from "../../utils/date";
import chatBg from "../../assets/chat-bg.jpg";

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
  const hasCachedMessages = currentMessages.length > 0;

  // Initial fetch for the conversation messages with cached data as initialData
  const { isFetching: isQueryFetching } = useQuery({
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
    staleTime: 1000 * 30, // 30s cache freshness
  });

  const isInitialLoading = isQueryFetching && !hasCachedMessages;

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (messageListRef.current) {
      messageListRef.current.scrollTop = messageListRef.current.scrollHeight;
    }
  }, [currentMessages.length]);

  const myId = currentUser?.id || (currentUser as any)?._id;

  // Mark unread messages as read
  useEffect(() => {
    if (!activeConversationId || !myId || currentMessages.length === 0) return;

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
  }, [activeConversationId, currentMessages.length, myId]);

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

  const handleReact = useCallback(
    (messageId: string, emoji: string) => {
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
    },
    [activeConversationId, currentUser, toggleOptimisticReaction, reactMessage]
  );

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
      <div className="flex-1 h-full flex flex-col items-center justify-center bg-[#171824] text-[#767b93] select-none p-6 text-center">
        <div className="w-16 h-16 rounded-2xl bg-[#161722] border border-white/[0.04] flex items-center justify-center text-[#505469] mb-4 shadow-xl">
          <MessageSquareOff className="w-8 h-8 stroke-1 text-[#505469]" />
        </div>
        <h3 className="text-base font-semibold text-white mb-1">
          No Conversation Selected
        </h3>
        <p className="text-xs text-[#767b93] max-w-sm">
          Select a chat from the left panel or click New Chat to start communicating.
        </p>
      </div>
    );
  }

  return (
    <div className="flex-1 h-full flex flex-col bg-[#171824] relative min-w-0 overflow-hidden">
      {/* Background Wallpaper Image */}
      <div
        className="absolute inset-0 bg-cover bg-center pointer-events-none select-none z-0"
        style={{ backgroundImage: `url(${chatBg})` }}
      />
      {/* Subtle Dark Overlay to preserve high message contrast & readability */}
      <div className="absolute inset-0 bg-[#0b0e17]/85 backdrop-blur-[1px] pointer-events-none select-none z-0" />

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
        className="flex-1 overflow-y-auto px-4 md:px-6 py-4 flex flex-col justify-start relative z-10"
      >
        {/* Centered Desktop Column */}
        <div className="w-full max-w-4xl mx-auto flex flex-col gap-2.5 flex-1 justify-end">
          {isLoadingMore && (
            <div className="flex items-center justify-center py-2 text-xs text-[#767b93]">
              <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5 text-[#0066ff]" />
              Loading older messages...
            </div>
          )}

          {isInitialLoading && currentMessages.length === 0 && (
            <div className="flex-1 flex flex-col items-center justify-center text-[#767b93]">
              <Loader2 className="w-6 h-6 animate-spin text-[#0066ff] mb-2" />
              <p className="text-xs">Loading messages...</p>
            </div>
          )}

          {!isInitialLoading && currentMessages.length === 0 && (
            <div className="flex-1 flex flex-col items-center justify-center text-[#767b93] text-center">
              <p className="text-sm font-medium text-white mb-1">
                Start of conversation
              </p>
              <p className="text-xs text-[#505469]">
                Send a message or share a file to get the conversation going.
              </p>
            </div>
          )}

          <div className="flex flex-col space-y-1">
            {currentMessages.map((msg, index) => {
              const prevMsg = currentMessages[index - 1];
              const currentDate = msg.createdAt ? new Date(msg.createdAt).toDateString() : "";
              const prevDate = prevMsg?.createdAt ? new Date(prevMsg.createdAt).toDateString() : "";
              const showDateSeparator = currentDate && currentDate !== prevDate;

              return (
                <div key={msg._id} className="flex flex-col">
                  {showDateSeparator && (
                    <div className="text-[#5f6377] text-[11px] tracking-wide my-4 select-none text-center font-normal">
                      {formatDateSeparator(msg.createdAt)}
                    </div>
                  )}
                  <MessageBubble
                    message={msg}
                    isGroup={activeConv?.type === "group"}
                    onReact={handleReact}
                  />
                </div>
              );
            })}
          </div>

          {/* Real-time typing indicators */}
          {activeTypingNames.length > 0 && (
            <div className="pt-2">
              <TypingIndicator names={activeTypingNames} />
            </div>
          )}
        </div>
      </div>

      {/* Docked Bottom Input Bar with File Attachment Trigger */}
      <MessageInput
        conversationId={activeConversationId}
        onSendMessage={handleSendMessage}
      />
    </div>
  );
};
