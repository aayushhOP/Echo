# Advanced WhatsApp-Style Blocking & Delivery Receipt Pipeline

**Project Stack:** React 19 · TypeScript · Express 5 · Node.js · MongoDB / Mongoose · Socket.IO · Redis Adapter

---

## 1. Architectural Overview & State Matrix

This specification elevates blocking and message delivery to production WhatsApp standards:

### 1.1 WhatsApp Blocking Dynamics
1. **Silent Rejection (Anti-Harassment):** A blocked user is never shown an error banner like "You are blocked." They are permitted to send messages on the frontend, but:
   - The message is saved in MongoDB for the sender only (or marked as `undeliverableToBlocker`).
   - The message is **never relayed** to the blocker.
   - The sender permanently sees a **Single Grey Tick (✓ - Sent)**. It will never transition to Double Tick or Blue.
2. **Immediate Presence Suppression:**
   - The blocker's real-time online status and `lastSeen` are immediately shielded from the blocked contact.
   - If User A blocks User B while User B is viewing their chat, User B immediately receives a socket payload masking User A as permanently offline with no `lastSeen`.
3. **Immediate Typing Suppression:**
   - `typing:start` and `typing:stop` events are completely dropped between mutually blocked pairs.
4. **Bidirectional Single Tick Guarantee:**
   - If User A blocks User B, neither can trigger delivered/read acknowledgments across that 1:1 boundary. Any message created while a block exists remains stuck at status `sent` (Single Tick).

### 1.2 Message Delivery Lifecycle (Ticks)
| Status | Visual Representation | Condition |
| :--- | :--- | :--- |
| `sent` | Single Grey Tick (✓) | Message is committed to the database on the server, but recipient has not acknowledged receipt. Permanent state if recipient blocked the sender. |
| `delivered` | Double Grey Tick (✓✓) | Recipient client has an active socket connection and emitted a delivery ack back to the server. |
| `read` | Double Blue Tick (✓✓ blue) | Recipient currently has the chat open or clicks into the conversation and emits a read ack. |

---

## 2. Database Schema Updates

### 2.1 Message Schema (`server/src/models/Message.ts`)
Update the message status enum and recipient tracking:

```typescript
import { Schema, model, Document, Types } from "mongoose";

export type MessageDeliveryStatus = "sent" | "delivered" | "read";

export interface IMessage extends Document {
  conversationId: Types.ObjectId;
  senderId: string; // Clerk user ID
  content: string;
  type: "text" | "image" | "file";
  status: MessageDeliveryStatus;
  readBy: {
    userId: string;
    readAt: Date;
  }[];
  deliveredTo: {
    userId: string;
    deliveredAt: Date;
  }[];
  isDroppedDueToBlock?: boolean; // Internal tracking flag
  createdAt: Date;
  updatedAt: Date;
}

const messageSchema = new Schema<IMessage>(
  {
    conversationId: { type: Schema.Types.ObjectId, ref: "Conversation", required: true, index: true },
    senderId: { type: String, required: true, index: true },
    content: { type: String, required: true },
    type: { type: String, enum: ["text", "image", "file"], default: "text" },
    status: {
      type: String,
      enum: ["sent", "delivered", "read"],
      default: "sent",
      index: true
    },
    readBy: [
      {
        userId: { type: String, required: true },
        readAt: { type: Date, default: Date.now }
      }
    ],
    deliveredTo: [
      {
        userId: { type: String, required: true },
        deliveredAt: { type: Date, default: Date.now }
      }
    ],
    isDroppedDueToBlock: { type: Boolean, default: false }
  },
  { timestamps: true }
);

// Compound index for lightning-fast conversation history lookups
messageSchema.index({ conversationId: 1, createdAt: -1 });

export default model<IMessage>("Message", messageSchema);
```

### 2.2 User Model Blocking Helper (`server/src/models/User.ts`)
Ensure fast lookup for mutual blocking checks:

```typescript
// Helper method to check block relationship in one query
userSchema.statics.isBlockedRelationship = async function (userA: string, userB: string): Promise<boolean> {
  const users = await this.find({ clerkId: { $in: [userA, userB] } }).select("clerkId blockedUsers");
  const docA = users.find((u) => u.clerkId === userA);
  const docB = users.find((u) => u.clerkId === userB);

  const aBlockedB = docA?.blockedUsers?.includes(userB) ?? false;
  const bBlockedA = docB?.blockedUsers?.includes(userA) ?? false;

  return aBlockedB || bBlockedA;
};
```

---

## 3. Real-Time Socket Architecture (Server)

### 3.1 Advanced Message Routing & Silent Block Handling (`server/src/sockets/handlers/messageHandlers.ts`)

