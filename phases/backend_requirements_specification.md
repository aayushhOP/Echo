# Backend Requirements Specification — Echo Redesign & Feature Expansion

**Project Stack:** Express 5 · Node.js · Socket.IO · Mongoose 9 / MongoDB · Redis · Cloudinary / S3  
**Target Client:** React 19 + TypeScript Cyber-Glass & Slate Desktop UI

---

## 1. Overview & Objectives

To support the modern desktop 3-pane chat interface and its interactive features (emoji reactions, rich media uploads, right-side detail drawer, message status checkmarks, live presence, and threaded replies), the backend requires schema updates, new REST endpoints, and extended Socket.IO handlers.

---

## 2. Database Schema Modifications (Mongoose)

### 2.1 `Message` Schema Updates (`models/Message.ts`)

Update the `Message` model to support reactions, file/media metadata, and message replies/quotes.

```typescript
import { Schema, model, Document, Types } from "mongoose";

// Sub-schema for individual emoji reaction aggregations
export interface IReactionUser {
  _id: Types.ObjectId;
  username: string;
}

export interface IReaction {
  emoji: string;
  users: Types.ObjectId[]; // Stored as ObjectIds, populated with user info on query
}

export interface IMessage extends Document {
  conversationId: Types.ObjectId;
  senderId: Types.ObjectId;
  content: string;
  type: "text" | "image" | "file";
  mediaUrl?: string | null;
  fileName?: string | null;
  fileSize?: number | null;
  reactions: IReaction[];
  replyTo?: Types.ObjectId | null; // Parent message for threaded quotes
  readBy: Types.ObjectId[];
  status: "sent" | "delivered" | "read";
  createdAt: Date;
  updatedAt: Date;
}
```

#### Fields to Add:
| Field | Type | Description |
|---|---|---|
| `reactions` | `[{ emoji: String, users: [{ type: ObjectId, ref: 'User' }] }]` | Emoji identifier and user array. |
| `replyTo` | `ObjectId (ref: 'Message')` | Optional ID referencing the quoted message. |
| `mediaUrl` | `String` | CDN/Cloudinary URL for media or files. |
| `fileName` | `String` | Original uploaded file name (e.g., `document.pdf`). |
| `fileSize` | `Number` | File size in bytes. |

---

### 2.2 `User` Schema Updates (`models/User.ts`)

Support rich profiles, contact drawer info, and user custom preferences.

```typescript
export interface IUser extends Document {
  username: string;
  email: string;
  passwordHash: string;
  avatarUrl?: string;
  status?: string;
  bio?: string; // Extended "About Me" for contact drawer
  phone?: string;
  isOnline: boolean;
  lastSeen: Date;
  preferences?: {
    soundEnabled: boolean;
    theme: string;
    notifications: boolean;
  };
}
```

---

### 2.3 `Conversation` Schema Updates (`models/Conversation.ts`)

Add conversation metadata for shared asset drawers and pin/mute states.

```typescript
export interface IConversation extends Document {
  type: "direct" | "group";
  groupName?: string;
  groupAvatar?: string;
  participants: Types.ObjectId[];
  admins?: Types.ObjectId[];
  lastMessage?: Types.ObjectId;
  pinnedBy: Types.ObjectId[]; // Users who pinned this chat to top
  mutedBy: Types.ObjectId[];  // Users who muted notifications
  updatedAt: Date;
}
```

---

## 3. REST API Requirements

### 3.1 Media & File Upload (`/api/messages/upload`)
Required to handle image and file attachments before emitting the socket event.

- **Method:** `POST`
- **Endpoint:** `/api/messages/upload`
- **Auth:** Required (`Bearer <JWT>`)
- **Content-Type:** `multipart/form-data`
- **Request Body:** Form data with field `file`
- **File Limits:** Max 10MB (images, pdf, zip, docx, txt)
- **Response `200 OK`:**
  ```json
  {
    "url": "https://res.cloudinary.com/demo/image/upload/v1234/file.png",
    "fileName": "screenshot.png",
    "fileSize": 245120,
    "mimetype": "image/png",
    "type": "image"
  }
  ```

---

### 3.2 Presence Bootstrap (`/api/users/online`)
Fetches all currently connected user IDs so the client can immediately render green presence dots without waiting for state change events.

- **Method:** `GET`
- **Endpoint:** `/api/users/online`
- **Auth:** Required
- **Response `200 OK`:**
  ```json
  {
    "onlineUserIds": ["673c...", "673d..."]
  }
  ```

---

### 3.3 Enhanced Conversation Listing (`/api/conversations`)
Must return computed fields for the calling authenticated user (`req.user.id`).

- **Method:** `GET`
- **Endpoint:** `/api/conversations`
- **Auth:** Required
- **Response `200 OK`:**
  ```json
  [
    {
      "_id": "673a...",
      "type": "direct",
      "participants": [
        { "_id": "673c...", "username": "aayush", "avatarUrl": "", "isOnline": true }
      ],
      "lastMessage": {
        "_id": "673f...",
        "content": "Sounds good!",
        "createdAt": "2026-10-30T08:30:00.000Z",
        "senderId": "673c..."
      },
      "unreadCount": 3,
      "isPinned": false,
      "isMuted": false,
      "updatedAt": "2026-10-30T08:30:00.000Z"
    }
  ]
  ```

---

### 3.4 Conversation Pin & Mute Toggles

#### Pin / Unpin Conversation
- **Method:** `PATCH`
- **Endpoint:** `/api/conversations/:id/pin`
- **Auth:** Required
- **Response `200 OK`:**
  ```json
  { "conversationId": "673a...", "isPinned": true }
  ```

