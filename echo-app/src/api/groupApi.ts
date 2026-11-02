import { axiosClient } from "./axiosClient";

export interface GroupSettingsPayload {
  onlyAdminsMessage?: boolean;
  onlyAdminsEditInfo?: boolean;
  onlyAdminsAddMembers?: boolean;
  requireAdminApproval?: boolean;
}

export const groupApi = {
  updateSettings: async (groupId: string, settings: GroupSettingsPayload) => {
    const res = await axiosClient.patch(`/conversations/${groupId}/settings`, settings);
    return res.data;
  },

  promoteMember: async (groupId: string, targetUserId: string) => {
    const res = await axiosClient.post(`/conversations/${groupId}/members/${targetUserId}/promote`);
    return res.data;
  },

  demoteMember: async (groupId: string, targetUserId: string) => {
    const res = await axiosClient.post(`/conversations/${groupId}/members/${targetUserId}/demote`);
    return res.data;
  },

  removeMember: async (groupId: string, targetUserId: string) => {
    const res = await axiosClient.delete(`/conversations/${groupId}/members/${targetUserId}`);
    return res.data;
  },

  leaveGroup: async (groupId: string) => {
    const res = await axiosClient.post(`/conversations/${groupId}/leave`);
    return res.data;
  },

  generateInviteLink: async (groupId: string) => {
    const res = await axiosClient.post<{ success: boolean; inviteUrl: string; inviteToken: string }>(
      `/conversations/${groupId}/invite-link/generate`
    );
    return res.data;
  },

  getGroupByInvite: async (token: string) => {
    const res = await axiosClient.get(`/conversations/invite/${token}`);
    return res.data;
  },

  joinByInvite: async (token: string) => {
    const res = await axiosClient.post(`/conversations/invite/${token}/join`);
    return res.data;
  },

  approveRequest: async (groupId: string, targetUserId: string) => {
    const res = await axiosClient.post(`/conversations/${groupId}/requests/${targetUserId}/approve`);
    return res.data;
  },

  rejectRequest: async (groupId: string, targetUserId: string) => {
    const res = await axiosClient.post(`/conversations/${groupId}/requests/${targetUserId}/reject`);
    return res.data;
  },

  deleteGroup: async (groupId: string): Promise<{ success: boolean; message: string }> => {
    const res = await axiosClient.delete<{ success: boolean; message: string }>(
      `/conversations/${groupId}/delete-group`
    );
    return res.data;
  },
};
