import { axiosClient } from "./axiosClient";

export interface Contact {
  _id?: string;
  contactUserId: string;
  targetMongoId?: string;
  savedName: string;
  email?: string;
  phoneNumber?: string;
  username: string;
  avatarUrl?: string;
  status?: string;
  about?: string;
  isOnline?: boolean;
  lastSeen?: string | null;
  savedAt?: string;
}

export interface SaveContactPayload {
  contactUserId: string;
  savedName: string;
  email?: string;
  phoneNumber?: string;
}

export const contactApi = {
  getContacts: async (): Promise<Contact[]> => {
    const res = await axiosClient.get<{ success: boolean; contacts: Contact[] }>("/contacts");
    return res.data.contacts || [];
  },

  saveContact: async (payload: SaveContactPayload): Promise<Contact> => {
    const res = await axiosClient.post<{ success: boolean; message: string; contact: Contact }>(
      "/contacts",
      payload
    );
    return res.data.contact;
  },

  deleteContact: async (contactUserId: string): Promise<void> => {
    await axiosClient.delete(`/contacts/${contactUserId}`);
  },
};
