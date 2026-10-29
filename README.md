# Echo — Real-Time Chat Application

Echo is a full-featured real-time chat application engineered with React 19, TypeScript, Express 5, Socket.IO, and MongoDB.

---

## Features

- **Authentication:** JWT access token (15m expiry) + secure `httpOnly` refresh cookie (7d expiry) with automatic token rotation.
- **1-on-1 & Group Chats:** Create direct chats or group conversations with member management (add/remove participants, admin role permissions).
- **Real-Time Messaging:** Instant message delivery over Socket.IO rooms with optimistic UI updates and delivery/read receipts.
- **Presence & Activity:** Multi-tab real-time online/offline presence tracking and live typing indicators.
- **Message History:** Cursor-based pagination with infinite scroll.
- **Profile Customization:** User status message and custom avatar URL.

---

## Tech Stack

| Layer | Technologies |
|---|---|
| **Frontend** | React 19, TypeScript, Vite, Tailwind CSS v4, Zustand, TanStack Query, React Router v7, Socket.IO Client, Lucide React |
| **Backend** | Node.js, Express 5, TypeScript, Socket.IO, Mongoose 9, MongoDB, Redis, Zod, Bcrypt, Winston/Morgan |
| **Testing** | Jest, Supertest, `mongodb-memory-server` |
| **Containerization** | Docker, Docker Compose, Nginx |

---

## Project Structure

```
Echo/
├── client/                 # React 19 + TypeScript frontend
│   ├── src/
│   │   ├── api/            # REST API clients (Axios with interceptors)
│   │   ├── components/     # UI components (Chat, Layout, Modals)
│   │   ├── hooks/          # Custom hooks (useSocket, useAuth, useTypingIndicator)
│   │   ├── pages/          # ChatPage, LoginPage, RegisterPage, ProfilePage
│   │   ├── store/          # Zustand stores (authStore, chatStore, socketStore)
│   │   └── types/          # Shared frontend interfaces
│   ├── Dockerfile
│   └── nginx.conf
├── server/                 # Express 5 + Socket.IO backend
│   ├── src/
│   │   ├── config/         # MongoDB, Redis, and Environment config
│   │   ├── controllers/    # Thin HTTP route controllers
│   │   ├── middlewares/    # Centralized errorHandler, auth, rate-limiters
│   │   ├── models/         # Mongoose models (User, Conversation, Message)
│   │   ├── routes/         # Express API routes
│   │   ├── services/       # Core business logic
│   │   └── sockets/        # Socket.IO handlers (messages, typing, presence)
│   ├── tests/              # Jest + Supertest test suite
│   └── Dockerfile
├── phases/                 # Architecture implementation milestones
├── docker-compose.yml      # Multi-container orchestration (server, MongoDB, Redis)
└── README.md
```

---

## Environment Variables

### Server (`server/.env`)

Copy `server/.env.example` to `server/.env`:

```bash
# Windows PowerShell:
Copy-Item server/.env.example server/.env

# Linux / macOS:
cp server/.env.example server/.env
```

| Variable | Description | Example / Default |
|---|---|---|
| `PORT` | Backend port | `5000` |
| `NODE_ENV` | Environment mode (`development`, `test`, `production`) | `development` |
| `MONGO_URI` | MongoDB connection URI | `mongodb://127.0.0.1:27017/chatapp` |
| `JWT_SECRET` | Secret key for access token signing | `<random-32-char-secret>` |
| `JWT_REFRESH_SECRET` | Secret key for refresh token signing | `<random-32-char-secret>` |
| `JWT_ACCESS_EXPIRY` | Access token lifespan | `15m` |
| `JWT_REFRESH_EXPIRY` | Refresh token lifespan | `7d` |
| `REDIS_URL` | Redis connection URL | `redis://localhost:6379` |
| `CLIENT_ORIGIN` | Allowed client URL for CORS | `http://localhost:5173` |

### Client (`client/.env`)

Copy `client/.env.example` to `client/.env`:

```bash
# Windows PowerShell:
Copy-Item client/.env.example client/.env

# Linux / macOS:
cp client/.env.example client/.env
```

