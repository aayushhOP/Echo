# WhatsApp-Style Advanced Group Architecture & Governance — Technical Specification

**Project Stack:** Express 5 · Node.js · MongoDB / Mongoose · Socket.IO · React 19 · TypeScript · Tailwind CSS · Lucide React

---

## 1. Architectural Model & Domain Rules

### 1.1 Role Hierarchy & Permissions
1. **Primary Admin (Creator):**
   * Identified by `creatorId`.
   * Cannot be demoted or removed by any other admin.
   * Retains permanent admin authority unless they explicitly leave the group.
2. **Group Admin:**
   * Promoted by the creator or another admin.
   * Can edit group settings, approve/reject pending join requests, promote other members, demote other admins (except `creatorId`), remove members, and revoke any message ("Delete for Everyone by Admin").
3. **Regular Member:**
   * Can participate in chats, share media, and view members.
   * If `settings.onlyAdminsMessage === true`, the input area is disabled with a read-only banner.
   * Cannot edit group info if `settings.onlyAdminsEditInfo === true`.

### 1.2 Governance & Lifecycle Rules
* **Restricted Messaging Mode:** When toggled on, only admins can emit `message:send` for that room. Regular members attempting to send via API/socket receive a `403 Forbidden` rejection.
* **Silent Leave Notification:** When a regular participant leaves, no public chat broadcast is pushed to all members. The system injects a system-type notification visible **only to admins**.
* **Admin Succession (Orphan Prevention):** If the sole remaining admin leaves, the server automatically selects an existing member (e.g., the oldest participant by `joinedAt`) and promotes them to admin before processing the departure.
* **Past Participants Audit:** Users who leave or get kicked are tracked in a `pastParticipants` sub-array with a 60-day TTL.

---

## 2. Database Schema Updates

### 2.1 Extended Conversation Model (`server/src/models/Conversation.ts`)

Update the Mongoose conversation schema to support structured participants, granular settings, pending approvals, and invite tokens:

```typescript
import { Schema, model, Document, Types } from "mongoose";

export interface IGroupParticipant {
  userId: string; // Clerk ID
  role: "admin" | "member";
  joinedAt: Date;
}

export interface IPastParticipant {
  userId: string;
  leftAt: Date;
  reason: "left" | "removed";
}

export interface IConversation extends Document {
  type: "direct" | "group";
  name?: string;
  description?: string;
  avatarUrl?: string;
  creatorId?: string;
  participants: string[]; // For backwards-compatibility & quick indexing
  groupParticipants: IGroupParticipant[];
  pastParticipants: IPastParticipant[];
  pendingRequests: string[]; // Clerk IDs waiting for admin approval
  inviteToken?: string;
  settings: {
    onlyAdminsMessage: boolean;
    onlyAdminsEditInfo: boolean;
    onlyAdminsAddMembers: boolean;
    requireAdminApproval: boolean;
  };
  createdAt: Date;
  updatedAt: Date;
}

const conversationSchema = new Schema<IConversation>(
  {
    type: { type: String, enum: ["direct", "group"], required: true },
    name: { type: String },
    description: { type: String, default: "" },
    avatarUrl: { type: String },
    creatorId: { type: String },
    participants: [{ type: String, index: true }],
    groupParticipants: [
      {
        userId: { type: String, required: true },
        role: { type: String, enum: ["admin", "member"], default: "member" },
        joinedAt: { type: Date, default: Date.now },
      },
    ],
    pastParticipants: [
      {
        userId: { type: String, required: true },
        leftAt: { type: Date, default: Date.now },
        reason: { type: String, enum: ["left", "removed"], default: "left" },
      },
    ],
    pendingRequests: [{ type: String }],
    inviteToken: { type: String, unique: true, sparse: true },
    settings: {
      onlyAdminsMessage: { type: Boolean, default: false },
      onlyAdminsEditInfo: { type: Boolean, default: false },
      onlyAdminsAddMembers: { type: Boolean, default: false },
      requireAdminApproval: { type: Boolean, default: false },
    },
  },
  { timestamps: true }
);

export default model<IConversation>("Conversation", conversationSchema);
```

