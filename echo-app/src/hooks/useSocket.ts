import { useEffect, useRef, useCallback } from "react";
import { io } from "socket.io-client";
import { useAuth } from "@clerk/clerk-react";
import { useAuthStore } from "../store/authStore";
import { useSocketStore, AppSocket } from "../store/socketStore";
import { useChatStore } from "../store/chatStore";
import { Message, IReaction } from "../types/message";
import { messageApi } from "../api/messageApi";

export const useSocket = () => {
  const { getToken, isSignedIn } = useAuth();
  const user = useAuthStore((state) => state.user);
  const setAccessToken = useAuthStore((state) => state.setAccessToken);
  const { socket, isConnected, setSocket, setIsConnected, reset } = useSocketStore();
  const socketRef = useRef<AppSocket | null>(null);

  const {
    handleNewMessage,
    updateReactions,
    updateMessageReadStatus,
    updateMessageStatus,
    updateBatchMessageStatus,
    setTyping,
    setUserPresence,
    removeMessagesFromConversation,
    removeConversationFromList,
    markMessageAsRevoked,
    updateGroupSettingsInConversation,
    updateMemberRoleInConversation,
    removeMemberFromConversationState,
    addOrUpdateConversation,
  } = useChatStore();

  useEffect(() => {
    // If not signed in or no user profile, disconnect and clean up
    if (!isSignedIn || !user) {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
        reset();
      }
      return;
    }

    // Singleton socket: prevent re-instantiating if already running
    if (socketRef.current) {
      return;
    }

    let isDisposed = false;
    const socketUrl =
      import.meta.env.VITE_SOCKET_URL || "https://echo-1aal.onrender.com";

    // Setup Socket.IO client with dynamic auth token callback
    // Every time Socket.IO reconnects or refreshes, this auth callback executes to fetch a fresh Clerk token!
    const newSocket: AppSocket = io(socketUrl, {
      auth: async (cb: (data: { token: string | null }) => void) => {
        try {
          const freshToken = await getToken();
          if (freshToken) {
            setAccessToken(freshToken);
          }
          cb({ token: freshToken });
        } catch (err) {
          console.error("[useSocket] Error fetching fresh token for socket auth:", err);
          cb({ token: null });
        }
      },
      autoConnect: false,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    });

    socketRef.current = newSocket;
    setSocket(newSocket);

    // Event listeners
    newSocket.on("connect", () => {
      if (isDisposed) return;
      setIsConnected(true);
      console.log("[Socket connected]:", newSocket.id);
    });

    newSocket.on("disconnect", (reason) => {
      if (isDisposed) return;
      setIsConnected(false);
      console.log("[Socket disconnected]:", reason);
    });

    newSocket.on("connect_error", async (error) => {
      console.error("[Socket connection error]:", error.message);
      // If server rejected with Invalid Token or Auth error, force fetch a fresh Clerk token
      if (error.message && error.message.includes("Authentication error")) {
        try {
          const freshToken = await getToken({ skipCache: true });
          if (freshToken) {
            setAccessToken(freshToken);
            // Reconnect with fresh token
            newSocket.connect();
          }
        } catch (refreshErr) {
          console.error("[useSocket] Failed refreshing token on connect_error:", refreshErr);
        }
      }
    });

    // Real-time chat events
    newSocket.on("message:new", async (data: any) => {
      const msg: Message = data?.message || data;
      if (msg && msg._id) {
        handleNewMessage(msg);

        // If this conversation is not yet in the active conversation list (e.g. first incoming message in direct chat),
        // fetch and add it immediately so it appears on the chat list without requiring a page reload.
        const currentConversations = useChatStore.getState().conversations;
        const exists = currentConversations.some((c) => c._id === msg.conversationId);
        if (!exists && msg.conversationId) {
          try {
            const freshConv = await messageApi.getConversationById(msg.conversationId);
            if (freshConv) {
              addOrUpdateConversation({
                ...freshConv,
                lastMessage: msg,
                unreadCount: useChatStore.getState().activeConversationId !== msg.conversationId ? 1 : 0,
              });
            }
          } catch (err) {
            console.error("[useSocket] Error fetching new conversation for incoming message:", err);
          }
        }
      }
    });

    newSocket.on("message:reaction:update", (data: { messageId: string; reactions: IReaction[] }) => {
      if (data?.messageId && data?.reactions) {
        updateReactions(data.messageId, data.reactions);
      }
    });

    newSocket.on("message:read:update", ({ conversationId, messageIds, readerId }) => {
      updateMessageReadStatus(conversationId, messageIds, readerId);
    });

    newSocket.on("message:status_update", ({ conversationId, messageId, status }: { conversationId: string; messageId: string; status: "sent" | "delivered" | "read" }) => {
      if (conversationId && messageId && status) {
        updateMessageStatus(conversationId, messageId, status);
      }
    });

    newSocket.on("message:status_batch_update", ({ conversationId, messageIds, status }: { conversationId: string; messageIds: string[]; status: "sent" | "delivered" | "read" }) => {
      if (conversationId && Array.isArray(messageIds) && status) {
        updateBatchMessageStatus(conversationId, messageIds, status);
      }
    });

    newSocket.on("presence:masked", ({ userId }: { userId: string; isOnline: boolean; lastSeen: null }) => {
      setUserPresence(userId, false, undefined);
    });

    newSocket.on("presence:unmasked", ({ userId, isOnline }: { userId: string; isOnline: boolean }) => {
      setUserPresence(userId, isOnline, undefined);
    });

    newSocket.on("typing:update", ({ conversationId, userId, isTyping }) => {
      const currentUserId = user?.id || user?._id;
      if (currentUserId && userId === currentUserId) {
        return;
      }
      setTyping(conversationId, userId, isTyping);
    });

    newSocket.on("presence:online", ({ userId }) => {
      setUserPresence(userId, true);
    });

    newSocket.on("presence:offline", ({ userId, lastSeen }) => {
      setUserPresence(userId, false, lastSeen);
    });

    newSocket.on("presence:sync", ({ onlineUsers }: { onlineUsers: string[] }) => {
      if (Array.isArray(onlineUsers)) {
        useChatStore.getState().setMultipleUsersOnline(onlineUsers);
      }
    });

    newSocket.on("messages:batch_removed", ({ conversationId, messageIds }: { conversationId: string; messageIds: string[] }) => {
      if (conversationId && Array.isArray(messageIds)) {
        removeMessagesFromConversation(conversationId, messageIds);
      }
    });

    newSocket.on("conversation:deleted", ({ conversationId }: { conversationId: string }) => {
      if (conversationId) {
        removeConversationFromList(conversationId);
      }
    });

    newSocket.on("message:revoked", (data: {
      messageId: string;
      conversationId: string;
      deletedBy?: any;
      deletedAt?: string;
    }) => {
      if (data?.conversationId && data?.messageId) {
        markMessageAsRevoked(data.conversationId, data.messageId, data.deletedBy, data.deletedAt);
      }
    });

    // Advanced Group Governance Socket Events
    newSocket.on("group:settings-updated", (data: { conversationId: string; settings: any }) => {
      if (data?.conversationId && data?.settings) {
        updateGroupSettingsInConversation(data.conversationId, data.settings);
      }
    });

    newSocket.on("group:member-promoted", (data: { conversationId: string; promotedUserId: string }) => {
      if (data?.conversationId && data?.promotedUserId) {
        updateMemberRoleInConversation(data.conversationId, data.promotedUserId, "admin");
      }
    });

    newSocket.on("group:member-demoted", (data: { conversationId: string; demotedUserId: string }) => {
      if (data?.conversationId && data?.demotedUserId) {
        updateMemberRoleInConversation(data.conversationId, data.demotedUserId, "member");
      }
    });

    newSocket.on("group:member-removed", (data: { conversationId: string; removedUserId: string }) => {
      if (data?.conversationId && data?.removedUserId) {
        removeMemberFromConversationState(data.conversationId, data.removedUserId);
        const currentUserId = user?.id || (user as any)?._id;
        if (data.removedUserId === currentUserId) {
          removeConversationFromList(data.conversationId);
        }
      }
    });

    newSocket.on("group:member-left", (data: { conversationId: string; leftUserId: string }) => {
      if (data?.conversationId && data?.leftUserId) {
        removeMemberFromConversationState(data.conversationId, data.leftUserId);
      }
    });

    newSocket.on("group:user-left-admin-alert", (data: { conversationId: string; leftUserId: string; timestamp: string | Date }) => {
      console.log("[Admin Alert] Member left group silently:", data);
    });

    // Explicitly connect
    newSocket.connect();

    return () => {
      isDisposed = true;
      newSocket.removeAllListeners();
      newSocket.disconnect();
      socketRef.current = null;
      setSocket(null);
      setIsConnected(false);
    };
  }, [isSignedIn, user?.id, getToken, setAccessToken, setSocket, setIsConnected, reset, handleNewMessage, updateReactions, updateMessageReadStatus, updateMessageStatus, updateBatchMessageStatus, setTyping, setUserPresence, removeMessagesFromConversation, removeConversationFromList, markMessageAsRevoked]);

  const sendMessage = useCallback(
    (
      conversationId: string,
      content: string,
      type: "text" | "image" | "file" = "text",
      metadata?: { mediaUrl?: string | null; fileName?: string | null; fileSize?: number | null; replyTo?: string | null; isForwarded?: boolean },
      callback?: (response: { success: boolean; message?: any; error?: string }) => void
    ) => {
      const activeSock = socketRef.current || useSocketStore.getState().socket;
      if (!activeSock || !activeSock.connected) {
        console.warn("[useSocket] Cannot send message: socket not connected");
        if (callback) callback({ success: false, error: "Socket not connected" });
        return;
      }
      activeSock.emit(
        "message:send",
        {
          conversationId,
          content,
          type,
          mediaUrl: metadata?.mediaUrl,
          fileName: metadata?.fileName,
          fileSize: metadata?.fileSize,
          replyTo: metadata?.replyTo,
          isForwarded: metadata?.isForwarded,
        },
        callback
      );
    },
    []
  );

  const reactMessage = useCallback(
    (
      conversationId: string,
      messageId: string,
      emoji: string,
      callback?: (response: { success: boolean; reactions?: IReaction[]; error?: string }) => void
    ) => {
      const activeSock = socketRef.current || useSocketStore.getState().socket;
      if (!activeSock || !activeSock.connected) return;
      activeSock.emit("message:react", { conversationId, messageId, emoji }, callback);
    },
    []
  );

  const markAsRead = useCallback((conversationId: string, messageIds: string[]) => {
    const activeSock = socketRef.current || useSocketStore.getState().socket;
    if (!activeSock || !activeSock.connected || messageIds.length === 0) return;
    activeSock.emit("message:read", { conversationId, messageIds });
  }, []);

  const startTyping = useCallback((conversationId: string) => {
    const activeSock = socketRef.current || useSocketStore.getState().socket;
    if (!activeSock || !activeSock.connected) return;
    activeSock.emit("typing:start", { conversationId });
  }, []);

  const stopTyping = useCallback((conversationId: string) => {
    const activeSock = socketRef.current || useSocketStore.getState().socket;
    if (!activeSock || !activeSock.connected) return;
    activeSock.emit("typing:stop", { conversationId });
  }, []);

  const requestPresenceSync = useCallback((contactIds: string[]) => {
    const activeSock = socketRef.current || useSocketStore.getState().socket;
    if (!activeSock || !activeSock.connected || !Array.isArray(contactIds) || contactIds.length === 0) return;
    activeSock.emit("presence:request_sync", contactIds);
  }, []);

  const emitMessagesDeleted = useCallback((conversationId: string, messageIds: string[]) => {
    const activeSock = socketRef.current || useSocketStore.getState().socket;
    if (!activeSock || !activeSock.connected || !conversationId || messageIds.length === 0) return;
    activeSock.emit("messages:deleted", { conversationId, messageIds });
  }, []);

  return {
    socket,
    isConnected,
    sendMessage,
    reactMessage,
    markAsRead,
    startTyping,
    stopTyping,
    requestPresenceSync,
    emitMessagesDeleted,
  };
};
