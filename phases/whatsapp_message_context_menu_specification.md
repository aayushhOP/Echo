# WhatsApp-Style Message Context Menu Specification

**Project Stack:** React 19 · TypeScript · Tailwind CSS · Lucide React · Framer Motion · Zustand · Socket.IO

---

## 1. Overview & Behavioral Matrix

Currently, clicking the three dots (`MoreHorizontal` / chevron) on an individual message bubble directly opens the delete dialog. 

This update introduces a **floating WhatsApp-style context menu** anchored to the specific message bubble, containing:

| Action | Icon | Behavior & Effects |
|---|---|---|
| **Reply** | `Reply` | Sets `replyingTo` in Zustand. Attaches a quoted preview banner directly above the input box and auto-focuses the text area. |
| **Copy** | `Copy` | Copies `message.content` to the clipboard via `navigator.clipboard.writeText()` and triggers a temporary checkmark or toast notification. |
| **Forward** | `Forward` | Opens a modal to select another conversation/contact and duplicates the message payload to that conversation. |
| **Pin** | `Pin` | Toggles pinned status for the message in the conversation (synced via API & Socket.IO). Displays a small pin indicator badge on the bubble. |
| **Select** | `CheckSquare` | Activates selection mode (`isSelectionMode = true`) with this specific message pre-selected, rendering checkboxes for multi-select. |
| **Delete** | `Trash2` | Opens the dual-option `DeleteMessageModal` ("Delete for me" vs "Delete for everyone") as specified earlier. |

---

## 2. Zustand Store Extensions (`client/src/store/chatStore.ts`)

Extend your existing chat store to support reply quotes, message pinning, and the forward modal state:

```typescript
// Additions to client/src/store/chatStore.ts
export interface QuotedMessage {
  _id: string;
  senderId: string;
  senderUsername: string;
  content: string;
  type: "text" | "image" | "file";
}

interface ExtendedChatState {
  // Quoted reply state
  replyingTo: QuotedMessage | null;
  setReplyingTo: (msg: QuotedMessage | null) => void;

  // Forwarding modal state
  forwardingMessage: { _id: string; content: string } | null;
  setForwardingMessage: (msg: { _id: string; content: string } | null) => void;

  // Pin toggle action
  togglePinMessage: (conversationId: string, messageId: string, isPinned: boolean) => void;
}

// Inside your create<ChatState>() slice:
export const useChatStore = create<any>((set) => ({
  // ... existing states (isSelectionMode, selectedMessageIds, etc.) ...
  
  replyingTo: null,
  setReplyingTo: (msg) => set({ replyingTo: msg }),

  forwardingMessage: null,
  setForwardingMessage: (msg) => set({ forwardingMessage: msg }),

  togglePinMessage: (conversationId, messageId, isPinned) =>
    set((state: any) => {
      const convMessages = state.messages[conversationId] || [];
      return {
        messages: {
          ...state.messages,
          [conversationId]: convMessages.map((m: any) =>
            m._id === messageId ? { ...m, isPinned } : m
          ),
        },
      };
    }),
}));
```

---

## 3. Context Menu Component (`client/src/components/chat/MessageContextMenu.tsx`)

A floating dropdown that auto-adjusts based on whether the message is sent (right-aligned) or received (left-aligned):

