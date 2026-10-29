# PHASE 0 — Repository & Environment Setup

> Give this whole file to the AI agent as context. Work top to bottom. Do not skip steps.

## Goal
Get a clean repo skeleton with `client/` and `server/`, correct `.gitignore`, and `.env.example` files, so every later phase has a stable foundation.

## Prerequisites
- Empty project folder.
- `client/package.json` and `server/package.json` already exist (provided separately) — do not overwrite them.

## Tech Stack (fixed — do not change)
- Frontend: React 19, TypeScript, Vite, Tailwind CSS v4 (CSS-first config, no `tailwind.config.js`), Zustand, TanStack Query, React Router v7, socket.io-client
- Backend: Node.js, Express 5, TypeScript, Socket.IO, Mongoose 9, MongoDB, JWT auth (15m access + 7d refresh cookie), Redis (optional, for presence + horizontal scaling)

## Steps

### Step 0.1 — Folder structure
Task: Create a repo root with two folders, `client/` and `server/`. Do not overwrite the existing `package.json` in each. Add a root `.gitignore` covering `node_modules`, `.env`, `dist`, `build`, and common editor files, for a Node + Vite/React project.

Verify: `.gitignore` exists at root. Both `package.json` files are untouched.

### Step 0.2 — Install dependencies
Task: Run `npm install` inside `server/` and inside `client/` using their existing `package.json` files. Report peer-dependency warnings but do not change any version numbers without asking first.

Verify: both `node_modules/` folders exist. No version numbers changed.

### Step 0.3 — Environment files
Task: Create `server/.env.example` and `client/.env.example` using the variable list below. Use placeholder values only — no real secrets. Add a short "Environment setup" section to a root `README.md` explaining how to copy these files to `.env`.

```bash
# server/.env.example
PORT=5000
MONGO_URI=mongodb+srv://<user>:<pass>@cluster.mongodb.net/chatapp
JWT_SECRET=your_access_token_secret
JWT_REFRESH_SECRET=your_refresh_token_secret
JWT_ACCESS_EXPIRY=15m
JWT_REFRESH_EXPIRY=7d
REDIS_URL=redis://localhost:6379
CLOUDINARY_URL=cloudinary://<key>:<secret>@<cloud_name>
CLIENT_ORIGIN=http://localhost:5173

# client/.env.example
VITE_API_URL=http://localhost:5000/api
VITE_SOCKET_URL=http://localhost:5000
```

Verify: both `.env.example` files exist with placeholders only. `.env` is NOT tracked by git (check `git status`).

## Done condition for Phase 0
- [ ] `client/`, `server/` exist with their `package.json` untouched
- [ ] `.gitignore` excludes `node_modules`, `.env`, `dist`, `build`
- [ ] both `node_modules/` installed
- [ ] `.env.example` files created in both folders
- [ ] root `README.md` has an "Environment setup" section

Next file: `PHASE_1_BACKEND_AUTH.md`
