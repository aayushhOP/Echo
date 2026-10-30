# Create Chat & Group Modal — Technical Specification & Implementation Guide

**Project Stack:** React 19 · TypeScript · Tailwind CSS v4 · Zustand · Lucide React · Axios

**Target Feature:** Modal Dialog for initiating Direct Messages and creating Multi-User Group Chats.

---

## 1. Overview & Objectives

The `CreateChatModal` opens when clicking the `+ New Chat` button in the conversation sidebar list. It supports:
1. **User Search & Discovery:** Queries `GET /api/users/search?q={query}` with debounced search input.
2. **Direct Chat (1-on-1):** Instant selection of an individual contact to start or navigate to an existing DM.
3. **Group Chat Creation Mode:** Tab toggle allowing multiple user selections, displaying selected participants as removable chips, group title input, and group avatar URL.
4. **Subtle Dark Slate Backdrop:** Frosted backdrop overlay matching `#0b0e14` with a centered dialog card (`#111622`).

---

## 2. Component Architecture & Props

### 2.1 File Location
`client/src/components/chat/CreateChatModal.tsx`

### 2.2 TypeScript Interfaces

```typescript
export interface IUserSearchResult {
  _id: string;
  username: string;
  email: string;
  avatarUrl?: string;
  isOnline?: boolean;
}

export interface CreateChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUserId: string;
  onConversationCreated: (conversationId: string) => void;
}
```

---

## 3. UI Layout & Visual Styling

* **Overlay:** `fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4`.
* **Modal Dialog Card:** `w-full max-w-md bg-[#111622] border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col`.
* **Mode Switcher Tabs:**
  * Direct Chat (`"Direct Message"`) vs. Group Chat (`"New Group"`).
  * Styled as clean segmented controls with `bg-[#181f2f] p-1 rounded-xl`.
* **Selected Participant Chips (Group Mode):**
  * Horizontal wrap container displaying selected members as pills: `bg-indigo-600/20 border border-indigo-500/40 text-indigo-200 text-xs px-2.5 py-1 rounded-full flex items-center gap-1.5`.
* **Results Scroll Area:** `max-h-60 overflow-y-auto space-y-1 px-4 py-2`.

---

## 4. Complete React Component Implementation

