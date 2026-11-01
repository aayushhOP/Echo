# Advanced Chat Header Actions & Menu Specification

**Project Stack:** React 19 · TypeScript · Tailwind CSS · Lucide React · Zustand · Socket.IO · Express 5 · MongoDB

---

## 1. UX & Architectural Changes

### 1.1 Action Separation
* **Three-dots Menu Button (`MoreVertical`):** Will no longer toggle the Contact Info drawer. Instead, clicking the three dots opens an absolute-positioned dropdown menu with the following options:
  1. **Search Messages** (`Search` icon)
  2. **Select Messages** (`CheckSquare` icon)
  3. **Close Chat** (`X` icon)
  4. **Block / Unblock User** (`Ban` icon) *(Already implemented — preserve existing handler)*
  5. **Delete Chat** (`Trash2` icon — Destructive red)
* **Accessing Contact Info:** Following WhatsApp Web convention, clicking the **User Avatar or Username banner** in the top header will toggle the Contact Info side drawer.

---

## 2. Zustand Store Updates (`client/src/store/chatStore.ts`)

Add state management for message selection mode, active search querying, and active conversation clearing.

```typescript
// client/src/store/chatStore.ts
import { create } from "zustand";

interface Message {
  _id: string;
  conversationId: string;
  senderId: string;
  content: string;
  status: "sent" | "delivered" | "read";
  createdAt: string;
}

interface ChatState {
  activeConversationId: string | null;
  isContactDrawerOpen: boolean;
  isSearchOpen: boolean;
  searchQuery: string;
  isSelectionMode: boolean;
  selectedMessageIds: string[];
  
  // Actions
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
}

export const useChatStore = create<ChatState>((set) => ({
  activeConversationId: null,
  isContactDrawerOpen: false,
  isSearchOpen: false,
  searchQuery: "",
  isSelectionMode: false,
  selectedMessageIds: [],

  setActiveConversationId: (id) => set({ 
    activeConversationId: id,
    isSearchOpen: false,
    searchQuery: "",
    isSelectionMode: false,
    selectedMessageIds: []
  }),
  setContactDrawerOpen: (open) => set({ isContactDrawerOpen: open }),
  toggleSearch: () => set((state) => ({ 
    isSearchOpen: !state.isSearchOpen, 
    searchQuery: "" 
  })),
  setSearchQuery: (query) => set({ searchQuery: query }),
  enterSelectionMode: (initialMessageId) => set({
    isSelectionMode: true,
    selectedMessageIds: initialMessageId ? [initialMessageId] : []
  }),
  exitSelectionMode: () => set({ 
    isSelectionMode: false, 
    selectedMessageIds: [] 
  }),
  toggleSelectMessage: (messageId) => set((state) => {
    const exists = state.selectedMessageIds.includes(messageId);
    return {
      selectedMessageIds: exists
        ? state.selectedMessageIds.filter((id) => id !== messageId)
        : [...state.selectedMessageIds, messageId]
    };
  }),
  selectAllMessages: (messageIds) => set({ selectedMessageIds: messageIds }),
  removeConversationFromList: (conversationId) => set((state) => ({
    activeConversationId: state.activeConversationId === conversationId ? null : state.activeConversationId,
    isContactDrawerOpen: false
  })),
  removeMessagesFromConversation: (conversationId, messageIds) => set((state) => {
    // Handled in message collection slice
    return { selectedMessageIds: [], isSelectionMode: false };
  })
}));
```

---

## 3. Chat Header & Dropdown Menu Component

### `client/src/components/chat/ChatHeader.tsx`

