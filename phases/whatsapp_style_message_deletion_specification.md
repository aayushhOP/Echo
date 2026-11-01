# WhatsApp-Style Message Deletion — Technical Specification

**Project Stack:** React 19 · TypeScript · Tailwind CSS · Lucide React · Express 5 · Node.js · MongoDB / Mongoose · Socket.IO

---

## 1. Feature Architecture & Rules

This specification implements the dual-tier deletion system used by WhatsApp:

### 1.1 "Delete for Everyone" (Revocation)
1. **Permission Check:**
   - Permitted if the requester is the original sender.
   - Permitted if the requester is a group administrator in a group conversation.
2. **Time Window Limit:**
   - Must be initiated within **60 hours** (`216,000,000 ms`) of message creation. After 60 hours, "Delete for Everyone" is disabled.
3. **Tombstone Substitution:**
   - The document remains in MongoDB to preserve chat ordering and thread integrity.
   - `content` and media attachments are wiped.
   - Flag `isDeletedForEveryone: true` is set.
   - Clients render:
     - Sender: *"You deleted this message"*
     - Other participants: *"This message was deleted"*
     - If deleted by an admin: *"This message was deleted by admin [Username]"*
4. **Real-time Sync:**
   - Broadcast `message:revoked` via Socket.IO so all connected clients swap the bubble instantly.

### 1.2 "Delete for Me" (Local Soft-Delete)
1. **Permission Check:** Any participant can delete any message (sent or received) for themselves at any time.
2. **No Time Limit:** Usable regardless of message age.
3. **Storage Mechanism:** Appends the user's `clerkId` to a `deletedForUsers` array on the Message document.
4. **Query & Display:**
   - When fetching conversation messages, filter out documents where `deletedForUsers` contains the current user's ID.
   - No Socket.IO broadcast to other users is needed.
5. **Undo Snackbar:** Client displays a floating 5-second snackbar allowing the user to undo the local deletion.

### 1.3 "Clear Chat" vs. "Delete Chat"
- **Clear Chat:** Adds the current user's ID to `deletedForUsers` on all existing messages in that conversation. The chat remains in the sidebar list.
- **Delete Chat:** Performs "Clear Chat" logic and additionally removes the user from the conversation or marks the conversation thread as hidden/deleted for that user.

---

## 2. Database Schema Updates

### 2.1 Update Message Schema (`server/src/models/Message.ts`)

Add the flags and tracking arrays required for both deletion models:

```typescript
import { Schema, model, Document, Types } from "mongoose";

export interface IMessage extends Document {
  conversationId: Types.ObjectId;
  senderId: string;
  content: string;
  type: "text" | "image" | "file";
  fileUrl?: string;
  status: "sent" | "delivered" | "read";
  // WhatsApp Deletion Extensions
  isDeletedForEveryone: boolean;
  deletedAt?: Date;
  deletedBy?: {
    userId: string;
    username: string;
    role: "sender" | "admin";
  };
  deletedForUsers: string[]; // clerkId list for "Delete for Me"
  createdAt: Date;
  updatedAt: Date;
}

const messageSchema = new Schema<IMessage>(
  {
    conversationId: { type: Schema.Types.ObjectId, ref: "Conversation", required: true, index: true },
    senderId: { type: String, required: true, index: true },
    content: { type: String, default: "" },
    type: { type: String, enum: ["text", "image", "file"], default: "text" },
    fileUrl: { type: String },
    status: { type: String, enum: ["sent", "delivered", "read"], default: "sent" },
    
    // Deletion attributes
    isDeletedForEveryone: { type: Boolean, default: false, index: true },
    deletedAt: { type: Date },
    deletedBy: {
      userId: { type: String },
      username: { type: String },
      role: { type: String, enum: ["sender", "admin"] }
    },
    deletedForUsers: [{ type: String, index: true }]
  },
  { timestamps: true }
);

// Compound index for message queries excluding deleted-for-me
messageSchema.index({ conversationId: 1, createdAt: 1 });

export default model<IMessage>("Message", messageSchema);
```

