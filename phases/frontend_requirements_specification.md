# Frontend Technical Specification & Implementation Guide — Echo UI Redesign

**Project Stack:** React 19 · TypeScript · Vite · Tailwind CSS v4 · Zustand · Lucide React · TanStack Query · Socket.IO Client  
**Target Design:** Modern Desktop 3-Pane Slate/Charcoal Web Chat (Live Indicators, Docked Reactions, Media Uploads)

---

## 1. Scope & Objective

Transform the current minimal UI into a modern, live, desktop-first 3-pane web chat interface. The look and feel must be clean, responsive, and grounded (using deep slate/charcoal tones like `#0b0e14`, `#111622`, and `#182030`), avoiding exaggerated neon/arcade glow while delivering real-time interactive cues:
1. **Left Navigation Rail (64px width)** for primary module switches (Chats, Contacts, Settings, Profile, Logout).
2. **Middle Conversation Panel (320px width)** with search, online status badges, unread count pills, and dynamic sort.
3. **Main Chat Canvas (Fluid flex-1)** with desktop header, live presence (`Active now`), bubble message stream with timestamps & checkmarks, floating hover reactions, docked reaction badges, and docked bottom input bar with file attachment trigger.

---

## 2. Dependencies to Install

Run the following in the `client/` root directory:

```bash
npm install lucide-react clsx tailwind-merge
```

*(Optional for subtle micro-interactions: `npm install motion`)*

---

## 3. Global CSS Setup (`client/src/index.css`)

Ensure global color variables, scrollbar styling, and background values are applied cleanly with Tailwind CSS v4:

```css
@import "tailwindcss";

@layer base {
  :root {
    --bg-main: #0b0e14;
    --bg-rail: #0e121b;
    --bg-panel: #111622;
    --bg-surface: #182030;
    --bg-surface-hover: #1f293d;
    --border-color: rgba(51, 65, 85, 0.6);
  }

  body {
    background-color: var(--bg-main);
    color: #f1f5f9;
    font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    overflow: hidden;
    height: 100vh;
    width: 100vw;
  }

  /* Sleek Desktop Scrollbar */
  ::-webkit-scrollbar {
    width: 6px;
    height: 6px;
  }
  ::-webkit-scrollbar-track {
    background: transparent;
  }
  ::-webkit-scrollbar-thumb {
    background: #1e293b;
    border-radius: 9999px;
  }
  ::-webkit-scrollbar-thumb:hover {
    background: #334155;
  }
}
```

---

## 4. Frontend Type Definitions (`client/src/types/chat.ts`)

Ensure the shared frontend models align with the updated backend schemas:

```typescript
export interface IReaction {
  emoji: string;
  users: string[]; // User IDs who reacted
}

export interface IMessage {
  _id: string;
  conversationId: string;
  senderId: string;
  content: string;
  type: "text" | "image" | "file";
  mediaUrl?: string | null;
  fileName?: string | null;
  fileSize?: number | null;
  reactions: IReaction[];
  replyTo?: string | null;
  readBy: string[];
  status: "sent" | "delivered" | "read";
  createdAt: string;
  updatedAt: string;
}

export interface IConversation {
  _id: string;
  type: "direct" | "group";
  groupName?: string;
  participants: Array<{
    _id: string;
    username: string;
    avatarUrl?: string;
    isOnline: boolean;
    lastSeen: string;
  }>;
  lastMessage?: IMessage;
  unreadCount?: number;
  updatedAt: string;
}
```

---

## 5. Component Breakdown & Structure

### 5.1 Architecture Plan

```
client/src/
├── components/
│   ├── layout/
│   │   ├── NavRail.tsx               # 64px far-left rail with module switches
│   │   └── AppLayout.tsx             # Wrapper flex layout
│   └── chat/
│       ├── ConversationList.tsx      # 320px chat list with search & active state
│       ├── ChatWindow.tsx            # Fluid main chat area
│       ├── ChatHeader.tsx            # Active conversation header + live indicator
│       ├── MessageBubble.tsx         # Message row, hover reactions & docked tags
│       ├── MessageInput.tsx          # Floating docked input bar with file picker
│       └── CreateChatModal.tsx       # New chat / group creation dialog
├── store/
│   ├── chatStore.ts                  # Selected conversation, messages cache, reaction mutator
│   └── socketStore.ts                # Socket.IO event listeners & dispatchers
└── pages/
    └── ChatPage.tsx                  # Coordinates layout, store subscriptions, and views
```

---

### 5.2 `NavRail.tsx` (`client/src/components/layout/NavRail.tsx`)

* **Width:** `w-16` (`64px`), border on right (`border-slate-800/80`), background `#0e121b`.
* **Top:** Brand Logo / App Monogram with a subtle indigo tint.
* **Middle Navigation:**
  * Icons: `MessageSquare` (Chats), `Users` (Contacts), `Settings` (Settings).
  * Selected state: `bg-indigo-600 text-white shadow-md shadow-indigo-600/20 rounded-xl`.
  * Inactive state: `text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 rounded-xl`.
* **Bottom:**
  * Logout button trigger (`LogOut` icon).
  * Current user avatar with an absolute online indicator badge (`bg-emerald-500 ring-2 ring-[#0e121b]`).

---

### 5.3 `ConversationList.tsx` (`client/src/components/chat/ConversationList.tsx`)

