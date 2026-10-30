# Contact & Conversation Detail Drawer — Technical Specification & Implementation Guide

**Project Stack:** React 19 · TypeScript · Tailwind CSS v4 · Zustand · Lucide React · TanStack Query

**Target Feature:** 320px Slide-out Right Drawer for Direct & Group Conversations

---

## 1. Overview & Objectives

The Contact & Conversation Detail Drawer slides in from the right edge of the screen when a user clicks the conversation header (avatar/username) or the header action menu (`⋮`). 

It provides:
- **Participant Profile / Group Overview:** Large avatar, online badge, bio/status, email/phone.
- **Quick Action Bar:** Mute, Pin, Search, and Audio/Video call shortcuts.
- **Shared Media & Docs Gallery:** Tabbed grid displaying photos and files consumed from `GET /api/conversations/:id/media`.
- **Member Management (Group Mode):** Admin tags, remove member, and add member modal trigger.
- **Privacy & Danger Zone:** Block user, Leave group, or Delete chat actions.

---

## 2. Component Architecture & Props

### 2.1 File Location
`client/src/components/chat/ContactDetailDrawer.tsx`

### 2.2 TypeScript Interfaces

```typescript
export interface ContactDetailDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  conversation: {
    _id: string;
    type: "direct" | "group";
    groupName?: string;
    isPinned?: boolean;
    isMuted?: boolean;
    participants: Array<{
      _id: string;
      username: string;
      email?: string;
      avatarUrl?: string;
      status?: string;
      bio?: string;
      isOnline?: boolean;
      lastSeen?: string;
    }>;
    admins?: string[];
  };
  currentUserId: string;
  onTogglePin: (conversationId: string) => Promise<void>;
  onToggleMute: (conversationId: string) => Promise<void>;
  onOpenMediaItem?: (url: string) => void;
}
```

---

## 3. UI Layout & Styling Specification

### 3.1 Drawer Container
- **Position & Width:** Absolute or fixed on the right, `w-80` (320px), `h-screen`, `z-30`.
- **Surface:** `bg-[#0e121b] border-l border-slate-800/80 flex flex-col select-none`.
- **Animation:** Smooth horizontal slide transition:
  ```css
  /* Transition classes */
  transition-all duration-300 ease-in-out
  transform translate-x-0 /* open */
  translate-x-full /* closed */
  ```

### 3.2 Header Bar
- Top bar matching chat window header height (`h-16 px-5 border-b border-slate-800/70 flex items-center justify-between`).
- Title: `"Contact Info"` or `"Group Details"`.
- Close button (`X` icon from Lucide React) with hover state (`text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800/60`).

### 3.3 Profile Hero Section
- Centered container (`flex flex-col items-center py-6 px-4 border-b border-slate-800/60 text-center`).
- Large Avatar: `w-20 h-20 rounded-full border-2 border-slate-700 relative overflow-hidden bg-slate-800`.
- Online Pill: Emerald ring badge docked on avatar if online.
- Display Name: `text-base font-semibold text-white mt-3`.
- Bio / About: `text-xs text-slate-400 mt-1 max-w-xs break-words` (e.g., *"Hey there! I'm using ChatApp"*).

### 3.4 Quick Action Pill Strip
Horizontal 4-button dock centered below profile hero (`flex items-center justify-center gap-3 py-3 border-b border-slate-800/60`):
1. **Mute Button:** Bell icon (`Bell` / `BellOff`), toggles `isMuted` via `PATCH /api/conversations/:id/mute`.
2. **Pin Button:** Pin icon (`Pin`), toggles `isPinned` via `PATCH /api/conversations/:id/pin`.
3. **Search In Chat:** Magnifying glass (`Search`), activates message search overlay.
4. **Call / More:** Video or Phone icon.

Each button: `flex flex-col items-center gap-1 text-[10px] text-slate-400 hover:text-slate-200 transition-colors p-2 rounded-xl hover:bg-slate-800/50`.

