# Unified Dual Notification System (Desktop + In-App Toast) Specification

**Project Stack:** React 19 · TypeScript · Tailwind CSS · Sonner · Socket.IO Client · Web Notifications API

## 1. Architectural Strategy & Collision Prevention

To provide timely notifications without annoying users with duplicate alerts, notifications are routed through a **mutually exclusive state matrix** using `document.visibilityState` (`document.hidden`) and the currently active conversation ID (`activeConversationId`).

### 1.1 Decision Matrix

| User & Window State | Desktop OS Notification | In-App Toast (Sonner) | Audio Chime |
|---|:---:|:---:|:---:|
| **Tab Hidden / Minimized / Backgrounded** | **Yes** (Native OS popup) | No | **Yes** |
| **Tab Focused, but in another chat / view** | No | **Yes** (Top-right dark toast) | **Yes** |
| **Tab Focused, currently inside active chat** | No | No (Direct bubble append) | No |
| **Sender is Current User** | No | No | No |

### 1.2 Core Objectives
1. **Zero Conflict Guarantee:** Desktop and in-app toasts never trigger simultaneously for the same message.
2. **Audio Autoplay Resilience:** Handle browser media autoplay policies gracefully using unlocked `Audio` instances.
3. **Notification Grouping (`tag`):** Prevent desktop banner spam by using conversation-specific tags that update in place.
4. **Click-to-Focus & Navigate:** Clicking any notification (desktop or toast) focuses the browser window and opens the target chat thread.

---

## 2. Dependencies & Asset Setup

### 2.1 Install Sonner
```bash
npm install sonner
```

### 2.2 Notification Sound Asset
Ensure a lightweight notification audio file exists in the public directory:
```
client/public/sounds/notification.mp3
```
*(Tip: Keep audio file size under 50KB and duration under 1.2s for low latency).*

---

## 3. Notification Service & Utilities (`client/src/services/notificationService.ts`)

Create a dedicated service handling native browser permissions, audio synthesis/playback, and notification dispatching:

```typescript
// client/src/services/notificationService.ts

export interface NotificationPayload {
  messageId: string;
  conversationId: string;
  senderId: string;
  senderName: string;
  senderAvatar?: string;
  content: string;
}

class NotificationService {
  private audio: HTMLAudioElement | null = null;
  private isAudioUnlocked = false;

  constructor() {
    if (typeof window !== "undefined") {
      this.audio = new Audio("/sounds/notification.mp3");
      this.audio.volume = 0.5;

      // Unlock browser audio context on initial user interaction
      const unlockAudio = () => {
        if (!this.audio || this.isAudioUnlocked) return;
        this.audio.play().then(() => {
          this.audio?.pause();
          if (this.audio) this.audio.currentTime = 0;
          this.isAudioUnlocked = true;
          window.removeEventListener("click", unlockAudio);
          window.removeEventListener("keydown", unlockAudio);
        }).catch(() => {
          // Keep listeners if blocked
        });
      };

      window.addEventListener("click", unlockAudio, { once: true });
      window.addEventListener("keydown", unlockAudio, { once: true });
    }
  }

  /**
   * Request browser notification permission
   */
  public async requestDesktopPermission(): Promise<boolean> {
    if (!("Notification" in window)) {
      console.warn("Notifications are not supported in this browser.");
      return false;
    }

    if (Notification.permission === "granted") return true;

    if (Notification.permission !== "denied") {
      const status = await Notification.requestPermission();
      return status === "granted";
    }

    return false;
  }

  /**
   * Play the subtle notification chime
   */
  public playChime(): void {
    if (!this.audio) return;
    try {
      this.audio.currentTime = 0;
      this.audio.play().catch((err) => {
        // Autoplay policy safety
        console.debug("Audio play blocked by browser policy:", err.message);
      });
    } catch (error) {
      console.debug("Error playing notification audio:", error);
    }
  }

  /**
   * Trigger native OS desktop notification banner
   */
  public showDesktopNotification(
    payload: NotificationPayload,
    onNavigate: (convId: string) => void
  ): void {
    if (!("Notification" in window) || Notification.permission !== "granted") {
      return;
    }

    const notification = new Notification(`New message from ${payload.senderName}`, {
      body: payload.content.length > 80 ? `${payload.content.slice(0, 80)}...` : payload.content,
      icon: payload.senderAvatar || "/favicon.ico",
      tag: `conv-${payload.conversationId}`, // Groups consecutive messages from same chat
      silent: true, // We trigger custom playChime() to avoid duplicate audio
    });

    notification.onclick = () => {
      window.focus();
      onNavigate(payload.conversationId);
      notification.close();
    };
  }
}

export const notificationService = new NotificationService();
```