* **Width:** `w-80` (`320px`), background `#111622`, border right `border-slate-800/70`.
* **Header:**
  * "Chats" header title with count or filter indicator.
  * `+ New Chat` action button styled with `bg-indigo-600 hover:bg-indigo-500 text-xs text-white`.
* **Search Input:**
  * Full-width dark search container (`bg-[#181f2f] text-slate-200 border border-slate-700/50 rounded-lg pl-9 pr-3 py-2 text-xs`).
  * Embedded `Search` icon from Lucide React.
* **Conversation Cards:**
  * Avatar with live green indicator dot if the counterpart is online.
  * Direct counterpart username or group title.
  * Truncated last message snippet (text or "📷 Photo" / "📎 Attachment").
  * Last message timestamp formatted cleanly (e.g., `08:30 AM` or `Yesterday`).
  * Active state: `bg-[#1d263b] text-white border-l-2 border-indigo-500`.
  * Unread counter badge (`bg-indigo-600 text-white rounded-full text-[11px] font-bold px-2 py-0.5`).

---

### 5.4 `ChatWindow.tsx` & `ChatHeader.tsx`

* **Layout:** `flex-1 h-screen flex flex-col bg-[#0b0e14] relative`.
* **Header:**
  * Height `h-16`, frosted glass backdrop (`bg-[#0e121b]/90 backdrop-blur-md border-b border-slate-800/80`).
  * Avatar + name + real-time presence indicator.
  * Live status display: `"Active now"` with an emerald dot if online; otherwise, `"Last seen <time>"`.
  * Action controls: Audio Call, Video Call, and Conversation Search (`Phone`, `Video`, `Search` icons).

---

### 5.5 `MessageBubble.tsx` (`client/src/components/chat/MessageBubble.tsx`)

* **Message Canvas Alignment:**
  * Sent messages: `items-end`, bubble color `bg-indigo-600 text-white rounded-2xl rounded-tr-sm`.
  * Received messages: `items-start`, bubble color `bg-[#182030] text-slate-100 border border-slate-700/60 rounded-2xl rounded-tl-sm`.
  * Maximum bubble width: `max-w-xl` to prevent uncomfortably long lines on wide monitors.
* **Timestamp & Read Indicators:**
  * Placed inline at the bottom-right of each bubble.
  * Status icons: Single checkmark `Check` (sent), double checkmark `CheckCheck` (delivered), double cyan/blue checkmark (read).
* **Hover Quick-Reaction Trigger:**
  * On mouse hover over the message container, reveal a floating pill above the bubble with quick emoji buttons (`👍`, `❤️`, `😂`, `🔥`, `😮`, `😢`).
  * Clicking an emoji triggers `socket.emit("message:react", { messageId, conversationId, emoji })`.
* **Docked Reactions Pill:**
  * Positioned below the message bubble.
  * Each reacted emoji is wrapped in a chip (`bg-[#141a29] border border-slate-700 px-2 py-0.5 rounded-full text-xs text-slate-300`).
  * Displays emoji count and highlights if the active user is part of the reaction.

---

### 5.6 `MessageInput.tsx` (`client/src/components/chat/MessageInput.tsx`)

* **Container:** Docked at the bottom inside `max-w-4xl mx-auto w-full`.
* **Surface:** `bg-[#161c29] border border-slate-700/60 rounded-xl px-3 py-2 focus-within:border-indigo-500/80`.
* **Controls:**
  1. **Hidden file input (`ref={fileInputRef}`)** activated via a `Paperclip` button. Supports image formats and PDFs/docs up to 10MB.
  2. **Auto-expanding textarea or text input** handling `Enter` to send and `Shift+Enter` for multiline input.
  3. **Emoji picker trigger** (`Smile` icon).
  4. **Send button** (`Send` icon) with disabled visual states when input is empty or uploading.
* **File Upload Handling:**
  * When a file is selected, dispatch a multipart POST to `/api/messages/upload`.
  * On success, emit `message:send` with the returned `mediaUrl`, `fileName`, and `fileSize`.

---

## 6. Socket.IO Client Event Listeners

Ensure your Socket client store or hook subscribes to the following events:

```typescript
// Register in socket listener hook
socket.on("message:new", (message: IMessage) => {
  chatStore.getState().addMessage(message);
});

socket.on("message:reaction:update", ({ messageId, reactions }: { messageId: string; reactions: IReaction[] }) => {
  chatStore.getState().updateReactions(messageId, reactions);
});

socket.on("message:read:update", ({ conversationId, messageIds, readerId }) => {
  chatStore.getState().markMessagesAsRead(messageIds);
});

socket.on("presence:online", ({ userId }) => {
  chatStore.getState().setUserOnline(userId, true);
});

socket.on("presence:offline", ({ userId, lastSeen }) => {
  chatStore.getState().setUserOnline(userId, false, lastSeen);
});
```

---

## 7. Verification Checklist for the Agent

- [ ] Left navigation rail renders at 64px width with active highlight on the chats tab.
- [ ] Middle conversation list displays search filtering, avatar status dots, and active selection border.
- [ ] Chat bubbles cap at a balanced max width (`max-w-xl`) and render timestamps and checkmark icons correctly.
- [ ] Quick-reaction bar displays on hover, and reactions render docked under message bubbles.
- [ ] Media attachments upload to `/api/messages/upload` and render inline inside messages.
- [ ] Desktop responsiveness: flex layout adapts properly to 1080p and ultrawide viewports without text stretching.