#### Mute / Unmute Conversation
- **Method:** `PATCH`
- **Endpoint:** `/api/conversations/:id/mute`
- **Auth:** Required
- **Response `200 OK`:**
  ```json
  { "conversationId": "673a...", "isMuted": true }
  ```

---

### 3.5 Shared Media & Files Endpoint (for Contact Drawer)
Fetches all photos, documents, and media shared inside a conversation.

- **Method:** `GET`
- **Endpoint:** `/api/conversations/:id/media`
- **Auth:** Required
- **Query Params:** `type=image|file&limit=30&cursor=`
- **Response `200 OK`:**
  ```json
  {
    "items": [
      {
        "_id": "673c...",
        "mediaUrl": "https://res.cloudinary.com/...",
        "fileName": "design-spec.pdf",
        "fileSize": 1048576,
        "type": "file",
        "createdAt": "2026-10-30T08:30:00.000Z",
        "senderId": { "_id": "...", "username": "aayush" }
      }
    ],
    "nextCursor": null
  }
  ```

---

### 3.6 User Profile & Preferences Updates
- **Method:** `PATCH`
- **Endpoint:** `/api/users/me/preferences`
- **Auth:** Required
- **Payload:**
  ```json
  {
    "soundEnabled": true,
    "theme": "slate-dark",
    "bio": "Full-stack developer"
  }
  ```

---

## 4. Mongoose Population Contracts

Whenever messages are returned (`GET /api/conversations/:id/messages`, `message:new`, and `message:reaction:update`), Mongoose queries must populate the following:

```typescript
const messagePopulation = [
  { path: "senderId", select: "_id username avatarUrl" },
  {
    path: "replyTo",
    select: "_id content senderId type mediaUrl",
    populate: { path: "senderId", select: "_id username" }
  },
  { path: "reactions.users", select: "_id username avatarUrl" }
];
```

---

## 5. Socket.IO Real-Time Event Catalogue

### 5.1 Event Matrix

| Event Name | Direction | Payload | Description |
|---|---|---|---|
| `message:send` | Client → Server | `{ conversationId, content, type, mediaUrl?, fileName?, fileSize?, replyTo? }` | Extended to carry attachments and reply parent ID. |
| `message:new` | Server → Client | `{ message: IMessage }` | Broadcasts newly created message (with sender, replyTo, and reactions populated). |
| `message:react` | Client → Server | `{ conversationId: string, messageId: string, emoji: string }` | User toggles an emoji reaction. |
| `message:reaction:update` | Server → Client | `{ conversationId: string, messageId: string, reactions: IReaction[], userId: string }` | Broadcasts aggregated reaction array (with populated user info). |
| `message:read` | Client → Server | `{ conversationId: string, messageIds: string[] }` | Marks delivered messages as read by recipient. |
| `message:read:update` | Server → Client | `{ conversationId: string, messageIds: string[], readerId: string }` | Emits checkmark read status updates. |
| `presence:online` | Server → Client | `{ userId: string }` | Emitted when a user connects. |
| `presence:offline` | Server → Client | `{ userId: string, lastSeen: string }` | Emitted when a user disconnects. |

---

### 5.2 Reaction Business Logic (`messageService.ts`)

```typescript
/**
 * Toggles a reaction for a user on a given message.
 * - If the user has already reacted with the emoji, remove their ID.
 * - If no users remain for that emoji, remove the reaction entry.
 * - If the user has not reacted, append their user ID.
 * - Always populates reactions.users with {_id, username} before returning.
 */
export async function toggleReaction(
  messageId: string,
  userId: string,
  emoji: string
): Promise<IMessage>;
```

---

## 6. Input Validation Rules (Zod)

All new requests must pass server-side Zod validation:

```typescript
import { z } from "zod";

export const createMessageSchema = z.object({
  conversationId: z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid ObjectId"),
  content: z.string().max(4000).optional().default(""),
  type: z.enum(["text", "image", "file"]).default("text"),
  mediaUrl: z.string().url().optional().nullable(),
  fileName: z.string().max(255).optional().nullable(),
  fileSize: z.number().max(10485760).optional().nullable(), // 10MB max
  replyTo: z.string().regex(/^[0-9a-fA-F]{24}$/).optional().nullable(),
});

export const reactMessageSchema = z.object({
  conversationId: z.string().regex(/^[0-9a-fA-F]{24}$/),
  messageId: z.string().regex(/^[0-9a-fA-F]{24}$/),
  emoji: z.string().min(1).max(8), // Unicode emoji validation
});
```

---

## 7. Implementation Checklist

- [x] Update `Message.ts` model with `reactions`, `replyTo`, and file metadata fields.
- [x] Update `Conversation.ts` model with `pinnedBy` and `mutedBy` arrays.
- [x] Add `toggleReaction` logic in `messageService.ts` with population on `reactions.users`.
- [x] Implement `message:react` listener in `messageHandlers.ts`.
- [x] Configure `multer` and Cloudinary storage pipeline.
- [x] Create `POST /api/messages/upload` endpoint in Express.
- [x] Implement `GET /api/users/online` for initial presence sync.
- [x] Compute `unreadCount`, `isPinned`, and `isMuted` in `GET /api/conversations`.
- [x] Add `PATCH /api/conversations/:id/pin` and `PATCH /api/conversations/:id/mute`.
- [x] Implement `GET /api/conversations/:id/media` for drawer assets.
- [x] Update backend test suite to cover reaction toggling, upload handlers, and conversation metadata.