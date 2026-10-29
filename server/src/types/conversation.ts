import { Types } from "mongoose";

export interface CreateConversationDTO {
  type: "direct" | "group";
  participantId?: string; // For "direct"
  participantIds?: string[]; // For "group"
  participants?: string[]; // Alias for participantIds for "group"
  groupName?: string; // For "group"
}

export interface UpdateConversationDTO {
  groupName?: string;
  addParticipantIds?: string[];
  removeParticipantIds?: string[];
  addParticipants?: string[];
  removeParticipants?: string[];
}

export interface MessageQueryDTO {
  before?: string; // message _id or ISO date cursor
  limit?: number; // default 30
}