---

## 3. Backend Controllers & Routes

### 3.1 Controller: `server/src/controllers/messageController.ts`

```typescript
import { Request, Response } from "express";
import Message from "../models/Message";
import Conversation from "../models/Conversation";
import User from "../models/User";
import { getIO } from "../sockets";

const DELETE_FOR_EVERYONE_LIMIT_MS = 60 * 60 * 1000 * 60; // 60 Hours

/**
 * PATCH /api/messages/:id/delete-for-everyone
 */
export const deleteForEveryone = async (req: Request, res: Response) => {
  const { id } = req.params;
  const currentUserId = (req as any).auth.userId;

  try {
    const message = await Message.findById(id);
    if (!message) {
      return res.status(404).json({ message: "Message not found" });
    }

    if (message.isDeletedForEveryone) {
      return res.status(400).json({ message: "Message already revoked" });
    }

    // 1. Validate Time Limit (60 Hours)
    const elapsedMs = Date.now() - new Date(message.createdAt).getTime();
    if (elapsedMs > DELETE_FOR_EVERYONE_LIMIT_MS) {
      return res.status(403).json({
        message: "Messages can only be deleted for everyone within 60 hours of sending."
      });
    }

    // 2. Validate Ownership or Group Admin Rights
    const conversation = await Conversation.findById(message.conversationId);
    if (!conversation) {
      return res.status(404).json({ message: "Conversation not found" });
    }

    const isSender = message.senderId === currentUserId;
    const isGroupAdmin =
      conversation.type === "group" &&
      conversation.admins?.includes(currentUserId);

    if (!isSender && !isGroupAdmin) {
      return res.status(403).json({
        message: "You do not have permission to delete this message for everyone."
      });
    }

    // Fetch requester's username for admin placeholder
    const requester = await User.findOne({ clerkId: currentUserId }).select("username");
    const requesterName = requester?.username || "Admin";

    // 3. Apply Tombstone Mutation
    message.isDeletedForEveryone = true;
    message.content = "";
    message.fileUrl = undefined;
    message.deletedAt = new Date();
    message.deletedBy = {
      userId: currentUserId,
      username: requesterName,
      role: isSender ? "sender" : "admin"
    };

    await message.save();

    // 4. Emit Real-time Socket Event
    const io = getIO();
    io.to(`conv:${message.conversationId}`).emit("message:revoked", {
      messageId: message._id,
      conversationId: message.conversationId,
      deletedBy: message.deletedBy,
      deletedAt: message.deletedAt
    });

    return res.status(200).json({ success: true, message });
  } catch (error) {
    console.error("Error in deleteForEveryone:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

/**
 * PATCH /api/messages/:id/delete-for-me
 */
export const deleteForMe = async (req: Request, res: Response) => {
  const { id } = req.params;
  const currentUserId = (req as any).auth.userId;

  try {
    const message = await Message.findByIdAndUpdate(
      id,
      { $addToSet: { deletedForUsers: currentUserId } },
      { new: true }
    );

    if (!message) {
      return res.status(404).json({ message: "Message not found" });
    }

    return res.status(200).json({ success: true, messageId: id });
  } catch (error) {
    console.error("Error in deleteForMe:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

/**
 * POST /api/messages/:id/undo-delete-for-me
 */
export const undoDeleteForMe = async (req: Request, res: Response) => {
  const { id } = req.params;
  const currentUserId = (req as any).auth.userId;

  try {
    const message = await Message.findByIdAndUpdate(
      id,
      { $pull: { deletedForUsers: currentUserId } },
      { new: true }
    );

    if (!message) {
      return res.status(404).json({ message: "Message not found" });
    }

    return res.status(200).json({ success: true, message });
  } catch (error) {
    console.error("Error in undoDeleteForMe:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

/**
 * POST /api/conversations/:id/clear
 * Adds current user to deletedForUsers for all messages in the conversation
 */
export const clearChatMessages = async (req: Request, res: Response) => {
  const { id: conversationId } = req.params;
  const currentUserId = (req as any).auth.userId;

  try {
    await Message.updateMany(
      { conversationId },
      { $addToSet: { deletedForUsers: currentUserId } }
    );

    return res.status(200).json({ success: true, message: "Chat cleared successfully" });
  } catch (error) {
    console.error("Error in clearChatMessages:", error);
    return res.status(500).json({ message: "Failed to clear chat" });
  }
};

/**
 * GET /api/conversations/:id/messages
 * Updated query filtering out messages hidden for the current user
 */
export const getConversationMessages = async (req: Request, res: Response) => {
  const { id: conversationId } = req.params;
  const currentUserId = (req as any).auth.userId;

  try {
    const messages = await Message.find({
      conversationId,
      deletedForUsers: { $ne: currentUserId } // Exclude messages deleted for me
    }).sort({ createdAt: 1 });

    return res.status(200).json({ success: true, messages });
  } catch (error) {
    return res.status(500).json({ message: "Failed to fetch messages" });
  }
};
```

