# PHASE 6 — Frontend

> Give this whole file to the AI agent as context. Phases 1–5 (backend) must already be done and working. This phase can start as soon as Phase 2 is stable, run in parallel with Phases 3–5 if working in a team — but if one agent builds everything, do it after Phase 5.

## Goal
Build the React client: scaffolding, API client, auth pages, the socket connection hook, the chat UI, and typing/presence UI.

## Fixed rules
- Components never call `axios` or `socket.io-client` directly. REST calls go through `src/api/*.ts`. Real-time goes through `src/hooks/useSocket.ts` — exactly **one** socket instance, created after login, shared across all components, disconnected on logout.
- Optimistic UI: when a user sends a message, render it immediately with a `pending` status, then reconcile once the server broadcasts `message:new` back.
- Message history is loaded via REST with cursor pagination (`?before=&limit=`), never through sockets.
- No `tailwind.config.js` — Tailwind v4 CSS-first config via `@tailwindcss/vite`.
- No pre-v6 `react-router-dom` API (`<Switch>`, `useHistory`) — use v7's data router API only.
- TypeScript strict mode, named exports only.

## Folder structure to create
```
client/
├── src/
│   ├── api/
│   │   ├── axiosClient.ts
│   │   ├── authApi.ts
│   │   ├── userApi.ts
│   │   └── messageApi.ts
│   ├── components/
│   │   ├── chat/
│   │   │   ├── ChatWindow.tsx
│   │   │   ├── MessageBubble.tsx
│   │   │   ├── MessageInput.tsx
│   │   │   ├── TypingIndicator.tsx
│   │   │   └── ConversationList.tsx
│   │   ├── common/
│   │   └── layout/
│   ├── store/
│   │   ├── authStore.ts
│   │   ├── chatStore.ts
│   │   └── socketStore.ts
│   ├── hooks/
│   │   ├── useSocket.ts
│   │   ├── useAuth.ts
│   │   └── useTypingIndicator.ts
│   ├── pages/
│   │   ├── LoginPage.tsx
│   │   ├── RegisterPage.tsx
│   │   ├── ChatPage.tsx
│   │   └── ProfilePage.tsx
│   ├── types/
│   │   ├── user.ts
│   │   ├── message.ts
│   │   └── socketEvents.ts
│   ├── routes/
│   │   └── AppRouter.tsx
│   ├── utils/
│   ├── App.tsx
│   └── main.tsx
├── .env
├── package.json
└── vite.config.ts
```

## Steps

### Step 6.1 — Scaffold frontend structure
Task: Create the full `client/src/` folder structure above — empty files only. Set up Vite with the React SWC plugin and the Tailwind v4 Vite plugin.

Verify: `npm run dev` starts with no config errors. A test Tailwind class renders visibly.

### Step 6.2 — API client layer
Task: Implement `client/src/api/axiosClient.ts` — a base axios instance that attaches the access token via a request interceptor, and refreshes the token on a 401 response. Implement `authApi.ts`, `userApi.ts`, `messageApi.ts` wrapping the backend endpoints from Phases 1–2.

Verify: log in from a scratch component. Confirm the token is attached to subsequent requests automatically.

### Step 6.3 — Auth store and pages
Task: Implement `authStore.ts` (Zustand) holding the current user and access token. Build `LoginPage.tsx` and `RegisterPage.tsx` using it. Add a protected-route wrapper inside `AppRouter.tsx` using React Router v7's data router API.

Verify: register, log in, refresh the page — session persists, or the user is cleanly redirected to login if the session is invalid.

### Step 6.4 — Socket connection hook
Task: Implement `useSocket.ts` — one socket instance, created after login, shared across all components via `socketStore`, disconnected on logout. Connect using the pattern from Phase 3:
```typescript
const socket = io(import.meta.env.VITE_SOCKET_URL, {
  auth: { token: accessToken },
  autoConnect: false,
});
```

Verify: after login, the browser's network tab shows exactly one active WebSocket connection. It closes on logout.

### Step 6.5 — Conversation list and chat window
Task: Implement `ConversationList.tsx` (via `conversationApi` + TanStack Query), and `ChatWindow.tsx` + `MessageBubble.tsx` + `MessageInput.tsx`, wired to `useSocket` for send/receive, with optimistic UI on send.

Verify: sending a message shows it immediately with a pending state, then reconciles (pending → confirmed) once the server broadcasts `message:new` back.

### Step 6.6 — Typing indicator and presence UI
Task: Implement `TypingIndicator.tsx` and an online/offline dot on user avatars, wired to the `typing:update` and `presence:online`/`presence:offline` events from Phase 4.

Verify: typing in one browser shows the indicator in another connected browser. Closing a tab updates the other user's presence dot to offline.

## Done condition for Phase 6
- [x] Frontend folder structure matches Step 6.1
- [x] All REST calls go through `src/api/*.ts`, never direct `axios` calls in components
- [x] Exactly one socket connection per session, via `useSocket`
- [x] Sending a message shows optimistic UI, then reconciles
- [x] Typing indicator and presence dot both work live between two browsers

Next file: `PHASE_7_POLISH_TESTING_DEPLOYMENT.md`
