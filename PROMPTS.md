# Cursor Build Prompts — Sequential Playbook

## How to use this file
- Work top to bottom, one prompt at a time — don't skip ahead. Later prompts assume the files from earlier prompts already exist.
- Paste each prompt as-is into Cursor's **Agent** chat (not Inline Edit), so it has full read/write access to the project.
- After each prompt, check the **Verify** line before moving to the next one. If something's off, fix it in the same chat first.
- If Cursor drifts from a convention in `AGENTS.md` (wrong export style, wrong config approach, etc.), correct it immediately — don't let a bad pattern get copied into the next five files.

---

## Phase 0 — Repository setup

### Prompt 0.1 — Initialize the repo structure
> Create a repo root with two folders, `client/` and `server/`. I've already placed `package.json` in each — don't overwrite them. Add a root `.gitignore` covering `node_modules`, `.env`, `dist`, `build`, and common editor files, suitable for a Node + Vite/React project.

**Verify:** `.gitignore` exists at root; both `package.json` files are untouched.

### Prompt 0.2 — Install dependencies
> Run `npm install` inside `server/` and `client/` using their existing `package.json` files. Report any peer-dependency warnings but don't change any version numbers without asking me first.

**Verify:** both `node_modules/` folders exist; no version numbers changed.

### Prompt 0.3 — Environment files
> Using ARCHITECTURE.md section 15, create `server/.env.example` and `client/.env.example` with placeholder values — no real secrets. Add a short "Environment setup" section to a root README explaining how to copy these to `.env`.

**Verify:** `.env.example` files exist with placeholders only.

---

## Phase 1 — Backend scaffolding & auth

### Prompt 1.1 — Scaffold backend structure
> Using ARCHITECTURE.md section 5.1, create the full `server/src/` folder and file structure — empty files only, no implementation yet. Include `tsconfig.json` for a Node + TypeScript project targeting ES2022, with `src/server.ts` as the entry point.

**Verify:** folder tree matches section 5.1; `npx tsc --noEmit` runs without "file not found" errors.

### Prompt 1.2 — DB and Redis config
> Implement `server/src/config/db.ts` (Mongoose connection using `MONGO_URI` from env) and `server/src/config/redis.ts` (Redis client using `REDIS_URL` from env). Both should log a clear success/failure message and exit the process on a failed required connection.

**Verify:** dev server logs a successful MongoDB connection (Redis can stay local/optional for now).

### Prompt 1.3 — User model
> Implement `server/src/models/User.ts` using the exact schema from ARCHITECTURE.md section 6.2, including the `IUser` interface.

**Verify:** file compiles; fields match the doc exactly.

### Prompt 1.4 — Conversation and Message models
> Implement `server/src/models/Conversation.ts` and `server/src/models/Message.ts` using the schemas from ARCHITECTURE.md section 6.2, including the compound index on `conversationId` + `createdAt` in the message schema.

**Verify:** both files compile; the index is present.

### Prompt 1.5 — Auth service and controller
> Implement `server/src/services/authService.ts` (register, login, refresh, logout — bcrypt hashing, JWT signing per section 7) and `server/src/controllers/authController.ts` that calls it. Token expiries should come from env vars, matching section 15.

**Verify:** functions exist for all four flows; no secret is hardcoded.

### Prompt 1.6 — Auth middleware and routes
> Implement `server/src/middlewares/authMiddleware.ts` (verifies the `Authorization: Bearer` JWT, attaches `req.userId`) and `server/src/routes/authRoutes.ts` wiring the four auth endpoints from section 7. Mount the router in `app.ts`.

**Verify:** with curl/Thunder Client — register, log in, confirm an access token and a `Set-Cookie` refresh token; hit a protected route with and without the token.

---

## Phase 2 — Core chat REST APIs

### Prompt 2.1 — User routes
> Implement `userController.ts` and `userRoutes.ts` for `GET /api/users/me`, `PATCH /api/users/me`, and `GET /api/users/search`, protected by `authMiddleware`.

**Verify:** with a valid token, fetch your own profile and search for a seeded user.

### Prompt 2.2 — Conversation routes
> Implement `conversationController.ts`, `conversationRoutes.ts`, and the corresponding service for the four conversation endpoints in section 7. A "direct" conversation must not be duplicated if one already exists between the same two users.

**Verify:** create a direct conversation twice between the same two users — the second call returns the existing one.

### Prompt 2.3 — Message history route
> Implement the paginated message history endpoint `GET /api/conversations/:id/messages`, using cursor-based pagination (`before` + `limit`) ordered newest-first.

**Verify:** seed 40+ messages in a conversation; confirm pagination returns 30 by default and the next page via `before`.

---

## Phase 3 — Real-time layer (Socket.IO)

### Prompt 3.1 — Socket auth middleware and server bootstrap
> Implement `server/src/sockets/socketAuthMiddleware.ts` exactly as in ARCHITECTURE.md section 8.1, and `server/src/sockets/index.ts` that initializes Socket.IO on the same HTTP server as Express, applies the auth middleware, and auto-joins each socket to `user:<userId>` plus a room per conversation the user belongs to.

**Verify:** connect with `socket.io-client` in a scratch script — succeeds with a valid token, fails with an invalid one.

