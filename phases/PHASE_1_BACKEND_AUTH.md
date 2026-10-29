# PHASE 1 — Backend Scaffolding & Auth

> Give this whole file to the AI agent as context. Phase 0 must already be done.

## Goal
Build the backend skeleton, connect MongoDB/Redis, and implement JWT register/login/refresh/logout — fully working and testable by curl before moving on.

## Architecture rule (apply in every step)
Backend request flow is always: **Route → Middleware → Controller → Service → Model**.
Controllers stay thin (parse request, call service, format response). All business logic lives in `services/`, so REST controllers and Socket.IO handlers (later phases) can reuse the same functions instead of duplicating logic.

Other fixed rules:
- TypeScript strict mode.
- Validate every request body with Zod before it touches the database.
- Named exports only — no default exports for app code (Mongoose models use `export default model(...)`, that is the one exception).
- Secrets only from `process.env`, never hardcoded.

## Folder structure to create (empty files first, then fill in order below)
```
server/
├── src/
│   ├── config/
│   │   ├── db.ts
│   │   ├── redis.ts
│   │   └── env.ts
│   ├── models/
│   │   ├── User.ts
│   │   ├── Conversation.ts
│   │   ├── Message.ts
│   │   └── Group.ts
│   ├── routes/
│   │   └── authRoutes.ts
│   ├── controllers/
│   │   └── authController.ts
│   ├── services/
│   │   └── authService.ts
│   ├── middlewares/
│   │   ├── authMiddleware.ts
│   │   ├── errorHandler.ts
│   │   └── rateLimiter.ts
│   ├── sockets/            # leave empty, used in Phase 3
│   ├── utils/
│   ├── app.ts
│   └── server.ts
├── .env
├── package.json
└── tsconfig.json
```

## Steps

### Step 1.1 — Scaffold backend structure
Task: Create the full `server/src/` folder and file structure above — empty files only, no implementation yet. Include `tsconfig.json` for a Node + TypeScript project targeting ES2022, with `src/server.ts` as the entry point.

Verify: folder tree matches the structure above. `npx tsc --noEmit` runs without "file not found" errors.

### Step 1.2 — DB and Redis config
Task: Implement `server/src/config/db.ts` (Mongoose connection using `MONGO_URI` from env) and `server/src/config/redis.ts` (Redis client using `REDIS_URL` from env). Both should log a clear success/failure message. MongoDB is required — exit the process on a failed MongoDB connection. Redis is optional for local dev — log a warning and continue if it fails.

Verify: dev server logs a successful MongoDB connection.

### Step 1.3 — User model
Task: Implement `server/src/models/User.ts` using the exact schema below, including the `IUser` interface.

```typescript
import { Schema, model, Document } from "mongoose";

export interface IUser extends Document {
  username: string;
  email: string;
  passwordHash: string;
  avatarUrl?: string;
  status?: string;
  isOnline: boolean;
  lastSeen: Date;
}

const userSchema = new Schema<IUser>(
  {
    username: { type: String, required: true, unique: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true },
    passwordHash: { type: String, required: true },
    avatarUrl: { type: String, default: "" },
    status: { type: String, default: "Hey there! I'm using ChatApp" },
    isOnline: { type: Boolean, default: false },
    lastSeen: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

export default model<IUser>("User", userSchema);
```

Verify: file compiles. Fields match exactly — do not rename fields.

### Step 1.4 — Conversation and Message models
Task: Implement `server/src/models/Conversation.ts` and `server/src/models/Message.ts` using the schemas below. Also create `server/src/models/Group.ts` as an empty placeholder file for now (group-specific fields, if any beyond `Conversation`, are added in Phase 5 — for the MVP, groups are just `Conversation` documents with `type: "group"`).

```typescript
// models/Conversation.ts
import { Schema, model, Document, Types } from "mongoose";

export interface IConversation extends Document {
  type: "direct" | "group";
  groupName?: string;
  participants: Types.ObjectId[];
  admins?: Types.ObjectId[];
  lastMessage?: Types.ObjectId;
}

const conversationSchema = new Schema<IConversation>(
  {
    type: { type: String, enum: ["direct", "group"], required: true },
    groupName: { type: String },
    participants: [{ type: Schema.Types.ObjectId, ref: "User", required: true }],
    admins: [{ type: Schema.Types.ObjectId, ref: "User" }],
    lastMessage: { type: Schema.Types.ObjectId, ref: "Message" },
  },
  { timestamps: true }
);

export default model<IConversation>("Conversation", conversationSchema);
```

```typescript
// models/Message.ts
import { Schema, model, Document, Types } from "mongoose";

export interface IMessage extends Document {
  conversationId: Types.ObjectId;
  senderId: Types.ObjectId;
  content: string;
  type: "text" | "image" | "file";
  mediaUrl?: string;
  readBy: Types.ObjectId[];
  status: "sent" | "delivered" | "read";
}

const messageSchema = new Schema<IMessage>(
  {
    conversationId: { type: Schema.Types.ObjectId, ref: "Conversation", required: true, index: true },
    senderId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    content: { type: String, required: true },
    type: { type: String, enum: ["text", "image", "file"], default: "text" },
    mediaUrl: { type: String },
    readBy: [{ type: Schema.Types.ObjectId, ref: "User" }],
    status: { type: String, enum: ["sent", "delivered", "read"], default: "sent" },
  },
  { timestamps: true }
);

// Required index — do not omit
messageSchema.index({ conversationId: 1, createdAt: -1 });

export default model<IMessage>("Message", messageSchema);
```

Verify: both files compile. The compound index `{ conversationId: 1, createdAt: -1 }` is present on Message.

### Step 1.5 — Auth service and controller
Task: Implement `server/src/services/authService.ts` with four functions: `register`, `login`, `refresh`, `logout`. Use `bcrypt` (salt rounds ≥ 10) for password hashing and `jsonwebtoken` for signing. Token expiries must come from env vars (`JWT_ACCESS_EXPIRY`, `JWT_REFRESH_EXPIRY`), never hardcoded. Then implement `server/src/controllers/authController.ts` that calls these service functions and formats HTTP responses.

Verify: all four functions exist in the service layer (not in the controller). No secret or expiry value is hardcoded.

### Step 1.6 — Auth middleware and routes
Task: Implement `server/src/middlewares/authMiddleware.ts` — verifies the `Authorization: Bearer <token>` JWT and attaches `req.userId`. Implement `server/src/routes/authRoutes.ts` wiring these four endpoints:

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/api/auth/register` | No | Register new user |
| POST | `/api/auth/login` | No | Login, returns access token + sets refresh cookie |
| POST | `/api/auth/refresh` | Refresh cookie | Issue new access token |
| POST | `/api/auth/logout` | Yes | Invalidate refresh token |

Mount the router in `app.ts`. The refresh token must be set as an `httpOnly`, `Secure`, `SameSite=strict` cookie — never returned in the JSON body.

Verify (use curl or Thunder Client):
1. Register a user → 201.
2. Log in → response has `accessToken` in the JSON body and a `Set-Cookie` refresh token.
3. Hit a protected test route with the access token → 200.
4. Hit the same route with no token → 401.

## Done condition for Phase 1
- [x] Backend folder structure matches Step 1.1
- [x] MongoDB connects on startup
- [x] `User`, `Conversation`, `Message` models compile with exact field names above
- [x] Register / login / refresh / logout all work via curl
- [x] Protected route rejects requests with no/invalid token

Next file: `PHASE_2_CORE_REST_API.md`
