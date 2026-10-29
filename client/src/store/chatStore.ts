import { create } from "zustand";
import { Conversation, Message } from "../types/message";

interface ChatState {
  activeConversationId: string | null;
  conversations: Conversation[];
  messages: Record<string, Message[]>; // conversationId -> messages
  typingUsers: Record<string, Record<string, boolean>>; // conversationId -> { userId: isTyping }
  onlineUsers: Set<string>; // set of online userIds

  setActiveConversationId: (id: string | null) => void;
  setConversations: (conversations: Conversation[]) => void;
  addOrUpdateConversation: (conversation: Conversation) => void;
  setMessages: (conversationId: string, messages: Message[]) => void;
  prependMessages: (conversationId: string, messages: Message[]) => void;
  addOptimisticMessage: (message: Message) => void;
  reconcileMessage: (tempId: string, confirmedMessage: Message) => void;
  handleNewMessage: (message: Message) => void;
  updateMessageReadStatus: (conversationId: string, messageIds: string[], readerId: string) => void;
  setTyping: (conversationId: string, userId: string, isTyping: boolean) => void;
  setUserPresence: (userId: string, isOnline: boolean) => void;
  setOnlineUsers: (userIds: string[]) => void;
  resetChat: () => void;
}

export const useChatStore = create<ChatState>((set, get) => ({
  activeConversationId: null,
  conversations: [],
  messages: {},
  typingUsers: {},
  onlineUsers: new Set<string>(),

  setActiveConversationId: (id) => set({ activeConversationId: id }),

  setConversations: (conversations) => set({ conversations }),

  addOrUpdateConversation: (conversation) => {
    const list = get().conversations;
    const index = list.findIndex((c) => c._id === conversation._id);
    if (index >= 0) {
      const updated = [...list];
      updated[index] = { ...updated[index], ...conversation };
      set({ conversations: updated });
    } else {
      set({ conversations: [conversation, ...list] });
    }
  },

  setMessages: (conversationId, messages) => {
    set((state) => ({
      messages: {
        ...state.messages,
        [conversationId]: messages,
      },
    }));
  },

  prependMessages: (conversationId, olderMessages) => {
    set((state) => {
      const current = state.messages[conversationId] || [];
      // Filter duplicates by _id
      const existingIds = new Set(current.map((m) => m._id));
      const freshOlder = olderMessages.filter((m) => !existingIds.has(m._id));
      return {
        messages: {
          ...state.messages,
          [conversationId]: [...freshOlder, ...current],
        },
      };
    });
  },

  addOptimisticMessage: (message) => {
    const { conversationId } = message;
    set((state) => {
      const current = state.messages[conversationId] || [];
      return {
        messages: {
          ...state.messages,
          [conversationId]: [...current, message],
        },
      };
    });
  },

  reconcileMessage: (tempId, confirmedMessage) => {
    const { conversationId } = confirmedMessage;
    set((state) => {
      const current = state.messages[conversationId] || [];
      const index = current.findIndex((m) => m._id === tempId);
      if (index >= 0) {
        const next = [...current];
        next[index] = confirmedMessage;
        return {
          messages: {
            ...state.messages,
            [conversationId]: next,
          },
        };
      } else {
        // If not found by tempId, add if not duplicate
        if (!current.some((m) => m._id === confirmedMessage._id)) {
          return {
            messages: {
              ...state.messages,
              [conversationId]: [...current, confirmedMessage],
            },
          };
        }
      }
      return state;
    });
  },

  handleNewMessage: (message) => {
    const { conversationId } = message;
    set((state) => {
      const current = state.messages[conversationId] || [];

      // Check if message already exists (e.g. by _id)
      const existingIndex = current.findIndex((m) => m._id === message._id);
      if (existingIndex >= 0) {
        const updated = [...current];
        updated[existingIndex] = message;
        return {
          messages: { ...state.messages, [conversationId]: updated },
        };
      }

      // Check if there is an optimistic pending message from the same sender with matching content
      const msgSenderId =
        typeof message.senderId === "string"
          ? message.senderId
          : (message.senderId as any)._id || message.senderId.id;

      const pendingIndex = current.findIndex((m) => {
        if (m.status !== "pending") return false;
        const pendingSenderId =
          typeof m.senderId === "string"
            ? m.senderId
            : (m.senderId as any)._id || m.senderId.id;
        return m.content === message.content && pendingSenderId === msgSenderId;
      });

      let nextMessages: Message[];
      if (pendingIndex >= 0) {
        nextMessages = [...current];
        nextMessages[pendingIndex] = message;
      } else {
        nextMessages = [...current, message];
      }

      // Also update lastMessage in conversation list
      const convList = state.conversations.map((c) => {
        if (c._id === conversationId) {
          return {
            ...c,
            lastMessage: message,
            updatedAt: message.createdAt,
          };
        }
        return c;
      });

      // Sort conversations by lastMessage/updatedAt
      convList.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

      return {
        messages: {
          ...state.messages,
          [conversationId]: nextMessages,
        },
        conversations: convList,
      };
    });
  },

  updateMessageReadStatus: (conversationId, messageIds, readerId) => {
    set((state) => {
      const current = state.messages[conversationId];
      if (!current) return state;

      const idsSet = new Set(messageIds);
      const updatedMessages = current.map((msg) => {
        if (idsSet.has(msg._id)) {
          const readBy = msg.readBy.includes(readerId)
            ? msg.readBy
            : [...msg.readBy, readerId];
          return {
            ...msg,
            readBy,
            status: "read" as const,
          };
        }
        return msg;
      });

      return {
        messages: {
          ...state.messages,
          [conversationId]: updatedMessages,
        },
      };
    });
  },

  setTyping: (conversationId, userId, isTyping) => {
    set((state) => {
      const convTyping = { ...(state.typingUsers[conversationId] || {}) };
      if (isTyping) {
        convTyping[userId] = true;
      } else {
        delete convTyping[userId];
      }
      return {
        typingUsers: {
          ...state.typingUsers,
          [conversationId]: convTyping,
        },
      };
    });
  },

  setUserPresence: (userId, isOnline) => {
    set((state) => {
      const updated = new Set(state.onlineUsers);
      if (isOnline) {
        updated.add(userId);
      } else {
        updated.delete(userId);
      }
      return { onlineUsers: updated };
    });
  },

  setOnlineUsers: (userIds) => {
    set({ onlineUsers: new Set(userIds) });
  },

  resetChat: () => {
    set({
      activeConversationId: null,
      conversations: [],
      messages: {},
      typingUsers: {},
      onlineUsers: new Set<string>(),
    });
  },
}));
