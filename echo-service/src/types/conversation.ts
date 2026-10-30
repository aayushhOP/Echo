import { Types } from "mongoose";

export interface CreateConversationDTO {
  type: "direct" | "group";
  participantId?: string; // For "direct"
  participantIds?: string[]; // For "group"
  participants?: string[]; // Alias for participantIds for "group"
  groupName?: string; // For "group"
  groupAvatar?: string;
}

export interface UpdateConversationDTO {
  groupName?: string;
  groupAvatar?: string;
  addParticipantIds?: string[];
  removeParticipantIds?: string[];
  addParticipants?: string[];
  removeParticipants?: string[];
  pinned?: boolean;
  muted?: boolean;
}

export interface MessageQueryDTO {
  before?: string; // message _id or ISO date cursor
  limit?: number; // default 30
}

export interface ConversationMediaQueryDTO {
  type?: "image" | "file";
  limit?: number; // default 30
  cursor?: string; // message _id cursor
}
