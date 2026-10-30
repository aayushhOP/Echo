import { axiosClient } from "./axiosClient";
import { Conversation, Message } from "../types/message";
import { ApiResponse } from "./authApi";

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

export interface UploadFileResponse {
  url: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
}

export const messageApi = {
  getConversations: async (): Promise<Conversation[]> => {
    const res = await axiosClient.get<ApiResponse<Conversation[]>>("/conversations");
    return res.data.data;
  },

  getConversationById: async (conversationId: string): Promise<Conversation> => {
    const res = await axiosClient.get<ApiResponse<Conversation>>(`/conversations/${conversationId}`);
    return res.data.data;
  },

  createConversation: async (data: CreateConversationDTO): Promise<Conversation> => {
    const res = await axiosClient.post<ApiResponse<Conversation>>("/conversations", data);
    return res.data.data;
  },

  updateConversation: async (
    conversationId: string,
    data: UpdateConversationDTO
  ): Promise<Conversation> => {
    const res = await axiosClient.patch<ApiResponse<Conversation>>(`/conversations/${conversationId}`, data);
    return res.data.data;
  },

  getMessages: async (
    conversationId: string,
    params?: MessageQueryDTO
  ): Promise<Message[]> => {
    const res = await axiosClient.get<ApiResponse<Message[]>>(`/conversations/${conversationId}/messages`, {
      params,
    });
    return res.data.data;
  },

  uploadFile: async (file: File): Promise<UploadFileResponse> => {
    const formData = new FormData();
    formData.append("file", file);
    const res = await axiosClient.post<UploadFileResponse>("/messages/upload", formData, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    });
    return res.data;
  },
};
