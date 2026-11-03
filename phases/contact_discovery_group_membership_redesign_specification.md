# Contact Discovery, Unsaved Contact Banner & Group Membership Redesign

**Project Stack:** React 19 · TypeScript · Tailwind CSS · Lucide React · Express 5 · Node.js · MongoDB / Mongoose · Zustand

## 1. Architectural Overview & Workflow Matrix

This redesign decouples **User Discovery / Direct Messaging** from **Saved Contacts**, mirroring the standard mobile and web messaging experience:

### 1.1 The User Journey

```
[Search Username via Full-Screen Search Modal]
               │
               ├──> [Option A: Click "Add Contact" directly on search card]
               │         └── Opens "Save Contact" Panel -> Saves to address book
               │
               └──> [Option B: Click "Start Chat" to send message / "Hii"]
                         │
                         ▼
               [Recipient is NOT in saved contacts?]
                  ├── YES: Display top warning banner ("This person is not in your contacts")
                  │         └── Action: [Add to Contacts] Button
                  │                  │
                  │                  ▼
                  │         [Opens "Save Contact" Panel]
                  │         (Custom Name, Email, Phone Number)
                  │                  │
                  │                  ▼
                  │         [Saved to User.contacts in MongoDB]
                  │         (Banner disappears; contact is listed on Contacts page)
                  │
                  └── NO:  Standard chat header with saved contact name and avatar.
```

### 1.2 Core Domain Rules

1. **Full-Screen New Conversation Screen:** Replaces the small floating modal seen in your screenshot. Styled in dark navy (`#13141d` background, `#171824` cards) with electric blue accents (`#0066ff`). **"Group Chat" toggle is completely removed** from this modal. This modal now focuses purely on username search, immediate 1:1 chat initialization, and direct contact addition.

2. **Dual-Action Search Results:** Each user card returned in the search results offers two explicit actions:
   * **Add to Contact:** If the user is not yet saved, a dedicated button opens the pre-filled "Save Contact" modal directly from the search list. If already saved, it displays a subtle "Saved" check badge.
   * **Start Chat:** Opens the direct chat panel with this user immediately.

3. **Unsaved Contact Top Banner:** When User A views a 1:1 chat with User B, the frontend checks if User B's `clerkId` is present in User A's `contacts` list. If not, a persistent banner appears at the very top of the chat panel:
   * Text: *"This sender is not in your contact list."*
   * Action: **"Add to Contacts"** button (and an optional **"Block"** shortcut).

4. **Save Contact Drawer / Modal:** Prompts for:
   * **Display Name / Full Name** (defaults to their username or Clerk profile name, but editable as an address-book alias).
   * **Email Address** (pre-filled if publicly available, or manual input).
   * **Phone Number** (formatted input).
   * Once saved, User B appears in the dedicated **Contacts Page**.

5. **Group Creation Restriction:** When creating a group or adding members to an existing group, **only saved contacts** are queryable and selectable. Random users found only via username search cannot be added to groups until they have been saved as a contact first.

## 2. Database Schema Updates

### 2.1 Update User Schema with Embedded Contacts (`server/src/models/User.ts`)

Store contacts as structured address-book subdocuments directly on the User model:

```typescript
// server/src/models/User.ts
import { Schema, model, Document } from "mongoose";

export interface ISavedContact {
  contactUserId: string; // Clerk ID of target user
  savedName: string;     // Custom alias/name assigned by user
  email?: string;
  phoneNumber?: string;
  savedAt: Date;
}

export interface IUser extends Document {
  clerkId: string;
  username: string;
  email: string;
  avatarUrl?: string;
  about?: string;
  contacts: ISavedContact[];
  blockedUsers: string[];
  createdAt: Date;
  updatedAt: Date;
}

const savedContactSchema = new Schema<ISavedContact>(
  {
    contactUserId: { type: String, required: true },
    savedName: { type: String, required: true },
    email: { type: String, default: "" },
    phoneNumber: { type: String, default: "" },
    savedAt: { type: Date, default: Date.now },
  },
  { _id: true }
);

const userSchema = new Schema<IUser>(
  {
    clerkId: { type: String, required: true, unique: true, index: true },
    username: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
    email: { type: String, required: true },
    avatarUrl: { type: String },
    about: { type: String, default: "Hey there! I am using Echo." },
    contacts: [savedContactSchema],
    blockedUsers: [{ type: String }],
  },
  { timestamps: true }
);

// Indexes
userSchema.index({ "contacts.contactUserId": 1 });

export default model<IUser>("User", userSchema);
```