When User A sends a message to User B:
1. Save the message to DB with status `"sent"` (1 Tick).
2. Check if User B has blocked User A, or if User A has blocked User B.
3. If blocked: **Acknowledge the sender with success** (saving the message with `status: "sent"`), but **do not forward** the socket event to User B.
4. If not blocked:
   - Check if User B has active sockets (`io.in('user:' + userB).allSockets()`).
   - If active: relay message to User B, immediately transition status to `"delivered"`, and emit `message:status_update` back to User A.

```typescript
import { Server, Socket } from "socket.io";
import Message from "../../models/Message";
import Conversation from "../../models/Conversation";
import User from "../../models/User";

export const registerMessageHandlers = (io: Server, socket: Socket) => {
  const senderId = socket.data.userId;

  // 1. SEND MESSAGE
  socket.on("message:send", async (payload: { conversationId: string; content: string; type?: "text" | "image" | "file" }, callback) => {
    try {
      const { conversationId, content, type = "text" } = payload;
      const conversation = await Conversation.findById(conversationId);
      if (!conversation) return callback?.({ error: "Conversation not found" });

      let isBlocked = false;
      let recipientId: string | undefined;

      // In 1-on-1 direct conversations, inspect block relations
      if (conversation.type === "direct") {
        recipientId = conversation.participants.find((id: string) => id !== senderId);
        if (recipientId) {
          const [senderDoc, recipientDoc] = await Promise.all([
            User.findOne({ clerkId: senderId }).select("blockedUsers"),
            User.findOne({ clerkId: recipientId }).select("blockedUsers")
          ]);

          const senderBlockedRecipient = senderDoc?.blockedUsers?.includes(recipientId);
          const recipientBlockedSender = recipientDoc?.blockedUsers?.includes(senderId);

          if (senderBlockedRecipient || recipientBlockedSender) {
            isBlocked = true;
          }
        }
      }

      // Persist the message as 'sent' (Single Tick)
      const newMessage = await Message.create({
        conversationId,
        senderId,
        content,
        type,
        status: "sent",
        isDroppedDueToBlock: isBlocked
      });

      // Confirm to sender socket (Sender immediately gets 1 Tick)
      callback?.({ success: true, message: newMessage });

      // If blocked in 1:1, STOP HERE. Do not broadcast to recipient.
      if (isBlocked && conversation.type === "direct") {
        return;
      }

      if (conversation.type === "direct" && recipientId) {
        const recipientSockets = await io.in(`user:${recipientId}`).allSockets();
        const isRecipientConnected = recipientSockets.size > 0;

        // Relay to recipient's personal room
        io.to(`user:${recipientId}`).emit("message:new", newMessage);

        // If recipient is connected, transition immediately to Double Grey Tick ("delivered")
        if (isRecipientConnected) {
          newMessage.status = "delivered";
          newMessage.deliveredTo.push({ userId: recipientId, deliveredAt: new Date() });
          await newMessage.save();

          // Notify sender of the 2nd tick
          io.to(`user:${senderId}`).emit("message:status_update", {
            messageId: newMessage._id,
            conversationId,
            status: "delivered"
          });
        }
      } else {
        // Group Chat: Broadcast to the entire conversation room except sender
        socket.to(`conv:${conversationId}`).emit("message:new", newMessage);
      }
    } catch (error) {
      console.error("Error in message:send:", error);
      callback?.({ error: "Failed to process message" });
    }
  });

  // 2. READ RECEIPT ACKNOWLEDGMENT (Double Blue Tick)
  socket.on("message:mark_read", async (payload: { conversationId: string; messageIds: string[] }) => {
    try {
      const { conversationId, messageIds } = payload;
      if (!messageIds || messageIds.length === 0) return;

      const conversation = await Conversation.findById(conversationId);
      if (!conversation) return;

      // Update matching messages to 'read'
      await Message.updateMany(
        {
          _id: { $in: messageIds },
          conversationId,
          senderId: { $ne: senderId }, // Only mark others' messages
          status: { $ne: "read" }
        },
        {
          $set: { status: "read" },
          $addToSet: { readBy: { userId: senderId, readAt: new Date() } }
        }
      );

      // Broadcast the blue ticks back to the conversation or specific sender
      io.to(`conv:${conversationId}`).emit("message:status_batch_update", {
        conversationId,
        messageIds,
        status: "read",
        readByUserId: senderId
      });
    } catch (error) {
      console.error("Error in message:mark_read:", error);
    }
  });

  // 3. TYPING STATUS INTERCEPTOR
  socket.on("typing:start", async (payload: { conversationId: string; targetUserId?: string }) => {
    const { conversationId, targetUserId } = payload;
    if (targetUserId) {
      const isBlocked = await (User as any).isBlockedRelationship(senderId, targetUserId);
      if (isBlocked) return; // Drop typing indicator silently
      io.to(`user:${targetUserId}`).emit("typing:started", { conversationId, userId: senderId });
    } else {
      socket.to(`conv:${conversationId}`).emit("typing:started", { conversationId, userId: senderId });
    }
  });

  socket.on("typing:stop", async (payload: { conversationId: string; targetUserId?: string }) => {
    const { conversationId, targetUserId } = payload;
    if (targetUserId) {
      const isBlocked = await (User as any).isBlockedRelationship(senderId, targetUserId);
      if (isBlocked) return;
      io.to(`user:${targetUserId}`).emit("typing:stopped", { conversationId, userId: senderId });
    } else {
      socket.to(`conv:${conversationId}`).emit("typing:stopped", { conversationId, userId: senderId });
    }
  });
};
```

