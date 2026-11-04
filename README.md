# Echo — Real-Time Chat Application

[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=flat&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![React 19](https://img.shields.io/badge/React_19-20232A?style=flat&logo=react&logoColor=61DAFB)](https://react.dev/)
[![Express 5](https://img.shields.io/badge/Express_5-000000?style=flat&logo=express&logoColor=white)](https://expressjs.com/)
[![Socket.IO](https://img.shields.io/badge/Socket.IO-010101?style=flat&logo=socketdotio&logoColor=white)](https://socket.io/)
[![Tailwind CSS v4](https://img.shields.io/badge/Tailwind_CSS_v4-38B2AC?style=flat&logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)
[![MongoDB](https://img.shields.io/badge/MongoDB-4EA94B?style=flat&logo=mongodb&logoColor=white)](https://www.mongodb.com/)
[![Clerk](https://img.shields.io/badge/Auth-Clerk-6C47FF?style=flat&logo=clerk&logoColor=white)](https://clerk.com/)

**Echo** is a WhatsApp-inspired, production-grade real-time chat application built as a college major project (7th semester). The repository is structured as two cleanly decoupled applications:
- **`echo-app/`** — Modern frontend powered by React 19, TypeScript, Vite, Tailwind CSS v4, Zustand, TanStack Query, and React Router v7.
- **`echo-service/`** — Robust backend powered by Node.js, Express 5, Socket.IO, Mongoose 9, MongoDB, and Redis.

---

## 🚀 Key Features

### 🔐 Authentication & Identity
- **Clerk Integration & Native JWT Support**: Seamless authentication with Clerk authentication provider plus token rotation and user sync mechanisms.
- **Webhook Synchronization**: Svix-verified webhooks (`/api/webhooks/clerk`) keeping MongoDB user collections synchronized with Clerk in real time.
- **Custom Profile & Avatar Studio**: User bio, presence status message, and custom circular avatar cropping modal powered by Cloudinary media storage.

### 💬 Messaging Experience
- **1-on-1 Direct Messaging**: Private conversations with real-time socket delivery, read/delivered ticks (single tick, double tick, blue double ticks).
- **Advanced Group Chats**:
  - Role-based permissions (`admin`, `member`).
  - Add/remove members, transfer group ownership, manage group descriptions, and assign admins.
  - Group avatar upload and group info drawer.
- **Rich Message Actions**:
  - **Quoted Replies**: In-line quoted replies with scroll-to-original message animation.
  - **Reactions**: Emoji reaction picker and reactions breakdown modal.
  - **Message Pinning**: Pin crucial announcements/messages with custom expiry duration banners.
  - **Forwarding**: Multi-chat message forwarding.
  - **Deletion**: WhatsApp-style "Delete for Me" and "Delete for Everyone" with undo snackbars.
- **Voice Notes**: Native audio recording overlay with waveform visualization, playback controls, and Cloudinary audio streaming.
- **Cursor Pagination**: Optimized infinite scroll message history powered by TanStack Query and MongoDB cursor indexes.

### ⚡ Real-Time & Presence
- **Multi-Tab Presence Tracking**: Redis-backed / in-memory tracking of active socket connections per user across multiple devices and tabs.
- **Instant Typing Indicators**: Ephemeral typing status broadcasts with debounced auto-stop timers.
- **Unified Dual Notification System**:
  - In-app custom interactive toast banners with sound effects.
  - Native Web Notifications API for background tabs and desktop alerts.
- **Cold-Start Resilience**: Built-in backend warmup modal and health probes designed specifically for free-tier deployments (e.g., Render spin-down).

### 👥 Contact Management & Discovery
- **Saved Contacts Directory**: Save contacts with international phone format support and custom display names.
- **Contact Discovery**: Global user search with unsaved contact warnings and quick save shortcuts.
- **User Blocking**: Block/unblock contacts with immediate message suppression and real-time state sync.

---

## 🛠️ Tech Stack & Architecture

### Frontend (`echo-app/`)
- **Core Framework**: React 19, TypeScript, Vite
- **Styling**: Tailwind CSS v4 (CSS-first engine via `@tailwindcss/vite`), Lucide React icons, Framer Motion animations
- **State Management**: Zustand (isolated stores: `authStore`, `chatStore`, `contactStore`, `socketStore`, `confirmDialogStore`)
- **Data Fetching & Cache**: TanStack Query (React Query v5) paired with Axios interceptors
- **Routing**: React Router v7 data router with guarded route layouts
- **Media & Audio**: MediaRecorder API for voice notes, Canvas API for avatar cropping
- **Real-Time Client**: Socket.IO client (`^4.8.3`) singleton hook

### Backend (`echo-service/`)
- **Runtime & Framework**: Node.js, Express 5 (native async route handling)
- **Database & ODM**: MongoDB, Mongoose 9
- **Real-Time Socket Layer**: Socket.IO with optional `@socket.io/redis-adapter` for multi-instance horizontal scaling
- **Caching & Ephemeral State**: Redis (`redis` v6)
- **Validation**: Zod (strict schema validation on REST endpoints and Socket.IO payloads)
- **Media Storage**: Cloudinary SDK + Multer memory storage
- **Security & Reliability**: Helmet, CORS, Express Mongo Sanitize, Express Rate Limit, Morgan, Winston logging

---

## 📂 Repository Structure

```
Echo/
├── echo-app/                     # Frontend Application (React 19 + Vite)
│   ├── public/                   # Static assets, PWA icons, audio notification sounds
│   ├── src/
│   │   ├── api/                  # Axios REST API services (contact, group, message, user)
│   │   ├── assets/               # Branding graphics & chat background patterns
│   │   ├── components/
│   │   │   ├── auth/             # Clerk Auth layout & guard wrappers
│   │   │   ├── chat/             # Message bubbles, input, voice recorder, modals
│   │   │   ├── common/           # Custom dialogs, avatar, warmup loader
│   │   │   ├── contacts/         # Contact drawer, save contact modals
│   │   │   ├── layout/           # App navigation sidebar, rail layout
│   │   │   ├── notifications/    # Message toasts & permission banners
│   │   │   └── settings/         # Avatar cropper, notification toggles
│   │   ├── hooks/                # useSocket, useAuth, useAudioRecorder, useTypingIndicator
│   │   ├── pages/                # ChatPage, ContactsPage, GroupsPage, ProfilePage, SettingsPage
│   │   ├── routes/               # AppRouter & RouteGuards
│   │   ├── store/                # Zustand stores
│   │   ├── types/                # TypeScript models and socket event contracts
│   │   └── utils/                # Date formatting, phone parsing, chat helpers
│   ├── Dockerfile
│   ├── nginx.conf
│   └── vite.config.ts
│
├── echo-service/                 # Backend Service (Node.js + Express 5 + Socket.IO)
│   ├── src/
│   │   ├── config/               # Database, Redis, Clerk, and Environment loaders
│   │   ├── controllers/          # Thin HTTP controllers
│   │   ├── middlewares/          # authMiddleware, socketAuthMiddleware, rateLimiter, upload
│   │   ├── models/               # Mongoose schemas: User, Conversation, Group, Message
│   │   ├── routes/               # REST route handlers + webhook endpoints
│   │   ├── services/             # Core business logic (shared across REST and Sockets)
│   │   ├── sockets/              # Socket.IO lifecycle and event handlers
│   │   │   └── handlers/         # messageHandlers, presenceHandlers, typingHandlers
│   │   ├── types/                # Backend TypeScript types
│   │   ├── app.ts                # Express application configuration
│   │   └── server.ts             # HTTP & Socket.IO server bootstrap
│   ├── tests/                    # Jest integration tests with mongodb-memory-server
│   └── Dockerfile
│
├── phases/                       # Detailed specifications & architecture milestones
├── docker-compose.yml            # Local orchestration (server, MongoDB, Redis)
├── AGENTS.md                     # Engineering principles & coding guidelines
└── README.md                     # Project documentation
```

---

## ⚙️ Environment Variables

### 1. Backend (`echo-service/.env`)

Copy `echo-service/.env.example` to `echo-service/.env`:

```bash
# Windows PowerShell
Copy-Item echo-service/.env.example echo-service/.env

# Linux / macOS
cp echo-service/.env.example echo-service/.env
```

| Variable | Description | Example / Default |
|---|---|---|
| `PORT` | Backend HTTP & WebSocket port | `5000` |
| `NODE_ENV` | Environment mode (`development` / `production` / `test`) | `development` |
| `MONGO_URI` | MongoDB connection string | `mongodb://127.0.0.1:27017/chatapp` |
| `JWT_SECRET` | Secret key for access token signing | `<random-32-char-string>` |
| `JWT_REFRESH_SECRET` | Secret key for refresh token signing | `<random-32-char-string>` |
| `JWT_ACCESS_EXPIRY` | Access token duration | `15m` |
| `JWT_REFRESH_EXPIRY` | Refresh token duration | `7d` |
| `REDIS_URL` | Redis connection URI (optional for multi-instance scaling) | `redis://localhost:6379` |
| `CLIENT_ORIGIN` | Allowed client URL for CORS | `http://localhost:5173` |
| `CLERK_SECRET_KEY` | Clerk Backend Secret Key | `sk_test_...` |
| `CLERK_PUBLISHABLE_KEY` | Clerk Publishable Key | `pk_test_...` |
| `CLERK_WEBHOOK_SECRET` | Clerk Webhook signing secret (Svix) | `whsec_...` |
| `CLOUDINARY_URL` | Cloudinary connection string for media & voice notes | `cloudinary://<key>:<secret>@<cloud_name>` |

### 2. Frontend (`echo-app/.env`)

Copy `echo-app/.env.example` to `echo-app/.env`:

```bash
# Windows PowerShell
Copy-Item echo-app/.env.example echo-app/.env

# Linux / macOS
cp echo-app/.env.example echo-app/.env
```

| Variable | Description | Example / Default |
|---|---|---|
| `VITE_API_URL` | Base REST API endpoint | `http://localhost:5000/api` |
| `VITE_SOCKET_URL` | Socket.IO server endpoint | `http://localhost:5000` |
| `VITE_CLERK_PUBLISHABLE_KEY` | Clerk publishable key | `pk_test_...` |

---

## 💻 Local Development Setup

### Prerequisites
- **Node.js**: v20.0.0 or higher
- **MongoDB**: Local MongoDB instance running on port `27017` or a MongoDB Atlas connection string
- **Redis** *(Optional)*: Running on port `6379` (for distributed presence & socket adapter)

### 1. Install Dependencies

```bash
# Install backend dependencies
cd echo-service
npm install

# Install frontend dependencies
cd ../echo-app
npm install
```

### 2. Run the Development Servers

Open two terminal sessions:

```bash
# Terminal 1: Backend service (starts ts-node-dev with reload on change)
cd echo-service
npm run dev

# Terminal 2: Frontend client (Vite dev server)
cd echo-app
npm run dev
```

- **Frontend Application:** `http://localhost:5173`
- **Backend API & WebSockets:** `http://localhost:5000`
- **Health Check Endpoint:** `http://localhost:5000/health`

---

## 🐳 Running with Docker Compose

To run the entire Echo infrastructure (Backend server, MongoDB, and Redis) locally using Docker:

```bash
# Build and start all services
docker compose up --build

# Run in detached mode
docker compose up -d --build

# Stop all containers
docker compose down
```

Exposed Services:
- **Backend API & Socket.IO:** `http://localhost:5000`
- **MongoDB:** `localhost:27017`
- **Redis:** `localhost:6379`

---

## 🧪 Testing & Quality Assurance

The backend includes automated integration and unit tests using **Jest**, **Supertest**, and **mongodb-memory-server** (no external MongoDB instance required):

```bash
cd echo-service

# Run all backend test suites
npm test

# Run tests in watch mode
npm run test:watch

# Execute verification suites
npm run test:phase2
```

To run frontend tests and linting:

```bash
cd echo-app

# Run Vitest test runner
npm test

# Run ESLint validation
npm run lint
```

---

## 📡 Socket.IO Real-Time Event Contracts

All real-time communications flow through Socket.IO rooms. Connections are authenticated during handshake via `socketAuthMiddleware`.

| Event Name | Direction | Payload Description |
|---|---|---|
| `join_conversation` | Client → Server | `{ conversationId: string }` — Joins the conversation room |
| `leave_conversation` | Client → Server | `{ conversationId: string }` — Leaves the conversation room |
| `send_message` | Client → Server | `{ conversationId, content, mediaUrl, quotedMessageId, type }` |
| `new_message` | Server → Client | Full message object broadcasted to conversation room |
| `message_delivered` | Client ⇄ Server | Updates delivery receipt for messages |
| `message_read` | Client ⇄ Server | Marks messages as read and emits blue ticks |
| `typing_start` | Client → Server | `{ conversationId }` — Broadcasts typing event to other participants |
| `typing_stop` | Client → Server | `{ conversationId }` — Clears typing indicator |
| `user_presence` | Server → Client | `{ userId, status: "online" \| "offline", lastSeen }` |
| `message_reaction` | Client ⇄ Server | `{ messageId, emoji, userId }` — Adds or updates an emoji reaction |
| `message_deleted` | Client ⇄ Server | `{ messageId, conversationId, deleteForEveryone: boolean }` |

---

## 🌐 Production Deployment Guide

### 1. Database (MongoDB Atlas)
1. Create a free cluster on [MongoDB Atlas](https://www.mongodb.com/cloud/atlas).
2. Under **Network Access**, allow access from anywhere (`0.0.0.0/0`) or configure Render / Railway outbound IP ranges.
3. Under **Database Access**, create a user with read/write privileges.
4. Copy your connection string into `echo-service` environment variables as `MONGO_URI`.

### 2. Media Storage (Cloudinary)
1. Sign up on [Cloudinary](https://cloudinary.com/).
2. Retrieve your Cloudinary URL (`cloudinary://<api_key>:<api_secret>@<cloud_name>`) and set `CLOUDINARY_URL` in `echo-service/.env`.

### 3. Backend Deployment (Render / Railway)
1. Connect your repository to [Render](https://render.com) or [Railway](https://railway.app).
2. Configure service settings:
   - **Root Directory:** `echo-service`
   - **Build Command:** `npm install && npm run build`
   - **Start Command:** `npm start`
3. Supply the environment variables from the table above (`MONGO_URI`, `CLIENT_ORIGIN`, `CLOUDINARY_URL`, `CLERK_SECRET_KEY`, etc.).

### 4. Frontend Deployment (Vercel)
1. Import the repository on [Vercel](https://vercel.com).
2. Set configuration options:
   - **Root Directory:** `echo-app`
   - **Framework Preset:** `Vite`
   - **Build Command:** `npm run build`
   - **Output Directory:** `dist`
3. Add Environment Variables:
   - `VITE_API_URL`: `https://<your-backend-domain>.onrender.com/api`
   - `VITE_SOCKET_URL`: `https://<your-backend-domain>.onrender.com`
   - `VITE_CLERK_PUBLISHABLE_KEY`: `pk_test_...`
4. Deploy, copy the deployed Vercel domain, and update `CLIENT_ORIGIN` in your backend environment variables.

---

## 🛡️ Architecture & Design Principles

- **Controller-Service Pattern**: Controllers remain thin (request parsing & status responses), while core logic resides in `services/` to allow seamless reuse across REST and Socket.IO handlers.
- **Strict Validation**: All incoming requests and socket payloads are validated with Zod schemas prior to reaching database layers.
- **Resilient State Management**: Zustand slices maintain client-side message deduplication, pending optimistic message queues, and active socket synchronization.
- **Security Baseline**: Passwords hashed with Bcrypt, Clerk JWT verification, CORS constraints, MongoDB query sanitization, and rate limiting against brute force requests.