## 3. Backend Endpoints & Validation

### 3.1 Contact Management Controller (`server/src/controllers/contactController.ts`)

```typescript
// server/src/controllers/contactController.ts
import { Request, Response } from "express";
import User from "../models/User";

/**
 * GET /api/contacts
 * Returns list of saved contacts populated with current profile avatars and online status
 */
export const getSavedContacts = async (req: Request, res: Response) => {
  const currentUserId = (req as any).auth.userId;

  try {
    const user = await User.findOne({ clerkId: currentUserId });
    if (!user) return res.status(404).json({ message: "User not found" });

    // Fetch live details (avatar, username) for all saved contact IDs
    const contactUserIds = user.contacts.map((c) => c.contactUserId);
    const liveProfiles = await User.find({ clerkId: { $in: contactUserIds } })
      .select("clerkId username avatarUrl about");

    const profileMap = new Map(liveProfiles.map((p) => [p.clerkId, p]));

    const enrichedContacts = user.contacts.map((contact) => {
      const profile = profileMap.get(contact.contactUserId);
      return {
        _id: (contact as any)._id,
        contactUserId: contact.contactUserId,
        savedName: contact.savedName,
        email: contact.email || profile?.email || "",
        phoneNumber: contact.phoneNumber || "",
        username: profile?.username || "",
        avatarUrl: profile?.avatarUrl || "",
        about: profile?.about || "",
        savedAt: contact.savedAt,
      };
    });

    return res.status(200).json({ success: true, contacts: enrichedContacts });
  } catch (error) {
    console.error("Error fetching contacts:", error);
    return res.status(500).json({ message: "Failed to fetch contacts" });
  }
};

/**
 * POST /api/contacts
 * Adds or updates a contact in the user's address book
 */
export const saveContact = async (req: Request, res: Response) => {
  const currentUserId = (req as any).auth.userId;
  const { contactUserId, savedName, email, phoneNumber } = req.body;

  if (!contactUserId || !savedName?.trim()) {
    return res.status(400).json({ message: "Target user ID and saved name are required" });
  }

  if (contactUserId === currentUserId) {
    return res.status(400).json({ message: "You cannot add yourself as a contact" });
  }

  try {
    const targetUser = await User.findOne({ clerkId: contactUserId });
    if (!targetUser) {
      return res.status(404).json({ message: "User does not exist" });
    }

    const user = await User.findOne({ clerkId: currentUserId });
    if (!user) return res.status(404).json({ message: "User not found" });

    const existingIndex = user.contacts.findIndex((c) => c.contactUserId === contactUserId);

    if (existingIndex > -1) {
      // Update existing
      user.contacts[existingIndex].savedName = savedName.trim();
      user.contacts[existingIndex].email = email?.trim() || "";
      user.contacts[existingIndex].phoneNumber = phoneNumber?.trim() || "";
    } else {
      // Add new contact
      user.contacts.push({
        contactUserId,
        savedName: savedName.trim(),
        email: email?.trim() || "",
        phoneNumber: phoneNumber?.trim() || "",
        savedAt: new Date(),
      });
    }

    await user.save();

    return res.status(200).json({
      success: true,
      message: "Contact saved successfully",
      contact: {
        contactUserId,
        savedName: savedName.trim(),
        email: email || targetUser.email,
        phoneNumber,
        username: targetUser.username,
        avatarUrl: targetUser.avatarUrl,
      },
    });
  } catch (error) {
    console.error("Error saving contact:", error);
    return res.status(500).json({ message: "Failed to save contact" });
  }
};

/**
 * DELETE /api/contacts/:contactUserId
 * Removes a contact from the address book
 */
export const deleteContact = async (req: Request, res: Response) => {
  const currentUserId = (req as any).auth.userId;
  const { contactUserId } = req.params;

  try {
    await User.findOneAndUpdate(
      { clerkId: currentUserId },
      { $pull: { contacts: { contactUserId } } }
    );

    return res.status(200).json({ success: true, message: "Contact removed" });
  } catch (error) {
    return res.status(500).json({ message: "Failed to remove contact" });
  }
};
```