### 3.2 Block Toggle Controller with Live Presence Strip (`server/src/controllers/userController.ts`)

When User A clicks Block User B:
1. Push `userB` into `userA.blockedUsers`.
2. Push `presence:masked` to User B so User A's avatar immediately shows offline with hidden `lastSeen`.

```typescript
import { Request, Response } from "express";
import User from "../models/User";
import { getIO } from "../sockets"; // Expose your Socket.IO instance

export const blockUserController = async (req: Request, res: Response) => {
  const currentUserId = (req as any).auth.userId;
  const { targetUserId } = req.body;

  if (!targetUserId) {
    return res.status(400).json({ success: false, message: "Target user ID required" });
  }

  const user = await User.findOneAndUpdate(
    { clerkId: currentUserId },
    { $addToSet: { blockedUsers: targetUserId } },
    { new: true }
  );

  const io = getIO();
  // Immediately inform the blocked user that this contact is offline/hidden
  io.to(`user:${targetUserId}`).emit("presence:masked", {
    userId: currentUserId,
    isOnline: false,
    lastSeen: null
  });

  return res.status(200).json({ success: true, blockedUsers: user?.blockedUsers });
};

export const unblockUserController = async (req: Request, res: Response) => {
  const currentUserId = (req as any).auth.userId;
  const { targetUserId } = req.body;

  const user = await User.findOneAndUpdate(
    { clerkId: currentUserId },
    { $pull: { blockedUsers: targetUserId } },
    { new: true }
  );

  const io = getIO();
  // Fetch real presence state from Redis to restore accurate status
  const sockets = await io.in(`user:${currentUserId}`).allSockets();
  io.to(`user:${targetUserId}`).emit("presence:unmasked", {
    userId: currentUserId,
    isOnline: sockets.size > 0
  });

  return res.status(200).json({ success: true, blockedUsers: user?.blockedUsers });
};
```

---

## 4. Frontend Component & Hook Implementation (React 19)

### 4.1 Message Status Icon Component (`client/src/components/chat/MessageStatusTick.tsx`)

Render single tick, double tick, or double blue tick:

```tsx
import React from "react";
import { Check, CheckCheck } from "lucide-react";

export type MessageStatus = "sent" | "delivered" | "read";

interface MessageStatusTickProps {
  status: MessageStatus;
  isOwnMessage: boolean;
  className?: string;
}

export const MessageStatusTick: React.FC<MessageStatusTickProps> = ({
  status,
  isOwnMessage,
  className = ""
}) => {
  if (!isOwnMessage) return null;

  switch (status) {
    case "sent":
      // Single Grey Tick
      return (
        <Check
          size={14}
          strokeWidth={2.5}
          className={`text-slate-400 inline-block ml-1 transition-colors duration-200 ${className}`}
          title="Sent (Delivered to server)"
        />
      );
    case "delivered":
      // Double Grey Tick
      return (
        <CheckCheck
          size={15}
          strokeWidth={2.5}
          className={`text-slate-400 inline-block ml-1 transition-colors duration-200 ${className}`}
          title="Delivered to recipient"
        />
      );
    case "read":
      // Double Blue Tick (Electric blue matching the theme)
      return (
        <CheckCheck
          size={15}
          strokeWidth={2.5}
          className={`text-[#0066ff] inline-block ml-1 transition-colors duration-200 ${className}`}
          title="Read by recipient"
        />
      );
    default:
      return null;
  }
};
```

### 4.2 Zustand Chat Store Update (`client/src/store/chatStore.ts`)

Support granular message status updates:

```typescript
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
  messages: Record<string, Message[]>; // conversationId -> Message[]
  updateMessageStatus: (conversationId: string, messageId: string, status: "sent" | "delivered" | "read") => void;
  updateBatchMessageStatus: (conversationId: string, messageIds: string[], status: "sent" | "delivered" | "read") => void;
  appendMessage: (conversationId: string, message: Message) => void;
}

