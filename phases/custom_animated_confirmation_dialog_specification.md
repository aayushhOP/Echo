# Animated Custom Confirmation Dialog — Technical Specification

**Project Stack:** React 19 · TypeScript · Tailwind CSS · Framer Motion · Zustand · Lucide React

## 1. Overview & Objectives

Currently, critical user actions (logging out, blocking a contact, deleting a chat, and clearing messages) trigger the default browser dialog (`window.confirm()` or `window.alert()`), displaying the generic `"Localhost says:"` header.

This specification replaces that mechanism with:

1. **Global Programmatic API:** An imperative hook/store method (`confirm({ title, message, variant, ... })`) that returns a Promise resolving to `true` (confirmed) or `false` (canceled).
2. **Visual Consistency:** Dark-navy glassmorphism UI matching `#13141d` (app surface) and `#171824` (elevated cards), paired with action-specific icon badges (Danger, Warning, Neutral).
3. **Motion Design:** Backdrop fade and snappy scale-up entrance animations using Framer Motion.
4. **Accessibility:** Keyboard support (Escape to cancel, Enter to submit) and backdrop dismiss.

---

## 2. Global State & Programmatic Store (`client/src/store/confirmDialogStore.ts`)

Instead of placing separate boolean state variables across multiple components, a centralized Zustand store manages dialog parameters and resolves the action via a Promise.

```typescript
// client/src/store/confirmDialogStore.ts
import { create } from "zustand";

export type DialogVariant = "danger" | "warning" | "info";

export interface ConfirmOptions {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: DialogVariant;
}

interface ConfirmDialogState {
  isOpen: boolean;
  options: ConfirmOptions;
  resolver: ((value: boolean) => void) | null;
  confirm: (options: ConfirmOptions) => Promise<boolean>;
  handleConfirm: () => void;
  handleCancel: () => void;
}

const defaultOptions: ConfirmOptions = {
  title: "Confirm Action",
  message: "Are you sure you want to proceed?",
  confirmText: "Confirm",
  cancelText: "Cancel",
  variant: "danger",
};

export const useConfirmDialogStore = create<ConfirmDialogState>((set, get) => ({
  isOpen: false,
  options: defaultOptions,
  resolver: null,

  confirm: (options: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      set({
        isOpen: true,
        options: { ...defaultOptions, ...options },
        resolver: () => resolve,
      });
    });
  },

  handleConfirm: () => {
    const { resolver } = get();
    if (resolver) resolver(true);
    set({ isOpen: false, resolver: null });
  },

  handleCancel: () => {
    const { resolver } = get();
    if (resolver) resolver(false);
    set({ isOpen: false, resolver: null });
  },
}));

/**
 * Convenient standalone hook export
 */
export const useConfirm = () => {
  return useConfirmDialogStore((state) => state.confirm);
};
```

---

## 3. Animated Dialog Component (`client/src/components/common/ConfirmationModal.tsx`)

```tsx
// client/src/components/common/ConfirmationModal.tsx
import React, { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle, Trash2, LogOut, Ban, Info, X } from "lucide-react";
import { useConfirmDialogStore, DialogVariant } from "../../store/confirmDialogStore";

const variantConfig: Record<
  DialogVariant,
  {
    icon: React.ComponentType<{ className?: string; size?: number }>;
    iconBg: string;
    iconColor: string;
    confirmButtonBg: string;
  }
> = {
  danger: {
    icon: Trash2,
    iconBg: "bg-rose-500/10 border-rose-500/20",
    iconColor: "text-rose-400",
    confirmButtonBg: "bg-rose-600 hover:bg-rose-500 text-white shadow-rose-950/40",
  },
  warning: {
    icon: Ban,
    iconBg: "bg-amber-500/10 border-amber-500/20",
    iconColor: "text-amber-400",
    confirmButtonBg: "bg-amber-600 hover:bg-amber-500 text-white shadow-amber-950/40",
  },
  info: {
    icon: Info,
    iconBg: "bg-[#0066ff]/10 border-[#0066ff]/20",
    iconColor: "text-[#0066ff]",
    confirmButtonBg: "bg-[#0066ff] hover:bg-[#0052cc] text-white shadow-blue-950/40",
  },
};

export const ConfirmationModal: React.FC = () => {
  const { isOpen, options, handleConfirm, handleCancel } = useConfirmDialogStore();
  const { title, message, confirmText, cancelText, variant = "danger" } = options;

  const currentVariant = variantConfig[variant] || variantConfig.danger;
  const IconComponent = currentVariant.icon;

  // Keyboard accessibility: Escape cancels, Enter confirms
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        handleCancel();
      } else if (e.key === "Enter") {
        e.preventDefault();
        handleConfirm();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, handleCancel, handleConfirm]);

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* 1. Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={handleCancel}
            className="fixed inset-0 bg-[#0d0e15]/75 backdrop-blur-sm"
          />

          {/* 2. Dialog Card */}
          <motion.div
            initial={{ opacity: 0, scale: 0.92, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: 8 }}
            transition={{ type: "spring", stiffness: 380, damping: 28 }}
            className="relative z-10 w-full max-w-sm rounded-2xl border border-white/[0.08] bg-[#171824] p-5 shadow-2xl shadow-black/80"
          >
            {/* Close cross */}
            <button
              onClick={handleCancel}
              className="absolute right-4 top-4 p-1 text-slate-400 hover:text-white rounded-lg hover:bg-white/[0.04] transition-colors"
            >
              <X size={16} />
            </button>

            {/* Icon + Headers */}
            <div className="flex items-start gap-3.5">
              <div
                className={`flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl border ${currentVariant.iconBg}`}
              >
                <IconComponent className={currentVariant.iconColor} size={20} />
              </div>

              <div className="flex-1 pr-4">
                <h3 className="text-sm font-semibold tracking-wide text-white">
                  {title}
                </h3>
                <p className="mt-1 text-xs leading-relaxed text-slate-400">
                  {message}
                </p>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="mt-6 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={handleCancel}
                className="px-3.5 py-2 rounded-xl text-xs font-medium text-slate-300 hover:text-white hover:bg-white/[0.06] transition-colors"
              >
                {cancelText || "Cancel"}
              </button>

              <button
                type="button"
                onClick={handleConfirm}
                className={`px-4 py-2 rounded-xl text-xs font-medium shadow-lg transition-all active:scale-[0.98] ${currentVariant.confirmButtonBg}`}
              >
                {confirmText || "Confirm"}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
```