### 3.2 Restrict Group Creation to Saved Contacts Only

Enforce that every member added to a group exists within the creator's saved contacts list:

```typescript
// Inside server/src/controllers/groupController.ts
export const createGroupConversation = async (req: Request, res: Response) => {
  const currentUserId = (req as any).auth.userId;
  const { name, participantIds } = req.body; // participantIds = array of clerkIds

  try {
    const user = await User.findOne({ clerkId: currentUserId });
    if (!user) return res.status(404).json({ message: "User not found" });

    const savedContactIds = new Set(user.contacts.map((c) => c.contactUserId));

    // VALIDATION: Ensure all added participants are in user's saved contacts
    const unauthorizedUsers = participantIds.filter(
      (id: string) => id !== currentUserId && !savedContactIds.has(id)
    );

    if (unauthorizedUsers.length > 0) {
      return res.status(403).json({
        message: "Only saved contacts can be added to groups. Please add the user to your contacts first.",
        invalidUserIds: unauthorizedUsers,
      });
    }

    // Proceed with group creation...
  } catch (error) {
    return res.status(500).json({ message: "Failed to create group" });
  }
};
```

## 4. Frontend Implementation (React 19 + TypeScript)

### 4.1 Zustand Contact Store (`client/src/store/contactStore.ts`)

```typescript
// client/src/store/contactStore.ts
import { create } from "zustand";
import axios from "axios";

export interface Contact {
  _id?: string;
  contactUserId: string;
  savedName: string;
  email?: string;
  phoneNumber?: string;
  username: string;
  avatarUrl?: string;
  about?: string;
}

interface ContactState {
  contacts: Contact[];
  isLoading: boolean;
  isAddContactModalOpen: boolean;
  selectedContactForEdit: Partial<Contact> | null;
  fetchContacts: () => Promise<void>;
  openAddContactModal: (initialData?: Partial<Contact>) => void;
  closeAddContactModal: () => void;
  isContactSaved: (userId: string) => boolean;
  getContactDisplayName: (userId: string, defaultName?: string) => string;
}

export const useContactStore = create<ContactState>((set, get) => ({
  contacts: [],
  isLoading: false,
  isAddContactModalOpen: false,
  selectedContactForEdit: null,

  fetchContacts: async () => {
    set({ isLoading: true });
    try {
      const res = await axios.get("/api/contacts");
      if (res.data.success) {
        set({ contacts: res.data.contacts });
      }
    } catch (err) {
      console.error("Failed to load contacts", err);
    } finally {
      set({ isLoading: false });
    }
  },

  openAddContactModal: (initialData) =>
    set({ isAddContactModalOpen: true, selectedContactForEdit: initialData || null }),

  closeAddContactModal: () =>
    set({ isAddContactModalOpen: false, selectedContactForEdit: null }),

  isContactSaved: (userId: string) => {
    return get().contacts.some((c) => c.contactUserId === userId);
  },

  getContactDisplayName: (userId: string, defaultName: string = "User") => {
    const contact = get().contacts.find((c) => c.contactUserId === userId);
    return contact ? contact.savedName : defaultName;
  },
}));
```

### 4.2 Full-Screen "New Conversation" Modal with Direct Add Contact Button (`client/src/components/chat/NewConversationFullScreen.tsx`)

