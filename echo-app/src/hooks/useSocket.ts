import { useEffect, useRef } from "react";
import { io } from "socket.io-client";
import { useAuthStore } from "../store/authStore";
import { useSocketStore, AppSocket } from "../store/socketStore";
import { useChatStore } from "../store/chatStore";
import { Message, IReaction } from "../types/message";

export const useSocket = () => {
  const accessToken = useAuthStore((state) => state.accessToken);
  const user = useAuthStore((state) => state.user);
  const { socket, isConnected, setSocket, setIsConnected, reset } = useSocketStore();
  const socketRef = useRef<AppSocket | null>(null);

  const {
    handleNewMessage,
    updateReactions,
    updateMessageReadStatus,
    setTyping,
    setUserPresence,
  } = useChatStore();

  useEffect(() => {
    // If no authenticated user or access token, disconnect and clean up
    if (!accessToken || !user) {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
        reset();
      }
      return;
    }

    // If socket already exists and connected with current token, keep it
    if (socketRef.current) {
      return;
    }

    const socketUrl =
      import.meta.env.VITE_SOCKET_URL || "https://echo-1aal.onrender.com";

    const newSocket: AppSocket = io(socketUrl, {
      auth: { token: accessToken },
      autoConnect: false,
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
    });

    socketRef.current = newSocket;
    setSocket(newSocket);

    // Event listeners
    newSocket.on("connect", () => {
      setIsConnected(true);
      console.log("[Socket connected]:", newSocket.id);
    });

    newSocket.on("disconnect", (reason) => {
      setIsConnected(false);
      console.log("[Socket disconnected]:", reason);
    });

    newSocket.on("connect_error", (error) => {
      console.error("[Socket connection error]:", error.message);
    });

    // Real-time chat events
    newSocket.on("message:new", (data: any) => {
      const msg: Message = data?.message || data;
      if (msg && msg._id) {
        handleNewMessage(msg);
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

    newSocket.on("typing:update", ({ conversationId, userId, isTyping }) => {
      // Ignore typing events originating from the current user (e.g. across multi-tab or local echoes)
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

    // Explicitly connect
    newSocket.connect();

    return () => {
      newSocket.removeAllListeners();
      newSocket.disconnect();
      socketRef.current = null;
      setSocket(null);
      setIsConnected(false);
    };
  }, [accessToken, user?.id]);

  const sendMessage = (
    conversationId: string,
    content: string,
    type: "text" | "image" | "file" = "text",
    metadata?: { mediaUrl?: string | null; fileName?: string | null; fileSize?: number | null },
    callback?: (response: { success: boolean; message?: any; error?: string }) => void
  ) => {
    if (!socket || !isConnected) return;
    socket.emit(
      "message:send",
      {
        conversationId,
        content,
        type,
        mediaUrl: metadata?.mediaUrl,
        fileName: metadata?.fileName,
        fileSize: metadata?.fileSize,
      },
      callback
    );
  };

  const reactMessage = (
    conversationId: string,
    messageId: string,
    emoji: string,
    callback?: (response: { success: boolean; reactions?: IReaction[]; error?: string }) => void
  ) => {
    if (!socket || !isConnected) return;
    socket.emit("message:react", { conversationId, messageId, emoji }, callback);
  };

  const markAsRead = (conversationId: string, messageIds: string[]) => {
    if (!socket || !isConnected || messageIds.length === 0) return;
    socket.emit("message:read", { conversationId, messageIds });
  };

  const startTyping = (conversationId: string) => {
    if (!socket || !isConnected) return;
    socket.emit("typing:start", { conversationId });
  };

  const stopTyping = (conversationId: string) => {
    if (!socket || !isConnected) return;
    socket.emit("typing:stop", { conversationId });
  };

  const requestPresenceSync = (contactIds: string[]) => {
    if (!socket || !isConnected || !Array.isArray(contactIds) || contactIds.length === 0) return;
    socket.emit("presence:request_sync", contactIds);
  };

  return {
    socket,
    isConnected,
    sendMessage,
    reactMessage,
    markAsRead,
    startTyping,
    stopTyping,
    requestPresenceSync,
  };
};
