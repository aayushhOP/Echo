import { axiosClient } from "./axiosClient";
import { Conversation, Message } from "../types/message";

export interface CreateConversationDTO {
  type: "direct" | "group";
  participantId?: string; // For direct
  participantIds?: string[]; // For group
  participants?: string[]; // Alias for group
  groupName?: string;
}

export interface UpdateConversationDTO {
  groupName?: string;
  addParticipants?: string[];
  removeParticipants?: string[];
}

export interface MessageQueryDTO {
  before?: string;
  limit?: number;
}

export const messageApi = {
  getConversations: async (): Promise<Conversation[]> => {
    const res = await axiosClient.get<Conversation[]>("/conversations");
    return res.data;
  },

  getConversationById: async (conversationId: string): Promise<Conversation> => {
    const res = await axiosClient.get<Conversation>(`/conversations/${conversationId}`);
    return res.data;
  },

  createConversation: async (data: CreateConversationDTO): Promise<Conversation> => {
    const res = await axiosClient.post<Conversation>("/conversations", data);
    return res.data;
  },

  updateConversation: async (
    conversationId: string,
    data: UpdateConversationDTO
  ): Promise<Conversation> => {
    const res = await axiosClient.patch<Conversation>(`/conversations/${conversationId}`, data);
    return res.data;
  },

  getMessages: async (
    conversationId: string,
    params?: MessageQueryDTO
  ): Promise<Message[]> => {
    const res = await axiosClient.get<Message[]>(`/conversations/${conversationId}/messages`, {
      params,
    });
    return res.data;
  },
};
