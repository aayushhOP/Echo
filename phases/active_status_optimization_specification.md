# Active Status & Presence Optimization Specification

**Project Stack:** Node.js · Express 5 · Socket.IO · Redis Adapter · Mongoose · React 19

## 1. Problem Statement
The current presence tracking mechanism suffers from inaccuracies due to:
1. **Multi-Tab Race Conditions:** Closing one tab immediately broadcasts an "offline" status even if the user has the app open in another tab.
2. **Database Hammering:** Writing `isOnline: true/false` directly to MongoDB on every single connect/disconnect event causes high write-load and leaves "zombie" online statuses if a connection drops ungracefully.

## 2. Optimized Solution Architecture
Instead of using the database as the source of truth for real-time presence, we will use **Socket.IO Personal Rooms + Redis Adapter**. 

1. Every user joins a personal room (`user:<userId>`) upon connection.
2. We count the active sockets in that room.
3. **Connect:** If `sockets.size === 1`, it's their first active connection. Broadcast `presence:online`.
4. **Disconnect:** If `sockets.size === 0`, all tabs/devices are closed. Broadcast `presence:offline` and do a **single** MongoDB write to update `lastSeen`.

---

## 3. Backend Implementation (Socket.IO)

### 3.1 Update Presence Handlers (`server/src/sockets/handlers/presenceHandlers.ts`)

Replace the existing naive connect/disconnect logic with active socket counting:

```typescript
import { Server, Socket } from "socket.io";
import User from "../../models/User";

export const handlePresence = (io: Server, socket: Socket) => {
  const userId = socket.data.userId;
  const personalRoom = `user:${userId}`;

  // 1. Join personal room on connection
  socket.join(personalRoom);

  const handleConnect = async () => {
    try {
      // .allSockets() safely queries across all server instances via Redis
      const sockets = await io.in(personalRoom).allSockets();
      
      // If exactly 1 socket exists, the user just came online globally
      if (sockets.size === 1) {
        socket.broadcast.emit("presence:online", { userId });
      }
    } catch (error) {
      console.error("Error handling presence connect:", error);
    }
  };

  const handleDisconnect = async () => {
    try {
      const sockets = await io.in(personalRoom).allSockets();
      
      // If 0 sockets exist, ALL tabs/devices are closed
      if (sockets.size === 0) {
        const lastSeen = new Date();
        
        // Broadcast offline status globally
        io.emit("presence:offline", { userId, lastSeen: lastSeen.toISOString() });
        
        // Persist offline state and lastSeen to DB safely in the background
        await User.findByIdAndUpdate(userId, { 
          isOnline: false, 
          lastSeen 
        });
      }
    } catch (error) {
      console.error("Error handling presence disconnect:", error);
    }
  };

  // Execute connect logic immediately
  handleConnect();

  // Attach disconnect listener
  socket.on("disconnect", handleDisconnect);
};
```

### 3.2 Add Initial Sync Handler (`server/src/sockets/handlers/presenceHandlers.ts`)

Since we no longer rely strictly on the database for real-time status on initial page load, the client needs a way to ask "Who is online right now?" when they first log in.

Add this listener inside your socket initialization:

```typescript
  // Listen for client requesting initial presence state
  socket.on("presence:request_sync", async (contactIds: string[]) => {
    if (!Array.isArray(contactIds) || contactIds.length === 0) return;

    try {
      const onlineContacts: string[] = [];
      
      // Check Redis/Socket.IO for active rooms
      for (const contactId of contactIds) {
        const sockets = await io.in(`user:${contactId}`).allSockets();
        if (sockets.size > 0) {
          onlineContacts.push(contactId);
        }
      }
      
      // Send back the array of currently online user IDs
      socket.emit("presence:sync", { onlineUsers: onlineContacts });
    } catch (error) {
      console.error("Error syncing presence:", error);
    }
  });
```

---

## 4. Frontend Implementation (React / Zustand)

### 4.1 Update Socket Store / Hooks (`client/src/store/socketStore.ts` or `useSocket.ts`)

The frontend needs to request the initial sync once it loads the contacts, and handle the real-time differential events.

```typescript
// 1. Initial Sync Request
// Call this after fetching your conversation list or contacts
const requestPresenceSync = (contactIds: string[]) => {
  socket.emit("presence:request_sync", contactIds);
};

// 2. Listeners
socket.on("presence:sync", ({ onlineUsers }: { onlineUsers: string[] }) => {
  // Update local Zustand store to mark these specific users as online
  // e.g., chatStore.getState().setMultipleUsersOnline(onlineUsers);
});

socket.on("presence:online", ({ userId }: { userId: string }) => {
  // chatStore.getState().setUserOnline(userId, true);
});

socket.on("presence:offline", ({ userId, lastSeen }: { userId: string, lastSeen: string }) => {
  // chatStore.getState().setUserOnline(userId, false, lastSeen);
});
```

---

## 5. Verification Checklist for Agent

- [x] Replaced manual `User.findOneAndUpdate({ isOnline: true })` on every socket connect with Socket.IO personal room joins (`user:<userId>`).
- [x] Connected `io.in('user:id').allSockets()` logic to check if `sockets.size === 1` (broadcast online) or `sockets.size === 0` (broadcast offline and update MongoDB).
- [x] Added `presence:request_sync` handler on the backend to batch-check active rooms.
- [x] Frontend updated to emit `presence:request_sync` with an array of contact IDs upon loading the chat dashboard.
- [x] Multi-tab testing: Opening a second tab does NOT trigger another `presence:online` broadcast. Closing one of the two tabs does NOT trigger a `presence:offline` broadcast.