---

## 3. Backend Implementation (Express Controllers)

### 3.1 Permissions Middleware (`server/src/middleware/groupAuth.ts`)

```typescript
import { Request, Response, NextFunction } from "express";
import Conversation from "../models/Conversation";

export const requireGroupAdmin = async (req: Request, res: Response, next: NextFunction) => {
  const currentUserId = (req as any).auth.userId;
  const { id: conversationId } = req.params;

  try {
    const conversation = await Conversation.findById(conversationId);
    if (!conversation || conversation.type !== "group") {
      return res.status(404).json({ message: "Group not found" });
    }

    const member = conversation.groupParticipants.find((p) => p.userId === currentUserId);
    if (!member || member.role !== "admin") {
      return res.status(403).json({ message: "Action requires group administrator privileges" });
    }

    (req as any).group = conversation;
    next();
  } catch (err) {
    return res.status(500).json({ message: "Internal permission verification error" });
  }
};
```

### 3.2 Group Administration Controllers (`server/src/controllers/groupController.ts`)

```typescript
import { Request, Response } from "express";
import crypto from "crypto";
import Conversation from "../models/Conversation";
import Message from "../models/Message";
import { getIO } from "../sockets";

/**
 * PATCH /api/groups/:id/settings
 * Toggle messaging, info edits, and join approval rules
 */
export const updateGroupSettings = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { onlyAdminsMessage, onlyAdminsEditInfo, onlyAdminsAddMembers, requireAdminApproval } = req.body;
  const currentUserId = (req as any).auth.userId;

  try {
    const conversation = await Conversation.findById(id);
    if (!conversation || conversation.type !== "group") {
      return res.status(404).json({ message: "Group not found" });
    }

    const admin = conversation.groupParticipants.find((p) => p.userId === currentUserId && p.role === "admin");
    if (!admin) return res.status(403).json({ message: "Admins only" });

    if (onlyAdminsMessage !== undefined) conversation.settings.onlyAdminsMessage = onlyAdminsMessage;
    if (onlyAdminsEditInfo !== undefined) conversation.settings.onlyAdminsEditInfo = onlyAdminsEditInfo;
    if (onlyAdminsAddMembers !== undefined) conversation.settings.onlyAdminsAddMembers = onlyAdminsAddMembers;
    if (requireAdminApproval !== undefined) conversation.settings.requireAdminApproval = requireAdminApproval;

    await conversation.save();

    // Broadcast updated settings to all connected group members
    getIO().to(`conv:${id}`).emit("group:settings-updated", {
      conversationId: id,
      settings: conversation.settings,
    });

    return res.status(200).json({ success: true, settings: conversation.settings });
  } catch (error) {
    return res.status(500).json({ message: "Failed to update settings" });
  }
};

/**
 * POST /api/groups/:id/members/:targetUserId/promote
 * Elevate regular member to Admin
 */
export const promoteMember = async (req: Request, res: Response) => {
  const { id, targetUserId } = req.params;
  const currentUserId = (req as any).auth.userId;

  try {
    const conversation = await Conversation.findById(id);
    if (!conversation) return res.status(404).json({ message: "Group not found" });

    const isCurrentAdmin = conversation.groupParticipants.some((p) => p.userId === currentUserId && p.role === "admin");
    if (!isCurrentAdmin) return res.status(403).json({ message: "Only admins can promote members" });

    const target = conversation.groupParticipants.find((p) => p.userId === targetUserId);
    if (!target) return res.status(404).json({ message: "User is not in group" });

    target.role = "admin";
    await conversation.save();

    getIO().to(`conv:${id}`).emit("group:member-promoted", {
      conversationId: id,
      promotedUserId: targetUserId,
      promotedByUserId: currentUserId,
    });

    return res.status(200).json({ success: true });
  } catch (error) {
    return res.status(500).json({ message: "Promotion failed" });
  }
};

/**
 * POST /api/groups/:id/members/:targetUserId/demote
 * Demote admin to regular member (protected against creator demotion)
 */
export const demoteMember = async (req: Request, res: Response) => {
  const { id, targetUserId } = req.params;
  const currentUserId = (req as any).auth.userId;

  try {
    const conversation = await Conversation.findById(id);
    if (!conversation) return res.status(404).json({ message: "Group not found" });

    if (targetUserId === conversation.creatorId) {
      return res.status(403).json({ message: "The group creator cannot be demoted" });
    }

    const isCurrentAdmin = conversation.groupParticipants.some((p) => p.userId === currentUserId && p.role === "admin");
    if (!isCurrentAdmin) return res.status(403).json({ message: "Only admins can demote" });

    const target = conversation.groupParticipants.find((p) => p.userId === targetUserId);
    if (!target) return res.status(404).json({ message: "User is not in group" });

    target.role = "member";
    await conversation.save();

    getIO().to(`conv:${id}`).emit("group:member-demoted", {
      conversationId: id,
      demotedUserId: targetUserId,
      demotedByUserId: currentUserId,
    });

    return res.status(200).json({ success: true });
  } catch (error) {
    return res.status(500).json({ message: "Demotion failed" });
  }
};

/**
 * POST /api/groups/:id/leave
 * Participant departure with silent admin alert and auto-succession
 */
export const leaveGroup = async (req: Request, res: Response) => {
  const { id } = req.params;
  const currentUserId = (req as any).auth.userId;

  try {
    const conversation = await Conversation.findById(id);
    if (!conversation || conversation.type !== "group") {
      return res.status(404).json({ message: "Group not found" });
    }

    const memberIndex = conversation.groupParticipants.findIndex((p) => p.userId === currentUserId);
    if (memberIndex === -1) return res.status(400).json({ message: "Not a participant" });

    const leavingMember = conversation.groupParticipants[memberIndex];

    // Remove user from active participants and append to past audit list
    conversation.groupParticipants.splice(memberIndex, 1);
    conversation.participants = conversation.participants.filter((uid) => uid !== currentUserId);
    conversation.pastParticipants.push({
      userId: currentUserId,
      leftAt: new Date(),
      reason: "left",
    });

    // Auto-Succession check: if no admins left, elevate the oldest member
    const remainingAdmins = conversation.groupParticipants.filter((p) => p.role === "admin");
    if (remainingAdmins.length === 0 && conversation.groupParticipants.length > 0) {
      conversation.groupParticipants.sort((a, b) => new Date(a.joinedAt).getTime() - new Date(b.joinedAt).getTime());
      conversation.groupParticipants[0].role = "admin";
      
      getIO().to(`conv:${id}`).emit("group:member-promoted", {
        conversationId: id,
        promotedUserId: conversation.groupParticipants[0].userId,
        reason: "auto-succession",
      });
    }

    await conversation.save();

    // WhatsApp Rule: Silent notification dispatched ONLY to remaining admins
    remainingAdmins.forEach((admin) => {
      getIO().to(`user:${admin.userId}`).emit("group:user-left-admin-alert", {
        conversationId: id,
        leftUserId: currentUserId,
        timestamp: new Date(),
      });
    });

    return res.status(200).json({ success: true, message: "Successfully left group" });
  } catch (error) {
    return res.status(500).json({ message: "Failed to leave group" });
  }
};

/**
 * POST /api/groups/:id/invite-link/generate
 * Creates or resets the group invite link token
 */
export const generateInviteLink = async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const token = crypto.randomBytes(16).toString("hex");
    const conversation = await Conversation.findByIdAndUpdate(id, { inviteToken: token }, { new: true });
    return res.status(200).json({
      success: true,
      inviteUrl: `${process.env.CLIENT_ORIGIN || "http://localhost:5173"}/invite/${token}`,
      inviteToken: token,
    });
  } catch (error) {
    return res.status(500).json({ message: "Error generating link" });
  }
};
```