### 3.2 Wire Routes in `server/src/routes/messages.ts`

```typescript
import { Router } from "express";
import {
  deleteForEveryone,
  deleteForMe,
  undoDeleteForMe,
  getConversationMessages,
  clearChatMessages
} from "../controllers/messageController";

const router = Router();

router.get("/conversations/:id/messages", getConversationMessages);
router.post("/conversations/:id/clear", clearChatMessages);
router.patch("/:id/delete-for-everyone", deleteForEveryone);
router.patch("/:id/delete-for-me", deleteForMe);
router.post("/:id/undo-delete-for-me", undoDeleteForMe);

export default router;
```

---

## 4. Frontend Implementation (React 19 + TypeScript)

### 4.1 Delete Modal Dialog (`client/src/components/chat/DeleteMessageModal.tsx`)

A WhatsApp-style pop-up offering "Delete for Me", "Delete for Everyone" (if eligible), and "Cancel".

```tsx
import React from "react";
import { Ban, Trash2, X } from "lucide-react";

interface DeleteMessageModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDeleteForMe: () => void;
  onDeleteForEveryone: () => void;
  isSender: boolean;
  isAdmin: boolean;
  messageCreatedAt: string;
}

const SIXTY_HOURS_MS = 60 * 60 * 1000 * 60;

export const DeleteMessageModal: React.FC<DeleteMessageModalProps> = ({
  isOpen,
  onClose,
  onDeleteForMe,
  onDeleteForEveryone,
  isSender,
  isAdmin,
  messageCreatedAt,
}) => {
  if (!isOpen) return null;

  const ageMs = Date.now() - new Date(messageCreatedAt).getTime();
  const canDeleteForEveryone = (isSender || isAdmin) && ageMs <= SIXTY_HOURS_MS;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-150">
      <div className="w-full max-w-sm rounded-2xl bg-[#171824] border border-white/[0.08] p-5 shadow-2xl text-left">
        <h3 className="text-base font-semibold text-white">Delete message?</h3>
        <p className="mt-1.5 text-xs text-slate-400 leading-relaxed">
          {canDeleteForEveryone
            ? "You can delete this message for everyone in this chat or only for yourself."
            : "You can delete this message from your device. Other participants will still be able to see it."}
        </p>

        <div className="mt-6 flex flex-col gap-2">
          {canDeleteForEveryone && (
            <button
              onClick={() => {
                onDeleteForEveryone();
                onClose();
              }}
              className="w-full py-2.5 px-4 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 font-medium text-xs text-center transition-colors border border-rose-500/20"
            >
              Delete for everyone
            </button>
          )}

          <button
            onClick={() => {
              onDeleteForMe();
              onClose();
            }}
            className="w-full py-2.5 px-4 rounded-xl bg-white/[0.05] hover:bg-white/[0.08] text-slate-200 font-medium text-xs text-center transition-colors"
          >
            Delete for me
          </button>

          <button
            onClick={onClose}
            className="w-full py-2.5 px-4 rounded-xl text-slate-400 hover:text-white font-medium text-xs text-center transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};
```

