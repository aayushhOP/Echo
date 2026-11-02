import { create } from "zustand";
import { Conversation, Message, IReaction, ConversationParticipant } from "../types/message";
import { User } from "../types/user";
import { useAuthStore } from "./authStore";

export interface UndoDeleteState {
  messageId: string;
  conversationId: string;
  message?: Message;
}

export interface QuotedMessage {
  _id: string;
  senderId: string;
  senderUsername: string;
  content: string;
  type: "text" | "image" | "file";
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
  contactDrawerUser: (User | ConversationParticipant) | null;
  setContactDrawerUser: (user: (User | ConversationParticipant) | null) => void;
  isSearchOpen: boolean;
  searchQuery: string;
  isSelectionMode: boolean;
  selectedMessageIds: string[];

  // Quoted reply state
  replyingTo: QuotedMessage | null;
  setReplyingTo: (msg: QuotedMessage | null) => void;

  // Forwarding modal state
  forwardingMessage: { _id: string; content: string } | null;
  setForwardingMessage: (msg: { _id: string; content: string } | null) => void;

  // Pin duration dialog state
  pinningMessage: Message | null;
  setPinningMessage: (msg: Message | null) => void;

  // Pin toggle action
  togglePinMessage: (
    conversationId: string,
    messageId: string,
    isPinned: boolean,
    duration?: "24h" | "7d" | "30d"
  ) => void;

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
  updateGroupSettingsInConversation: (conversationId: string, settings: any) => void;
  updateMemberRoleInConversation: (conversationId: string, userId: string, role: "admin" | "member") => void;
  removeMemberFromConversationState: (conversationId: string, userId: string) => void;
  setParticipantBlockedStatus: (userId: string, isBlocked: boolean) => void;
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
  contactDrawerUser: null,
  setContactDrawerUser: (user) => set({ contactDrawerUser: user, isContactDrawerOpen: !!user }),
  isSearchOpen: false,
  searchQuery: "",
  isSelectionMode: false,
  selectedMessageIds: [],

  replyingTo: null,
  setReplyingTo: (replyingTo) => set({ replyingTo }),

  forwardingMessage: null,
  setForwardingMessage: (forwardingMessage) => set({ forwardingMessage }),

  pinningMessage: null,
  setPinningMessage: (pinningMessage) => set({ pinningMessage }),