Replaces the small card dialog with a modern, full-screen glassmorphism overlay matching `#13141d` and `#0066ff`, providing both an **Add Contact** and **Start Chat** button on each search result item:

```tsx
// client/src/components/chat/NewConversationFullScreen.tsx
import React, { useState, useEffect } from "react";
import { Search, X, User, MessageSquare, Sparkles, UserPlus, Check } from "lucide-react";
import axios from "axios";
import { useContactStore } from "../../store/contactStore";

interface NewConversationFullScreenProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectUserToChat: (targetUser: any) => void;
}

export const NewConversationFullScreen: React.FC<NewConversationFullScreenProps> = ({
  isOpen,
  onClose,
  onSelectUserToChat,
}) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  const { isContactSaved, openAddContactModal } = useContactStore();

  // Debounced search by username
  useEffect(() => {
    if (!searchTerm.trim()) {
      setResults([]);
      setIsSearching(false);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const res = await axios.get(`/api/users/search?q=${encodeURIComponent(searchTerm)}`);
        setResults(res.data.users || []);
      } catch (err) {
        console.error("User search failed", err);
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchTerm]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[#13141d]/95 backdrop-blur-xl animate-in fade-in duration-200">
      {/* Top Header */}
      <div className="h-20 border-b border-white/[0.06] px-8 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-2xl bg-[#0066ff]/10 text-[#0066ff] border border-[#0066ff]/20">
            <MessageSquare size={22} />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white tracking-tight">New Conversation</h2>
            <p className="text-xs text-slate-400">Search anyone on Echo by their unique username</p>
          </div>
        </div>

        <button
          onClick={onClose}
          className="p-2.5 rounded-full text-slate-400 hover:text-white hover:bg-white/[0.06] transition-colors"
        >
          <X size={22} />
        </button>
      </div>

      {/* Main Search Content Area */}
      <div className="flex-1 max-w-3xl w-full mx-auto px-6 py-10 flex flex-col">
        {/* Search Input Box */}
        <div className="relative w-full">
          <Search size={20} className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Type a unique username to search..."
            autoFocus
            className="w-full h-14 pl-14 pr-5 rounded-2xl bg-[#171824] border border-white/[0.08] text-white placeholder-slate-500 text-sm focus:outline-none focus:border-[#0066ff] focus:ring-4 focus:ring-[#0066ff]/10 transition-all shadow-xl"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm("")}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white text-xs"
            >
              Clear
            </button>
          )}
        </div>

        {/* Results / Empty States */}
        <div className="flex-1 mt-6 overflow-y-auto space-y-2.5">
          {isSearching ? (
            <div className="text-center py-16 text-xs text-slate-500 animate-pulse">
              Searching directory...
            </div>
          ) : results.length > 0 ? (
            results.map((user) => {
              const alreadySaved = isContactSaved(user.clerkId);

              return (
                <div
                  key={user.clerkId}
                  className="flex items-center justify-between p-4 rounded-2xl bg-[#171824]/60 hover:bg-[#171824] border border-white/[0.04] hover:border-[#0066ff]/30 transition-all shadow-md group"
                >
                  {/* Left: Avatar & Username info */}
                  <div className="flex items-center gap-4 min-w-0">
                    <div className="w-12 h-12 rounded-full bg-slate-800 border border-white/10 flex items-center justify-center overflow-hidden flex-shrink-0">
                      {user.avatarUrl ? (
                        <img src={user.avatarUrl} alt={user.username} className="w-full h-full object-cover" />
                      ) : (
                        <User size={20} className="text-slate-400" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-semibold text-white truncate">
                          @{user.username}
                        </h3>
                        {alreadySaved && (
                          <span className="flex items-center gap-1 text-[10px] font-medium text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                            <Check size={10} />
                            Contact
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-400 line-clamp-1 mt-0.5">
                        {user.about || "Hey there! I am using Echo."}
                      </p>
                    </div>
                  </div>

                  {/* Right: Actions (Add to Contact + Start Chat) */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {!alreadySaved && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          openAddContactModal({
                            contactUserId: user.clerkId,
                            username: user.username,
                            savedName: user.username,
                            email: user.email || "",
                            phoneNumber: user.phoneNumber || "",
                          });
                        }}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium bg-white/[0.06] hover:bg-white/[0.12] text-slate-200 hover:text-white transition-colors border border-white/[0.08]"
                        title="Save to contacts"
                      >
                        <UserPlus size={14} className="text-[#0066ff]" />
                        <span>Add Contact</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => {
                        onSelectUserToChat(user);
                        onClose();
                      }}
                      className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-[#0066ff] hover:bg-[#0052cc] text-white transition-all shadow-md shadow-[#0066ff]/20 active:scale-95"
                    >
                      <MessageSquare size={13} />
                      <span>Start Chat</span>
                    </button>
                  </div>
                </div>
              );
            })
          ) : searchTerm ? (
            <div className="text-center py-16">
              <p className="text-sm font-medium text-white">No user found with @{searchTerm}</p>
              <p className="text-xs text-slate-400 mt-1">Make sure the username is spelled correctly</p>
            </div>
          ) : (
            <div className="text-center py-20 text-slate-500">
              <Sparkles className="mx-auto mb-3 h-8 w-8 text-[#0066ff]/40" />
              <p className="text-sm">Find friends and colleagues by typing their exact username above</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
```

