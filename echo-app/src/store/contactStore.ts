import { create } from "zustand";
import { contactApi, Contact, SaveContactPayload } from "../api/contactApi";

interface ContactState {
  contacts: Contact[];
  isLoading: boolean;
  isAddContactModalOpen: boolean;
  selectedContactForEdit: Partial<Contact> | null;
  fetchContacts: () => Promise<void>;
  saveContact: (payload: SaveContactPayload) => Promise<Contact>;
  deleteContact: (contactUserId: string) => Promise<void>;
  openAddContactModal: (initialData?: Partial<Contact>) => void;
  closeAddContactModal: () => void;
  isContactSaved: (userIdOrClerkId?: string) => boolean;
  getContactDisplayName: (userIdOrClerkId?: string, defaultName?: string) => string;
}

export const useContactStore = create<ContactState>((set, get) => ({
  contacts: [],
  isLoading: false,
  isAddContactModalOpen: false,
  selectedContactForEdit: null,

  fetchContacts: async () => {
    set({ isLoading: true });
    try {
      const contacts = await contactApi.getContacts();
      set({ contacts });
    } catch (err) {
      console.error("Failed to load contacts:", err);
    } finally {
      set({ isLoading: false });
    }
  },

  saveContact: async (payload: SaveContactPayload) => {
    const saved = await contactApi.saveContact(payload);
    // Refresh or update state
    await get().fetchContacts();
    return saved;
  },

  deleteContact: async (contactUserId: string) => {
    await contactApi.deleteContact(contactUserId);
    set((state) => ({
      contacts: state.contacts.filter(
        (c) =>
          c.contactUserId !== contactUserId &&
          c.targetMongoId !== contactUserId &&
          c._id !== contactUserId
      ),
    }));
  },

  openAddContactModal: (initialData) =>
    set({ isAddContactModalOpen: true, selectedContactForEdit: initialData || null }),

  closeAddContactModal: () =>
    set({ isAddContactModalOpen: false, selectedContactForEdit: null }),

  isContactSaved: (userIdOrClerkId?: string) => {
    if (!userIdOrClerkId) return false;
    return get().contacts.some(
      (c) =>
        c.contactUserId === userIdOrClerkId ||
        c.targetMongoId === userIdOrClerkId ||
        c.username?.toLowerCase() === userIdOrClerkId.toLowerCase()
    );
  },

  getContactDisplayName: (userIdOrClerkId?: string, defaultName: string = "User") => {
    if (!userIdOrClerkId) return defaultName;
    const contact = get().contacts.find(
      (c) =>
        c.contactUserId === userIdOrClerkId ||
        c.targetMongoId === userIdOrClerkId ||
        c.username?.toLowerCase() === userIdOrClerkId.toLowerCase()
    );
    return contact ? contact.savedName : defaultName;
  },
}));
