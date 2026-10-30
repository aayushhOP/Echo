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
  "typing:update": (data: {
    conversationId: string;
    userId: string;
    isTyping: boolean;
  }) => void;
  "presence:online": (data: { userId: string }) => void;
  "presence:offline": (data: { userId: string; lastSeen?: string }) => void;
  "presence:sync": (data: { onlineUsers: string[] }) => void;
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
  "typing:start": (payload: { conversationId: string }) => void;
  "typing:stop": (payload: { conversationId: string }) => void;
  "presence:request_sync": (contactIds: string[]) => void;
}