### 4.2 Tombstone Message Item (`client/src/components/chat/MessageItem.tsx`)

Renders the italicized *"This message was deleted"* placeholder when `isDeletedForEveryone === true`:

```tsx
import React, { useState } from "react";
import { Ban, MoreHorizontal } from "lucide-react";
import { MessageStatusTick } from "./MessageStatusTick";
import { DeleteMessageModal } from "./DeleteMessageModal";

export interface MessageProps {
  message: {
    _id: string;
    conversationId: string;
    senderId: string;
    content: string;
    status: "sent" | "delivered" | "read";
    isDeletedForEveryone: boolean;
    deletedBy?: {
      userId: string;
      username: string;
      role: "sender" | "admin";
    };
    createdAt: string;
  };
  currentUserId: string;
  isGroupAdmin: boolean;
  onDeleteForMe: (messageId: string) => void;
  onDeleteForEveryone: (messageId: string) => void;
}

export const MessageItem: React.FC<MessageProps> = ({
  message,
  currentUserId,
  isGroupAdmin,
  onDeleteForMe,
  onDeleteForEveryone,
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const isOwn = message.senderId === currentUserId;

  // 1. Tombstone Rendering (Deleted for Everyone)
  if (message.isDeletedForEveryone) {
    let tombstoneText = "This message was deleted";
    if (isOwn && message.deletedBy?.role === "sender") {
      tombstoneText = "You deleted this message";
    } else if (message.deletedBy?.role === "admin") {
      tombstoneText = `This message was deleted by admin ${
        message.deletedBy.userId === currentUserId ? "you" : message.deletedBy.username
      }`;
    }

    return (
      <div className={`flex ${isOwn ? "justify-end" : "justify-start"} my-1.5`}>
        <div
          className={`flex items-center gap-2 max-w-[70%] rounded-2xl px-3.5 py-2 text-xs italic ${
            isOwn
              ? "bg-[#171824]/60 text-slate-400 border border-white/[0.04] rounded-br-none"
              : "bg-[#13141d]/70 text-slate-500 border border-white/[0.03] rounded-bl-none"
          }`}
        >
          <Ban size={14} className="opacity-70 flex-shrink-0" />
          <span>{tombstoneText}</span>
          <span className="text-[10px] opacity-50 not-italic ml-2">
            {new Date(message.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </span>
        </div>
      </div>
    );
  }

  // 2. Standard Message Bubble with Options Trigger
  return (
    <>
      <div className={`group relative flex ${isOwn ? "justify-end" : "justify-start"} my-1`}>
        <div
          className={`relative max-w-[70%] rounded-2xl px-4 py-2 text-sm shadow-sm transition-all ${
            isOwn
              ? "bg-[#0066ff] text-white rounded-br-none"
              : "bg-[#171824] text-slate-100 rounded-bl-none border border-white/[0.05]"
          }`}
        >
          {/* Options button (visible on hover) */}
          <button
            onClick={() => setIsModalOpen(true)}
            className="absolute top-1.5 right-1.5 opacity-0 group-hover:opacity-100 p-1 rounded-md bg-black/20 hover:bg-black/40 text-white/80 hover:text-white transition-opacity"
            title="Options"
          >
            <MoreHorizontal size={13} />
          </button>

          <p className="break-words leading-relaxed pr-4">{message.content}</p>

          <div className="flex items-center justify-end gap-1 mt-1 text-[10px] text-white/70">
            <span>
              {new Date(message.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </span>
            <MessageStatusTick status={message.status} isOwnMessage={isOwn} />
          </div>
        </div>
      </div>

      <DeleteMessageModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onDeleteForMe={() => onDeleteForMe(message._id)}
        onDeleteForEveryone={() => onDeleteForEveryone(message._id)}
        isSender={isOwn}
        isAdmin={isGroupAdmin}
        messageCreatedAt={message.createdAt}
      />
    </>
  );
};
```

