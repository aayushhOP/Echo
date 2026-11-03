import { useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useSocketStore } from "../store/socketStore";
import { notificationService, NotificationPayload } from "../services/notificationService";
import { useChatStore } from "../store/chatStore";
import { MessageToast } from "../components/notifications/MessageToast";
import { Message, MessageSender } from "../types/message";

export const useNotifications = (currentUserId: string) => {
  const location = useLocation();
  const navigate = useNavigate();
  const socket = useSocketStore((state) => state.socket);
  const activeConversationId = useChatStore((state) => state.activeConversationId);
  const setActiveConversationId = useChatStore((state) => state.setActiveConversationId);

  // Keep a set of recently notified message IDs to prevent any duplicate notifications
  const seenMessageIdsRef = useRef<Set<string>>(new Set());

  // Request browser permission upon initial hook mount (if not decided)
  useEffect(() => {
    notificationService.requestDesktopPermission();

    const handleCustomNav = (event: Event) => {
      const customEvent = event as CustomEvent<{ conversationId: string }>;
      if (customEvent.detail?.conversationId) {
        setActiveConversationId(customEvent.detail.conversationId);
        navigate("/chat");
      }
    };

    window.addEventListener("echo:navigate-conversation", handleCustomNav);
    return () => {
      window.removeEventListener("echo:navigate-conversation", handleCustomNav);
    };
  }, [setActiveConversationId, navigate]);

  useEffect(() => {
    if (!socket) return;

    const handleNewMessage = (data: any) => {
      const msg: Message = data?.message || data;
      if (!msg || !msg._id) return;

      // Deduplicate: If this message was already notified in this session, skip
      if (seenMessageIdsRef.current.has(msg._id)) {
        return;
      }
      seenMessageIdsRef.current.add(msg._id);
      // Clean up cache to prevent memory leak (keep last 100 messages)
      if (seenMessageIdsRef.current.size > 100) {
        const firstEntry = seenMessageIdsRef.current.values().next().value;
        if (firstEntry) seenMessageIdsRef.current.delete(firstEntry);
      }

      // Extract sender id cleanly
      const senderId =
        typeof msg.senderId === "string"
          ? msg.senderId
          : (msg.senderId as MessageSender)?.id || (msg.senderId as MessageSender)?._id || "";

      // 1. Never notify on own messages
      if (senderId && currentUserId && senderId === currentUserId) {
        return;
      }

      // Check if this conversation is muted by the current user
      const conversation = useChatStore
        .getState()
        .conversations.find((c) => c._id === msg.conversationId);
      if (conversation?.isMuted) {
        // Conversation is muted: silently ignore notifications (no chime, no toast, no desktop popup)
        return;
      }

      // Extract sender username and avatar
      let senderName = "Someone";
      let senderAvatar: string | undefined = undefined;

      if (typeof msg.senderId === "object" && msg.senderId !== null) {
        senderName = (msg.senderId as MessageSender).username || "Someone";
        senderAvatar = (msg.senderId as MessageSender).avatarUrl;
      } else {
        // Fallback: check conversation participants if available
        const participant = conversation?.participants.find((p) => {
          const pId = (p as any).id || (p as any)._id;
          return pId === senderId;
        });
        if (participant) {
          senderName = participant.username || "Someone";
          senderAvatar = participant.avatarUrl;
        }
      }

      // Check content / attachment fallback
      let displayContent = msg.content;
      if (!displayContent) {
        if (msg.type === "image") displayContent = "Sent an image";
        else if (msg.type === "audio") displayContent = "Sent a voice message";
        else if (msg.type === "file") displayContent = "Sent a file attachment";
        else displayContent = "Sent a message";
      }

      const payload: NotificationPayload = {
        messageId: msg._id,
        conversationId: msg.conversationId,
        senderId,
        senderName,
        senderAvatar,
        content: displayContent,
      };

      const isChatRoute = location.pathname === "/chat" || location.pathname === "/";
      const isCurrentChat = isChatRoute && activeConversationId === payload.conversationId;

      const navigateToChat = (convId: string) => {
        setActiveConversationId(convId);
        if (location.pathname !== "/chat" && location.pathname !== "/") {
          navigate("/chat");
        }
      };

      // 2. State Branching Logic

      // Case A: Tab is minimized or behind another window
      if (document.hidden) {
        notificationService.playChime();
        if ("Notification" in window && Notification.permission === "granted") {
          notificationService.showDesktopNotification(payload, (convId) => {
            navigateToChat(convId);
          });
        } else {
          // Fallback: If desktop notification permission is not granted or blocked, trigger in-app toast
          toast.custom(
            (t) => (
              <MessageToast
                payload={payload}
                onClick={() => navigateToChat(payload.conversationId)}
                onDismiss={() => toast.dismiss(t)}
              />
            ),
            { id: `msg-toast-${payload.messageId}`, duration: 4000 }
          );
        }
        return;
      }

      // Case B: Tab is focused, but user is looking at another chat or another page (groups, contacts, settings, profile)
      if (!isCurrentChat) {
        notificationService.playChime();
        toast.custom(
          (t) => (
            <MessageToast
              payload={payload}
              onClick={() => navigateToChat(payload.conversationId)}
              onDismiss={() => toast.dismiss(t)}
            />
          ),
          { id: `msg-toast-${payload.messageId}`, duration: 4000 }
        );
        return;
      }

      // Case C: User has this conversation active and visible
      // No banners or toasts; UI appends message seamlessly.
    };

    socket.on("message:new", handleNewMessage);

    return () => {
      socket.off("message:new", handleNewMessage);
    };
  }, [socket, currentUserId, activeConversationId, setActiveConversationId, location.pathname, navigate]);
};
