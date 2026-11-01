import { create } from "zustand";
import { Conversation, Message, IReaction } from "../types/message";
import { useAuthStore } from "./authStore";

export interface UndoDeleteState {
  messageId: string;
  conversationId: string;
  message?: Message;
}

interface ChatState {
  activeConversationId: string | null;
  conversations: Conversation[];
  messages: Record<string, Message[]>; // conversationId -> messages
  typingUsers: Record<string, Record<string, boolean>>; // conversationId -> { userId: isTyping }
  onlineUsers: Set<string>; // set of online userIds
  userLastSeen: Record<string, string>; // userId -> ISO timestamp

  // Undo delete for me snackbar state
  undoDeleteState: UndoDeleteState | null;
  setUndoDeleteState: (state: UndoDeleteState | null) => void;

  // Advanced Header Actions state
  isContactDrawerOpen: boolean;
  isSearchOpen: boolean;
  searchQuery: string;
  isSelectionMode: boolean;
  selectedMessageIds: string[];

  setActiveConversationId: (id: string | null) => void;
  setContactDrawerOpen: (open: boolean) => void;
  toggleSearch: () => void;
  setSearchQuery: (query: string) => void;
  enterSelectionMode: (initialMessageId?: string) => void;
  exitSelectionMode: () => void;
  toggleSelectMessage: (messageId: string) => void;
  selectAllMessages: (messageIds: string[]) => void;
  removeConversationFromList: (conversationId: string) => void;
  removeMessagesFromConversation: (conversationId: string, messageIds: string[]) => void;

  clearUnreadCount: (conversationId: string) => void;
  setConversations: (conversations: Conversation[]) => void;
  addOrUpdateConversation: (conversation: Conversation) => void;
  setMessages: (conversationId: string, messages: Message[]) => void;
  prependMessages: (conversationId: string, messages: Message[]) => void;
  addOptimisticMessage: (message: Message) => void;
  reconcileMessage: (tempId: string, confirmedMessage: Message) => void;
  handleNewMessage: (message: Message) => void;
  addMessage: (message: Message) => void;
  updateMessageStatus: (conversationId: string, messageId: string, status: "sent" | "delivered" | "read") => void;
  updateBatchMessageStatus: (conversationId: string, messageIds: string[], status: "sent" | "delivered" | "read") => void;
  updateMessageReadStatus: (conversationId: string, messageIds: string[], readerId?: string) => void;
  markMessagesAsRead: (messageIds: string[]) => void;
  markMessageAsRevoked: (conversationId: string, messageId: string, deletedBy?: any, deletedAt?: string) => void;
  removeMessageForMe: (conversationId: string, messageId: string) => void;
  restoreMessageForMe: (conversationId: string, message: Message) => void;
  clearConversationMessages: (conversationId: string) => void;
  updateReactions: (messageId: string, reactions: IReaction[]) => void;
  toggleOptimisticReaction: (
    messageId: string,
    emoji: string,
    user: { id: string; username: string; avatarUrl?: string }
  ) => void;
  setTyping: (conversationId: string, userId: string, isTyping: boolean) => void;
  setUserPresence: (userId: string, isOnline: boolean, lastSeen?: string) => void;
  setUserOnline: (userId: string, isOnline: boolean, lastSeen?: string) => void;
  setOnlineUsers: (userIds: string[]) => void;
  setMultipleUsersOnline: (userIds: string[]) => void;
  resetChat: () => void;
}

