# Project Instructions

## Overview
Real-time chat application — college major project (7th semester). Two apps in this repo:
- `client/` — React 19 + TypeScript + Vite
- `server/` — Node.js + Express 5 + Socket.IO + MongoDB

Full design lives in `ARCHITECTURE.md` at the repo root. Read the relevant section before generating code for a new feature — don't improvise structure that contradicts it.

## Tech stack
- Frontend: React 19, TypeScript, Vite, Tailwind CSS v4, Zustand, TanStack Query, React Router v7, Socket.IO client
- Backend: Node.js, Express 5, TypeScript, Socket.IO, Mongoose 9, MongoDB
- Auth: JWT access token (15m expiry) + httpOnly refresh cookie (7d expiry)
- Real-time scaling (optional locally): Redis + `@socket.io/redis-adapter`

## Architecture rules
- Backend request flow: `Route -> Middleware -> Controller -> Service -> Model`. Controllers stay thin (parse request, call service, format response). Business logic lives in `services/` so REST controllers and Socket.IO handlers can both call the same service functions instead of duplicating logic.
- Socket.IO event names and payload shapes must match `ARCHITECTURE.md` section 8.3 exactly. If a new event is genuinely needed, update that table in the same change.
- Every socket connection is authenticated via `socketAuthMiddleware` before joining any room. Never trust a `userId` sent inside an event payload — always read `socket.data.userId`, set once at handshake.
- Frontend components never call `axios` or `socket.io-client` directly. Go through `src/api/*.ts` for REST and `src/hooks/useSocket.ts` for real-time — one socket connection, reused everywhere.

## Conventions
- TypeScript everywhere, strict mode on, on both frontend and backend.
- Validate every REST request body and socket payload with Zod before it touches the database.
- Named exports for components and modules — no default exports.
- Secrets (JWT keys, DB URI, Redis URL) come from `process.env` via `.env`, never hardcoded, never committed.
- Mongoose schema field names and shapes must match `ARCHITECTURE.md` section 6.2 — don't rename fields ad hoc.

## Avoid
- No `tailwind.config.js` — this project uses Tailwind v4's CSS-first config via `@tailwindcss/vite`.
- No pre-v6 `react-router-dom` API (`<Switch>`, `useHistory`, etc.) — this project is on v7's data router APIs.
- No `express-async-errors` package — Express 5 handles async route-handler errors natively.
- No writing files directly under `dist/` or `build/` — those are generated output, not source.