### 4.3 Unsaved Contact Banner (`client/src/components/chat/UnsavedContactBanner.tsx`)

Rendered at the top of the chat area right below the header:

```tsx
// client/src/components/chat/UnsavedContactBanner.tsx
import React from "react";
import { UserPlus, Ban, AlertCircle } from "lucide-react";
import { useContactStore } from "../../store/contactStore";

interface UnsavedContactBannerProps {
  participant: {
    clerkId: string;
    username: string;
    email?: string;
    phoneNumber?: string;
  };
  onBlock: () => void;
}

export const UnsavedContactBanner: React.FC<UnsavedContactBannerProps> = ({
  participant,
  onBlock,
}) => {
  const { isContactSaved, openAddContactModal } = useContactStore();

  // If already saved in contacts, render nothing
  if (isContactSaved(participant.clerkId)) {
    return null;
  }

  return (
    <div className="w-full bg-[#171824]/90 border-b border-amber-500/20 px-6 py-2.5 flex items-center justify-between backdrop-blur-md animate-in slide-in-from-top duration-200 z-10">
      <div className="flex items-center gap-2.5">
        <AlertCircle size={16} className="text-amber-400 flex-shrink-0" />
        <span className="text-xs text-slate-300">
          <strong className="text-white">@{participant.username}</strong> is not in your contacts.
        </span>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={onBlock}
          className="px-3 py-1 rounded-lg text-xs font-medium text-rose-400 hover:bg-rose-500/10 transition-colors flex items-center gap-1.5"
        >
          <Ban size={13} />
          <span>Block</span>
        </button>

        <button
          onClick={() =>
            openAddContactModal({
              contactUserId: participant.clerkId,
              username: participant.username,
              savedName: participant.username,
              email: participant.email || "",
              phoneNumber: participant.phoneNumber || "",
            })
          }
          className="px-3 py-1 rounded-lg text-xs font-medium bg-[#0066ff] hover:bg-[#0052cc] text-white transition-colors flex items-center gap-1.5 shadow-md shadow-[#0066ff]/20"
        >
          <UserPlus size={13} />
          <span>Add to Contacts</span>
        </button>
      </div>
    </div>
  );
};
```

### 4.4 Save Contact Side Drawer / Modal (`client/src/components/contacts/SaveContactModal.tsx`)

Collects custom display name, email, and phone number:

```tsx
// client/src/components/contacts/SaveContactModal.tsx
import React, { useState, useEffect } from "react";
import { X, UserPlus, Mail, Phone, UserCheck, Sparkles } from "lucide-react";
import axios from "axios";
import { useContactStore } from "../../store/contactStore";

export const SaveContactModal: React.FC = () => {
  const {
    isAddContactModalOpen,
    selectedContactForEdit,
    closeAddContactModal,
    fetchContacts,
  } = useContactStore();

  const [savedName, setSavedName] = useState("");
  const [email, setEmail] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (selectedContactForEdit) {
      setSavedName(selectedContactForEdit.savedName || selectedContactForEdit.username || "");
      setEmail(selectedContactForEdit.email || "");
      setPhoneNumber(selectedContactForEdit.phoneNumber || "");
      setError(null);
    }
  }, [selectedContactForEdit]);

  if (!isAddContactModalOpen || !selectedContactForEdit) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!savedName.trim()) {
      setError("Please enter a name for this contact.");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      await axios.post("/api/contacts", {
        contactUserId: selectedContactForEdit.contactUserId,
        savedName: savedName.trim(),
        email: email.trim(),
        phoneNumber: phoneNumber.trim(),
      });

      await fetchContacts(); // Refresh contact cache
      closeAddContactModal();
    } catch (err: any) {
      setError(err.response?.data?.message || "Failed to save contact");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-150">
      <div className="w-full max-w-md rounded-2xl bg-[#171824] border border-white/[0.08] shadow-2xl p-6 text-left">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-white/[0.06]">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-[#0066ff]/10 text-[#0066ff]">
              <UserPlus size={18} />
            </div>
            <div>
              <h3 className="text-base font-semibold text-white">Save to Contacts</h3>
              <p className="text-xs text-slate-400">@{selectedContactForEdit.username}</p>
            </div>
          </div>
          <button onClick={closeAddContactModal} className="text-slate-400 hover:text-white">
            <X size={18} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          {error && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs">
              {error}
            </div>
          )}

          {/* Contact Display Name */}
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              Contact Name <span className="text-rose-400">*</span>
            </label>
            <div className="relative">
              <UserCheck size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="text"
                value={savedName}
                onChange={(e) => setSavedName(e.target.value)}
                placeholder="e.g. Aayush Colleague"
                className="w-full h-11 pl-10 pr-3.5 rounded-xl bg-[#13141d] border border-white/[0.08] text-white text-xs placeholder-slate-500 focus:outline-none focus:border-[#0066ff]"
                autoFocus
              />
            </div>
          </div>

          {/* Email Address */}
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">Email Address</label>
            <div className="relative">
              <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@example.com"
                className="w-full h-11 pl-10 pr-3.5 rounded-xl bg-[#13141d] border border-white/[0.08] text-white text-xs placeholder-slate-500 focus:outline-none focus:border-[#0066ff]"
              />
            </div>
          </div>

          {/* Phone Number */}
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">Phone Number</label>
            <div className="relative">
              <Phone size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="tel"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                placeholder="+1 (555) 000-0000"
                className="w-full h-11 pl-10 pr-3.5 rounded-xl bg-[#13141d] border border-white/[0.08] text-white text-xs placeholder-slate-500 focus:outline-none focus:border-[#0066ff]"
              />
            </div>
          </div>

          {/* Actions */}
          <div className="mt-6 flex items-center justify-end gap-2.5 pt-2">
            <button
              type="button"
              onClick={closeAddContactModal}
              className="px-4 py-2 rounded-xl text-xs font-medium text-slate-300 hover:text-white hover:bg-white/[0.05] transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 rounded-xl text-xs font-semibold bg-[#0066ff] hover:bg-[#0052cc] text-white transition-all shadow-lg shadow-[#0066ff]/25 disabled:opacity-50"
            >
              {isSubmitting ? "Saving..." : "Save Contact"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
```

### 4.5 Group Creation Modal Filtered by Saved Contacts

When creating a group, source members **only** from `contacts`:

```tsx
// client/src/components/chat/CreateGroupModal.tsx
import React, { useState } from "react";
import { useContactStore } from "../../store/contactStore";
import { Users, Check } from "lucide-react";

export const CreateGroupModal = ({ isOpen, onClose, onCreateGroup }: any) => {
  const { contacts } = useContactStore(); // Only saved contacts
  const [groupName, setGroupName] = useState("");
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);

  if (!isOpen) return null;

  const toggleSelect = (userId: string) => {
    setSelectedUserIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-md bg-[#171824] rounded-2xl p-6 border border-white/[0.08]">
        <h3 className="text-base font-semibold text-white mb-4">Create New Group</h3>

        <input
          type="text"
          placeholder="Group Subject / Name"
          value={groupName}
          onChange={(e) => setGroupName(e.target.value)}
          className="w-full h-11 px-3.5 mb-4 rounded-xl bg-[#13141d] border border-white/10 text-xs text-white"
        />

        <p className="text-xs font-medium text-slate-400 mb-2">Select Members from Contacts:</p>
        
        {/* Contacts Only List */}
        <div className="max-h-56 overflow-y-auto space-y-1">
          {contacts.length === 0 ? (
            <p className="text-xs text-slate-500 py-4 text-center">
              No saved contacts yet. Add contacts before creating a group!
            </p>
          ) : (
            contacts.map((contact) => {
              const isSelected = selectedUserIds.includes(contact.contactUserId);
              return (
                <div
                  key={contact.contactUserId}
                  onClick={() => toggleSelect(contact.contactUserId)}
                  className={`flex items-center justify-between p-2.5 rounded-xl cursor-pointer transition-colors ${
                    isSelected ? "bg-[#0066ff]/15 border border-[#0066ff]/30" : "hover:bg-white/[0.04]"
                  }`}
                >
                  <div>
                    <p className="text-xs font-medium text-white">{contact.savedName}</p>
                    <p className="text-[10px] text-slate-400">@{contact.username}</p>
                  </div>
                  <div className={`w-5 h-5 rounded-md flex items-center justify-center border ${
                    isSelected ? "bg-[#0066ff] border-[#0066ff]" : "border-white/20"
                  }`}>
                    {isSelected && <Check size={12} className="text-white" />}
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <button onClick={onClose} className="px-3 py-1.5 text-xs text-slate-400">Cancel</button>
          <button
            disabled={!groupName.trim() || selectedUserIds.length === 0}
            onClick={() => onCreateGroup(groupName, selectedUserIds)}
            className="px-4 py-1.5 rounded-xl text-xs bg-[#0066ff] text-white disabled:opacity-40"
          >
            Create
          </button>
        </div>
      </div>
    </div>
  );
};
```

## 5. Agent Verification Checklist

* [ ] **Modal Redesign:**
  * [ ] Replaced small card with `NewConversationFullScreen.tsx` covering viewport in `#13141d` dark navy.
  * [ ] Removed the "Group Chat" toggle completely from this dialog.
  * [ ] Debounced search query fires against `/api/users/search?q=...` by username.
  * [ ] **Search Result Actions:** Search cards display both an **"Add Contact"** button (with status check for already saved contacts) and a **"Start Chat"** button.
* [ ] **Contact Persistence & Schema:**
  * [ ] Updated User model with `contacts` array storing `contactUserId`, `savedName`, `email`, and `phoneNumber`.
  * [ ] Implemented `GET /api/contacts` and `POST /api/contacts`.
* [ ] **Unsaved Warning Banner:**
  * [ ] Renders `UnsavedContactBanner.tsx` at the top of direct chats if `isContactSaved(targetId)` returns `false`.
  * [ ] Clicking "Add to Contacts" opens `SaveContactModal.tsx` pre-filled with username.
  * [ ] Once saved, the banner disappears immediately and the updated custom name reflects across the app.
* [ ] **Group Creation Restriction:**
  * [ ] Member selection inside `CreateGroupModal` displays **only saved contacts**.
  * [ ] Server-side endpoint checks that all `participantIds` exist in creator's `contacts` before persisting the group.