### 4.3 Undo Snackbar for "Delete for Me" (`client/src/components/chat/UndoSnackbar.tsx`)

WhatsApp gives users 5 seconds to undo an accidental local deletion:

```tsx
import React, { useEffect, useState } from "react";
import { Undo2 } from "lucide-react";

interface UndoSnackbarProps {
  messageId: string | null;
  onUndo: (messageId: string) => void;
  onDismiss: () => void;
  durationMs?: number;
}

export const UndoSnackbar: React.FC<UndoSnackbarProps> = ({
  messageId,
  onUndo,
  onDismiss,
  durationMs = 5000,
}) => {
  const [progress, setProgress] = useState(100);

  useEffect(() => {
    if (!messageId) return;

    const startTime = Date.now();
    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const remaining = Math.max(0, 100 - (elapsed / durationMs) * 100);
      setProgress(remaining);

      if (elapsed >= durationMs) {
        clearInterval(interval);
        onDismiss();
      }
    }, 50);

    return () => clearInterval(interval);
  }, [messageId, durationMs, onDismiss]);

  if (!messageId) return null;

  return (
    <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-40 flex flex-col overflow-hidden rounded-xl bg-[#171824] border border-white/[0.08] shadow-2xl animate-in slide-in-from-bottom duration-200">
      <div className="flex items-center gap-4 px-4 py-2.5">
        <span className="text-xs text-slate-300">Message deleted for you</span>
        <button
          onClick={() => {
            onUndo(messageId);
            onDismiss();
          }}
          className="flex items-center gap-1.5 text-xs font-semibold text-[#0066ff] hover:text-[#0052cc] transition-colors"
        >
          <Undo2 size={14} />
          <span>Undo</span>
        </button>
      </div>
      {/* Progress countdown bar */}
      <div
        className="h-0.5 bg-[#0066ff] transition-all duration-75 ease-linear"
        style={{ width: `${progress}%` }}
      />
    </div>
  );
};
```

### 4.4 Socket.IO Event Listener (`client/src/components/chat/ChatWindow.tsx`)

Wire the `message:revoked` listener in your chat window to replace the revoked message in the Zustand store:

```typescript
// Inside ChatWindow.tsx
useEffect(() => {
  const handleMessageRevoked = (data: {
    messageId: string;
    conversationId: string;
    deletedBy: any;
    deletedAt: string;
  }) => {
    if (data.conversationId === activeConversationId) {
      useChatStore.getState().markMessageAsRevoked(data.conversationId, data.messageId, data.deletedBy);
    }
  };

  socket.on("message:revoked", handleMessageRevoked);

  return () => {
    socket.off("message:revoked", handleMessageRevoked);
  };
}, [activeConversationId]);
```

---

## 5. Agent Verification Checklist

- [ ] Updated `Message` schema with `isDeletedForEveryone`, `deletedBy`, `deletedAt`, and `deletedForUsers` array.
- [ ] Added `PATCH /api/messages/:id/delete-for-everyone` enforcing:
  - 60-hour timestamp limit.
  - Ownership or group admin check.
  - Setting `isDeletedForEveryone: true` and wiping content.
  - Emitting `message:revoked` to `conv:<conversationId>`.
- [ ] Added `PATCH /api/messages/:id/delete-for-me` appending `userId` to `deletedForUsers`.
- [ ] Added `POST /api/messages/:id/undo-delete-for-me` removing `userId` from `deletedForUsers`.
- [ ] Updated message query route to filter `{ deletedForUsers: { $ne: currentUserId } }`.
- [ ] Created `DeleteMessageModal.tsx` showing both options if within 60 hours, or only "Delete for me" if expired.
- [ ] Rendered tombstone with italicized *"You deleted this message"* or *"This message was deleted"* text.
- [ ] Added `UndoSnackbar.tsx` with a 5-second animated progress bar on "Delete for me".