export const useChatStore = create<ChatState>((set) => ({
  messages: {},

  appendMessage: (conversationId, message) =>
    set((state) => ({
      messages: {
        ...state.messages,
        [conversationId]: [...(state.messages[conversationId] || []), message]
      }
    })),

  updateMessageStatus: (conversationId, messageId, status) =>
    set((state) => {
      const convMessages = state.messages[conversationId] || [];
      return {
        messages: {
          ...state.messages,
          [conversationId]: convMessages.map((m) => (m._id === messageId ? { ...m, status } : m))
        }
      };
    }),

  updateBatchMessageStatus: (conversationId, messageIds, status) =>
    set((state) => {
      const idSet = new Set(messageIds);
      const convMessages = state.messages[conversationId] || [];
      return {
        messages: {
          ...state.messages,
          [conversationId]: convMessages.map((m) => (idSet.has(m._id) ? { ...m, status } : m))
        }
      };
    })
}));
```

### 4.3 Chat Viewport Read Trigger (`client/src/components/chat/ChatWindow.tsx`)

When the user enters a conversation, identify unread messages and emit `message:mark_read`:

```tsx
import { useEffect, useRef } from "react";
import { useChatStore } from "../../store/chatStore";
import { MessageStatusTick } from "./MessageStatusTick";
import { socket } from "../../services/socket";

interface ChatWindowProps {
  conversationId: string;
  currentUserId: string;
}

export const ChatWindow: React.FC<ChatWindowProps> = ({ conversationId, currentUserId }) => {
  const messages = useChatStore((state) => state.messages[conversationId] || []);
  const updateBatchMessageStatus = useChatStore((state) => state.updateBatchMessageStatus);
  const updateMessageStatus = useChatStore((state) => state.updateMessageStatus);

  // 1. Listen for real-time delivery and read updates
  useEffect(() => {
    socket.on("message:status_update", ({ conversationId: cId, messageId, status }) => {
      if (cId === conversationId) {
        updateMessageStatus(cId, messageId, status);
      }
    });

    socket.on("message:status_batch_update", ({ conversationId: cId, messageIds, status }) => {
      if (cId === conversationId) {
        updateBatchMessageStatus(cId, messageIds, status);
      }
    });

    return () => {
      socket.off("message:status_update");
      socket.off("message:status_batch_update");
    };
  }, [conversationId, updateMessageStatus, updateBatchMessageStatus]);

  // 2. Mark incoming messages as read when viewing this conversation
  useEffect(() => {
    const unreadMessageIds = messages
      .filter((m) => m.senderId !== currentUserId && m.status !== "read")
      .map((m) => m._id);

    if (unreadMessageIds.length > 0) {
      socket.emit("message:mark_read", {
        conversationId,
        messageIds: unreadMessageIds
      });
    }
  }, [messages, conversationId, currentUserId]);

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-3">
      {messages.map((msg) => {
        const isOwn = msg.senderId === currentUserId;

        return (
          <div key={msg._id} className={`flex ${isOwn ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[70%] rounded-2xl px-4 py-2.5 shadow-sm text-sm ${
                isOwn
                  ? "bg-[#0066ff] text-white rounded-br-none"
                  : "bg-[#1b1c27] text-slate-100 rounded-bl-none border border-white/[0.04]"
              }`}
            >
              <p className="break-words leading-relaxed">{msg.content}</p>
              
              <div className="flex items-center justify-end gap-1 mt-1 text-[10px] text-white/70">
                <span>{new Date(msg.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                <MessageStatusTick status={msg.status} isOwnMessage={isOwn} />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};
```

---

## 5. Verification Checklist for the Agent

- [x] Updated `Message` schema with `status` enum (`sent`, `delivered`, `read`), `deliveredTo`, and `readBy` arrays.
- [x] Updated `message:send` handler:
  - If a 1:1 recipient blocked sender (or vice-versa), save message to DB with `status: "sent"` and return success to sender, but **do not** emit to recipient.
  - If recipient is connected, emit to recipient and immediately update status to `"delivered"` (Double Grey Tick) on sender's client.
- [x] Added `message:mark_read` handler: updates messages to `"read"` and emits `message:status_batch_update` (turning ticks `#0066ff` Blue).
- [x] Added `typing:start` and `typing:stop` suppression when users have blocked each other.
- [x] Connected `presence:masked` event on block toggle to clear `lastSeen` and force offline state on the blocked user's viewport.
- [x] Integrated `MessageStatusTick.tsx` rendering Lucide `Check` (1 tick) and `CheckCheck` (grey 2 ticks vs blue 2 ticks).