```tsx
// client/src/components/chat/MessageContextMenu.tsx
import React, { useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Reply, 
  Copy, 
  Forward, 
  Pin, 
  CheckSquare, 
  Trash2,
  Check
} from "lucide-react";

interface MessageContextMenuProps {
  isOpen: boolean;
  onClose: () => void;
  isOwnMessage: boolean;
  isPinned?: boolean;
  onReply: () => void;
  onCopy: () => void;
  onForward: () => void;
  onTogglePin: () => void;
  onSelect: () => void;
  onDelete: () => void;
}

export const MessageContextMenu: React.FC<MessageContextMenuProps> = ({
  isOpen,
  onClose,
  isOwnMessage,
  isPinned,
  onReply,
  onCopy,
  onForward,
  onTogglePin,
  onSelect,
  onDelete,
}) => {
  const menuRef = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = React.useState(false);

  // Close on click outside
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen, onClose]);

  const handleCopyClick = () => {
    onCopy();
    setCopied(true);
    setTimeout(() => {
      setCopied(false);
      onClose();
    }, 600);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          ref={menuRef}
          initial={{ opacity: 0, scale: 0.88, y: -6 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.88, y: -6 }}
          transition={{ duration: 0.15, ease: "easeOut" }}
          className={`absolute top-full z-40 mt-1.5 w-44 rounded-xl bg-[#171824] border border-white/[0.08] shadow-2xl py-1 backdrop-blur-md ${
            isOwnMessage ? "right-0" : "left-0"
          }`}
        >
          {/* 1. Reply */}
          <button
            onClick={() => { onClose(); onReply(); }}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-slate-200 hover:text-white hover:bg-white/[0.05] transition-colors"
          >
            <Reply size={15} className="text-slate-400" />
            <span>Reply</span>
          </button>

          {/* 2. Copy */}
          <button
            onClick={handleCopyClick}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-slate-200 hover:text-white hover:bg-white/[0.05] transition-colors"
          >
            {copied ? (
              <Check size={15} className="text-emerald-400" />
            ) : (
              <Copy size={15} className="text-slate-400" />
            )}
            <span>{copied ? "Copied!" : "Copy"}</span>
          </button>

          {/* 3. Forward */}
          <button
            onClick={() => { onClose(); onForward(); }}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-slate-200 hover:text-white hover:bg-white/[0.05] transition-colors"
          >
            <Forward size={15} className="text-slate-400" />
            <span>Forward</span>
          </button>

          {/* 4. Pin / Unpin */}
          <button
            onClick={() => { onClose(); onTogglePin(); }}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-slate-200 hover:text-white hover:bg-white/[0.05] transition-colors"
          >
            <Pin size={15} className={isPinned ? "text-[#0066ff] fill-[#0066ff]" : "text-slate-400"} />
            <span>{isPinned ? "Unpin" : "Pin"}</span>
          </button>

          {/* 5. Select */}
          <button
            onClick={() => { onClose(); onSelect(); }}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-slate-200 hover:text-white hover:bg-white/[0.05] transition-colors"
          >
            <CheckSquare size={15} className="text-slate-400" />
            <span>Select</span>
          </button>

          <div className="h-px bg-white/[0.06] my-1" />

          {/* 6. Delete */}
          <button
            onClick={() => { onClose(); onDelete(); }}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-rose-400 hover:bg-rose-500/10 transition-colors"
          >
            <Trash2 size={15} />
            <span>Delete</span>
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
```

---

## 4. Integration into `MessageItem.tsx`

Update `MessageItem.tsx` so clicking the three-dots button toggles the dropdown instead of immediately opening `DeleteMessageModal`:

```tsx
// Inside client/src/components/chat/MessageItem.tsx
import React, { useState } from "react";
import { MoreHorizontal, Pin } from "lucide-react";
import { MessageContextMenu } from "./MessageContextMenu";
import { DeleteMessageModal } from "./DeleteMessageModal";
import { useChatStore } from "../../store/chatStore";

export const MessageItem: React.FC<any> = ({
  message,
  currentUserId,
  senderUsername,
  onDeleteForMe,
  onDeleteForEveryone,
}) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

  const {
    setReplyingTo,
    setForwardingMessage,
    enterSelectionMode,
    togglePinMessage,
  } = useChatStore();

  const isOwn = message.senderId === currentUserId;

  // Actions
  const handleReply = () => {
    setReplyingTo({
      _id: message._id,
      senderId: message.senderId,
      senderUsername: isOwn ? "You" : senderUsername,
      content: message.content,
      type: message.type || "text",
    });
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(message.content);
  };

  const handleForward = () => {
    setForwardingMessage({
      _id: message._id,
      content: message.content,
    });
  };

  const handleTogglePin = async () => {
    const nextPinState = !message.isPinned;
    togglePinMessage(message.conversationId, message._id, nextPinState);
    // Sync via socket/API
    // socket.emit("message:pin", { messageId: message._id, isPinned: nextPinState });
  };

  const handleSelect = () => {
    enterSelectionMode(message._id);
  };

  return (
    <div className={`group relative flex ${isOwn ? "justify-end" : "justify-start"} my-1.5`}>
      <div
        className={`relative max-w-[70%] rounded-2xl px-4 py-2 text-sm shadow-sm transition-all ${
          isOwn
            ? "bg-[#0066ff] text-white rounded-br-none"
            : "bg-[#171824] text-slate-100 rounded-bl-none border border-white/[0.05]"
        }`}
      >
        {/* Pinned Icon Indicator */}
        {message.isPinned && (
          <div className="absolute -top-2 left-2 flex items-center justify-center w-4 h-4 rounded-full bg-[#171824] border border-white/10 shadow-sm text-[#0066ff]">
            <Pin size={10} className="fill-[#0066ff]" />
          </div>
        )}

        {/* Action Trigger Button (Reveals on Bubble Hover) */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            setIsMenuOpen((prev) => !prev);
          }}
          className={`absolute top-1.5 ${
            isOwn ? "left-1.5" : "right-1.5"
          } p-1 rounded-md bg-black/25 hover:bg-black/40 text-white/80 hover:text-white transition-opacity ${
            isMenuOpen ? "opacity-100" : "opacity-0 group-hover:opacity-100"
          }`}
          title="Message options"
        >
          <MoreHorizontal size={13} />
        </button>

        {/* Message Content */}
        <p className="break-words leading-relaxed pr-3">{message.content}</p>

        {/* The Context Menu Dropdown */}
        <MessageContextMenu
          isOpen={isMenuOpen}
          onClose={() => setIsMenuOpen(false)}
          isOwnMessage={isOwn}
          isPinned={message.isPinned}
          onReply={handleReply}
          onCopy={handleCopy}
          onForward={handleForward}
          onTogglePin={handleTogglePin}
          onSelect={handleSelect}
          onDelete={() => setIsDeleteModalOpen(true)}
        />
      </div>

      {/* Delete Modal opens only when Delete is clicked from the menu */}
      <DeleteMessageModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onDeleteForMe={() => onDeleteForMe(message._id)}
        onDeleteForEveryone={() => onDeleteForEveryone(message._id)}
        isSender={isOwn}
        isAdmin={false}
        messageCreatedAt={message.createdAt}
      />
    </div>
  );
};
```

---

## 5. Quoted Reply Preview Bar (`client/src/components/chat/QuotedReplyPreview.tsx`)

When the user selects **Reply**, show an anchored preview block directly above the input box:

```tsx
// client/src/components/chat/QuotedReplyPreview.tsx
import React from "react";
import { X, Reply } from "lucide-react";
import { useChatStore } from "../../store/chatStore";

export const QuotedReplyPreview: React.FC = () => {
  const { replyingTo, setReplyingTo } = useChatStore();

  if (!replyingTo) return null;

  return (
    <div className="bg-[#171824]/90 backdrop-blur-sm border-t border-l-4 border-l-[#0066ff] border-white/[0.06] px-4 py-2 flex items-center justify-between animate-in slide-in-from-bottom-2 duration-150">
      <div className="flex items-center gap-2.5 overflow-hidden">
        <Reply size={15} className="text-[#0066ff] flex-shrink-0" />
        <div className="text-left overflow-hidden">
          <p className="text-[11px] font-semibold text-[#0066ff] truncate">
            {replyingTo.senderUsername}
          </p>
          <p className="text-xs text-slate-300 truncate max-w-md">
            {replyingTo.content}
          </p>
        </div>
      </div>

      <button
        onClick={() => setReplyingTo(null)}
        className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/[0.05]"
      >
        <X size={15} />
      </button>
    </div>
  );
};
```

Mount `<QuotedReplyPreview />` immediately above `<MessageInput />` inside your main chat container:

```tsx
<div className="flex flex-col border-t border-white/[0.06]">
  <QuotedReplyPreview />
  <MessageInput ... />
</div>
```

---