```tsx
import React, { useState, useRef, useEffect } from "react";
import { 
  MoreVertical, 
  Search, 
  CheckSquare, 
  X, 
  Ban, 
  Trash2 
} from "lucide-react";
import { useChatStore } from "../../store/chatStore";

interface ChatHeaderProps {
  conversation: {
    _id: string;
    type: "direct" | "group";
    name?: string;
    avatarUrl?: string;
    participant?: {
      clerkId: string;
      username: string;
      isOnline: boolean;
      lastSeen?: string;
    };
  };
  onBlockUser: () => void;
  onDeleteChat: () => void;
}

export const ChatHeader: React.FC<ChatHeaderProps> = ({
  conversation,
  onBlockUser,
  onDeleteChat,
}) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const {
    setActiveConversationId,
    setContactDrawerOpen,
    isContactDrawerOpen,
    toggleSearch,
    enterSelectionMode,
  } = useChatStore();

  // Close menu on outside click
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsMenuOpen(false);
      }
    };
    if (isMenuOpen) document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [isMenuOpen]);

  const username = conversation.participant?.username || conversation.name || "Chat";
  const isOnline = conversation.participant?.isOnline;

  return (
    <div className="relative h-16 bg-[#13141d]/90 backdrop-blur-md border-b border-white/[0.06] px-4 flex items-center justify-between z-20">
      
      {/* 1. Clickable Header Profile -> Opens Contact Info Drawer */}
      <div 
        onClick={() => setContactDrawerOpen(!isContactDrawerOpen)}
        className="flex items-center gap-3 cursor-pointer group p-1.5 rounded-xl hover:bg-white/[0.03] transition-colors"
      >
        <div className="relative">
          <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center overflow-hidden border border-white/10">
            {conversation.avatarUrl ? (
              <img src={conversation.avatarUrl} alt={username} className="w-full h-full object-cover" />
            ) : (
              <span className="text-white font-medium text-sm">{username.slice(0, 2).toUpperCase()}</span>
            )}
          </div>
          {isOnline && (
            <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 rounded-full ring-2 ring-[#13141d]" />
          )}
        </div>

        <div>
          <h2 className="text-sm font-semibold text-white group-hover:text-blue-400 transition-colors">
            {username}
          </h2>
          <p className="text-[11px] text-slate-400">
            {isOnline ? "Active now" : "Offline"}
          </p>
        </div>
      </div>

      {/* 2. Three-Dots Menu Trigger */}
      <div className="relative" ref={menuRef}>
        <button
          onClick={() => setIsMenuOpen((prev) => !prev)}
          className={`p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/[0.05] transition-all ${
            isMenuOpen ? "bg-white/[0.08] text-white" : ""
          }`}
          aria-label="Chat options"
        >
          <MoreVertical size={19} />
        </button>

        {/* 3. Action Dropdown Menu */}
        {isMenuOpen && (
          <div className="absolute right-0 mt-2 w-52 rounded-xl bg-[#171824] border border-white/[0.08] shadow-2xl py-1.5 z-50 animate-in fade-in zoom-in-95 duration-150">
            
            {/* Search messages */}
            <button
              onClick={() => {
                setIsMenuOpen(false);
                toggleSearch();
              }}
              className="w-full flex items-center gap-2.5 px-3.5 py-2 text-xs text-slate-300 hover:text-white hover:bg-white/[0.05] transition-colors"
            >
              <Search size={15} className="text-slate-400" />
              <span>Search messages</span>
            </button>

            {/* Select messages */}
            <button
              onClick={() => {
                setIsMenuOpen(false);
                enterSelectionMode();
              }}
              className="w-full flex items-center gap-2.5 px-3.5 py-2 text-xs text-slate-300 hover:text-white hover:bg-white/[0.05] transition-colors"
            >
              <CheckSquare size={15} className="text-slate-400" />
              <span>Select messages</span>
            </button>

            {/* Close chat panel */}
            <button
              onClick={() => {
                setIsMenuOpen(false);
                setActiveConversationId(null);
              }}
              className="w-full flex items-center gap-2.5 px-3.5 py-2 text-xs text-slate-300 hover:text-white hover:bg-white/[0.05] transition-colors"
            >
              <X size={15} className="text-slate-400" />
              <span>Close chat</span>
            </button>

            <div className="h-px bg-white/[0.06] my-1" />

            {/* Block / Unblock Contact (Direct chats only) */}
            {conversation.type === "direct" && (
              <button
                onClick={() => {
                  setIsMenuOpen(false);
                  onBlockUser();
                }}
                className="w-full flex items-center gap-2.5 px-3.5 py-2 text-xs text-rose-400 hover:bg-rose-500/10 transition-colors"
              >
                <Ban size={15} />
                <span>Block Contact</span>
              </button>
            )}

            {/* Delete Chat */}
            <button
              onClick={() => {
                setIsMenuOpen(false);
                onDeleteChat();
              }}
              className="w-full flex items-center gap-2.5 px-3.5 py-2 text-xs text-rose-400 hover:bg-rose-500/10 transition-colors"
            >
              <Trash2 size={15} />
              <span>Delete Chat</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
```

