# PHASE 3 — Real-time Layer (Socket.IO)

> Give this whole file to the AI agent as context. Phases 1–2 must already be done and working.

## Goal
Add a Socket.IO server on top of the existing Express app: authenticated connections, room joins, message send/broadcast, and read receipts.

## Fixed rules (critical — do not violate)
- Every socket connection is authenticated via `socketAuthMiddleware` **before** joining any room.
- Never trust a `userId` sent inside an event payload. Always read `socket.data.userId`, which is set once at handshake and nowhere else.
- Socket handlers must call the **same service functions** used by REST controllers (e.g. `messageService.createMessage()`). Do not re-implement message creation logic inside a socket handler.
- Event names and payload shapes below are final — if a new event is genuinely needed, document it here in the same change.

## Room strategy
On connection, the server auto-joins each socket to:
- `conversation:<conversationId>` — one room per conversation the user belongs to
- `user:<userId>` — a personal room for direct notifications (e.g. "added to a new group")

Broadcasting a message only requires emitting to `conversation:<id>`.

## Event catalogue for this phase

| Event | Direction | Payload | Purpose |
|---|---|---|---|
| `connection` | client→server (implicit) | — | Socket handshake, triggers room joins |
| `message:send` | client→server | `{ conversationId, content, type }` | User sends a message |
| `message:new` | server→client | `{ message }` | Broadcast new message to room |
| `message:read` | client→server | `{ conversationId, messageIds[] }` | Mark messages as read |
| `message:read:update` | server→client | `{ conversationId, messageIds[], readerId }` | Notify sender of read receipt |
| `disconnect` | client→server (implicit) | — | Cleanup, leave rooms |

## Steps

### Step 3.1 — Socket auth middleware and server bootstrap
Task: Implement `server/src/sockets/socketAuthMiddleware.ts` using this pattern:

```typescript
import jwt from "jsonwebtoken";
import type { Socket } from "socket.io";

export const socketAuthMiddleware = (socket: Socket, next: (err?: Error) => void) => {
  const token = socket.handshake.auth?.token;
  if (!token) return next(new Error("No token provided"));

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET!) as { userId: string };
    socket.data.userId = payload.userId;
    next();
  } catch {
    next(new Error("Invalid token"));
  }
};
```

Then implement `server/src/sockets/index.ts` that initializes Socket.IO on the **same HTTP server** as Express, applies `socketAuthMiddleware`, and on `connection` auto-joins the socket to `user:<userId>` plus a room for every conversation the user belongs to (look these up via `conversationService`).

The client attaches the token like this (for reference, not built until Phase 6):
```typescript
const socket = io(import.meta.env.VITE_SOCKET_URL, {
  auth: { token: accessToken },
  autoConnect: false,
});
```

Verify: connect with `socket.io-client` in a scratch script — connection succeeds with a valid token, fails with an invalid or missing token.

### Step 3.2 — Message send/receive handlers
Task: Implement `server/src/sockets/handlers/messageHandlers.ts` for the `message:send` → `message:new` flow:
1. Client emits `message:send` with `{ conversationId, content, type }`.
2. Server calls `messageService.createMessage()` (reuse, don't duplicate) to persist the message.
3. Server broadcasts the saved message (with `_id` and `createdAt`) as `message:new` to room `conversation:<id>` — this includes the sender, so the sender's own UI reconciles the same way as everyone else's.

Verify: open two clients in the same conversation room. Client A emits `message:send`. Client B receives `message:new` with the persisted `_id`.

### Step 3.3 — Read receipts
Task: Implement the `message:read` → `message:read:update` flow:
1. Client emits `message:read` with `{ conversationId, messageIds[] }`.
2. Server updates each message's `readBy[]` array and `status` field to `"read"`.
3. Server emits `message:read:update` with `{ conversationId, messageIds[], readerId }` to the room (so the original sender's client updates its UI).

Verify: client B marks a message as read. Client A receives the `message:read:update` event.

## Done condition for Phase 3
- [ ] Socket connections reject invalid/missing tokens
- [ ] A connected socket is auto-joined to its conversation rooms + personal room
- [ ] `message:send` persists via `messageService` and broadcasts `message:new` with correct `_id`
- [ ] `message:read` updates `readBy`/`status` and broadcasts `message:read:update`
- [ ] No handler trusts a client-supplied `userId`

Next file: `PHASE_4_PRESENCE_TYPING.md`