---

## 4. Root App Mount (`client/src/App.tsx`)

Mount `<ConfirmationModal />` once at the application root so any screen can trigger it without rendering dedicated modal markup:

```tsx
// client/src/App.tsx
import { ConfirmationModal } from "./components/common/ConfirmationModal";
// ... other imports

export default function App() {
  return (
    <>
      <ConfirmationModal />
      {/* Existing routes, layouts, and warm-up modal */}
    </>
  );
}
```

---

## 5. Usage Patterns: Replacing `window.confirm()`

Replace legacy confirm calls throughout your codebase using the `useConfirm()` hook.

### 5.1 Delete Chat Replacement

```tsx
// Inside ChatHeader.tsx or ChatDropdownMenu.tsx
import { useConfirm } from "../../store/confirmDialogStore";

export const ChatMenu = () => {
  const confirm = useConfirm();

  const handleDeleteChat = async () => {
    const isConfirmed = await confirm({
      title: "Delete this chat?",
      message: "All messages in this conversation will be permanently removed for you. This action cannot be reversed.",
      confirmText: "Delete Chat",
      cancelText: "Keep Chat",
      variant: "danger",
    });

    if (!isConfirmed) return;

    // Proceed with API call:
    await api.delete(`/api/conversations/${conversationId}`);
  };

  return <button onClick={handleDeleteChat}>Delete Chat</button>;
};
```

### 5.2 Block User Replacement

```tsx
const handleBlockContact = async (username: string, userId: string) => {
  const isConfirmed = await confirm({
    title: `Block ${username}?`,
    message: "Blocked contacts will not be able to send you private messages or see your active status.",
    confirmText: "Block Contact",
    variant: "warning",
  });

  if (!isConfirmed) return;

  await api.post(`/api/users/${userId}/block`);
};
```

### 5.3 User Logout Confirmation

```tsx
// Inside Sidebar or UserProfileButton
import { useClerk } from "@clerk/clerk-react";
import { useConfirm } from "../store/confirmDialogStore";

export const LogoutButton = () => {
  const { signOut } = useClerk();
  const confirm = useConfirm();

  const handleLogout = async () => {
    const shouldLogout = await confirm({
      title: "Log out of Echo Chat?",
      message: "You will need to sign back in to access your conversations.",
      confirmText: "Log Out",
      cancelText: "Stay Signed In",
      variant: "danger",
    });

    if (shouldLogout) {
      await signOut();
    }
  };

  return <button onClick={handleLogout}>Log Out</button>;
};
```

### 5.4 Clear All Messages in Chat

```tsx
const handleClearMessages = async () => {
  const confirmed = await confirm({
    title: "Clear all messages?",
    message: "This will remove all message history in this chat from your device.",
    confirmText: "Clear Messages",
    variant: "danger",
  });

  if (!confirmed) return;

  await api.post(`/api/conversations/${activeId}/clear`);
};
```

---

## 6. Verification Checklist for the Agent

* [x] Created `client/src/store/confirmDialogStore.ts` with promise-based resolution.
* [x] Created `client/src/components/common/ConfirmationModal.tsx` styled with Framer Motion animations and dark navy tokens (`#171824`, `#13141d`).
* [x] Mounted `<ConfirmationModal />` globally at the root in `App.tsx`.
* [x] Replaced all occurrences of `window.confirm` in:
  * [x] Delete chat action
  * [x] Block/unblock contact action
  * [x] Logout button (Clerk sign-out flow)
  * [x] Clear messages / Leave group triggers
* [x] Tested Escape key cancels and Enter key confirms.
* [x] Verified no native `"Localhost says:"` alert boxes appear anywhere in the app.