### Prompt 3.2 — Message send/receive handlers
> Implement `server/src/sockets/handlers/messageHandlers.ts` for the `message:send` → `message:new` flow in section 8.4 — persist via the existing message service, then broadcast to the conversation room. Reuse `messageService`, don't duplicate its logic.

**Verify:** two clients in the same room — client A emits `message:send`, client B receives `message:new` with the persisted `_id`.

### Prompt 3.3 — Read receipts
> Implement the `message:read` → `message:read:update` flow from the section 8.3 event table — update `readBy` and `status`, then notify the sender.

**Verify:** client B marks a message read; client A receives the read-update event.

---

## Phase 4 — Presence & typing

### Prompt 4.1 — Typing indicator
> Implement `typingHandlers.ts` for `typing:start`/`typing:stop` → `typing:update`, broadcasting to the room excluding the sender.

**Verify:** client A typing shows the indicator on client B, not on A itself.

### Prompt 4.2 — Presence tracking
> Implement `presenceHandlers.ts` and `presenceService.ts` per section 8.5 — track online status in Redis with a short TTL, handle multi-tab connections correctly (don't go offline while another tab is connected), and broadcast `presence:online`/`presence:offline` with `lastSeen`.

**Verify:** two tabs as the same user, close one — stays online; close both — `presence:offline` fires with a timestamp.

---

## Phase 5 — Group chat

### Prompt 5.1 — Group creation and membership
> Extend `conversationService.ts`/`conversationController.ts` to support creating a group (`type: "group"`, `groupName`, multiple participants) and an add/remove-member endpoint restricted to admins.

**Verify:** create a group with 3 users, add a 4th, remove one — `participants` updates correctly, non-admins are rejected.

### Prompt 5.2 — Group messaging
> Confirm the existing `message:send`/`message:new` handlers work unchanged for group conversations, since messages key off `conversationId` regardless of type. Add a test for a 3-person group broadcast.

**Verify:** a group message reaches all connected members.

---

## Phase 6 — Frontend

### Prompt 6.1 — Scaffold frontend structure
> Using ARCHITECTURE.md section 4.1, create the full `client/src/` folder structure — empty files only. Set up Vite with the React SWC plugin and the Tailwind v4 Vite plugin per AGENTS.md (no `tailwind.config.js`).

**Verify:** `npm run dev` starts with no config errors; a test Tailwind class renders.

### Prompt 6.2 — API client layer
> Implement `client/src/api/axiosClient.ts` (base instance attaching the access token via interceptor, refreshing on a 401) and `authApi.ts`, `userApi.ts`, `messageApi.ts` wrapping the backend endpoints from section 7.

**Verify:** log in from a scratch component; confirm the token is attached to subsequent requests.

### Prompt 6.3 — Auth store and pages
> Implement `authStore.ts` (Zustand) holding the current user and access token, and build `LoginPage.tsx`/`RegisterPage.tsx` using it. Add a protected-route wrapper in `AppRouter.tsx` using React Router v7's data router API.

**Verify:** register, log in, refresh the page — session persists or you're cleanly redirected to login.

### Prompt 6.4 — Socket connection hook
> Implement `useSocket.ts` per section 8.1 — one socket instance created after login, shared across all components, disconnected on logout.

**Verify:** after login, only one active WS connection in the network tab; it closes on logout.

### Prompt 6.5 — Conversation list and chat window
> Implement `ConversationList.tsx` (via `conversationApi` + React Query), and `ChatWindow.tsx` + `MessageBubble.tsx` + `MessageInput.tsx`, wired to `useSocket` for send/receive, with optimistic UI on send per section 4.2.

**Verify:** sending a message shows it immediately (pending), then reconciles once the server broadcasts it back.

### Prompt 6.6 — Typing indicator and presence UI
> Implement `TypingIndicator.tsx` and an online/offline dot on avatars, wired to `typing:update` and `presence:online`/`presence:offline`.

**Verify:** typing in one browser shows in another; closing a tab updates the other user's presence dot.

---

## Phase 7 — Polish, testing, deployment

### Prompt 7.1 — Error handling and validation
> Add a centralized `errorHandler.ts` Express middleware and Zod schemas validating every REST route and socket payload. Return a consistent `{ error: { code, message } }` shape.

### Prompt 7.2 — Backend tests
> Write Jest + Supertest tests for the auth routes and message service using `mongodb-memory-server` per section 12. Cover register/login happy paths and at least one failure case each.

### Prompt 7.3 — Docker Compose
> Create a root `docker-compose.yml` running `server`, MongoDB, and Redis as services, plus Dockerfiles for `server/` and `client/` per section 10.

### Prompt 7.4 — README and deployment
> Write a root `README.md` covering local setup, environment variables, running via Docker Compose, and deployment to Vercel (client) and Render (server) per section 10.

---

## Notes
- Phases map roughly onto the roadmap in ARCHITECTURE.md section 13 — useful if you're also writing weekly progress notes for evaluation.
- If a step's output doesn't match its "Verify" line, fix it before moving on — a broken layer compounds fast in later phases.
- Split any single prompt into two if Cursor's output for that scope feels rushed or incomplete.