---

## 4. In-Chat Message Search Feature

When Search is active, render an in-line search bar below the header that filters displayed messages or highlights matches.

### `client/src/components/chat/ChatSearchBar.tsx`

```tsx
import React from "react";
import { Search, X } from "lucide-react";
import { useChatStore } from "../../store/chatStore";

export const ChatSearchBar: React.FC = () => {
  const { isSearchOpen, searchQuery, setSearchQuery, toggleSearch } = useChatStore();

  if (!isSearchOpen) return null;

  return (
    <div className="h-12 bg-[#171824] border-b border-white/[0.06] px-4 flex items-center gap-2 animate-in slide-in-from-top-2 duration-150">
      <Search size={16} className="text-slate-400" />
      <input
        type="text"
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        placeholder="Search in this chat..."
        autoFocus
        className="flex-1 bg-transparent text-xs text-white placeholder-slate-500 focus:outline-none"
      />
      {searchQuery && (
        <button onClick={() => setSearchQuery("")} className="text-slate-400 hover:text-white">
          <X size={14} />
        </button>
      )}
      <button 
        onClick={toggleSearch}
        className="text-xs text-slate-400 hover:text-white px-2 py-1 rounded hover:bg-white/[0.05]"
      >
        Done
      </button>
    </div>
  );
};
```

### Filtering Messages in `MessageList.tsx`
```tsx
const filteredMessages = useMemo(() => {
  if (!searchQuery.trim()) return messages;
  return messages.filter((m) =>
    m.content.toLowerCase().includes(searchQuery.toLowerCase())
  );
}, [messages, searchQuery]);
```

---

## 5. Select Messages & Batch Action Feature

When `isSelectionMode` is active:
1. Replace the top Chat Header with a **Selection Action Bar** displaying the count of selected messages, a Select All button, a Delete Selected button, and an Exit button.
2. Render a checkbox alongside each message bubble.

### 5.1 Selection Top Bar (`client/src/components/chat/ChatSelectionBar.tsx`)

```tsx
import React from "react";
import { X, Trash2, CheckCheck } from "lucide-react";
import { useChatStore } from "../../store/chatStore";

interface ChatSelectionBarProps {
  totalMessageCount: number;
  allMessageIds: string[];
  onDeleteSelected: (ids: string[]) => void;
}

export const ChatSelectionBar: React.FC<ChatSelectionBarProps> = ({
  totalMessageCount,
  allMessageIds,
  onDeleteSelected,
}) => {
  const { 
    isSelectionMode, 
    selectedMessageIds, 
    exitSelectionMode, 
    selectAllMessages 
  } = useChatStore();

  if (!isSelectionMode) return null;

  const isAllSelected = selectedMessageIds.length === totalMessageCount && totalMessageCount > 0;

  return (
    <div className="h-16 bg-[#171824] border-b border-white/[0.06] px-4 flex items-center justify-between animate-in slide-in-from-top duration-150 z-20">
      <div className="flex items-center gap-3">
        <button
          onClick={exitSelectionMode}
          className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/[0.05]"
        >
          <X size={18} />
        </button>
        <span className="text-sm font-semibold text-white">
          {selectedMessageIds.length} selected
        </span>
      </div>

      <div className="flex items-center gap-2">
        {/* Toggle Select All */}
        <button
          onClick={() => {
            if (isAllSelected) {
              selectAllMessages([]);
            } else {
              selectAllMessages(allMessageIds);
            }
          }}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-300 hover:text-white hover:bg-white/[0.05] transition-colors"
        >
          <CheckCheck size={15} />
          <span>{isAllSelected ? "Deselect All" : "Select All"}</span>
        </button>

        {/* Delete Selected Messages */}
        <button
          disabled={selectedMessageIds.length === 0}
          onClick={() => onDeleteSelected(selectedMessageIds)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          <Trash2 size={15} />
          <span>Delete</span>
        </button>
      </div>
    </div>
  );
};
```

### 5.2 Integrating Selection with Message Bubble (`MessageItem.tsx`)