---

## 4. In-App Custom Toast Component

Using **Sonner**, create a custom glassmorphism notification bubble matching your dark-navy and electric-blue theme.

### `client/src/components/notifications/MessageToast.tsx`

```tsx
// client/src/components/notifications/MessageToast.tsx
import React from "react";
import { MessageSquare } from "lucide-react";
import { NotificationPayload } from "../../services/notificationService";

interface MessageToastProps {
  payload: NotificationPayload;
  onClick: () => void;
  onDismiss: () => void;
}

export const MessageToast: React.FC<MessageToastProps> = ({
  payload,
  onClick,
  onDismiss,
}) => {
  return (
    <div
      onClick={() => {
        onClick();
        onDismiss();
      }}
      className="flex items-center gap-3 w-80 p-3 rounded-2xl bg-[#171824]/95 border border-white/[0.08] shadow-2xl backdrop-blur-md cursor-pointer hover:border-[#0066ff]/40 transition-all group"
    >
      {/* Avatar or fallback */}
      <div className="relative flex-shrink-0">
        <div className="w-10 h-10 rounded-full bg-slate-800 border border-white/10 flex items-center justify-center overflow-hidden">
          {payload.senderAvatar ? (
            <img
              src={payload.senderAvatar}
              alt={payload.senderName}
              className="w-full h-full object-cover"
            />
          ) : (
            <span className="text-xs font-semibold text-white">
              {payload.senderName.slice(0, 2).toUpperCase()}
            </span>
          )}
        </div>
        <div className="absolute -bottom-0.5 -right-0.5 p-0.5 rounded-full bg-[#13141d]">
          <div className="w-2.5 h-2.5 rounded-full bg-[#0066ff] flex items-center justify-center">
            <MessageSquare size={6} className="text-white" />
          </div>
        </div>
      </div>

      {/* Content preview */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold text-white group-hover:text-[#0066ff] transition-colors truncate">
            {payload.senderName}
          </p>
          <span className="text-[10px] text-slate-500">just now</span>
        </div>
        <p className="text-xs text-slate-400 truncate mt-0.5">
          {payload.content}
        </p>
      </div>
    </div>
  );
};
```

---

## 5. Global Notification Orchestrator Hook

Create a central hook to bind Socket.IO events, evaluate visibility, and handle the notification lifecycle:

### `client/src/hooks/useNotifications.ts`

```typescript
// client/src/hooks/useNotifications.ts
import { useEffect } from "react";
import { toast } from "sonner";
import { socket } from "../services/socket";
import { notificationService, NotificationPayload } from "../services/notificationService";
import { useChatStore } from "../store/chatStore";
import { MessageToast } from "../components/notifications/MessageToast";

export const useNotifications = (currentUserId: string) => {
  const activeConversationId = useChatStore((state) => state.activeConversationId);
  const setActiveConversationId = useChatStore((state) => state.setActiveConversationId);

  // Request browser permission upon initial hook mount (if not decided)
  useEffect(() => {
    notificationService.requestDesktopPermission();
  }, []);

  useEffect(() => {
    const handleNewMessage = (msg: any) => {
      // 1. Never notify on own messages
      if (msg.senderId === currentUserId) return;

      const payload: NotificationPayload = {
        messageId: msg._id,
        conversationId: msg.conversationId,
        senderId: msg.senderId,
        senderName: msg.senderUsername || "Someone",
        senderAvatar: msg.senderAvatarUrl,
        content: msg.content || "Sent an attachment",
      };

      const isCurrentChat = activeConversationId === payload.conversationId;

      // 2. State Branching Logic

      // Case A: Tab is minimized or behind another window
      if (document.hidden) {
        notificationService.playChime();
        notificationService.showDesktopNotification(payload, (convId) => {
          setActiveConversationId(convId);
        });
        return;
      }

      // Case B: Tab is focused, but user is looking at another chat or main screen
      if (!isCurrentChat) {
        notificationService.playChime();
        toast.custom(
          (t) => (
            <MessageToast
              payload={payload}
              onClick={() => setActiveConversationId(payload.conversationId)}
              onDismiss={() => toast.dismiss(t)}
            />
          ),
          { duration: 4000 }
        );
        return;
      }

      // Case C: User has this conversation active and visible
      // No banners or toasts; UI appends message seamlessly.
    };

    socket.on("message:new", handleNewMessage);

    return () => {
      socket.off("message:new", handleNewMessage);
    };
  }, [currentUserId, activeConversationId, setActiveConversationId]);
};
```

