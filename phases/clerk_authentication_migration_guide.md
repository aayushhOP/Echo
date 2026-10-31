# Clerk Authentication Migration Specification

**Project Stack:** React 19 · TypeScript · Express 5 · Node.js · MongoDB/Mongoose · Socket.IO
**Target Feature:** Free Email OTP & Social Auth via Clerk

---

## 1. Preparation & Clerk Dashboard Setup

1. Go to [Clerk.com](https://clerk.com), create an account, and add a new application.
2. Under **User & Authentication -> Email, Phone, Web3**, enable **Email address** and select **Email verification code (OTP)**. Disable passwords.
3. Retrieve your API Keys:
   - `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` (Frontend)
   - `CLERK_SECRET_KEY` (Backend)
4. Under **Webhooks**, click **Add Endpoint** (you will point this to your deployed backend URL or a tool like Ngrok for local testing: `https://your-domain.com/api/webhooks/clerk`).
   - Subscribe to the `user.created` and `user.updated` events.
   - Retrieve the **Signing Secret** (`CLERK_WEBHOOK_SECRET`).

---

## 2. Backend Implementation (Express & MongoDB)

### 2.1 Install Dependencies
Run the following in your `server/` directory:
```bash
npm install @clerk/express svix
```
*(Note: `svix` is required to cryptographically verify the webhooks sent by Clerk).*

### 2.2 Update User Schema (`server/src/models/User.ts`)
Strip out the old password and email verification logic. Add `clerkId` as the primary identifier.

```typescript
import { Schema, model, Document } from "mongoose";

export interface IUser extends Document {
  clerkId: string;
  email: string;
  username: string;
  avatarUrl?: string;
  isOnline: boolean;
  lastSeen: Date;
}

const userSchema = new Schema<IUser>(
  {
    clerkId: { type: String, required: true, unique: true }, // The user_xxx ID from Clerk
    email: { type: String, required: true, unique: true },
    username: { type: String, required: true, trim: true },
    avatarUrl: { type: String, default: "" },
    isOnline: { type: Boolean, default: false },
    lastSeen: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

export default model<IUser>("User", userSchema);
```

### 2.3 Implement the Clerk Webhook (`server/src/routes/webhookRoutes.ts`)
This endpoint listens for Clerk events (like a user signing up via OTP) and creates/updates their profile in your MongoDB database.

**CRITICAL:** The webhook route must parse the raw body, not JSON.

```typescript
import { Router } from "express";
import express from "express";
import { Webhook } from "svix";
import User from "../models/User";

const router = Router();

// Middleware to parse raw body specifically for this route
router.post(
  "/clerk",
  express.raw({ type: "application/json" }),
  async (req, res) => {
    const SIGNING_SECRET = process.env.CLERK_WEBHOOK_SECRET;
    if (!SIGNING_SECRET) throw new Error("Missing CLERK_WEBHOOK_SECRET");

    const payload = req.body.toString();
    const headers = req.headers;

    const wh = new Webhook(SIGNING_SECRET);
    let evt: any;

    try {
      evt = wh.verify(payload, headers as any);
    } catch (err) {
      console.error("Webhook signature verification failed:", err);
      return res.status(400).json({ success: false, message: "Invalid signature" });
    }

    const { id } = evt.data;
    const eventType = evt.type;

    if (eventType === "user.created" || eventType === "user.updated") {
      const email = evt.data.email_addresses[0]?.email_address;
      const username = evt.data.first_name || email.split("@")[0];
      const avatarUrl = evt.data.image_url;

      await User.findOneAndUpdate(
        { clerkId: id },
        { email, username, avatarUrl },
        { upsert: true, new: true }
      );
    }

    res.status(200).json({ success: true });
  }
);

export default router;
```

### 2.4 Secure Express API Routes (`server/src/app.ts`)
Replace your custom JWT middleware with Clerk's middleware.

```typescript
import { clerkMiddleware, requireAuth } from "@clerk/express";

const app = express();

// 1. Webhooks MUST be registered BEFORE standard body parsers
app.use("/api/webhooks", webhookRoutes);

// 2. Standard parsers
app.use(express.json());

// 3. Mount Clerk Middleware globally (hydrates req.auth)
app.use(clerkMiddleware());

// 4. Protect specific routes (requireAuth blocks unauthenticated requests)
app.use("/api/conversations", requireAuth(), conversationRoutes);
app.use("/api/messages", requireAuth(), messageRoutes);
app.use("/api/users/search", requireAuth(), userRoutes);
```
*(Your backend now extracts `req.auth.userId`, which matches your `clerkId` in MongoDB).*

### 2.5 Secure Socket.IO Connection
Update your Socket middleware to verify the Clerk JWT token sent by the client.

```typescript
import { verifyToken } from "@clerk/backend";

io.use(async (socket, next) => {
  const token = socket.handshake.auth.token;
  if (!token) return next(new Error("Authentication error"));

  try {
    const verified = await verifyToken(token, {
      secretKey: process.env.CLERK_SECRET_KEY,
    });
    // Attach the Clerk ID to the socket
    socket.data.userId = verified.sub; 
    next();
  } catch (err) {
    next(new Error("Invalid token"));
  }
});
```

---

## 3. Frontend Implementation (React 19)

### 3.1 Install Dependencies
Run the following in your `client/` directory:
```bash
npm install @clerk/clerk-react
```

### 3.2 Initialize Clerk Provider (`client/src/main.tsx`)
Wrap your entire application in the `ClerkProvider`.

```tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import { ClerkProvider } from '@clerk/clerk-react';
import App from './App';
import './index.css';

const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

if (!PUBLISHABLE_KEY) {
  throw new Error("Missing Publishable Key");
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ClerkProvider publishableKey={PUBLISHABLE_KEY}>
      <App />
    </ClerkProvider>
  </React.StrictMode>
);
```

### 3.3 Create Auth Layout & Routing (`client/src/App.tsx`)
Use Clerk's pre-built UI components and `SignedIn` / `SignedOut` controllers to manage routing.

```tsx
import { SignedIn, SignedOut, SignIn, SignUp } from "@clerk/clerk-react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ChatPage } from "./pages/ChatPage";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public Auth Routes */}
        <Route path="/sign-in/*" element={
          <div className="h-screen w-screen flex items-center justify-center bg-[#13141d]">
            <SignIn routing="path" path="/sign-in" signUpUrl="/sign-up" />
          </div>
        } />
        <Route path="/sign-up/*" element={
          <div className="h-screen w-screen flex items-center justify-center bg-[#13141d]">
            <SignUp routing="path" path="/sign-up" signInUrl="/sign-in" />
          </div>
        } />

        {/* Protected Chat Route */}
        <Route path="/" element={
          <>
            <SignedIn>
              <ChatPage />
            </SignedIn>
            <SignedOut>
              <Navigate to="/sign-in" replace />
            </SignedOut>
          </>
        } />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
```

### 3.4 Authenticated API & Socket Calls (`client/src/pages/ChatPage.tsx`)
Use the `useAuth` hook to retrieve the session token dynamically before making API requests or connecting to Socket.IO.

```tsx
import { useEffect } from "react";
import { useAuth, UserButton } from "@clerk/clerk-react";
import { io } from "socket.io-client";
import axios from "axios";

export const ChatPage = () => {
  const { getToken, userId } = useAuth();

  useEffect(() => {
    let socket;

    const initializeChat = async () => {
      // 1. Get the short-lived JWT from Clerk
      const token = await getToken();

      // 2. Configure Axios default headers for REST API
      axios.defaults.headers.common["Authorization"] = `Bearer ${token}`;

      // 3. Connect Socket.IO with the token
      socket = io("http://localhost:5000", {
        auth: { token }
      });

      socket.on("connect", () => console.log("Connected to Chat!"));
    };

    initializeChat();

    return () => {
      if (socket) socket.disconnect();
    };
  }, [getToken]);

  return (
    <div className="h-screen w-screen bg-[#13141d] p-3 flex">
      {/* Sidebar Top: Clerk's Profile Button */}
      <div className="w-16 bg-[#1b1c27] flex flex-col items-center py-4">
        <UserButton afterSignOutUrl="/sign-in" />
      </div>
      
      {/* ... Rest of your chat UI ... */}
    </div>
  );
};
```

---

## 4. Verification Checklist for Agent

- [x] Ensure `.env` contains `CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`, and `CLERK_WEBHOOK_SECRET`.
- [x] Deleted old custom `authRoutes.ts`, `jwt` logic, and `bcrypt` dependencies.
- [x] `express.raw()` is successfully parsing payloads for the `/api/webhooks/clerk` route.
- [x] User documents are being successfully created in MongoDB automatically when a user verifies their Email OTP on the frontend.
- [x] Protected endpoints correctly extract `req.auth.userId`.
- [x] Socket.IO rejects connections without a valid Clerk token in `auth.token`.