```tsx
<div 
  onClick={() => isSelectionMode && toggleSelectMessage(message._id)}
  className={`flex items-center gap-3 group ${isSelectionMode ? "cursor-pointer" : ""}`}
>
  {/* Checkbox appears only in selection mode */}
  {isSelectionMode && (
    <input
      type="checkbox"
      checked={selectedMessageIds.includes(message._id)}
      onChange={() => toggleSelectMessage(message._id)}
      className="w-4 h-4 rounded border-white/20 bg-slate-900 text-blue-600 focus:ring-0 focus:ring-offset-0 cursor-pointer"
    />
  )}

  {/* Message Bubble */}
  <div className={`...`}>
    {message.content}
  </div>
</div>
```

---

## 6. Delete Chat & Batch Delete Endpoints

### 6.1 Backend Controller (`server/src/controllers/conversationController.ts`)

```typescript
import { Request, Response } from "express";
import Conversation from "../models/Conversation";
import Message from "../models/Message";

/**
 * DELETE /api/conversations/:id
 * Deletes all messages and removes the conversation.
 */
export const deleteConversation = async (req: Request, res: Response) => {
  const { id } = req.params;
  const currentUserId = (req as any).auth.userId;

  try {
    const conversation = await Conversation.findOne({
      _id: id,
      participants: currentUserId,
    });

    if (!conversation) {
      return res.status(404).json({ message: "Conversation not found" });
    }

    // 1. Delete all messages associated with conversation
    await Message.deleteMany({ conversationId: id });

    // 2. Delete conversation document
    await Conversation.findByIdAndDelete(id);

    return res.status(200).json({ success: true, message: "Chat deleted successfully" });
  } catch (error) {
    return res.status(500).json({ message: "Failed to delete conversation" });
  }
};

/**
 * DELETE /api/conversations/:id/messages
 * Batch delete selected messages.
 */
export const deleteSelectedMessages = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { messageIds } = req.body;
  const currentUserId = (req as any).auth.userId;

  try {
    if (!messageIds || !Array.isArray(messageIds) || messageIds.length === 0) {
      return res.status(400).json({ message: "No message IDs provided" });
    }

    // Delete messages matching the IDs and conversation
    await Message.deleteMany({
      _id: { $in: messageIds },
      conversationId: id,
      // Optional: enforce only sender can delete, or allow user to delete their local copy
    });

    return res.status(200).json({ success: true, message: "Messages deleted" });
  } catch (error) {
    return res.status(500).json({ message: "Failed to delete messages" });
  }
};
```

### 6.2 Socket.IO Event for Real-Time Synchronization

When messages are batch-deleted, emit a socket event so other active tabs or participants remove them instantly:

```typescript
// server/src/sockets/handlers/messageHandlers.ts
socket.on("messages:deleted", ({ conversationId, messageIds }) => {
  io.to(`conv:${conversationId}`).emit("messages:batch_removed", {
    conversationId,
    messageIds,
  });
});
```

---

## 7. Confirmation Modal for "Delete Chat"

Never delete a chat on an accidental single click. Show a modal confirmation:

```tsx
// Simple confirmation dialog
const handleDeleteChat = async () => {
  const confirmed = window.confirm(
    "Are you sure you want to delete this chat? All messages will be permanently removed."
  );
  if (!confirmed) return;

  try {
    await axios.delete(`/api/conversations/${activeConversationId}`);
    removeConversationFromList(activeConversationId);
    setActiveConversationId(null);
  } catch (err) {
    console.error("Failed to delete chat", err);
  }
};
```

---

## 8. Agent Implementation Checklist

- [x] **Unlink Contact Info:** Ensure clicking the three dots button no longer opens the contact drawer.
- [x] **Link Avatar to Drawer:** Clicking the avatar or name in `ChatHeader.tsx` toggles `isContactDrawerOpen`.
- [x] **Three-Dots Dropdown:** Implement dropdown with: Search Messages, Select Messages, Close Chat, Block Contact, and Delete Chat.
- [x] **Close Chat:** Clicking "Close chat" sets `activeConversationId = null` (clearing the active chat viewport).
- [x] **In-Chat Search:** Shows search bar, filters messages live as the user types, and dismisses on "Done".
- [x] **Message Selection Mode:** 
  - Shows `ChatSelectionBar` with counter, Select All, and Delete buttons.
  - Adds selectable checkboxes beside each message.
- [x] **Backend Endpoints:**
  - `DELETE /api/conversations/:id` (delete whole chat).
  - `DELETE /api/conversations/:id/messages` (batch delete selected messages).
- [x] **Real-Time Sockets:** Emit `messages:batch_removed` to update connected clients.