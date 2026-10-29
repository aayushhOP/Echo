# PHASE 4 — Presence & Typing Indicators

> Give this whole file to the AI agent as context. Phases 1–3 must already be done and working.

## Goal
Add typing indicators and online/offline presence tracking, with correct multi-tab behavior.

## Event catalogue for this phase

| Event | Direction | Payload | Purpose |
|---|---|---|---|
| `typing:start` | client→server | `{ conversationId }` | User starts typing |
| `typing:stop` | client→server | `{ conversationId }` | User stops typing |
| `typing:update` | server→client | `{ conversationId, userId, isTyping }` | Broadcast typing state to room, excluding sender |
| `presence:online` | server→client | `{ userId }` | User came online |
| `presence:offline` | server→client | `{ userId, lastSeen }` | User went offline |

## Steps

### Step 4.1 — Typing indicator
Task: Implement `server/src/sockets/handlers/typingHandlers.ts` for `typing:start` / `typing:stop` → `typing:update`. Broadcast to the conversation room, **excluding the sender's own socket** (use `socket.to(room)`, not `io.to(room)`).

Verify: client A typing shows the typing indicator on client B's screen, but not on client A's own screen.

### Step 4.2 — Presence tracking
Task: Implement `server/src/sockets/handlers/presenceHandlers.ts` and `server/src/services/presenceService.ts`:
- On `connection`: mark the user online. Prefer a Redis key with a short TTL (refreshed on activity) over a MongoDB write, since Redis avoids a DB write on every connect/disconnect.
- On `disconnect`: check whether the user has any **other** active sockets (multi-tab/multi-device support) before marking them offline.
- If no sockets remain: broadcast `presence:offline` with `{ userId, lastSeen }` to the user's contacts, and persist `lastSeen` to MongoDB.
- If other sockets remain: do nothing — the user stays online.

Verify:
1. Open two browser tabs as the same user. Close one tab → user stays online (check via `presence:online`/no offline event).
2. Close both tabs → `presence:offline` fires once, with a `lastSeen` timestamp.

## Done condition for Phase 4
- [x] Typing indicator shows on the recipient's screen only, not the sender's
- [x] Closing one of several tabs does not mark the user offline
- [x] Closing the last tab marks the user offline with a correct `lastSeen`
- [x] Presence state is read from Redis, not MongoDB, on the hot path

Next file: `PHASE_5_GROUP_CHAT.md`
