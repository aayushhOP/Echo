# PHASE 2 — Core Chat REST APIs

> Give this whole file to the AI agent as context. Phase 1 must already be done and working.

## Goal
Add user profile/search, conversation CRUD, and paginated message history — all REST, no sockets yet.

## Architecture rule (same as Phase 1)
Route → Middleware → Controller → Service → Model. Keep controllers thin. All new logic goes in `services/`.

## Endpoints to build in this phase

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/api/users/me` | Yes | Get current user profile |
| PATCH | `/api/users/me` | Yes | Update profile (status, avatar) |
| GET | `/api/users/search?q=` | Yes | Search users by username |
| GET | `/api/conversations` | Yes | List all conversations for current user |
| POST | `/api/conversations` | Yes | Create direct or group conversation |
| GET | `/api/conversations/:id` | Yes | Get single conversation metadata |
| PATCH | `/api/conversations/:id` | Yes | Update group (add/remove members, rename) |
| GET | `/api/conversations/:id/messages?before=&limit=` | Yes | Paginated message history |

All routes are protected by the `authMiddleware` built in Phase 1.

## Steps

### Step 2.1 — User routes
Task: Implement `userController.ts` and `userRoutes.ts` for `GET /api/users/me`, `PATCH /api/users/me`, and `GET /api/users/search`, protected by `authMiddleware`. Validate the `PATCH` body with Zod (only `status` and `avatarUrl` are editable).

Verify: with a valid token, fetch your own profile and search for a seeded user by partial username.

### Step 2.2 — Conversation routes
Task: Implement `conversationController.ts`, `conversationRoutes.ts`, and a `conversationService.ts` for the four conversation endpoints above. Rule: a `"direct"` conversation must never be duplicated — before creating one, check whether a direct conversation between the same two users already exists and return it instead.

Verify: create a direct conversation between user A and user B twice. The second call returns the existing conversation, not a new one.

### Step 2.3 — Message history route
Task: Implement `GET /api/conversations/:id/messages` using cursor-based pagination: query params `before` (a message `_id` or `createdAt` cursor) and `limit` (default 30). Results are ordered newest-first. Only a participant of the conversation may fetch its history (check `participants` array against `req.userId`, return 403 otherwise).

Verify: seed 40+ messages in one conversation. Confirm the endpoint returns 30 messages by default, and passing `before` with the oldest returned message's cursor returns the next page.

## Done condition for Phase 2
- [ ] `/api/users/me` GET and PATCH work
- [ ] `/api/users/search` returns matching users
- [ ] Creating the same direct conversation twice returns the same conversation
- [ ] Message history paginates correctly with `before` + `limit`
- [ ] Non-participants get 403 on conversation/message routes

Next file: `PHASE_3_REALTIME.md`
