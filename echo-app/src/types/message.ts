import { User } from "./user";

export type MessageType = "text" | "image" | "file";
export type MessageStatus = "pending" | "sent" | "delivered" | "read";

export interface IReaction {
  emoji: string;
  users: string[]; // User IDs who reacted
}

export interface MessageSender {
  _id?: string;
  id?: string;
  username: string;
  email?: string;
  avatarUrl?: string;
  isOnline?: boolean;
}

export interface Message {
  _id: string;
  conversationId: string;
  senderId: string | MessageSender;
  content: string;
  type: MessageType;
  mediaUrl?: string | null;
  fileName?: string | null;
  fileSize?: number | null;
  reactions?: IReaction[];
  replyTo?: string | null;
  readBy: string[];
  status: MessageStatus;
  createdAt: string;
  updatedAt?: string;
}

export interface ConversationParticipant {
  _id: string;
  id?: string;
  username: string;
  avatarUrl?: string;
  isOnline?: boolean;
  lastSeen?: string;
}

export interface Conversation {
  _id: string;
  type: "direct" | "group";
  groupName?: string;
  participants: (User | ConversationParticipant)[];
  admins?: string[];
  lastMessage?: Message;
  unreadCount?: number;
  createdAt?: string;
  updatedAt: string;
}

// Aliases matching spec types exactly
export type IMessage = Message;
export type IConversation = Conversation;
