# UX Flows & Screen Reference

> Companion doc to `PHASE_6_FRONTEND.md`. Read this before building any screen — it defines what each screen contains and how they connect, so layout isn't guessed from folder names alone.

## 1. Screen inventory (MVP — exactly 4 screens, nothing more)

| Screen | Route | Component | Purpose |
|---|---|---|---|
| Login | `/login` | `LoginPage.tsx` | Email + password → access token |
| Register | `/register` | `RegisterPage.tsx` | Username, email, password → auto-login |
| Chat | `/chat` | `ChatPage.tsx` | Sidebar (conversations) + active conversation — this is where users spend almost all their time |
| Profile | `/profile` | `ProfilePage.tsx` | Edit avatar, status message |

**Rule:** an individual conversation is NOT a separate route/page (no `/chat/:id` page component). It is a *selected state* inside the Chat screen, held in `chatStore`. Switching conversations re-renders `ChatWindow`, nothing navigates away, and the socket connection never reconnects.

## 2. Top-level flow

```
App loads
   │
   ▼
┌─────────────┐        ┌──────────────┐
│ Login screen │  OR   │Register screen│
└──────┬───────┘        └──────┬───────┘
       │                       │
       └───────────┬───────────┘
                    ▼
            ┌───────────────┐
            │  Chat screen   │  ← all successful auth lands here, always
            │ (sidebar + chat│     no separate "landing page"
            │     window)    │
            └───────┬───────┘
                     │
       ┌─────────────┼─────────────┐
       ▼             ▼             ▼
  Open existing   New chat /    Profile
  conversation    new group     screen
       │             │             │
       └─────────────┴─────────────┘
                     │
                     ▼
             back to Chat screen
```

A protected-route wrapper (`AppRouter.tsx`, Phase 6 Step 6.3) guards `/chat` and `/profile` — redirect to `/login` if there's no valid session. `/login` and `/register` redirect to `/chat` if a valid session already exists.

## 3. Chat screen — internal layout

Two panels, both visible on desktop; sidebar becomes a full-screen view on mobile (user taps back to return to it).

- **Left panel — `ConversationList.tsx`**
  - Every conversation the user belongs to, sorted by `lastMessage` timestamp (newest first).
  - Each row shows: avatar (or group icon), name, last message preview, unread count badge, online/offline dot (direct conversations only).
  - A "+" button at the top opens the "new chat/group" flow (see below).
  - Clicking a row sets that conversation as selected in `chatStore` — does not navigate.

- **Right panel — `ChatWindow.tsx`**
  - Header: conversation name/avatar, presence text ("Online" / "Last seen 5m ago" for direct; participant count for group).
  - Message list: `MessageBubble.tsx` per message, newest at the bottom, auto-scrolls on new message. Infinite-scroll upward loads older pages via `GET /api/conversations/:id/messages?before=&limit=` (never through sockets).
  - `TypingIndicator.tsx`: a line below the message list, e.g. "Alex is typing…", shown only when `typing:update` reports `isTyping: true` for someone other than the current user.
  - `MessageInput.tsx`: pinned to the bottom. On submit: emits `typing:stop`, then `message:send` via the socket, and immediately renders the message locally with a `pending` state (optimistic UI).
  - Empty state: when no conversation is selected (e.g. first load, or mobile before picking one), show a simple placeholder — never leave this panel blank with no explanation.

## 4. Key sub-flows

### 4.1 Starting a new conversation
1. User taps "+" in `ConversationList`.
2. A search modal opens, calling `userApi.search`.
3. **Direct chat:** pick one user → `POST /api/conversations` with `{ type: "direct" }` → backend returns the existing conversation if one already exists between the two users, or creates a new one → that conversation becomes selected.
4. **Group chat:** multi-select users + enter a group name → `POST /api/conversations` with `{ type: "group", groupName, participants }` → new conversation becomes selected.

### 4.2 Sending a message (optimistic UI — critical to get right)
1. User types in `MessageInput`, hits send.
2. The message appears **immediately** in the bubble list with a `pending` visual state (e.g. faded, small clock icon) — do not wait for the server.
3. Socket emits `message:send`.
4. Server broadcasts `message:new` with the persisted `_id` back to the room (including the sender).
5. The client reconciles: matches the broadcast to the pending local message (by temp ID + content, or just replaces the oldest pending message in that conversation) and swaps it to its confirmed state.

This is the single most important interaction to get right — it's what makes the app feel real-time even on a slow connection. If this is skipped, every message will visibly "pop" after a round-trip delay.

### 4.3 Read receipts & presence — ambient UI, not screens
Never build these as separate screens or modals. They're small visual states layered onto existing components:
- Online/offline dot on avatars (`ConversationList` rows, `ChatWindow` header) — driven by `presence:online` / `presence:offline`.
- Delivered/read indicator on `MessageBubble` (e.g. single check = sent, double check = read) — driven by `message:read:update`.
- "X is typing…" text — driven by `typing:update`, auto-clears after a few seconds of inactivity or on `typing:stop`.

### 4.4 Profile
Simple form: avatar (upload or URL), status message. `PATCH /api/users/me` on save. No separate "view profile" vs "edit profile" mode needed for MVP — one editable form is enough.

## 5. Figma recommendation (do this before writing frontend code)

Before Phase 6 starts, build a Figma file with exactly these frames, matching `ARCHITECTURE.md` section 4.1's folder structure so implementation maps 1:1 to design:
1. **Login**
2. **Register**
3. **Chat — empty state** (no conversation selected)
4. **Chat — conversation selected** (direct)
5. **Chat — conversation selected** (group, showing participant list difference if any)
6. **Chat — new chat/group modal** (as an overlay state on frame 3 or 4)
7. **Profile**

Name frames/components to match component file names above (`ConversationList`, `ChatWindow`, `MessageBubble`, etc.) so Cursor/Gemini can map design to code directly in Phase 6, instead of inventing layout from folder names alone.

## 6. Done condition
- [ ] Figma file has the 7 frames above, named to match component files
- [ ] Everyone on the team agrees: 4 routes only, conversation = state not route
- [ ] Optimistic-send behavior (4.2) is understood by whoever builds `MessageInput`/`ChatWindow`
- [ ] Presence/read-receipt UI is scoped as "decorations on existing components," not new screens
