# Echo — Real-Time Chat Application

Real-time chat application built with React 19, TypeScript, Express 5, Socket.IO, and MongoDB.

## Project Structure

```
Echo/
├── client/          # React 19 + TypeScript + Vite + Tailwind CSS v4
├── server/          # Node.js + Express 5 + Socket.IO + Mongoose
├── phases/          # Step-by-step implementation phases
└── AGENTS.md        # Architecture & project guidelines
```

## Environment Setup

Before running the application, copy the example environment configuration files in both `server/` and `client/` directories and fill in the required credentials:

### 1. Server Environment Configuration

Copy the server sample env file:

```bash
# On Windows (PowerShell)
Copy-Item server/.env.example server/.env

# On Linux/macOS
cp server/.env.example server/.env
```

Open `server/.env` and update the placeholders:
- `PORT`: Port for the Express server (default `5000`).
- `MONGO_URI`: Your MongoDB connection string.
- `JWT_SECRET` and `JWT_REFRESH_SECRET`: Secure secret keys for token signing.
- `JWT_ACCESS_EXPIRY`: Token expiry time (default `15m`).
- `JWT_REFRESH_EXPIRY`: Refresh token expiry (default `7d`).
- `REDIS_URL`: Redis server URL for presence & horizontal scaling (default `redis://localhost:6379`).
- `CLOUDINARY_URL`: Cloudinary credentials for media upload.
- `CLIENT_ORIGIN`: Frontend URL (default `http://localhost:5173`).

### 2. Client Environment Configuration

Copy the client sample env file:

```bash
# On Windows (PowerShell)
Copy-Item client/.env.example client/.env

# On Linux/macOS
cp client/.env.example client/.env
```

Open `client/.env` and configure:
- `VITE_API_URL`: Backend REST API base URL (default `http://localhost:5000/api`).
- `VITE_SOCKET_URL`: Socket.IO backend URL (default `http://localhost:5000`).

## Installation

Install dependencies for both projects:

```bash
# Server
cd server
npm install

# Client
cd ../client
npm install
```