### 3.3 Socket Handler Guard for Messaging Restrictions

In your `messageHandlers.ts`, check the `onlyAdminsMessage` flag prior to message emission:

```typescript
// server/src/sockets/handlers/messageHandlers.ts
socket.on("message:send", async (data, callback) => {
  const { conversationId, content } = data;
  const senderId = socket.data.userId;

  const conversation = await Conversation.findById(conversationId);
  if (!conversation) return callback?.({ error: "Conversation not found" });

  if (conversation.type === "group" && conversation.settings?.onlyAdminsMessage) {
    const participant = conversation.groupParticipants.find((p) => p.userId === senderId);
    if (!participant || participant.role !== "admin") {
      return callback?.({
        error: "Only admins can send messages in this group.",
        code: "ONLY_ADMINS_ALLOWED",
      });
    }
  }

  // Proceed with standard message creation and dispatch...
});
```

---

## 4. Frontend Implementation (React 19 + TypeScript)

### 4.1 Restricted Chat Input Bar (`client/src/components/chat/MessageInput.tsx`)

When the active group restricts sending to admins and the logged-in user is a regular participant, swap the input textarea with the WhatsApp banner:

```tsx
import React from "react";
import { Lock } from "lucide-react";

interface MessageInputProps {
  isGroup: boolean;
  onlyAdminsMessage: boolean;
  isCurrentUserAdmin: boolean;
  onSend: (text: string) => void;
}

export const MessageInput: React.FC<MessageInputProps> = ({
  isGroup,
  onlyAdminsMessage,
  isCurrentUserAdmin,
  onSend,
}) => {
  // WhatsApp Rule: Show read-only banner if user is not admin during restricted mode
  if (isGroup && onlyAdminsMessage && !isCurrentUserAdmin) {
    return (
      <div className="h-14 bg-[#13141d] border-t border-white/[0.06] flex items-center justify-center gap-2 px-4 text-xs text-slate-400">
        <Lock size={14} className="text-slate-500" />
        <span>Only admins can send messages</span>
      </div>
    );
  }

  return (
    <div className="h-16 bg-[#13141d] border-t border-white/[0.06] px-4 flex items-center gap-2">
      {/* Existing message input box, emoji picker, and send button */}
    </div>
  );
};
```

