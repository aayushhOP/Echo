# Block User Feature — Technical Specification & Implementation Guide

**Project Stack:** React 19 · TypeScript · Express 5 · Node.js · MongoDB · Socket.IO

## 1. Overview & Objectives
The Block User feature allows individuals to prevent specific contacts from messaging them. 
When User A blocks User B:
1. User B cannot send direct messages to User A.
2. User A's online status and "last seen" are hidden from User B.
3. User A cannot send messages to User B without unblocking them first.
4. The chat input bar in the UI is disabled for the blocker, displaying an "Unblock to send a message" banner.

---

## 2. Database Schema Modifications (MongoDB)

Update the `User` schema to include an array of blocked user IDs.

### `server/src/models/User.ts`
```typescript
export interface IUser extends Document {
  clerkId: string;
  email: string;
  username: string;
  avatarUrl?: string;
  isOnline: boolean;
  lastSeen: Date;
  blockedUsers: string[]; // Array of Clerk IDs or ObjectIds of blocked users
}

// Add to schema definition:
const userSchema = new Schema<IUser>({
  // ... existing fields ...
  blockedUsers: { type: [String], default: [] }
});
```

---

## 3. REST API Requirements

Add endpoints to toggle the block state.

### 3.1 Block a User (`POST /api/users/block`)
* **Auth:** Required
* **Payload:** `{ "targetUserId": "user_2abc..." }`
* **Action:** Adds `targetUserId` to the requesting user's `blockedUsers` array using `$addToSet` to prevent duplicates.
* **Response:** `{ "success": true, "blockedUserId": "user_2abc..." }`

### 3.2 Unblock a User (`POST /api/users/unblock`)
* **Auth:** Required
* **Payload:** `{ "targetUserId": "user_2abc..." }`
* **Action:** Removes `targetUserId` from the `blockedUsers` array using `$pull`.
* **Response:** `{ "success": true, "unblockedUserId": "user_2abc..." }`

### 3.3 Get Blocked Users (`GET /api/users/blocked`)
* **Auth:** Required
* **Action:** Returns the populated profiles of all users in the `blockedUsers` array for management in Settings.
* **Response:** `{ "blockedUsers": [{ "clerkId": "...", "username": "..." }] }`

---

## 4. Socket.IO Message Gating

We must intercept messages at the Socket layer so blocked users cannot deliver payloads.

### `server/src/sockets/handlers/messageHandlers.ts`
Inside your `message:send` handler, add a strict validation check before processing the message:

```typescript
import User from "../../models/User";

socket.on("message:send", async (data, callback) => {
  const senderId = socket.data.userId; // Provided by Clerk JWT
  const { conversationId, content, targetUserId } = data;

  try {
    // 1. Fetch both sender and receiver to check block lists
    const [sender, receiver] = await Promise.all([
      User.findOne({ clerkId: senderId }),
      User.findOne({ clerkId: targetUserId })
    ]);

    if (!sender || !receiver) throw new Error("User not found");

    // 2. Check if Receiver blocked Sender
    if (receiver.blockedUsers.includes(senderId)) {
      // Silently fail for the sender (anti-harassment best practice) 
      // or return a specific error if you want to notify them.
      return callback({ error: "Cannot send message to this user." });
    }

    // 3. Check if Sender blocked Receiver
    if (sender.blockedUsers.includes(targetUserId)) {
      return callback({ error: "You must unblock this user to send a message." });
    }

    // 4. Proceed with message creation and broadcast...
    // ...
  } catch (error) {
    callback({ error: "Message failed to send." });
  }
});
```

*(Note: Ensure you filter presence events (`presence:online`) so blocked users don't receive live status updates about the blocker).*

---

## 5. Frontend Implementation (React)

### 5.1 Update `ContactDetailDrawer.tsx`
Add a "Block User" danger-zone button at the bottom of the drawer for 1-on-1 chats.

```tsx
import { Ban } from "lucide-react";

// Inside ContactDetailDrawer 1-on-1 render:
const isBlocked = currentUser.blockedUsers.includes(counterpart.clerkId);

<div className="mt-auto p-5 border-t border-slate-800/60">
  <button
    onClick={() => isBlocked ? handleUnblock(counterpart.clerkId) : handleBlock(counterpart.clerkId)}
    className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium transition-colors ${
      isBlocked 
        ? "bg-slate-800 text-slate-300 hover:bg-slate-700"
        : "bg-rose-500/10 text-rose-500 hover:bg-rose-500/20"
    }`}
  >
    <Ban size={16} />
    {isBlocked ? "Unblock Contact" : "Block Contact"}
  </button>
</div>
```

### 5.2 Update `MessageInput.tsx` (Disabled State)
If the current user has blocked the counterpart, replace the input bar with an unblock prompt.

```tsx
// Inside MessageInput component or ChatWindow footer:
const isBlocked = currentUser.blockedUsers.includes(activeConversation.counterpartId);

if (isBlocked) {
  return (
    <div className="p-4 bg-[#171824] flex items-center justify-center">
      <div className="bg-[#1b1c27] text-slate-400 text-xs px-6 py-3 rounded-2xl border border-white/[0.04]">
        You blocked this contact. {" "}
        <button 
          onClick={() => handleUnblock(activeConversation.counterpartId)}
          className="text-[#0066ff] hover:underline font-medium"
        >
          Unblock to send a message.
        </button>
      </div>
    </div>
  );
}

// Otherwise, render normal input...
```

---

## 6. Verification Checklist for the Agent

- [ ] Added `blockedUsers` array of strings to the `User` Mongoose schema.
- [ ] Created `POST /api/users/block` and `POST /api/users/unblock` endpoints.
- [ ] Updated `message:send` Socket listener to reject messages if either user has blocked the other.
- [ ] Added Block/Unblock toggle button in `ContactDetailDrawer.tsx`.
- [ ] Replaced the chat input bar with a disabled "Unblock to send" banner in `MessageInput.tsx` when the chat is blocked.