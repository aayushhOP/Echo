import { axiosClient } from "./axiosClient";
import { Conversation, Message } from "../types/message";
import { ApiResponse } from "./userApi";

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

export interface MediaItem {
  _id: string;
  conversationId: string;
  senderId: {
    _id?: string;
    id?: string;
    username: string;
    avatarUrl?: string;
  };
  content: string;
  type: "image" | "file";
  mediaUrl: string;
  fileName?: string;
  fileSize?: number;
  createdAt: string;
}

export interface MediaResponse {
  items: MediaItem[];
  nextCursor: string | null;
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

  getConversationMedia: async (
    conversationId: string,
    params?: { type?: "image" | "file"; limit?: number; cursor?: string }
  ): Promise<MediaResponse> => {
    const res = await axiosClient.get<MediaResponse>(`/conversations/${conversationId}/media`, {
      params,
    });
    return res.data;
  },

  togglePinConversation: async (conversationId: string): Promise<{ conversationId: string; isPinned: boolean }> => {
    const res = await axiosClient.patch<{ conversationId: string; isPinned: boolean }>(
      `/conversations/${conversationId}/pin`
    );
    return res.data;
  },

  toggleMuteConversation: async (conversationId: string): Promise<{ conversationId: string; isMuted: boolean }> => {
    const res = await axiosClient.patch<{ conversationId: string; isMuted: boolean }>(
      `/conversations/${conversationId}/mute`
    );
    return res.data;
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