### 4.2 Group Settings Drawer & Admin Toggles (`client/src/components/chat/GroupSettingsModal.tsx`)

```tsx
import React from "react";
import { Shield, MessageSquare, Edit3, UserPlus, X } from "lucide-react";

interface GroupSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: {
    onlyAdminsMessage: boolean;
    onlyAdminsEditInfo: boolean;
    onlyAdminsAddMembers: boolean;
    requireAdminApproval: boolean;
  };
  onUpdateSetting: (key: string, value: boolean) => void;
}

export const GroupSettingsModal: React.FC<GroupSettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  onUpdateSetting,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-2xl bg-[#171824] border border-white/[0.08] p-6 shadow-2xl">
        <div className="flex items-center justify-between pb-4 border-b border-white/[0.06]">
          <div className="flex items-center gap-2 text-white font-semibold">
            <Shield size={18} className="text-[#0066ff]" />
            <span>Group Settings</span>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            <X size={18} />
          </button>
        </div>

        <div className="mt-4 space-y-4">
          {/* Send Messages Toggle */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <MessageSquare size={16} className="text-slate-400" />
              <div>
                <p className="text-xs font-medium text-white">Send Messages</p>
                <p className="text-[11px] text-slate-400">Choose who can send messages to this group</p>
              </div>
            </div>
            <button
              onClick={() => onUpdateSetting("onlyAdminsMessage", !settings.onlyAdminsMessage)}
              className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors ${
                settings.onlyAdminsMessage
                  ? "bg-[#0066ff] text-white"
                  : "bg-white/[0.06] text-slate-300 hover:bg-white/[0.1]"
              }`}
            >
              {settings.onlyAdminsMessage ? "Only Admins" : "All Members"}
            </button>
          </div>

          {/* Edit Group Info Toggle */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Edit3 size={16} className="text-slate-400" />
              <div>
                <p className="text-xs font-medium text-white">Edit Group Info</p>
                <p className="text-[11px] text-slate-400">Choose who can change group name, icon & description</p>
              </div>
            </div>
            <button
              onClick={() => onUpdateSetting("onlyAdminsEditInfo", !settings.onlyAdminsEditInfo)}
              className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors ${
                settings.onlyAdminsEditInfo
                  ? "bg-[#0066ff] text-white"
                  : "bg-white/[0.06] text-slate-300 hover:bg-white/[0.1]"
              }`}
            >
              {settings.onlyAdminsEditInfo ? "Only Admins" : "All Members"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
```

### 4.3 Participant Action Context Menu in Member List

In the group detail drawer, render administrative actions on user tiles:

```tsx
{/* Member context dropdown */}
<div className="flex items-center gap-2">
  {member.role === "admin" && (
    <span className="text-[10px] bg-[#0066ff]/20 text-[#0066ff] px-2 py-0.5 rounded border border-[#0066ff]/30">
      Admin
    </span>
  )}

  {isCurrentUserAdmin && member.userId !== currentUserId && (
    <div className="relative group">
      <button className="p-1 text-slate-400 hover:text-white">
        <MoreVertical size={14} />
      </button>

      {/* Flyout actions */}
      <div className="hidden group-hover:flex flex-col absolute right-0 top-6 w-36 bg-[#13141d] border border-white/[0.08] rounded-xl shadow-xl py-1 z-30">
        {member.role === "member" ? (
          <button
            onClick={() => handlePromote(member.userId)}
            className="px-3 py-1.5 text-left text-xs text-slate-200 hover:bg-white/[0.05]"
          >
            Make Admin
          </button>
        ) : member.userId !== conversation.creatorId ? (
          <button
            onClick={() => handleDemote(member.userId)}
            className="px-3 py-1.5 text-left text-xs text-slate-200 hover:bg-white/[0.05]"
          >
            Dismiss as Admin
          </button>
        ) : null}

        {member.userId !== conversation.creatorId && (
          <button
            onClick={() => handleRemove(member.userId)}
            className="px-3 py-1.5 text-left text-xs text-rose-400 hover:bg-rose-500/10"
          >
            Remove from Group
          </button>
        )}
      </div>
    </div>
  )}
</div>
```

---

## 5. Agent Verification Checklist

- [ ] **Data Model Extension:** Verified `Conversation` schema contains `groupParticipants` with role and timestamp, `pastParticipants`, and `settings` booleans.
- [ ] **Admin Privilege Enforcer:** Ensured non-admins cannot mutate `settings`, promote/demote members, or kick participants via API endpoints.
- [ ] **Creator Shield:** Validated that the user matching `creatorId` cannot be demoted or kicked by secondary admins.
- [ ] **Restricted Messaging Enforcement:**
  - Socket handler rejects incoming `message:send` when `onlyAdminsMessage === true` and sender is regular member.
  - Client swaps input bar with "Only admins can send messages" lock banner.
- [ ] **Silent Leave & Succession:**
  - Leaving member emits departure event to admins only.
  - If the departing member is the sole admin, the system automatically elevates the longest-tenured member to admin.
- [ ] **Invite Links:** Endpoint generates unique 16-byte hex tokens, and link reset breaks old invite links.