# PHASE 7 — Polish, Testing, Deployment

> Give this whole file to the AI agent as context. Phases 1–6 must already be done and working. This is the final phase before submission.

## Goal
Harden the app (validation, consistent errors), add a test suite, containerize it, and deploy it to a public URL.

## Steps

### Step 7.1 — Error handling and validation
Task: Add a centralized `errorHandler.ts` Express middleware (already scaffolded as an empty file in Phase 1 — implement it now). Add Zod schemas validating every REST route body and every socket payload from Phases 1–5. Every error response must use this exact shape:
```json
{ "error": { "code": "SOME_CODE", "message": "Human readable message" } }
```

Verify: send an invalid body to any route (e.g. missing required field) → response matches the shape above with an appropriate HTTP status code.

### Step 7.2 — Backend tests
Task: Write Jest + Supertest tests for the auth routes and `messageService`, using `mongodb-memory-server` (an in-memory MongoDB, no real DB needed for tests). Cover the happy path and at least one failure case for each: register, login, refresh, message creation.

Verify: `npm test` passes in `server/` with no real MongoDB connection required.

### Step 7.3 — Docker Compose
Task: Create a root `docker-compose.yml` running three services: `server`, MongoDB, and Redis. Add Dockerfiles for `server/` and `client/`.

Verify: `docker compose up` starts all services; the backend logs a successful MongoDB connection inside the container.

### Step 7.4 — README and deployment
Task: Write a root `README.md` covering: local setup, environment variables (reference `PHASE_0_SETUP.md`'s env table), running via Docker Compose, and deployment steps for Vercel (client) and Render (server), with MongoDB Atlas as the database.

Deploy:
- Frontend → Vercel or Netlify
- Backend → Render or Railway
- Database → MongoDB Atlas (free M0 tier)
- Redis (optional) → Upstash free tier

Verify: set environment variables correctly on each platform — never commit real values, only `.env.example` with placeholders belongs in git. After deployment, open the public frontend URL and complete a full login → send message → receive on a second browser flow with no local servers running.

## Done condition for Phase 7 (and the whole project)
- [ ] All REST/socket inputs validated with Zod
- [ ] Error responses use the consistent `{ error: { code, message } }` shape
- [ ] Backend test suite passes via `npm test`
- [ ] `docker compose up` brings up server + MongoDB + Redis together
- [ ] App is reachable at a public URL with no local servers running
- [ ] `.env` is not committed anywhere in git history

## Stretch goals (optional, only after everything above is done)
Only attempt these if time remains. Each is independent — pick any subset.
- Image/file sharing in chat (Multer + Cloudinary, validate MIME type and size server-side)
- Push notifications (Web Push API / Firebase Cloud Messaging) for offline users
- Message reactions (emoji)
- Message search (MongoDB text index)
- Voice/video calling (WebRTC, using Socket.IO for signaling)
- End-to-end encryption
- Running multiple backend instances behind the Redis Socket.IO adapter to actually validate horizontal scaling (not just designing for it)