---

## 6. Mounting in Root Application (`client/src/App.tsx`)

Mount Sonner's `<Toaster />` configured to your dark palette and initialize the `useNotifications` hook inside the authenticated context:

```tsx
// client/src/App.tsx
import { Toaster } from "sonner";
import { useAuth } from "@clerk/clerk-react";
import { useNotifications } from "./hooks/useNotifications";
// ... other imports

function AuthenticatedApp() {
  const { userId } = useAuth();
  
  // Wire global notification lifecycle
  useNotifications(userId || "");

  return (
    <div className="h-screen w-screen overflow-hidden bg-[#13141d] text-slate-100">
      {/* Existing Chat Layout & Routes */}
    </div>
  );
}

export default function App() {
  return (
    <>
      {/* Sonner Toaster container */}
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: "transparent",
            border: "none",
            boxShadow: "none",
            padding: 0,
          },
        }}
      />

      <AuthenticatedApp />
    </>
  );
}
```

---

## 7. Adding a Manual Notification Toggle in Settings

Allow users to grant permission later if they initially ignored the browser prompt:

```tsx
// Inside client/src/components/settings/NotificationSettings.tsx
import React, { useState } from "react";
import { Bell, BellOff, Check } from "lucide-react";
import { notificationService } from "../../services/notificationService";

export const NotificationSettings: React.FC = () => {
  const [permission, setPermission] = useState<NotificationPermission>(
    typeof window !== "undefined" && "Notification" in window
      ? Notification.permission
      : "default"
  );

  const handleEnableNotifications = async () => {
    const granted = await notificationService.requestDesktopPermission();
    setPermission(granted ? "granted" : "denied");
  };

  return (
    <div className="p-4 rounded-2xl bg-[#171824] border border-white/[0.06] flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className="p-2.5 rounded-xl bg-[#0066ff]/10 text-[#0066ff]">
          <Bell size={18} />
        </div>
        <div>
          <h4 className="text-sm font-medium text-white">Desktop Notifications</h4>
          <p className="text-xs text-slate-400">Receive alerts when the app is in the background</p>
        </div>
      </div>

      {permission === "granted" ? (
        <span className="flex items-center gap-1.5 text-xs text-emerald-400 font-medium bg-emerald-500/10 px-3 py-1.5 rounded-lg border border-emerald-500/20">
          <Check size={14} />
          Enabled
        </span>
      ) : (
        <button
          onClick={handleEnableNotifications}
          className="text-xs px-3.5 py-1.5 rounded-lg font-medium bg-[#0066ff] hover:bg-[#0052cc] text-white transition-colors"
        >
          Enable
        </button>
      )}
    </div>
  );
};
```

---

## 8. Agent Implementation Checklist

- [x] **Dependency Installation:** Installed `sonner` in the frontend client.
- [x] **Audio Asset Verification:** Placed `notification.mp3` in `client/public/sounds/`.
- [x] **Notification Service:** Created `client/src/services/notificationService.ts` with:
  - [x] Auto-unlock audio playback on first window interaction.
  - [x] `requestDesktopPermission()` using `Notification.requestPermission()`.
  - [x] `showDesktopNotification()` with grouping tag (`conv-${conversationId}`) and `window.focus()` on click.
- [x] **Custom In-App Toast:** Created `client/src/components/notifications/MessageToast.tsx` styled to the dark-navy palette.
- [x] **Central Hook Logic (`useNotifications.ts`):**
  - [x] Sender check: Ignores self-authored messages.
  - [x] Hidden document check (`document.hidden`): Plays chime and displays desktop notification only.
  - [x] Inactive conversation check (`!isCurrentChat`): Plays chime and displays Sonner in-app toast.
  - [x] Active conversation check (`isCurrentChat`): Silent inline update with no popups.
- [x] **Global Mounting:** Mounted `<Toaster position="top-right" />` in `client/src/App.tsx`.