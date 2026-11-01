import { Message, IReaction } from "./message";

export interface ServerToClientEvents {
  "message:new": (data: { message: Message } | Message) => void;
  "message:delivered": (data: { messageId: string; userId: string }) => void;
  "message:reaction:update": (data: {
    conversationId: string;
    messageId: string;
    reactions: IReaction[];
    userId?: string;
  }) => void;
  "message:read:update": (data: {
    conversationId: string;
    messageIds: string[];
    readerId?: string;
  }) => void;
  "message:status_update": (data: {
    conversationId: string;
    messageId: string;
    status: "sent" | "delivered" | "read";
  }) => void;
  "message:status_batch_update": (data: {
    conversationId: string;
    messageIds: string[];
    status: "sent" | "delivered" | "read";
    readByUserId?: string;
  }) => void;
  "presence:masked": (data: {
    userId: string;
    isOnline: boolean;
    lastSeen: null;
  }) => void;
  "presence:unmasked": (data: {
    userId: string;
    isOnline: boolean;
  }) => void;
  "typing:update": (data: {
    conversationId: string;
    userId: string;
    isTyping: boolean;
  }) => void;
  "presence:online": (data: { userId: string }) => void;
  "presence:offline": (data: { userId: string; lastSeen?: string }) => void;
  "presence:sync": (data: { onlineUsers: string[] }) => void;
  "messages:batch_removed": (data: { conversationId: string; messageIds: string[] }) => void;
  "conversation:deleted": (data: { conversationId: string }) => void;
  "message:revoked": (data: {
    messageId: string;
    conversationId: string;
    deletedBy?: any;
    deletedAt?: string;
  }) => void;
  "group:settings-updated": (data: { conversationId: string; settings: any }) => void;
  "group:member-promoted": (data: { conversationId: string; promotedUserId: string; reason?: string }) => void;
  "group:member-demoted": (data: { conversationId: string; demotedUserId: string }) => void;
  "group:member-removed": (data: { conversationId: string; removedUserId: string }) => void;
  "group:member-left": (data: { conversationId: string; leftUserId: string }) => void;
  "group:user-left-admin-alert": (data: { conversationId: string; leftUserId: string; timestamp: string | Date }) => void;
}

export interface ClientToServerEvents {
  "message:send": (
    payload: {
      conversationId: string;
      content?: string;
      type?: "text" | "image" | "file";
      mediaUrl?: string | null;
      fileName?: string | null;
      fileSize?: number | null;
      replyTo?: string | null;
    },
    callback?: (response: { success: boolean; message?: Message; error?: string }) => void
  ) => void;
  "message:react": (
    payload: {
      conversationId: string;
      messageId: string;
      emoji: string;
    },
    callback?: (response: { success: boolean; reactions?: IReaction[]; error?: string }) => void
  ) => void;
  "message:read": (
    payload: { conversationId: string; messageIds: string[] },
    callback?: (response: { success: boolean; updatedCount?: number; error?: string }) => void
  ) => void;
  "message:mark_read": (
    payload: { conversationId: string; messageIds: string[] },
    callback?: (response: { success: boolean; updatedCount?: number; error?: string }) => void
  ) => void;
  "typing:start": (payload: { conversationId: string }) => void;
  "typing:stop": (payload: { conversationId: string }) => void;
  "presence:request_sync": (contactIds: string[]) => void;
  "messages:deleted": (payload: { conversationId: string; messageIds: string[] }) => void;
}
