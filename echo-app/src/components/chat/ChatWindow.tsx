import { FC, useEffect, useRef, useState, useCallback, useMemo, UIEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { messageApi } from "../../api/messageApi";
import { useChatStore } from "../../store/chatStore";
import { useAuthStore } from "../../store/authStore";
import { useSocket } from "../../hooks/useSocket";
import { ChatHeader } from "./ChatHeader";
import { ChatSearchBar } from "./ChatSearchBar";
import { ChatSelectionBar } from "./ChatSelectionBar";
import { MessageBubble } from "./MessageBubble";
import { ForwardMessageModal } from "./ForwardMessageModal";
import { PinMessageDurationModal } from "./PinMessageDurationModal";
import { PinnedMessageBanner } from "./PinnedMessageBanner";
import { UndoSnackbar } from "./UndoSnackbar";
import { MessageInput } from "./MessageInput";
import { TypingIndicator } from "./TypingIndicator";
import { Message } from "../../types/message";
import { userApi } from "../../api/userApi";
import { MessageSquareOff, Loader2 } from "lucide-react";
import { formatDateSeparator } from "../../utils/date";
import { getOtherParticipant } from "../../utils/chatUtils";
import { useConfirm } from "../../store/confirmDialogStore";
import { UnsavedContactBanner } from "./UnsavedContactBanner";
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
  const addBlockedUser = useAuthStore((state) => state.addBlockedUser);
  const removeBlockedUser = useAuthStore((state) => state.removeBlockedUser);
  const confirm = useConfirm();
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
    isSelectionMode,
    selectedMessageIds,
    toggleSelectMessage,
    removeMessagesFromConversation,
    removeConversationFromList,
    removeMessageForMe,
    restoreMessageForMe,
    markMessageAsRevoked,
    searchQuery,
    undoDeleteState,
    setUndoDeleteState,
    pinningMessage,
    togglePinMessage,
    setReplyingTo,
    addMessage,
    setParticipantBlockedStatus,
    clearConversationMessages,
  } = useChatStore();

  const { sendMessage, reactMessage, markAsRead, emitMessagesDeleted } = useSocket();

  const messageListRef = useRef<HTMLDivElement>(null);
  const [hasMore, setHasMore] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isDeletingSelected, setIsDeletingSelected] = useState(false);
  const recentlyDeletedMessagesRef = useRef<Map<string, Message>>(new Map());

  const activeConv = conversations.find((c) => c._id === activeConversationId);
  const currentMessages = activeConversationId ? messages[activeConversationId] || [] : [];
  const hasCachedMessages = currentMessages.length > 0;

  // Active pinned message in the current conversation
  const activePinnedMessage = useMemo(() => {
    if (activeConv?.pinnedMessage) return activeConv.pinnedMessage;
    return currentMessages.slice().reverse().find((m) => m.isPinned) || null;
  }, [activeConv?.pinnedMessage, currentMessages]);

  const handleGoToMessage = (messageId: string) => {
    const container = messageListRef.current;
    const el = document.getElementById(`msg-${messageId}`);
    if (!container || !el) return;

    // Calculate exact target scrollTop within the messageList container only
    const containerRect = container.getBoundingClientRect();
    const elRect = el.getBoundingClientRect();
    const offset = elRect.top - containerRect.top + container.scrollTop - (container.clientHeight / 2 - el.clientHeight / 2);

    container.scrollTo({
      top: Math.max(0, offset),
      behavior: "smooth",
    });

    el.classList.add("ring-2", "ring-[#0066ff]", "transition-all", "duration-500");
    setTimeout(() => {
      el.classList.remove("ring-2", "ring-[#0066ff]");
    }, 1500);
  };

  const handleReplyMessage = (msg: Message) => {
    const senderId =
      typeof msg.senderId === "string"
        ? msg.senderId
        : msg.senderId?._id || msg.senderId?.id || "";

    const senderName =
      typeof msg.senderId === "string"
        ? "User"
        : msg.senderId?.username || "User";

    const currentUserId = currentUser?.id || (currentUser as any)?._id;
    const isOwn = Boolean(currentUserId && senderId && currentUserId === senderId);

    setReplyingTo({
      _id: msg._id,
      senderId,
      senderUsername: isOwn ? "You" : senderName,
      content: msg.content || "",
      type: msg.type === "image" || msg.type === "file" || msg.type === "audio" ? msg.type : "text",
    });
  };

  const handleConfirmPin = (duration: "24h" | "7d" | "30d") => {
    if (!activeConversationId || !pinningMessage) return;
    const msgId = pinningMessage._id;
    togglePinMessage(activeConversationId, msgId, true, duration);

    // Add in-chat system message: "You pinned a message"
    const systemMsg: Message = {
      _id: `sys-${Date.now()}`,
      conversationId: activeConversationId,
      senderId: currentUser?.id || "system",
      content: "You pinned a message",
      type: "system",
      reactions: [],
      readBy: [],
      status: "sent",
      createdAt: new Date().toISOString(),
    };
    addMessage(systemMsg);
  };

  const handleUnpinPinnedMessage = (messageId: string) => {
    if (!activeConversationId) return;
    togglePinMessage(activeConversationId, messageId, false);
  };

  // Filter messages live when search is active
  const filteredMessages = useMemo(() => {
    if (!searchQuery.trim()) return currentMessages;
    const lower = searchQuery.toLowerCase();
    return currentMessages.filter((m) => {
      const matchContent = m.content && m.content.toLowerCase().includes(lower);
      const matchFileName = m.fileName && m.fileName.toLowerCase().includes(lower);
      return matchContent || matchFileName;
    });
  }, [currentMessages, searchQuery]);

  const allMessageIds = useMemo(() => currentMessages.map((m) => m._id), [currentMessages]);

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

  const myId = currentUser?.id || (currentUser as any)?._id;
  const currentUserId = currentUser?.id || currentUser?._id;

  // Active typing user names (exclude current user so only recipients see typing indicator)
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

  // Auto-scroll to bottom on new messages or typing indicators
  useEffect(() => {
    if (messageListRef.current) {
      messageListRef.current.scrollTop = messageListRef.current.scrollHeight;
    }
  }, [currentMessages.length, activeTypingNames.length]);

  // Mark unread messages as read (both via REST API for persistence and Socket.IO for real-time delivery)
  useEffect(() => {
    if (!activeConversationId || !myId) return;

    // Immediately clear unread badge in store for responsive UI
    useChatStore.getState().clearUnreadCount(activeConversationId);

    const unreadMessageIds = currentMessages
      .filter((m) => {
        const senderId =
          typeof m.senderId === "string"
            ? m.senderId
            : m.senderId?._id || m.senderId?.id;
        const readByArray = Array.isArray(m.readBy)
          ? m.readBy.map((id: any) => (id?._id ? id._id.toString() : id.toString()))
          : [];
        return senderId !== myId && !readByArray.includes(myId);
      })
      .map((m) => m._id);

    // Call REST endpoint for guaranteed DB persistence
    messageApi
      .markAsRead(activeConversationId, unreadMessageIds.length > 0 ? unreadMessageIds : undefined)
      .catch((err) => console.error("Error marking messages as read via REST:", err));

    // Also emit socket event for real-time read receipts
    if (unreadMessageIds.length > 0) {
      markAsRead(activeConversationId, unreadMessageIds);
    }
  }, [activeConversationId, currentMessages.length, myId, markAsRead]);

  const handleDeleteForMe = async (messageId: string) => {
    if (!activeConversationId) return;
    const targetMsg = currentMessages.find((m) => m._id === messageId);
    if (targetMsg) {
      recentlyDeletedMessagesRef.current.set(messageId, targetMsg);
    }

    // Optimistically remove from view
    removeMessageForMe(activeConversationId, messageId);
    setUndoDeleteState({
      messageId,
      conversationId: activeConversationId,
      message: targetMsg,
    });

    try {
      await messageApi.deleteForMe(messageId);
    } catch (err: any) {
      console.error("Failed to delete message for me:", err);
      // Revert if API failed
      if (targetMsg) {
        restoreMessageForMe(activeConversationId, targetMsg);
      }
      setUndoDeleteState(null);
      alert(err.response?.data?.message || err.message || "Failed to delete message");
    }
  };

  const handleUndoDeleteForMe = async (messageId: string) => {
    const stateToUndo = undoDeleteState;
    setUndoDeleteState(null);

    const convId = stateToUndo?.conversationId || activeConversationId;
    if (!convId) return;

    const savedMsg = stateToUndo?.message || recentlyDeletedMessagesRef.current.get(messageId);
    if (savedMsg) {
      restoreMessageForMe(convId, savedMsg);
    }

    try {
      const res = await messageApi.undoDeleteForMe(messageId);
      if (res.success && res.message) {
        restoreMessageForMe(convId, res.message);
      }
    } catch (err: any) {
      console.error("Failed to undo delete for me:", err);
    } finally {
      recentlyDeletedMessagesRef.current.delete(messageId);
    }
  };

  const handleDeleteForEveryone = async (messageId: string) => {
    if (!activeConversationId) return;
    try {
      const res = await messageApi.deleteForEveryone(messageId);
      if (res.success && res.message) {
        markMessageAsRevoked(
          activeConversationId,
          messageId,
          res.message.deletedBy,
          res.message.deletedAt
        );
      }
    } catch (err: any) {
      console.error("Failed to delete for everyone:", err);
      alert(err.response?.data?.message || err.message || "Failed to delete message for everyone");
    }
  };

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

  const replyingTo = useChatStore((state) => state.replyingTo);

  const handleSendMessage = (
    content: string,
    type: "text" | "image" | "file" | "audio" = "text",
    metadata?: {
      mediaUrl?: string;
      fileUrl?: string;
      audioMetadata?: { duration: number; waveform: number[]; mimeType: string };
      fileName?: string;
      fileSize?: number;
      replyTo?: string | null;
    }
  ) => {
    if (!activeConversationId || !currentUser) return;

    // Build optimistic replyTo object if replying
    let optimisticReplyTo: any = metadata?.replyTo || null;
    if (replyingTo && metadata?.replyTo === replyingTo._id) {
      optimisticReplyTo = {
        _id: replyingTo._id,
        content: replyingTo.content,
        type: replyingTo.type,
        senderId: {
          username: replyingTo.senderUsername,
        },
      };
    }

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
      mediaUrl: metadata?.mediaUrl || metadata?.fileUrl,
      fileUrl: metadata?.fileUrl || metadata?.mediaUrl,
      audioMetadata: metadata?.audioMetadata,
      fileName: metadata?.fileName,
      fileSize: metadata?.fileSize,
      replyTo: optimisticReplyTo,
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

  const handleForwardMessage = async (targetConversationId: string, content: string) => {
    if (!currentUser) return;
    const tempId = `temp-${Date.now()}-${Math.random()}`;
    const optimisticMsg: Message = {
      _id: tempId,
      conversationId: targetConversationId,
      senderId: {
        id: currentUser.id,
        _id: currentUser.id,
        username: currentUser.username,
        avatarUrl: currentUser.avatarUrl,
      },
      content,
      type: "text",
      isForwarded: true,
      reactions: [],
      readBy: [currentUser.id],
      status: "pending",
      createdAt: new Date().toISOString(),
    };

    addOptimisticMessage(optimisticMsg);

    sendMessage(
      targetConversationId,
      content,
      "text",
      { isForwarded: true },
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

  const isGroupAdmin = useMemo(() => {
    if (activeConv?.type !== "group" || !myId) return false;
    const isLegacyAdmin = activeConv.admins?.some((a: any) => {
      const adminId = typeof a === "string" ? a : a._id || a.id;
      return adminId === myId;
    });
    const isGroupParticipantAdmin = activeConv.groupParticipants?.some((gp: any) => {
      const pId = typeof gp.userId === "string" ? gp.userId : gp.userId?._id || gp.userId?.id;
      return pId === myId && gp.role === "admin";
    });
    const isCreator = activeConv.creatorId === myId;
    return !!(isLegacyAdmin || isGroupParticipantAdmin || isCreator);
  }, [activeConv, myId]);

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

  const counterpart =
    activeConv?.type === "direct"
      ? getOtherParticipant(activeConv.participants, currentUser)
      : null;

  const counterpartId = counterpart ? (counterpart as any)._id || (counterpart as any).id : null;
  const isDirectBlockedByMe =
    activeConv?.type === "direct" && counterpartId && currentUser?.blockedUsers
      ? currentUser.blockedUsers.includes(counterpartId)
      : false;
  const isDirectBlockedByOther =
    activeConv?.type === "direct" && counterpartId && currentUser?.blockedBy
      ? currentUser.blockedBy.includes(counterpartId)
      : false;
  const isDirectBlocked =
    activeConv?.type === "direct" &&
    Boolean(
      isDirectBlockedByMe ||
      isDirectBlockedByOther ||
      (counterpart as any)?.isBlocked ||
      (counterpart as any)?.blockedUsers?.includes(currentUser?.id || (currentUser as any)?._id)
    );

  const isInputDisabled =
    isDirectBlocked ||
    Boolean(activeConv?.type === "group" && activeConv?.settings?.onlyAdminsMessage && !isGroupAdmin);
  const canReply = !isInputDisabled;

  const handleUnblockCounterpart = async () => {
    if (!counterpartId) return;
    try {
      await userApi.unblockUser(counterpartId);
      removeBlockedUser(counterpartId);
      setParticipantBlockedStatus(counterpartId, false);
    } catch (err: any) {
      console.error("Failed to unblock counterpart:", err);
      alert(err.response?.data?.message || err.message || "Failed to unblock user");
    }
  };

  const handleToggleBlockCounterpart = async () => {
    if (!counterpartId) return;
    try {
      if (isDirectBlockedByMe) {
        const confirmed = await confirm({
          title: `Unblock ${counterpart?.username || "user"}?`,
          message: "They will be able to send you messages and see your online status again.",
          confirmText: "Unblock",
          cancelText: "Cancel",
          variant: "info",
        });
        if (!confirmed) return;

        await userApi.unblockUser(counterpartId);
        removeBlockedUser(counterpartId);
        setParticipantBlockedStatus(counterpartId, false);
      } else {
        const confirmed = await confirm({
          title: `Block ${counterpart?.username || "user"}?`,
          message: "Blocked contacts will not be able to send you private messages or see your active status.",
          confirmText: "Block Contact",
          cancelText: "Cancel",
          variant: "warning",
        });
        if (!confirmed) return;

        await userApi.blockUser(counterpartId);
        addBlockedUser(counterpartId);
        setParticipantBlockedStatus(counterpartId, true);
        setReplyingTo(null);
      }
    } catch (err: any) {
      console.error("Failed to update block status:", err);
      alert(err.response?.data?.message || err.message || "Failed to update block status");
    }
  };

  const handleClearChat = async () => {
    if (!activeConversationId) return;
    const confirmed = await confirm({
      title: "Clear chat messages?",
      message: "Are you sure you want to clear all messages from this chat? The chat will remain in your chat list.",
      confirmText: "Clear Chat",
      cancelText: "Cancel",
      variant: "warning",
    });
    if (!confirmed) return;

    try {
      await messageApi.clearChat(activeConversationId);
      clearConversationMessages(activeConversationId);
    } catch (err: any) {
      console.error("Failed to clear chat:", err);
      alert(err.response?.data?.message || err.message || "Failed to clear chat");
    }
  };

  const handleDeleteChat = async () => {
    if (!activeConversationId) return;
    const confirmed = await confirm({
      title: "Delete this chat?",
      message: "All messages in this conversation will be permanently removed for you. This action cannot be reversed.",
      confirmText: "Delete Chat",
      cancelText: "Keep Chat",
      variant: "danger",
    });
    if (!confirmed) return;

    try {
      await messageApi.deleteConversation(activeConversationId);
      removeConversationFromList(activeConversationId);
    } catch (err: any) {
      console.error("Failed to delete chat:", err);
      alert(err.response?.data?.message || err.message || "Failed to delete chat");
    }
  };

  const handleDeleteSelectedMessages = async (ids: string[]) => {
    if (!activeConversationId || ids.length === 0 || isDeletingSelected) return;
    const confirmed = await confirm({
      title: `Delete ${ids.length} selected message${ids.length > 1 ? "s" : ""}?`,
      message: `Are you sure you want to delete ${ids.length} selected message${ids.length > 1 ? "s" : ""}?`,
      confirmText: "Delete",
      cancelText: "Cancel",
      variant: "danger",
    });
    if (!confirmed) return;

    try {
      setIsDeletingSelected(true);
      await messageApi.deleteSelectedMessages(activeConversationId, ids);
      removeMessagesFromConversation(activeConversationId, ids);
      emitMessagesDeleted(activeConversationId, ids);
    } catch (err: any) {
      console.error("Failed to delete selected messages:", err);
      alert(err.response?.data?.message || err.message || "Failed to delete selected messages");
    } finally {
      setIsDeletingSelected(false);
    }
  };

  return (
    <div className="flex-1 h-full flex flex-col bg-[#171824] relative min-w-0 overflow-hidden">
      {/* Background Wallpaper Image */}
      <div
        className="absolute inset-0 bg-cover bg-center pointer-events-none select-none z-0"
        style={{ backgroundImage: `url(${chatBg})` }}
      />
      {/* Subtle Dark Overlay to preserve high message contrast & readability */}
      <div className="absolute inset-0 bg-[#0b0e17]/85 backdrop-blur-[1px] pointer-events-none select-none z-0" />

      {/* Desktop Header or Selection Bar */}
      {isSelectionMode ? (
        <ChatSelectionBar
          totalMessageCount={currentMessages.length}
          allMessageIds={allMessageIds}
          onDeleteSelected={handleDeleteSelectedMessages}
          isDeleting={isDeletingSelected}
        />
      ) : (
        <ChatHeader
          conversation={activeConv}
          onHeaderClick={onHeaderClick}
          onOpenMenu={onOpenMenu}
          onSearchClick={onSearchClick}
          onBlockUser={handleToggleBlockCounterpart}
          onClearChat={handleClearChat}
          onDeleteChat={handleDeleteChat}
        />
      )}

      {/* In-chat Search Bar */}
      <ChatSearchBar />

      {/* Unsaved Contact Banner (if direct message, not blocked, and counterpart not saved in contacts) */}
      {counterpart && !isDirectBlocked && (
        <UnsavedContactBanner
          participant={counterpart as any}
          onBlock={handleToggleBlockCounterpart}
        />
      )}

      {/* WhatsApp Pinned Message Banner (just below panel header) */}
      {activePinnedMessage && (
        <PinnedMessageBanner
          pinnedMessage={activePinnedMessage}
          onGoToMessage={handleGoToMessage}
          onUnpinMessage={handleUnpinPinnedMessage}
        />
      )}

      {/* Message Stream */}
      <div
        ref={messageListRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto px-4 md:px-8 lg:px-12 py-4 flex flex-col justify-start relative z-10"
      >
        {/* Full-width responsive Message Column matching WhatsApp Web */}
        <div className="w-full flex flex-col gap-2 flex-1 justify-end">
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
            {filteredMessages.map((msg, index) => {
              const prevMsg = filteredMessages[index - 1];
              const currentDate = msg.createdAt ? new Date(msg.createdAt).toDateString() : "";
              const prevDate = prevMsg?.createdAt ? new Date(prevMsg.createdAt).toDateString() : "";
              const showDateSeparator = currentDate && currentDate !== prevDate;

              return (
                <div
                  key={msg._id}
                  id={`msg-${msg._id}`}
                  onDoubleClick={(e) => {
                    if (isSelectionMode || msg.type === "system" || !canReply) return;
                    const target = e.target as HTMLElement;
                    // Ignore clicks directly inside interactive elements (buttons, links, inputs)
                    if (
                      target.closest("button") ||
                      target.closest("a") ||
                      target.closest("input")
                    ) {
                      return;
                    }
                    handleReplyMessage(msg);
                  }}
                  className="flex flex-col rounded-2xl transition-all"
                >
                  {showDateSeparator && (
                    <div className="text-[#5f6377] text-[11px] tracking-wide my-4 select-none text-center font-normal">
                      {formatDateSeparator(msg.createdAt)}
                    </div>
                  )}
                  <MessageBubble
                    message={msg}
                    isGroup={activeConv?.type === "group"}
                    isGroupAdmin={isGroupAdmin}
                    participants={activeConv?.participants}
                    onReact={handleReact}
                    onDeleteForMe={handleDeleteForMe}
                    onDeleteForEveryone={handleDeleteForEveryone}
                    isSelectionMode={isSelectionMode}
                    isSelected={selectedMessageIds.includes(msg._id)}
                    onToggleSelect={toggleSelectMessage}
                    canReply={canReply}
                    onGoToMessage={handleGoToMessage}
                  />
                </div>
              );
            })}
          </div>

          {/* Real-time typing indicators */}
          {activeTypingNames.length > 0 && (
            <div className="pt-0.5 pb-0.5">
              <TypingIndicator names={activeTypingNames} />
            </div>
          )}
        </div>
      </div>

      {/* Docked Bottom Input Bar */}
      <MessageInput
        conversationId={activeConversationId}
        onSendMessage={handleSendMessage}
        isBlocked={isDirectBlocked}
        isBlockedByMe={isDirectBlockedByMe}
        onUnblock={handleUnblockCounterpart}
        isGroup={activeConv?.type === "group"}
        onlyAdminsMessage={!!activeConv?.settings?.onlyAdminsMessage}
        isCurrentUserAdmin={isGroupAdmin}
        participants={activeConv?.participants}
      />

      {/* Forward Message Modal */}
      <ForwardMessageModal
        conversations={conversations}
        onForwardMessage={handleForwardMessage}
      />

      {/* WhatsApp Pin Message Duration Modal */}
      <PinMessageDurationModal
        onConfirmPin={handleConfirmPin}
      />

      {/* Mobile-only Undo Snackbar when Chat List panel is hidden */}
      <div className="md:hidden">
        <UndoSnackbar
          messageId={undoDeleteState?.messageId || null}
          onUndo={handleUndoDeleteForMe}
          onDismiss={() => setUndoDeleteState(null)}
          className="absolute bottom-20 left-1/2 -translate-x-1/2 w-max max-w-[85%] z-40 flex flex-col overflow-hidden rounded-xl bg-[#1c1f2e] border border-white/[0.08] shadow-2xl shadow-black/80 animate-in fade-in slide-in-from-bottom-2 duration-200"
        />
      </div>
    </div>
  );
};