### 3.5 Shared Media & Docs Accordion
Scrollable asset explorer consuming `GET /api/conversations/:id/media`:
- Tabs: **Media (Photos)** | **Docs & Files**.
- **Media Grid:** `grid grid-cols-3 gap-2 px-4 py-3`. Images rendered in square thumbnails (`aspect-square rounded-lg object-cover hover:opacity-80 transition cursor-pointer`).
- **Files List:** `flex flex-col gap-2 px-4 py-3`. File row with document icon, truncated file name, size in KB/MB, and download button.
- Empty State: `"No media shared yet"` in muted text if items array is empty.

### 3.6 Group Members List (Group Mode Only)
- Visible if `conversation.type === "group"`.
- Member count header (e.g., `"Members · 5"`).
- List of members with miniature avatars, username, and an `"Admin"` pill badge if the user is in `conversation.admins`.
- `+ Add Participant` trigger for admins.

---

## 4. Complete React Component Implementation

```tsx
import React, { useState, useEffect } from "react";
import { 
  X, 
  Bell, 
  BellOff, 
  Pin, 
  Image as ImageIcon, 
  FileText, 
  Download, 
  ShieldCheck, 
  UserMinus,
  Search
} from "lucide-react";
import axios from "axios";

export interface ContactDetailDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  conversation: {
    _id: string;
    type: "direct" | "group";
    groupName?: string;
    isPinned?: boolean;
    isMuted?: boolean;
    participants: Array<{
      _id: string;
      username: string;
      email?: string;
      avatarUrl?: string;
      status?: string;
      bio?: string;
      isOnline?: boolean;
      lastSeen?: string;
    }>;
    admins?: string[];
  };
  currentUserId: string;
  onTogglePin: (conversationId: string) => Promise<void>;
  onToggleMute: (conversationId: string) => Promise<void>;
}

export const ContactDetailDrawer: React.FC<ContactDetailDrawerProps> = ({
  isOpen,
  onClose,
  conversation,
  currentUserId,
  onTogglePin,
  onToggleMute,
}) => {
  const [activeTab, setActiveTab] = useState<"media" | "docs">("media");
  const [mediaItems, setMediaItems] = useState<any[]>([]);
  const [loadingMedia, setLoadingMedia] = useState(false);

  // Identify display counterpart for 1-on-1 chats
  const counterpart = conversation.type === "direct"
    ? conversation.participants.find((p) => p._id !== currentUserId) || conversation.participants[0]
    : null;

  const displayName = conversation.type === "group" 
    ? conversation.groupName || "Group Chat" 
    : counterpart?.username || "User";

  const displayBio = counterpart?.bio || counterpart?.status || "Hey there! I am using ChatApp";

  // Fetch shared media and files
  useEffect(() => {
    if (!isOpen || !conversation._id) return;

    const fetchMedia = async () => {
      try {
        setLoadingMedia(true);
        const res = await axios.get(`/api/conversations/${conversation._id}/media?type=${activeTab === "media" ? "image" : "file"}`);
        setMediaItems(res.data.items || []);
      } catch (err) {
        console.error("Failed to fetch conversation media", err);
      } finally {
        setLoadingMedia(false);
      }
    };

    fetchMedia();
  }, [isOpen, conversation._id, activeTab]);

  return (
    <aside
      className={`fixed top-0 right-0 h-screen w-80 bg-[#0e121b] border-l border-slate-800/80 z-40 flex flex-col transition-transform duration-300 ease-in-out select-none ${
        isOpen ? "translate-x-0" : "translate-x-full"
      }`}
    >
      {/* Drawer Header */}
      <div className="h-16 px-5 border-b border-slate-800/70 flex items-center justify-between shrink-0">
        <h3 className="font-semibold text-sm text-slate-100">
          {conversation.type === "group" ? "Group Info" : "Contact Info"}
        </h3>
        <button
          onClick={onClose}
          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 transition-colors"
          title="Close"
        >
          <X size={18} />
        </button>
      </div>

      {/* Scrollable Content Container */}
      <div className="flex-1 overflow-y-auto">
        {/* Profile Card Section */}
        <div className="flex flex-col items-center py-6 px-4 border-b border-slate-800/60 text-center">
          <div className="relative">
            <div className="w-20 h-20 rounded-full bg-slate-800 border-2 border-slate-700/80 flex items-center justify-center text-lg font-bold text-slate-200 overflow-hidden">
              {counterpart?.avatarUrl ? (
                <img src={counterpart.avatarUrl} alt={displayName} className="w-full h-full object-cover" />
              ) : (
                displayName.slice(0, 2).toUpperCase()
              )}
            </div>
            {counterpart?.isOnline && (
              <span className="absolute bottom-1 right-1 w-3.5 h-3.5 bg-emerald-500 border-2 border-[#0e121b] rounded-full" />
            )}
          </div>

          <h4 className="text-base font-semibold text-white mt-3 truncate max-w-full">{displayName}</h4>
          <p className="text-xs text-slate-400 mt-1 leading-relaxed max-w-xs">{displayBio}</p>
        </div>

        {/* Quick Action Strip */}
        <div className="grid grid-cols-3 gap-2 px-6 py-3 border-b border-slate-800/60">
          <button
            onClick={() => onToggleMute(conversation._id)}
            className="flex flex-col items-center gap-1.5 p-2 rounded-xl hover:bg-slate-800/50 text-slate-400 hover:text-slate-200 transition-colors"
          >
            {conversation.isMuted ? <BellOff size={17} className="text-rose-400" /> : <Bell size={17} />}
            <span className="text-[11px]">{conversation.isMuted ? "Muted" : "Mute"}</span>
          </button>

          <button
            onClick={() => onTogglePin(conversation._id)}
            className="flex flex-col items-center gap-1.5 p-2 rounded-xl hover:bg-slate-800/50 text-slate-400 hover:text-slate-200 transition-colors"
          >
            <Pin size={17} className={conversation.isPinned ? "text-indigo-400 fill-indigo-400" : ""} />
            <span className="text-[11px]">{conversation.isPinned ? "Pinned" : "Pin"}</span>
          </button>

          <button
            className="flex flex-col items-center gap-1.5 p-2 rounded-xl hover:bg-slate-800/50 text-slate-400 hover:text-slate-200 transition-colors"
          >
            <Search size={17} />
            <span className="text-[11px]">Search</span>
          </button>
        </div>

        {/* Group Participants (Rendered only for group chats) */}
        {conversation.type === "group" && (
          <div className="py-4 border-b border-slate-800/60">
            <div className="px-5 mb-2 flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-300">
                Members ({conversation.participants.length})
              </span>
            </div>
            <div className="space-y-1 px-3">
              {conversation.participants.map((member) => {
                const isAdmin = conversation.admins?.includes(member._id);
                return (
                  <div key={member._id} className="flex items-center justify-between p-2 rounded-lg hover:bg-slate-800/30">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-xs text-slate-300 shrink-0 font-medium overflow-hidden">
                        {member.avatarUrl ? (
                          <img src={member.avatarUrl} alt={member.username} className="w-full h-full object-cover" />
                        ) : (
                          member.username.slice(0, 2).toUpperCase()
                        )}
                      </div>
                      <span className="text-xs text-slate-200 font-medium truncate">{member.username}</span>
                    </div>
                    {isAdmin && (
                      <span className="text-[10px] bg-indigo-950 text-indigo-400 border border-indigo-800/50 px-1.5 py-0.5 rounded font-medium flex items-center gap-1">
                        <ShieldCheck size={11} /> Admin
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Shared Media & Files Section */}
        <div className="py-4">
          <div className="flex items-center border-b border-slate-800/60 px-5 mb-3 gap-6">
            <button
              onClick={() => setActiveTab("media")}
              className={`pb-2 text-xs font-medium border-b-2 transition-colors ${
                activeTab === "media"
                  ? "border-indigo-500 text-indigo-400 font-semibold"
                  : "border-transparent text-slate-400 hover:text-slate-200"
              }`}
            >
              Media
            </button>
            <button
              onClick={() => setActiveTab("docs")}
              className={`pb-2 text-xs font-medium border-b-2 transition-colors ${
                activeTab === "docs"
                  ? "border-indigo-500 text-indigo-400 font-semibold"
                  : "border-transparent text-slate-400 hover:text-slate-200"
              }`}
            >
              Docs & Files
            </button>
          </div>

          {/* Media Tab View */}
          {activeTab === "media" && (
            <div className="px-5">
              {loadingMedia ? (
                <div className="text-center py-6 text-xs text-slate-500">Loading media...</div>
              ) : mediaItems.length === 0 ? (
                <div className="text-center py-8 text-xs text-slate-500">No media shared yet</div>
              ) : (
                <div className="grid grid-cols-3 gap-2">
                  {mediaItems.map((item) => (
                    <a
                      key={item._id}
                      href={item.mediaUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="aspect-square bg-slate-800 rounded-lg overflow-hidden border border-slate-700/60 hover:opacity-80 transition"
                    >
                      <img src={item.mediaUrl} alt="media" className="w-full h-full object-cover" />
                    </a>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Docs Tab View */}
          {activeTab === "docs" && (
            <div className="px-4 space-y-2">
              {loadingMedia ? (
                <div className="text-center py-6 text-xs text-slate-500">Loading files...</div>
              ) : mediaItems.length === 0 ? (
                <div className="text-center py-8 text-xs text-slate-500">No documents shared yet</div>
              ) : (
                mediaItems.map((item) => (
                  <div
                    key={item._id}
                    className="flex items-center justify-between p-2.5 rounded-lg bg-slate-800/30 border border-slate-800 hover:border-slate-700/80 transition"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <FileText size={18} className="text-indigo-400 shrink-0" />
                      <div className="min-w-0">
                        <p className="text-xs text-slate-200 truncate">{item.fileName || "Document"}</p>
                        <p className="text-[10px] text-slate-500">
                          {item.fileSize ? `${Math.round(item.fileSize / 1024)} KB` : "File"}
                        </p>
                      </div>
                    </div>
                    <a
                      href={item.mediaUrl}
                      download
                      className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-700/50"
                    >
                      <Download size={14} />
                    </a>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </aside>
  );
};
```

