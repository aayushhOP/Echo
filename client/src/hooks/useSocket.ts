import { useEffect, useRef } from "react";
import { io } from "socket.io-client";
import { useAuthStore } from "../store/authStore";
import { useSocketStore, AppSocket } from "../store/socketStore";
import { useChatStore } from "../store/chatStore";

export const useSocket = () => {
  const accessToken = useAuthStore((state) => state.accessToken);
  const user = useAuthStore((state) => state.user);
  const { socket, isConnected, setSocket, setIsConnected, reset } = useSocketStore();
  const socketRef = useRef<AppSocket | null>(null);

  const {
    handleNewMessage,
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
    newSocket.on("message:new", ({ message }) => {
      handleNewMessage(message);
    });

    newSocket.on("message:read:update", ({ conversationId, messageIds, readerId }) => {
      updateMessageReadStatus(conversationId, messageIds, readerId);
    });

    newSocket.on("typing:update", ({ conversationId, userId, isTyping }) => {
      setTyping(conversationId, userId, isTyping);
    });

    newSocket.on("presence:online", ({ userId }) => {
      setUserPresence(userId, true);
    });

    newSocket.on("presence:offline", ({ userId }) => {
      setUserPresence(userId, false);
    });

    // Explicitly connect
    newSocket.connect();

    return () => {
      // Disconnect on cleanup/unmount or token change
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
    callback?: (response: { success: boolean; message?: any; error?: string }) => void
  ) => {
    if (!socket || !isConnected) return;
    socket.emit("message:send", { conversationId, content, type }, callback);
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

  return {
    socket,
    isConnected,
    sendMessage,
    markAsRead,
    startTyping,
    stopTyping,
  };
};