## 6. Forward Message Modal (`client/src/components/chat/ForwardMessageModal.tsx`)

When **Forward** is clicked, display a list of active conversations to duplicate the message into:

```tsx
// client/src/components/chat/ForwardMessageModal.tsx
import React, { useState } from "react";
import { X, Forward, Search, Send } from "lucide-react";
import { useChatStore } from "../../store/chatStore";

interface ForwardMessageModalProps {
  conversations: Array<{ _id: string; name?: string; participant?: { username: string } }>;
  onForwardMessage: (targetConversationId: string, content: string) => Promise<void>;
}

export const ForwardMessageModal: React.FC<ForwardMessageModalProps> = ({
  conversations,
  onForwardMessage,
}) => {
  const { forwardingMessage, setForwardingMessage } = useChatStore();
  const [search, setSearch] = useState("");
  const [sendingId, setSendingId] = useState<string | null>(null);

  if (!forwardingMessage) return null;

  const filtered = conversations.filter((c) => {
    const title = c.participant?.username || c.name || "";
    return title.toLowerCase().includes(search.toLowerCase());
  });

  const handleSend = async (targetId: string) => {
    setSendingId(targetId);
    await onForwardMessage(targetId, forwardingMessage.content);
    setSendingId(null);
    setForwardingMessage(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-sm rounded-2xl bg-[#171824] border border-white/[0.08] p-5 shadow-2xl">
        <div className="flex items-center justify-between pb-3 border-b border-white/[0.06]">
          <div className="flex items-center gap-2 text-white font-semibold text-sm">
            <Forward size={16} className="text-[#0066ff]" />
            <span>Forward message to...</span>
          </div>
          <button onClick={() => setForwardingMessage(null)} className="text-slate-400 hover:text-white">
            <X size={16} />
          </button>
        </div>

        {/* Search */}
        <div className="mt-3 relative">
          <Search size={14} className="absolute left-3 top-2.5 text-slate-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search chats..."
            className="w-full bg-[#13141d] rounded-xl pl-8 pr-3 py-1.5 text-xs text-white border border-white/[0.06] focus:outline-none focus:border-[#0066ff]"
          />
        </div>

        {/* Conversation List */}
        <div className="mt-3 max-h-56 overflow-y-auto space-y-1">
          {filtered.map((conv) => {
            const title = conv.participant?.username || conv.name || "Conversation";
            const isSending = sendingId === conv._id;

            return (
              <div
                key={conv._id}
                className="flex items-center justify-between p-2 rounded-xl hover:bg-white/[0.04] transition-colors"
              >
                <span className="text-xs text-slate-200 font-medium truncate">{title}</span>
                <button
                  disabled={isSending}
                  onClick={() => handleSend(conv._id)}
                  className="p-1.5 rounded-lg bg-[#0066ff] hover:bg-[#0052cc] text-white disabled:opacity-50 transition-colors"
                >
                  <Send size={13} />
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
```

---

## 7. Agent Verification Checklist

- [x] **Decouple Three Dots from Delete:** Clicking the bubble's three dots now toggles `MessageContextMenu.tsx` and does *not* automatically trigger deletion.
- [x] **Context Menu Actions:**
  - [x] **Reply:** Populates `replyingTo` in Zustand and renders the `<QuotedReplyPreview />` above the input bar.
  - [x] **Copy:** Uses `navigator.clipboard.writeText()` and displays a transient checkmark feedback icon.
  - [x] **Forward:** Sets `forwardingMessage` and opens `<ForwardMessageModal />` to duplicate the message to another conversation.
  - [x] **Pin:** Toggles message pin state, showing a small `Pin` badge on the bubble.
  - [x] **Select:** Activates selection mode (`isSelectionMode = true`) with that message checked.
  - [x] **Delete:** Opens the existing dual-choice `DeleteMessageModal` ("Delete for me" vs "Delete for everyone").
- [x] **Responsive Positioning:** Left-aligned context menu for received messages; right-aligned context menu for sent messages.
- [x] **Outside Click Dismiss:** Clicking anywhere outside the menu smoothly closes it.