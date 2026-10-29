import { User } from "./user";

export type MessageType = "text" | "image" | "file";
export type MessageStatus = "pending" | "sent" | "delivered" | "read";

export interface Message {
  _id: string;
  conversationId: string;
  senderId: string | User;
  content: string;
  type: MessageType;
  mediaUrl?: string;
  readBy: string[];
  status: MessageStatus;
  createdAt: string;
  updatedAt?: string;
}

export interface Conversation {
  _id: string;
  type: "direct" | "group";
  groupName?: string;
  participants: User[];
  admins?: string[];
  lastMessage?: Message;
  unreadCount?: number;
  createdAt: string;
  updatedAt: string;
}
