import { axiosClient } from "./axiosClient";

export interface GroupSettingsPayload {
  onlyAdminsMessage?: boolean;
  onlyAdminsEditInfo?: boolean;
  onlyAdminsAddMembers?: boolean;
  requireAdminApproval?: boolean;
}

export const groupApi = {
  updateSettings: async (groupId: string, settings: GroupSettingsPayload) => {
    const res = await axiosClient.patch(`/api/conversations/${groupId}/settings`, settings);
    return res.data;
  },

  promoteMember: async (groupId: string, targetUserId: string) => {
    const res = await axiosClient.post(`/api/conversations/${groupId}/members/${targetUserId}/promote`);
    return res.data;
  },

  demoteMember: async (groupId: string, targetUserId: string) => {
    const res = await axiosClient.post(`/api/conversations/${groupId}/members/${targetUserId}/demote`);
    return res.data;
  },

  removeMember: async (groupId: string, targetUserId: string) => {
    const res = await axiosClient.delete(`/api/conversations/${groupId}/members/${targetUserId}`);
    return res.data;
  },

  leaveGroup: async (groupId: string) => {
    const res = await axiosClient.post(`/api/conversations/${groupId}/leave`);
    return res.data;
  },

  generateInviteLink: async (groupId: string) => {
    const res = await axiosClient.post<{ success: boolean; inviteUrl: string; inviteToken: string }>(
      `/api/conversations/${groupId}/invite-link/generate`
    );
    return res.data;
  },

  getGroupByInvite: async (token: string) => {
    const res = await axiosClient.get(`/api/conversations/invite/${token}`);
    return res.data;
  },

  joinByInvite: async (token: string) => {
    const res = await axiosClient.post(`/api/conversations/invite/${token}/join`);
    return res.data;
  },

  approveRequest: async (groupId: string, targetUserId: string) => {
    const res = await axiosClient.post(`/api/conversations/${groupId}/requests/${targetUserId}/approve`);
    return res.data;
  },

  rejectRequest: async (groupId: string, targetUserId: string) => {
    const res = await axiosClient.post(`/api/conversations/${groupId}/requests/${targetUserId}/reject`);
    return res.data;
  },
};