---

## 5. Wiring Into `ChatPage.tsx`

Add the state hook and pass the drawer directly next to the `ChatWindow`:

```tsx
const [isDrawerOpen, setIsDrawerOpen] = useState(false);

return (
  <div className="flex h-screen w-screen overflow-hidden bg-[#0b0e14]">
    <NavRail ... />
    <ConversationList ... />
    <div className="flex-1 flex relative">
      <ChatWindow 
        onHeaderClick={() => setIsDrawerOpen((prev) => !prev)}
        onOpenMenu={() => setIsDrawerOpen((prev) => !prev)}
        ...
      />
      <ContactDetailDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        conversation={activeConversation}
        currentUserId={currentUser._id}
        onTogglePin={handleTogglePin}
        onToggleMute={handleToggleMute}
      />
    </div>
  </div>
);
```

---

## 6. Verification Checklist for the Agent

- [ ] Clicking on the chat header (user avatar/name) or the `⋮` action button slides the drawer smoothly into view.
- [ ] Clicking the `X` button closes the drawer.
- [ ] Pin and Mute buttons trigger `PATCH /api/conversations/:id/pin` and `/mute` and toggle their visual states.
- [ ] The Media / Docs tab queries `GET /api/conversations/:id/media` and displays thumbnails and download cards.
- [ ] Group conversations render the member list with Admin badges; direct chats render individual contact details.