  togglePinMessage: (conversationId, messageId, isPinned, duration = "7d") =>
    set((state) => {
      const convMessages = state.messages[conversationId] || [];
      const now = new Date();
      let expiresAt: string | undefined = undefined;
      if (isPinned) {
        const ms =
          duration === "24h"
            ? 24 * 60 * 60 * 1000
            : duration === "30d"
            ? 30 * 24 * 60 * 60 * 1000
            : 7 * 24 * 60 * 60 * 1000;
        expiresAt = new Date(now.getTime() + ms).toISOString();
      }

      // If we are pinning a message, unpin any previously pinned message in this conversation so the top bar shows the newest pin
      const updatedMessages = convMessages.map((m) => {
        if (m._id === messageId) {
          return {
            ...m,
            isPinned,
            pinDuration: isPinned ? duration : undefined,
            pinnedAt: isPinned ? now.toISOString() : undefined,
            pinnedExpiresAt: expiresAt,
          };
        }
        if (isPinned && m.isPinned) {
          // Unpin previous pins if only 1 message can be prominently pinned at a time
          return { ...m, isPinned: false };
        }
        return m;
      });

      const targetMsg = updatedMessages.find((m) => m._id === messageId);
      const updatedConversations = state.conversations.map((c) => {
        if (c._id === conversationId) {
          return {
            ...c,
            pinnedMessage: isPinned ? targetMsg || null : null,
          };
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
    }),

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
        contactDrawerUser: null,
      };
    });
  },

  setContactDrawerOpen: (open) =>
    set((state) => ({
      isContactDrawerOpen: open,
      contactDrawerUser: open ? state.contactDrawerUser : null,
    })),

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
      contactDrawerUser: null,
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
      const updatedConversations = state.conversations.map((c) => {
        if (c._id === conversationId) {
          return {
            ...c,
            lastMessage: message,
            updatedAt: message.createdAt,
          };
        }
        return c;
      });
      updatedConversations.sort(
        (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      );

      return {
        messages: {
          ...state.messages,
          [conversationId]: [...current, message],
        },
        conversations: updatedConversations,
      };
    });
  },

  reconcileMessage: (tempId, confirmedMessage) => {
    const { conversationId } = confirmedMessage;
    set((state) => {
      const current = state.messages[conversationId] || [];
      let next: Message[];
      const index = current.findIndex((m) => m._id === tempId);
      if (index >= 0) {
        next = [...current];
        next[index] = confirmedMessage;
      } else {
        if (!current.some((m) => m._id === confirmedMessage._id)) {
          next = [...current, confirmedMessage];
        } else {
          next = current;
        }
      }

      const updatedConversations = state.conversations.map((c) => {
        if (c._id === conversationId) {
          return {
            ...c,
            lastMessage: confirmedMessage,
            updatedAt: confirmedMessage.createdAt,
          };
        }
        return c;
      });
      updatedConversations.sort(
        (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      );

      return {
        messages: {
          ...state.messages,
          [conversationId]: next,
        },
        conversations: updatedConversations,
      };
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
            const currentReactions: IReaction[] = (msg.reactions || []).map((r) => ({
              emoji: r.emoji,
              users: [...r.users],
            }));

            const userIdStr = user.id.toString();

            // Find if user already reacted with ANY emoji
            let existingEmojiReactionIndex = -1;
            let existingEmojiUserIndex = -1;

            for (let rIdx = 0; rIdx < currentReactions.length; rIdx++) {
              const uIdx = currentReactions[rIdx].users.findIndex(
                (u) => (typeof u === "string" ? u : u._id) === userIdStr
              );
              if (uIdx > -1) {
                existingEmojiReactionIndex = rIdx;
                existingEmojiUserIndex = uIdx;
                break;
              }
            }

            // Case 1: Same emoji -> remove (toggle off)
            if (
              existingEmojiReactionIndex > -1 &&
              currentReactions[existingEmojiReactionIndex].emoji === emoji
            ) {
              currentReactions[existingEmojiReactionIndex].users.splice(existingEmojiUserIndex, 1);
              if (currentReactions[existingEmojiReactionIndex].users.length === 0) {
                currentReactions.splice(existingEmojiReactionIndex, 1);
              }
            } else {
              // Case 2: Different emoji -> remove old reaction first (WhatsApp 1-reaction rule)
              if (existingEmojiReactionIndex > -1) {
                currentReactions[existingEmojiReactionIndex].users.splice(existingEmojiUserIndex, 1);
                if (currentReactions[existingEmojiReactionIndex].users.length === 0) {
                  currentReactions.splice(existingEmojiReactionIndex, 1);
                }
              }

              // Add user to the target emoji
              const targetIndex = currentReactions.findIndex((r) => r.emoji === emoji);
              const userObj = {
                _id: user.id,
                username: user.username,
                avatarUrl: user.avatarUrl,
              };

              if (targetIndex > -1) {
                currentReactions[targetIndex].users.push(userObj);
              } else {
                currentReactions.push({
                  emoji,
                  users: [userObj],
                });
              }
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

  updateGroupSettingsInConversation: (conversationId, settings) => {
    set((state) => ({
      conversations: state.conversations.map((c) =>
        c._id === conversationId ? { ...c, settings: { ...c.settings, ...settings } } : c
      ),
    }));
  },

  updateMemberRoleInConversation: (conversationId, userId, role) => {
    set((state) => ({
      conversations: state.conversations.map((c) => {
        if (c._id !== conversationId) return c;

        const updatedGParticipants = (c.groupParticipants || []).map((gp) => {
          const uId = typeof gp.userId === "string" ? gp.userId : (gp.userId as any)?._id || (gp.userId as any)?.id;
          if (uId === userId) {
            return { ...gp, role };
          }
          return gp;
        });

        let updatedAdmins = c.admins ? [...c.admins] : [];
        if (role === "admin" && !updatedAdmins.includes(userId)) {
          updatedAdmins.push(userId);
        } else if (role === "member") {
          updatedAdmins = updatedAdmins.filter((a) => a !== userId);
        }

        return {
          ...c,
          admins: updatedAdmins,
          groupParticipants: updatedGParticipants,
        };
      }),
    }));
  },

  removeMemberFromConversationState: (conversationId, userId) => {
    set((state) => ({
      conversations: state.conversations.map((c) => {
        if (c._id !== conversationId) return c;

        const updatedParticipants = c.participants.filter((p: any) => {
          const pId = p._id || p.id;
          return pId !== userId;
        });

        const updatedGParticipants = (c.groupParticipants || []).filter((gp) => {
          const uId = typeof gp.userId === "string" ? gp.userId : (gp.userId as any)?._id || (gp.userId as any)?.id;
          return uId !== userId;
        });

        const updatedAdmins = (c.admins || []).filter((a) => a !== userId);

        return {
          ...c,
          participants: updatedParticipants,
          groupParticipants: updatedGParticipants,
          admins: updatedAdmins,
        };
      }),
    }));
  },

  setParticipantBlockedStatus: (targetUserId, isBlocked) => {
    set((state) => ({
      conversations: state.conversations.map((c) => {
        if (!Array.isArray(c.participants)) return c;
        const hasUser = c.participants.some(
          (p: any) => (p._id || p.id) === targetUserId
        );
        if (!hasUser) return c;

        return {
          ...c,
          participants: c.participants.map((p: any) => {
            const pId = p._id || p.id;
            if (pId === targetUserId) {
              return {
                ...p,
                isBlocked,
                ...(isBlocked ? { isOnline: false, lastSeen: undefined } : {}),
              };
            }
            return p;
          }),
        };
      }),
    }));
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
      contactDrawerUser: null,
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