```tsx
import React, { useState, useEffect, useRef } from "react";
import { Search, X, Users, User, Check, Loader2, Sparkles } from "lucide-react";
import axios from "axios";

export interface IUserSearchResult {
  _id: string;
  username: string;
  email: string;
  avatarUrl?: string;
  isOnline?: boolean;
}

export interface CreateChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUserId: string;
  onConversationCreated: (conversationId: string) => void;
}

export const CreateChatModal: React.FC<CreateChatModalProps> = ({
  isOpen,
  onClose,
  currentUserId,
  onConversationCreated,
}) => {
  const [mode, setMode] = useState<"direct" | "group">("direct");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<IUserSearchResult[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<IUserSearchResult[]>([]);
  const [groupName, setGroupName] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const searchInputRef = useRef<HTMLInputElement>(null);

  // Focus search input on open
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => searchInputRef.current?.focus(), 100);
      setError(null);
      setSearchQuery("");
      setSelectedUsers([]);
      setGroupName("");
      setSearchResults([]);
    }
  }, [isOpen]);

  // Debounced search query
  useEffect(() => {
    if (!isOpen) return;

    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await axios.get(`/api/users/search?q=${encodeURIComponent(searchQuery)}`);
        // Filter out current user
        const results = (res.data.users || res.data || []).filter(
          (u: IUserSearchResult) => u._id !== currentUserId
        );
        setSearchResults(results);
      } catch (err: any) {
        setError(err.response?.data?.message || "Failed to search users");
      } finally {
        setLoading(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [searchQuery, isOpen, currentUserId]);

  if (!isOpen) return null;

  const toggleSelectUser = (user: IUserSearchResult) => {
    if (mode === "direct") {
      handleCreateDirect(user._id);
      return;
    }

    if (selectedUsers.some((u) => u._id === user._id)) {
      setSelectedUsers(selectedUsers.filter((u) => u._id !== user._id));
    } else {
      setSelectedUsers([...selectedUsers, user]);
    }
  };

  const handleCreateDirect = async (recipientId: string) => {
    try {
      setSubmitting(true);
      setError(null);
      const res = await axios.post("/api/conversations", {
        type: "direct",
        participantId: recipientId,
      });
      onConversationCreated(res.data._id);
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.message || "Failed to start chat");
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateGroup = async () => {
    if (!groupName.trim()) {
      setError("Please provide a group name");
      return;
    }
    if (selectedUsers.length < 1) {
      setError("Please select at least 1 member");
      return;
    }

    try {
      setSubmitting(true);
      setError(null);
      const res = await axios.post("/api/conversations", {
        type: "group",
        groupName: groupName.trim(),
        participants: selectedUsers.map((u) => u._id),
      });
      onConversationCreated(res.data._id);
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.message || "Failed to create group");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div 
        className="w-full max-w-md bg-[#111622] border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col transition-all"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Bar */}
        <div className="h-14 px-5 border-b border-slate-800/80 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles size={16} className="text-indigo-400" />
            <h3 className="font-semibold text-sm text-slate-100">New Conversation</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
          >
            <X size={16} />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="px-5 pt-4">
          <div className="grid grid-cols-2 p-1 bg-[#181f2f] rounded-xl border border-slate-700/50">
            <button
              onClick={() => {
                setMode("direct");
                setSelectedUsers([]);
                setError(null);
              }}
              className={`flex items-center justify-center gap-2 py-1.5 text-xs font-medium rounded-lg transition-all ${
                mode === "direct"
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <User size={14} /> Direct Message
            </button>
            <button
              onClick={() => {
                setMode("group");
                setError(null);
              }}
              className={`flex items-center justify-center gap-2 py-1.5 text-xs font-medium rounded-lg transition-all ${
                mode === "group"
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <Users size={14} /> Group Chat
            </button>
          </div>
        </div>

        {/* Group Name Field (Group mode only) */}
        {mode === "group" && (
          <div className="px-5 pt-3">
            <input
              type="text"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              placeholder="Group name (e.g., Design Team)..."
              className="w-full bg-[#181f2f] border border-slate-700/60 rounded-xl px-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
            />
          </div>
        )}

        {/* Selected Users Chips (Group mode only) */}
        {mode === "group" && selectedUsers.length > 0 && (
          <div className="px-5 pt-2 flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
            {selectedUsers.map((u) => (
              <span
                key={u._id}
                className="bg-indigo-600/20 border border-indigo-500/40 text-indigo-300 text-[11px] font-medium pl-2.5 pr-1.5 py-1 rounded-full flex items-center gap-1.5"
              >
                {u.username}
                <button
                  onClick={() => toggleSelectUser(u)}
                  className="hover:bg-indigo-500/30 rounded-full p-0.5 transition"
                >
                  <X size={12} />
                </button>
              </span>
            ))}
          </div>
        )}

        {/* Search Input Field */}
        <div className="px-5 py-3">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by username..."
              className="w-full bg-[#181f2f] text-slate-100 text-xs rounded-xl pl-9 pr-8 py-2 border border-slate-700/60 placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
            />
            {loading && (
              <Loader2 size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 animate-spin" />
            )}
          </div>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mx-5 mb-2 px-3 py-2 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs">
            {error}
          </div>
        )}

        {/* User Search Results List */}
        <div className="flex-1 max-h-56 overflow-y-auto px-4 pb-3 space-y-1">
          {searchResults.length === 0 && searchQuery.trim() && !loading && (
            <p className="text-center py-6 text-xs text-slate-500">No users found</p>
          )}

          {searchResults.length === 0 && !searchQuery.trim() && (
            <p className="text-center py-6 text-xs text-slate-500">Type a name to search</p>
          )}

          {searchResults.map((user) => {
            const isSelected = selectedUsers.some((u) => u._id === user._id);
            return (
              <div
                key={user._id}
                onClick={() => toggleSelectUser(user)}
                className={`flex items-center justify-between p-2 rounded-xl cursor-pointer transition ${
                  isSelected
                    ? "bg-[#1f293d] border border-indigo-500/40"
                    : "hover:bg-[#181f2f] border border-transparent"
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="relative">
                    <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-xs font-semibold text-slate-200 overflow-hidden">
                      {user.avatarUrl ? (
                        <img src={user.avatarUrl} alt={user.username} className="w-full h-full object-cover" />
                      ) : (
                        user.username.slice(0, 2).toUpperCase()
                      )}
                    </div>
                    {user.isOnline && (
                      <span className="absolute bottom-0 right-0 w-2 h-2 bg-emerald-500 border border-[#111622] rounded-full" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-slate-200 truncate">{user.username}</p>
                    <p className="text-[10px] text-slate-400 truncate">{user.email}</p>
                  </div>
                </div>

                {mode === "group" && (
                  <div
                    className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${
                      isSelected
                        ? "bg-indigo-600 border-indigo-500 text-white"
                        : "border-slate-600"
                    }`}
                  >
                    {isSelected && <Check size={11} />}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Footer Actions (Group mode only) */}
        {mode === "group" && (
          <div className="p-4 border-t border-slate-800/80 flex items-center justify-end gap-2 bg-[#0e121b]">
            <button
              onClick={onClose}
              disabled={submitting}
              className="px-3 py-1.5 text-xs text-slate-400 hover:text-slate-200 transition"
            >
              Cancel
            </button>
            <button
              onClick={handleCreateGroup}
              disabled={submitting || selectedUsers.length === 0 || !groupName.trim()}
              className="px-4 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-xs font-medium text-white transition flex items-center gap-1.5 shadow-sm"
            >
              {submitting && <Loader2 size={13} className="animate-spin" />}
              Create Group ({selectedUsers.length})
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
```