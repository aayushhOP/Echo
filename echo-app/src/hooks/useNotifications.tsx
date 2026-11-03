import { useEffect } from "react";
import { toast } from "sonner";
import { useSocketStore } from "../store/socketStore";
import { notificationService, NotificationPayload } from "../services/notificationService";
import { useChatStore } from "../store/chatStore";
import { MessageToast } from "../components/notifications/MessageToast";
import { Message, MessageSender } from "../types/message";

export const useNotifications = (currentUserId: string) => {
  const socket = useSocketStore((state) => state.socket);
  const activeConversationId = useChatStore((state) => state.activeConversationId);
  const setActiveConversationId = useChatStore((state) => state.setActiveConversationId);

  // Request browser permission upon initial hook mount (if not decided)
  useEffect(() => {
    notificationService.requestDesktopPermission();
  }, []);

  useEffect(() => {
    if (!socket) return;

    const handleNewMessage = (data: any) => {
      const msg: Message = data?.message || data;
      if (!msg || !msg._id) return;

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

      const isCurrentChat = activeConversationId === payload.conversationId;

      // 2. State Branching Logic

      // Case A: Tab is minimized or behind another window
      if (document.hidden) {
        notificationService.playChime();
        if ("Notification" in window && Notification.permission === "granted") {
          notificationService.showDesktopNotification(payload, (convId) => {
            setActiveConversationId(convId);
          });
        } else {
          // Fallback: If desktop notification permission is not granted or blocked, trigger in-app toast
          toast.custom(
            (t) => (
              <MessageToast
                payload={payload}
                onClick={() => setActiveConversationId(payload.conversationId)}
                onDismiss={() => toast.dismiss(t)}
              />
            ),
            { duration: 4000 }
          );
        }
        return;
      }

      // Case B: Tab is focused, but user is looking at another chat or main screen
      if (!isCurrentChat) {
        notificationService.playChime();
        toast.custom(
          (t) => (
            <MessageToast
              payload={payload}
              onClick={() => setActiveConversationId(payload.conversationId)}
              onDismiss={() => toast.dismiss(t)}
            />
          ),
          { duration: 4000 }
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
  }, [socket, currentUserId, activeConversationId, setActiveConversationId]);
};