export const useChatStore = create<ChatState>((set, get) => ({
  activeConversationId: null,
  conversations: [],
  messages: {},
  typingUsers: {},
  onlineUsers: new Set<string>(),
  userLastSeen: {},

  undoDeleteState: null,
  setUndoDeleteState: (undoDeleteState) => set({ undoDeleteState }),

  isContactDrawerOpen: false,
  isSearchOpen: false,
  searchQuery: "",
  isSelectionMode: false,
  selectedMessageIds: [],

  setActiveConversationId: (id) => {
    set((state) => {
      // If opening a conversation, immediately clear its unreadCount
      const updatedConversations = id
        ? state.conversations.map((c) => (c._id === id ? { ...c, unreadCount: 0 } : c))
        : state.conversations;

      return {
        activeConversationId: id,
        conversations: updatedConversations,
        isSearchOpen: false,
        searchQuery: "",
        isSelectionMode: false,
        selectedMessageIds: [],
        isContactDrawerOpen: false,
      };
    });
  },

  setContactDrawerOpen: (open) => set({ isContactDrawerOpen: open }),

  toggleSearch: () =>
    set((state) => ({
      isSearchOpen: !state.isSearchOpen,
      searchQuery: "",
    })),

  setSearchQuery: (query) => set({ searchQuery: query }),

  enterSelectionMode: (initialMessageId) =>
    set({
      isSelectionMode: true,
      selectedMessageIds: initialMessageId ? [initialMessageId] : [],
    }),

  exitSelectionMode: () =>
    set({
      isSelectionMode: false,
      selectedMessageIds: [],
    }),

  toggleSelectMessage: (messageId) =>
    set((state) => {
      const exists = state.selectedMessageIds.includes(messageId);
      return {
        selectedMessageIds: exists
          ? state.selectedMessageIds.filter((id) => id !== messageId)
          : [...state.selectedMessageIds, messageId],
      };
    }),

  selectAllMessages: (messageIds) => set({ selectedMessageIds: messageIds }),

  removeConversationFromList: (conversationId) =>
    set((state) => ({
      conversations: state.conversations.filter((c) => c._id !== conversationId),
      activeConversationId:
        state.activeConversationId === conversationId ? null : state.activeConversationId,
      isContactDrawerOpen: false,
      isSelectionMode: false,
      selectedMessageIds: [],
      isSearchOpen: false,
      searchQuery: "",
    })),

  removeMessagesFromConversation: (conversationId, messageIds) =>
    set((state) => {
      const idSet = new Set(messageIds);
      const currentList = state.messages[conversationId] || [];
      const updatedList = currentList.filter((m) => !idSet.has(m._id));

      // Also update lastMessage in conversations list if it was deleted
      const updatedConversations = state.conversations.map((c) => {
        if (c._id === conversationId) {
          const lastMsgId =
            typeof c.lastMessage === "string"
              ? c.lastMessage
              : c.lastMessage?._id;
          if (lastMsgId && idSet.has(lastMsgId)) {
            const newLastMsg = updatedList[updatedList.length - 1] || undefined;
            return {
              ...c,
              lastMessage: newLastMsg,
            };
          }
        }
        return c;
      });

      return {
        messages: {
          ...state.messages,
          [conversationId]: updatedList,
        },
        conversations: updatedConversations,
        selectedMessageIds: state.selectedMessageIds.filter((id) => !idSet.has(id)),
        isSelectionMode:
          state.selectedMessageIds.filter((id) => !idSet.has(id)).length > 0 &&
          state.isSelectionMode,
      };
    }),

  clearUnreadCount: (conversationId) => {
    set((state) => ({
      conversations: state.conversations.map((c) =>
        c._id === conversationId ? { ...c, unreadCount: 0 } : c
      ),
    }));
  },

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

      const existingIndex = current.findIndex((m) => m._id === message._id);
      if (existingIndex >= 0) {
        const updated = [...current];
        updated[existingIndex] = message;
        return {
          messages: { ...state.messages, [conversationId]: updated },
        };
      }

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

      // Determine current user ID to check if incoming message was sent by someone else
      const authUser = useAuthStore.getState().user;
      const currentUserId = authUser?.id || (authUser as any)?._id;
      const isFromOtherUser = msgSenderId && currentUserId && msgSenderId !== currentUserId;
      const isChatNotActive = state.activeConversationId !== conversationId;

      const convList = state.conversations.map((c) => {
        if (c._id === conversationId) {
          // Increment unread count if message came from another user and this conversation is NOT currently open
          const currentUnread = c.unreadCount || 0;
          const newUnread = isFromOtherUser && isChatNotActive ? currentUnread + 1 : 0;

          return {
            ...c,
            lastMessage: message,
            unreadCount: newUnread,
            updatedAt: message.createdAt,
          };
        }
        return c;
      });

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

  addMessage: (message) => {
    get().handleNewMessage(message);
  },

  updateMessageStatus: (conversationId, messageId, status) => {
    set((state) => {
      const convMessages = state.messages[conversationId] || [];
      return {
        messages: {
          ...state.messages,
          [conversationId]: convMessages.map((m) =>
            m._id === messageId ? { ...m, status } : m
          ),
        },
      };
    });
  },

  updateBatchMessageStatus: (conversationId, messageIds, status) => {
    set((state) => {
      const idSet = new Set(messageIds);
      const convMessages = state.messages[conversationId] || [];
      return {
        messages: {
          ...state.messages,
          [conversationId]: convMessages.map((m) =>
            idSet.has(m._id) ? { ...m, status } : m
          ),
        },
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
          const readBy = readerId
            ? (msg.readBy.includes(readerId) ? msg.readBy : [...msg.readBy, readerId])
            : msg.readBy;
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

  markMessagesAsRead: (messageIds) => {
    const idsSet = new Set(messageIds);
    set((state) => {
      const nextMessages: Record<string, Message[]> = {};
      for (const [convId, list] of Object.entries(state.messages)) {
        nextMessages[convId] = list.map((msg) => {
          if (idsSet.has(msg._id)) {
            return {
              ...msg,
              status: "read" as const,
            };
          }
          return msg;
        });
      }
      return { messages: nextMessages };
    });
  },

  markMessageAsRevoked: (conversationId, messageId, deletedBy, deletedAt) => {
    set((state) => {
      const current = state.messages[conversationId] || [];
      const updatedMessages = current.map((msg) => {
        if (msg._id === messageId) {
          return {
            ...msg,
            content: "",
            mediaUrl: null,
            fileName: null,
            fileSize: null,
            isDeletedForEveryone: true,
            deletedAt: deletedAt || new Date().toISOString(),
            deletedBy: deletedBy || msg.deletedBy,
          };
        }
        return msg;
      });

      // Also update lastMessage in conversations list if revoked
      const updatedConversations = state.conversations.map((c) => {
        if (c._id === conversationId) {
          const lastMsgId =
            typeof c.lastMessage === "string"
              ? c.lastMessage
              : c.lastMessage?._id;
          if (lastMsgId === messageId) {
            return {
              ...c,
              lastMessage: {
                ...(typeof c.lastMessage === "object" ? c.lastMessage : {}),
                _id: messageId,
                content: "",
                isDeletedForEveryone: true,
                deletedBy: deletedBy || (c.lastMessage as any)?.deletedBy,
              } as Message,
            };
          }
        }
        return c;
      });

      return {
        messages: {
          ...state.messages,
          [conversationId]: updatedMessages,
        },
        conversations: updatedConversations,
      };
    });
  },

  removeMessageForMe: (conversationId, messageId) => {
    set((state) => {
      const current = state.messages[conversationId] || [];
      const updated = current.filter((m) => m._id !== messageId);

      const updatedConversations = state.conversations.map((c) => {
        if (c._id === conversationId) {
          const lastMsgId =
            typeof c.lastMessage === "string"
              ? c.lastMessage
              : c.lastMessage?._id;
          if (lastMsgId === messageId) {
            return {
              ...c,
              lastMessage: updated[updated.length - 1] || undefined,
            };
          }
        }
        return c;
      });

      return {
        messages: {
          ...state.messages,
          [conversationId]: updated,
        },
        conversations: updatedConversations,
      };
    });
  },

  restoreMessageForMe: (conversationId, message) => {
    set((state) => {
      const current = state.messages[conversationId] || [];
      if (current.some((m) => m._id === message._id)) {
        return state;
      }
      const updated = [...current, message].sort(
        (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      );

      const latestMsg = updated[updated.length - 1];

      const updatedConversations = state.conversations.map((c) => {
        if (c._id === conversationId) {
          const currentLastCreatedAt = c.lastMessage?.createdAt
            ? new Date(c.lastMessage.createdAt).getTime()
            : 0;
          const restoredCreatedAt = latestMsg?.createdAt
            ? new Date(latestMsg.createdAt).getTime()
            : 0;

          if (restoredCreatedAt >= currentLastCreatedAt) {
            return {
              ...c,
              lastMessage: latestMsg,
            };
          }
        }
        return c;
      });

      return {
        messages: {
          ...state.messages,
          [conversationId]: updated,
        },
        conversations: updatedConversations,
      };
    });
  },

  clearConversationMessages: (conversationId) => {
    set((state) => ({
      messages: {
        ...state.messages,
        [conversationId]: [],
      },
      conversations: state.conversations.map((c) =>
        c._id === conversationId ? { ...c, lastMessage: undefined } : c
      ),
    }));
  },

  updateReactions: (messageId, reactions) => {
    set((state) => {
      let found = false;
      const nextMessages: Record<string, Message[]> = {};
      for (const [convId, list] of Object.entries(state.messages)) {
        nextMessages[convId] = list.map((msg) => {
          if (msg._id === messageId) {
            found = true;
            return {
              ...msg,
              reactions,
            };
          }
          return msg;
        });
      }
      return found ? { messages: nextMessages } : state;
    });
  },

  toggleOptimisticReaction: (messageId, emoji, user) => {
    set((state) => {
      let found = false;
      const nextMessages: Record<string, Message[]> = {};
      for (const [convId, list] of Object.entries(state.messages)) {
        nextMessages[convId] = list.map((msg) => {
          if (msg._id === messageId) {
            found = true;
            const currentReactions = [...(msg.reactions || [])];
            const reactionIndex = currentReactions.findIndex((r) => r.emoji === emoji);

            if (reactionIndex > -1) {
              const r = currentReactions[reactionIndex];
              const userIndex = r.users.findIndex((u) =>
                typeof u === "string" ? u === user.id : u._id === user.id
              );

              if (userIndex > -1) {
                // Remove reaction
                r.users.splice(userIndex, 1);
                if (r.users.length === 0) {
                  currentReactions.splice(reactionIndex, 1);
                }
              } else {
                // Add user to reaction
                r.users.push({
                  _id: user.id,
                  username: user.username,
                  avatarUrl: user.avatarUrl,
                });
              }
            } else {
              // New reaction emoji
              currentReactions.push({
                emoji,
                users: [
                  {
                    _id: user.id,
                    username: user.username,
                    avatarUrl: user.avatarUrl,
                  },
                ],
              });
            }

            return {
              ...msg,
              reactions: currentReactions,
            };
          }
          return msg;
        });
      }
      return found ? { messages: nextMessages } : state;
    });
  },

  setTyping: (conversationId, userId, isTyping) => {
    set((state) => {
      const currentConvTyping = { ...(state.typingUsers[conversationId] || {}) };
      if (isTyping) {
        currentConvTyping[userId] = true;
      } else {
        delete currentConvTyping[userId];
      }
      return {
        typingUsers: {
          ...state.typingUsers,
          [conversationId]: currentConvTyping,
        },
      };
    });
  },

  setUserPresence: (userId, isOnline, lastSeen) => {
    set((state) => {
      const updated = new Set(state.onlineUsers);
      const updatedLastSeen = { ...state.userLastSeen };
      if (isOnline) {
        updated.add(userId);
      } else {
        updated.delete(userId);
        if (lastSeen) {
          updatedLastSeen[userId] = lastSeen;
        } else if (lastSeen === null || lastSeen === undefined) {
          // If masked or not provided when going offline, clear lastSeen
          delete updatedLastSeen[userId];
        }
      }
      return { onlineUsers: updated, userLastSeen: updatedLastSeen };
    });
  },

  setUserOnline: (userId, isOnline, lastSeen) => {
    get().setUserPresence(userId, isOnline, lastSeen);
  },

  setOnlineUsers: (userIds) => {
    set({ onlineUsers: new Set(userIds) });
  },

  setMultipleUsersOnline: (userIds) => {
    set((state) => {
      const updated = new Set(state.onlineUsers);
      for (const id of userIds) {
        updated.add(id);
      }
      return { onlineUsers: updated };
    });
  },

  resetChat: () => {
    set({
      activeConversationId: null,
      conversations: [],
      messages: {},
      typingUsers: {},
      onlineUsers: new Set<string>(),
      userLastSeen: {},
      isContactDrawerOpen: false,
      isSearchOpen: false,
      searchQuery: "",
      isSelectionMode: false,
      selectedMessageIds: [],
    });
  },
}));

// Export chatStore alias as well to match spec section 6
export const chatStore = {
  getState: useChatStore.getState,
  setState: useChatStore.setState,
  subscribe: useChatStore.subscribe,
};
