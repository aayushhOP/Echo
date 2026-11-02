import { User } from "./user";

export type MessageType = "text" | "image" | "file" | "system";
export type MessageStatus = "pending" | "sent" | "delivered" | "read";

export interface IReactionUser {
  _id: string;
  username: string;
  avatarUrl?: string;
}

export interface IReaction {
  emoji: string;
  users: (string | IReactionUser)[];
}

export interface MessageSender {
  _id?: string;
  id?: string;
  username: string;
  email?: string;
  avatarUrl?: string;
  isOnline?: boolean;
}

export interface IDeletedBy {
  userId: string;
  username: string;
  role: "sender" | "admin";
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
  isForwarded?: boolean;
  isPinned?: boolean;
  pinDuration?: "24h" | "7d" | "30d";
  pinnedAt?: string;
  pinnedExpiresAt?: string;
  isDeletedForEveryone?: boolean;
  deletedAt?: string;
  deletedBy?: IDeletedBy;
  deletedForUsers?: string[];
  createdAt: string;
  updatedAt?: string;
}

export interface IGroupParticipant {
  userId: string | ConversationParticipant;
  role: "admin" | "member";
  joinedAt: string;
}

export interface IPastParticipant {
  userId: string | ConversationParticipant;
  leftAt: string;
  reason: "left" | "removed";
}

export interface IGroupSettings {
  onlyAdminsMessage: boolean;
  onlyAdminsEditInfo: boolean;
  onlyAdminsAddMembers: boolean;
  requireAdminApproval: boolean;
}

export interface ConversationParticipant {
  _id: string;
  id?: string;
  clerkId?: string;
  username: string;
  email?: string;
  avatarUrl?: string;
  bio?: string;
  status?: string;
  phone?: string;
  isOnline?: boolean;
  lastSeen?: string;
  isBlocked?: boolean;
}

export interface Conversation {
  _id: string;
  type: "direct" | "group";
  groupName?: string;
  name?: string;
  description?: string;
  groupAvatar?: string;
  avatarUrl?: string;
  creatorId?: string;
  participants: (User | ConversationParticipant)[];
  admins?: string[];
  groupParticipants?: IGroupParticipant[];
  pastParticipants?: IPastParticipant[];
  pendingRequests?: string[];
  inviteToken?: string;
  settings?: IGroupSettings;
  lastMessage?: Message;
  pinnedMessage?: Message | null;
  isPinned?: boolean;
  isMuted?: boolean;
  unreadCount?: number;
  createdAt?: string;
  updatedAt: string;
}

// Aliases matching spec types exactly
export type IMessage = Message;
export type IConversation = Conversation;