| Variable | Description | Example / Default |
|---|---|---|
| `VITE_API_URL` | Base REST API URL | `http://localhost:5000/api` |
| `VITE_SOCKET_URL` | Socket.IO server URL | `http://localhost:5000` |

---

## Local Development Setup

### 1. Install Dependencies

```bash
# Install backend packages
cd server
npm install

# Install frontend packages
cd ../client
npm install
```

### 2. Start the Development Servers

```bash
# In terminal 1: Start backend server
cd server
npm run dev

# In terminal 2: Start frontend client
cd client
npm run dev
```

The frontend will run at `http://localhost:5173` and communicate with the backend at `http://localhost:5000`.

---

## Running Backend Tests

Backend tests use Jest, Supertest, and `mongodb-memory-server` (no external database required):

```bash
cd server
npm test
```

This runs integration tests covering:
- User registration (happy path, validation failure, duplicate conflict)
- User login (happy path, invalid credentials failure)
- Refresh token rotation (happy path, missing token failure)
- Message service (creation, non-participant access control, empty validation, mark as read)

---

## Running with Docker Compose

To start the complete environment (Node server, MongoDB, and Redis) locally with one command:

```bash
docker compose up --build
```

- **Backend API & WebSockets:** `http://localhost:5000`
- **MongoDB:** `localhost:27017`
- **Redis:** `localhost:6379`

To stop the containers:
```bash
docker compose down
```

---

## Deployment Guide

### 1. Database: MongoDB Atlas (Free Tier)
1. Sign up at [MongoDB Atlas](https://www.mongodb.com/cloud/atlas) and create a free M0 cluster.
2. In **Network Access**, add `0.0.0.0/0` (allow access from anywhere) or Render's outbound IPs.
3. In **Database Access**, create a user with read/write permissions.
4. Click **Connect** → **Drivers** and copy the connection string (e.g. `mongodb+srv://<user>:<password>@cluster0.mongodb.net/chatapp?retryWrites=true&w=majority`).

### 2. Redis: Upstash (Optional Free Tier)
1. Create a free serverless Redis database at [Upstash](https://upstash.com).
2. Copy the `rediss://...` connection URL into the backend environment variable `REDIS_URL`.

### 3. Backend: Render / Railway
1. Push your repository to GitHub.
2. Log in to [Render](https://render.com) and create a new **Web Service**.
3. Connect your repository and configure:
   - **Root Directory:** `server`
   - **Environment:** `Node`
   - **Build Command:** `npm install && npm run build`
   - **Start Command:** `npm start`
4. Set the environment variables in the Render dashboard:
   - `PORT`: `5000`
   - `NODE_ENV`: `production`
   - `MONGO_URI`: `<Your MongoDB Atlas URI>`
   - `JWT_SECRET`: `<Secure random secret>`
   - `JWT_REFRESH_SECRET`: `<Secure random secret>`
   - `JWT_ACCESS_EXPIRY`: `15m`
   - `JWT_REFRESH_EXPIRY`: `7d`
   - `CLIENT_ORIGIN`: `<Your Vercel frontend URL>`
   - `REDIS_URL`: `<Your Upstash Redis URL>` (optional)

### 4. Frontend: Vercel / Netlify
1. Log in to [Vercel](https://vercel.com) and import the repository.
2. Configure project settings:
   - **Framework Preset:** `Vite`
   - **Root Directory:** `client`
   - **Build Command:** `npm run build`
   - **Output Directory:** `dist`
3. Add Environment Variables:
   - `VITE_API_URL`: `https://<your-render-service>.onrender.com/api`
   - `VITE_SOCKET_URL`: `https://<your-render-service>.onrender.com`
4. Deploy. Once deployed, copy your production Vercel URL and update `CLIENT_ORIGIN` in your Render backend settings.

---

## Verification Checklist

- [x] All REST and socket inputs validated with Zod.
- [x] Error responses follow standard `{ error: { code, message } }` format.
- [x] Backend test suite passes via `npm test` using in-memory MongoDB.
- [x] `docker-compose.yml` configures server, MongoDB, and Redis.
- [x] Client and Server Dockerfiles configured for production builds.
- [x] Root `README.md` provides complete local setup, Docker, and deployment instructions.
- [x] No `.env` secrets committed to git.
