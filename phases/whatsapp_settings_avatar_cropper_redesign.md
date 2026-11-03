# WhatsApp-Style Settings Architecture & Avatar Cropper — Technical Specification

**Project Stack:** React 19 · TypeScript · Tailwind CSS · Lucide React · Express 5 · Node.js · MongoDB / Mongoose · Multer · Clerk Auth

## 1. Architectural Strategy & Design System

The current settings page is a plain single card containing a raw `"Avatar Image URL"` text input and mixed settings. 

We will transform this into the official WhatsApp Desktop split-view settings system shown in your screenshots:

### 1.1 Visual & Structural Hierarchy

1. **Left Settings Sidebar (Navigation List):**
   * Header: Active user profile card (`Avatar`, `Full Name`, `"What's happening?" / About` status badge).
   * Categorized navigation items with WhatsApp icons:
     * **General:** App startup, preferences, theme mode.
     * **Profile:** Name, Profile picture, Username, About/Bio, Phone number.
     * **Account:** Security, account status.
     * **Privacy:** Blocked contacts directory, unblock actions, last seen & read receipts.
     * **Chats:** Wallpaper customization, clear chat history.
     * **Notifications:** Message tones, group tones, preview alerts, desktop push toggles.
     * **Keyboard shortcuts:** Quick modal overlay.

2. **Right Content Canvas (Category Detail View):**
   * Selecting a category from the left smoothly switches the view on the right.

3. **Avatar Upload & Frame Adjustment Workflow:**
   * **Removal of Raw URL Input:** The `"Avatar Image URL"` input field is removed completely.
   * **Default Fallback:** The avatar automatically defaults to Clerk's profile image or Google email avatar (`user.imageUrl`).
   * **File Ingestion:** Clicking the avatar or camera overlay opens a file picker accepting **strictly `.jpg`, `.jpeg`, and `.png`**. All other MIME types are immediately rejected on client and server.
   * **WhatsApp-Style Adjust Frame Modal:** 
     * Once an image is picked, a crop frame modal opens with a circular aperture overlay.
     * Allows zooming in/out ($+$ / $-$ controls) and dragging the image position ($X/Y$ offset) to adjust framing.
     * Has an upload confirmation button (WhatsApp green checkmark or electric blue button) that crops onto an HTML `<canvas>`, creates a compressed Blob, and uploads via Multer.

---

## 2. Backend Implementation (Express & MongoDB)

### 2.1 Multer Ingestion & Avatar Endpoint (`server/src/controllers/userController.ts`)

Create a dedicated multer instance that enforces image MIME restrictions and limits file size to 5MB:

```typescript
// server/src/middleware/avatarUpload.ts
import multer from "multer";
import path from "path";
import fs from "fs";

const avatarDir = path.join(process.cwd(), "uploads", "avatars");
if (!fs.existsSync(avatarDir)) {
  fs.mkdirSync(avatarDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, avatarDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `avatar-${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`);
  },
});

export const avatarUpload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB max
  fileFilter: (_req, file, cb) => {
    const allowedExtensions = [".jpg", ".jpeg", ".png"];
    const ext = path.extname(file.originalname).toLowerCase();
    const mime = file.mimetype.toLowerCase();

    const isAllowedExt = allowedExtensions.includes(ext);
    const isAllowedMime = ["image/jpeg", "image/jpg", "image/png"].includes(mime);

    if (isAllowedExt && isAllowedMime) {
      cb(null, true);
    } else {
      cb(new Error("Invalid file type. Only JPG, JPEG, and PNG images are permitted."));
    }
  },
}).single("avatar");
```

### 2.2 Profile & Privacy Controller Methods (`server/src/controllers/userController.ts`)

```typescript
// server/src/controllers/userController.ts
import { Request, Response } from "express";
import User from "../models/User";

/**
 * POST /api/users/profile/avatar
 * Uploads custom cropped profile picture
 */
export const updateAvatar = async (req: Request, res: Response) => {
  const currentUserId = (req as any).auth.userId;

  try {
    if (!req.file) {
      return res.status(400).json({ message: "No avatar image uploaded" });
    }

    const avatarUrl = `/uploads/avatars/${req.file.filename}`;

    const updatedUser = await User.findOneAndUpdate(
      { clerkId: currentUserId },
      { $set: { avatarUrl } },
      { new: true }
    );

    return res.status(200).json({
      success: true,
      avatarUrl: updatedUser?.avatarUrl,
      message: "Avatar updated successfully",
    });
  } catch (error) {
    console.error("Avatar update failed:", error);
    return res.status(500).json({ message: "Failed to update profile picture" });
  }
};

/**
 * GET /api/users/privacy/blocked-contacts
 * Returns detailed profiles for all blocked users
 */
export const getBlockedContacts = async (req: Request, res: Response) => {
  const currentUserId = (req as any).auth.userId;

  try {
    const user = await User.findOne({ clerkId: currentUserId }).select("blockedUsers");
    if (!user) return res.status(404).json({ message: "User not found" });

    const blockedList = await User.find({ clerkId: { $in: user.blockedUsers } })
      .select("clerkId username avatarUrl about");

    return res.status(200).json({ success: true, blockedContacts: blockedList });
  } catch (error) {
    return res.status(500).json({ message: "Failed to fetch blocked contacts" });
  }
};

/**
 * PATCH /api/users/profile/details
 * Update bio/status, phone, or custom display name
 */
export const updateProfileDetails = async (req: Request, res: Response) => {
  const currentUserId = (req as any).auth.userId;
  const { about, phoneNumber } = req.body;

  try {
    const updated = await User.findOneAndUpdate(
      { clerkId: currentUserId },
      { $set: { about: about?.trim(), phoneNumber: phoneNumber?.trim() } },
      { new: true }
    );

    return res.status(200).json({ success: true, user: updated });
  } catch (error) {
    return res.status(500).json({ message: "Failed to update profile details" });
  }
};
```

Mount in `server/src/routes/users.ts`:
```typescript
import { Router } from "express";
import { avatarUpload } from "../middleware/avatarUpload";
import {
  updateAvatar,
  getBlockedContacts,
  updateProfileDetails,
} from "../controllers/userController";

const router = Router();

router.post("/profile/avatar", avatarUpload, updateAvatar);
router.patch("/profile/details", updateProfileDetails);
router.get("/privacy/blocked-contacts", getBlockedContacts);

export default router;
```

---

## 3. WhatsApp-Style Avatar Cropping Frame Modal

This component replicates the circular image positioner shown in your screenshot (`image_a3feee.jpg`), with zoom slider controls, click-and-drag panning, and a canvas export to PNG.

### `client/src/components/settings/AvatarCropModal.tsx`

```tsx
import React, { useState, useRef, useEffect, useCallback } from "react";
import { X, Check, Plus, Minus, RotateCcw } from "lucide-react";

interface AvatarCropModalProps {
  imageSrc: string | null;
  isOpen: boolean;
  onClose: () => void;
  onCropComplete: (croppedBlob: Blob) => Promise<void>;
}

export const AvatarCropModal: React.FC<AvatarCropModalProps> = ({
  imageSrc,
  isOpen,
  onClose,
  onCropComplete,
}) => {
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [isUploading, setIsUploading] = useState(false);

  const imageRef = useRef<HTMLImageElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      setScale(1);
      setPosition({ x: 0, y: 0 });
    }
  }, [isOpen, imageSrc]);

  if (!isOpen || !imageSrc) return null;

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    setPosition({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y,
    });
  };

  const handleMouseUp = () => setIsDragging(false);

  const zoomIn = () => setScale((prev) => Math.min(prev + 0.15, 3));
  const zoomOut = () => setScale((prev) => Math.max(prev - 0.15, 0.6));

  const handleExportCropped = async () => {
    if (!imageRef.current) return;
    setIsUploading(true);

    try {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      const cropSize = 320; // 320x320 export resolution

      canvas.width = cropSize;
      canvas.height = cropSize;

      if (!ctx) return;

      // Circular clipping path
      ctx.beginPath();
      ctx.arc(cropSize / 2, cropSize / 2, cropSize / 2, 0, Math.PI * 2);
      ctx.closePath();
      ctx.clip();

      const img = imageRef.current;
      const naturalAspect = img.naturalWidth / img.naturalHeight;
      let renderWidth = cropSize * scale;
      let renderHeight = (cropSize / naturalAspect) * scale;

      const drawX = (cropSize - renderWidth) / 2 + position.x;
      const drawY = (cropSize - renderHeight) / 2 + position.y;

      ctx.drawImage(img, drawX, drawY, renderWidth, renderHeight);

      canvas.toBlob((blob) => {
        if (blob) {
          onCropComplete(blob).finally(() => {
            setIsUploading(false);
            onClose();
          });
        }
      }, "image/png", 0.95);
    } catch (err) {
      console.error("Cropping failed", err);
      setIsUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-150">
      <div className="relative w-full max-w-lg rounded-2xl bg-[#171824] border border-white/[0.08] shadow-2xl overflow-hidden">
        
        {/* Top Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.06]">
          <div className="flex items-center gap-3">
            <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
              <X size={18} />
            </button>
            <h3 className="text-sm font-semibold text-white">Drag the image to adjust</h3>
          </div>
          <button
            onClick={() => { setScale(1); setPosition({ x: 0, y: 0 }); }}
            className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white"
          >
            <RotateCcw size={14} />
            <span>Reset</span>
          </button>
        </div>

        {/* Viewport & Circular Aperture Mask */}
        <div
          ref={containerRef}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          className="relative w-full h-80 bg-[#0d0e15] overflow-hidden flex items-center justify-center cursor-move select-none"
        >
          {/* User Image undergoing transform */}
          <img
            ref={imageRef}
            src={imageSrc}
            alt="Crop candidate"
            draggable={false}
            style={{
              transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
              transition: isDragging ? "none" : "transform 0.1s ease-out",
            }}
            className="max-w-none max-h-none pointer-events-none"
          />

          {/* WhatsApp Circular Aperture Overlay */}
          <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
            {/* Dark Mask with circular knockout */}
            <div 
              className="w-full h-full"
              style={{
                background: "radial-gradient(circle 120px at center, transparent 120px, rgba(13, 14, 21, 0.75) 121px)",
                border: "1px solid rgba(255, 255, 255, 0.08)"
              }}
            />
            {/* Circular Border Ring */}
            <div className="absolute w-60 h-60 rounded-full border-2 border-[#0066ff] shadow-2xl" />
          </div>

          {/* Zoom Controls floating on right */}
          <div className="absolute right-4 top-1/2 -translate-y-1/2 flex flex-col gap-2 bg-[#171824]/90 border border-white/10 rounded-xl p-1 backdrop-blur-md shadow-lg">
            <button onClick={zoomIn} className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-white/[0.08]">
              <Plus size={16} />
            </button>
            <div className="h-px bg-white/10 mx-1" />
            <button onClick={zoomOut} className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-white/[0.08]">
              <Minus size={16} />
            </button>
          </div>
        </div>

        {/* Bottom Actions */}
        <div className="flex items-center justify-between px-6 py-4 bg-[#13141d] border-t border-white/[0.06]">
          <span className="text-xs text-slate-400">Position and frame your profile avatar</span>

          <button
            disabled={isUploading}
            onClick={handleExportCropped}
            className="flex items-center justify-center w-11 h-11 rounded-full bg-emerald-500 hover:bg-emerald-400 text-white shadow-lg shadow-emerald-950/40 transition-transform active:scale-95 disabled:opacity-50"
            title="Apply profile picture"
          >
            <Check size={20} strokeWidth={2.5} />
          </button>
        </div>
      </div>
    </div>
  );
};
```

---

## 4. Redesigned Settings Panel Architecture

Replicate the multi-panel WhatsApp layout (`client/src/pages/SettingsPage.tsx`).

### `client/src/pages/SettingsPage.tsx`

```tsx
import React, { useState, useRef, useEffect } from "react";
import { useUser } from "@clerk/clerk-react";
import { 
  Laptop, 
  User, 
  KeyRound, 
  Lock, 
  MessageSquare, 
  Video, 
  Bell, 
  Keyboard, 
  Camera, 
  Trash2, 
  Check, 
  ChevronRight,
  ShieldCheck,
  Ban
} from "lucide-react";
import axios from "axios";
import { AvatarCropModal } from "../components/settings/AvatarCropModal";
import { notificationService } from "../services/notificationService";

type SettingsTab = "profile" | "privacy" | "notifications" | "general" | "chats";

export const SettingsPage: React.FC = () => {
  const { user } = useUser();
  const [activeTab, setActiveTab] = useState<SettingsTab>("profile");

  // Profile Form States
  const [about, setAbout] = useState("Hey there! I am using Echo.");
  const [phoneNumber, setPhoneNumber] = useState("+91 98765 43210");
  const [avatarPreview, setAvatarPreview] = useState<string>(user?.imageUrl || "");
  const [selectedCropFile, setSelectedCropFile] = useState<string | null>(null);
  const [isCropOpen, setIsCropOpen] = useState(false);

  // Blocked Contacts State
  const [blockedList, setBlockedList] = useState<any[]>([]);

  // Notifications State
  const [desktopEnabled, setDesktopEnabled] = useState(
    typeof window !== "undefined" && "Notification" in window ? Notification.permission === "granted" : false
  );
  const [messageChime, setMessageChime] = useState(true);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // 1. Initial Load
  useEffect(() => {
    if (user) {
      setAvatarPreview(user.imageUrl);
    }
    fetchBlockedUsers();
  }, [user]);

  const fetchBlockedUsers = async () => {
    try {
      const res = await axios.get("/api/users/privacy/blocked-contacts");
      if (res.data.success) {
        setBlockedList(res.data.blockedContacts);
      }
    } catch (err) {
      console.error("Could not fetch blocked users", err);
    }
  };

  // 2. Strict File Picker Ingestion (.jpg, .jpeg, .png only)
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const allowedMime = ["image/jpeg", "image/jpg", "image/png"];
    const fileExt = file.name.slice(file.name.lastIndexOf(".")).toLowerCase();

    if (!allowedMime.includes(file.type) || ![".jpg", ".jpeg", ".png"].includes(fileExt)) {
      alert("Invalid format! Only JPG, JPEG, and PNG images are supported.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setSelectedCropFile(reader.result as string);
      setIsCropOpen(true);
    };
    reader.readAsDataURL(file);

    // Reset input value so same file can be re-selected if cancelled
    e.target.value = "";
  };

  // 3. Upload Cropped Blob
  const handleCropComplete = async (croppedBlob: Blob) => {
    const formData = new FormData();
    formData.append("avatar", croppedBlob, "avatar.png");

    try {
      const res = await axios.post("/api/users/profile/avatar", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      if (res.data.success) {
        setAvatarPreview(res.data.avatarUrl);
      }
    } catch (err) {
      console.error("Failed to upload avatar", err);
    }
  };

  const handleUnblockUser = async (targetUserId: string) => {
    try {
      await axios.post("/api/users/unblock", { targetUserId });
      setBlockedList((prev) => prev.filter((u) => u.clerkId !== targetUserId));
    } catch (err) {
      console.error("Unblock failed", err);
    }
  };

  return (
    <div className="h-full w-full flex bg-[#13141d] text-slate-100 overflow-hidden">
      
      {/* 1. LEFT SIDEBAR: Navigation Menu */}
      <div className="w-80 h-full border-r border-white/[0.06] bg-[#171824]/60 flex flex-col">
        {/* Profile Card Header */}
        <div className="p-6 border-b border-white/[0.06] flex items-center gap-4">
          <div className="relative w-14 h-14 rounded-full overflow-hidden bg-slate-800 border-2 border-white/10 flex-shrink-0">
            <img src={avatarPreview || user?.imageUrl} alt="Avatar" className="w-full h-full object-cover" />
          </div>
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-white truncate">
              {user?.fullName || user?.username || "Aayush Jha"}
            </h2>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              <span className="text-xs text-slate-400 truncate">{about}</span>
            </div>
          </div>
        </div>

        {/* Categories List */}
        <div className="flex-1 overflow-y-auto py-3 space-y-1 px-3">
          {[
            { id: "general", label: "General", desc: "Startup and preferences", icon: Laptop },
            { id: "profile", label: "Profile", desc: "Name, photo, status", icon: User },
            { id: "privacy", label: "Privacy", desc: "Blocked contacts, last seen", icon: Lock },
            { id: "chats", label: "Chats", desc: "Theme, wallpaper, chat history", icon: MessageSquare },
            { id: "notifications", label: "Notifications", desc: "Alerts, tones, previews", icon: Bell },
          ].map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;

            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id as SettingsTab)}
                className={`w-full flex items-center gap-3.5 px-3.5 py-3 rounded-xl text-left transition-all ${
                  isActive
                    ? "bg-[#0066ff]/15 border border-[#0066ff]/30 text-white"
                    : "hover:bg-white/[0.04] text-slate-300"
                }`}
              >
                <Icon size={18} className={isActive ? "text-[#0066ff]" : "text-slate-400"} />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold">{item.label}</p>
                  <p className="text-[11px] text-slate-400 truncate">{item.desc}</p>
                </div>
                <ChevronRight size={14} className="text-slate-500" />
              </button>
            );
          })}
        </div>
      </div>

      {/* 2. RIGHT VIEW: Category Details */}
      <div className="flex-1 h-full overflow-y-auto p-10 bg-[#13141d]">
        <div className="max-w-2xl mx-auto">
          
          {/* TAB 1: PROFILE SETTINGS */}
          {activeTab === "profile" && (
            <div className="space-y-8 animate-in fade-in duration-150">
              <h2 className="text-xl font-bold text-white tracking-wide">Profile Information</h2>

              {/* Avatar Uploader Section */}
              <div className="flex flex-col items-center justify-center p-6 rounded-2xl bg-[#171824] border border-white/[0.06]">
                <div className="relative group cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                  <div className="w-28 h-28 rounded-full overflow-hidden border-4 border-[#0066ff]/20 bg-slate-900 shadow-xl">
                    <img src={avatarPreview || user?.imageUrl} alt="Profile" className="w-full h-full object-cover group-hover:opacity-75 transition-opacity" />
                  </div>
                  {/* Camera overlay hover */}
                  <div className="absolute inset-0 rounded-full flex flex-col items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Camera size={24} className="text-white mb-1" />
                    <span className="text-[10px] text-white font-medium">CHANGE PHOTO</span>
                  </div>
                </div>

                {/* Hidden File Input strictly accepting jpg, jpeg, png */}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/jpg,image/png"
                  onChange={handleFileChange}
                  className="hidden"
                />

                <p className="text-xs text-slate-400 mt-3">Click picture to frame & upload (JPG, JPEG, or PNG)</p>
              </div>

              {/* Profile Fields */}
              <div className="p-6 rounded-2xl bg-[#171824] border border-white/[0.06] space-y-5">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">Username</label>
                  <input
                    type="text"
                    disabled
                    value={user?.username || "aayush"}
                    className="w-full h-11 px-3.5 rounded-xl bg-[#13141d] border border-white/[0.06] text-slate-400 text-xs cursor-not-allowed"
                  />
                  <span className="text-[10px] text-slate-500 mt-1 block">Your unique username cannot be modified</span>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">What's happening? (About / Status)</label>
                  <input
                    type="text"
                    value={about}
                    onChange={(e) => setAbout(e.target.value)}
                    placeholder="Hey there! I am using Echo."
                    className="w-full h-11 px-3.5 rounded-xl bg-[#13141d] border border-white/[0.08] text-white text-xs focus:outline-none focus:border-[#0066ff]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">Phone Number</label>
                  <input
                    type="text"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    className="w-full h-11 px-3.5 rounded-xl bg-[#13141d] border border-white/[0.08] text-white text-xs focus:outline-none focus:border-[#0066ff]"
                  />
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: PRIVACY & BLOCKED CONTACTS */}
          {activeTab === "privacy" && (
            <div className="space-y-6 animate-in fade-in duration-150">
              <h2 className="text-xl font-bold text-white tracking-wide">Privacy Settings</h2>

              <div className="p-6 rounded-2xl bg-[#171824] border border-white/[0.06]">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 rounded-xl bg-rose-500/10 text-rose-400">
                    <Ban size={18} />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-white">Blocked Contacts</h3>
                    <p className="text-xs text-slate-400">{blockedList.length} contacts blocked</p>
                  </div>
                </div>

                <div className="divide-y divide-white/[0.04]">
                  {blockedList.length === 0 ? (
                    <p className="text-xs text-slate-500 py-6 text-center">No blocked contacts.</p>
                  ) : (
                    blockedList.map((contact) => (
                      <div key={contact.clerkId} className="py-3 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-slate-800 border border-white/10 flex items-center justify-center overflow-hidden">
                            {contact.avatarUrl ? (
                              <img src={contact.avatarUrl} alt={contact.username} className="w-full h-full object-cover" />
                            ) : (
                              <span className="text-xs font-semibold text-white">{contact.username.slice(0, 2).toUpperCase()}</span>
                            )}
                          </div>
                          <div>
                            <p className="text-xs font-medium text-white">@{contact.username}</p>
                            <p className="text-[10px] text-slate-400">{contact.about}</p>
                          </div>
                        </div>

                        <button
                          onClick={() => handleUnblockUser(contact.clerkId)}
                          className="px-3 py-1 rounded-lg text-xs font-medium bg-white/[0.06] hover:bg-white/[0.1] text-rose-400 transition-colors"
                        >
                          Unblock
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: NOTIFICATIONS */}
          {activeTab === "notifications" && (
            <div className="space-y-6 animate-in fade-in duration-150">
              <h2 className="text-xl font-bold text-white tracking-wide">Notifications</h2>

              <div className="p-6 rounded-2xl bg-[#171824] border border-white/[0.06] space-y-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-[#0066ff]/10 text-[#0066ff]">
                      <Bell size={18} />
                    </div>
                    <div>
                      <p className="text-xs font-medium text-white">Desktop Notifications</p>
                      <p className="text-[11px] text-slate-400">Show notification banners for incoming messages</p>
                    </div>
                  </div>

                  <button
                    onClick={async () => {
                      const granted = await notificationService.requestDesktopPermission();
                      setDesktopEnabled(granted);
                    }}
                    className={`text-xs px-3.5 py-1.5 rounded-lg font-medium transition-colors ${
                      desktopEnabled
                        ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                        : "bg-[#0066ff] text-white hover:bg-[#0052cc]"
                    }`}
                  >
                    {desktopEnabled ? "Enabled" : "Enable"}
                  </button>
                </div>

                <div className="flex items-center justify-between pt-4 border-t border-white/[0.06]">
                  <div>
                    <p className="text-xs font-medium text-white">Message Sound Chimes</p>
                    <p className="text-[11px] text-slate-400">Play a chime when receiving messages</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={messageChime}
                    onChange={(e) => setMessageChime(e.target.checked)}
                    className="w-4 h-4 rounded text-[#0066ff] bg-[#13141d] border-white/20 focus:ring-0 cursor-pointer"
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 3. Crop Adjustment Modal */}
      <AvatarCropModal
        imageSrc={selectedCropFile}
        isOpen={isCropOpen}
        onClose={() => setIsCropOpen(false)}
        onCropComplete={handleCropComplete}
      />
    </div>
  );
};
```

---

## 5. Verification Checklist for the Agent

* [x] **Elimination of URL Input:** The `"Avatar Image URL"` text field has been completely removed from settings.
* [x] **Email/Clerk Default Image:** Avatars fallback automatically to `user.imageUrl` (the Google/Clerk OAuth profile photo).
* [x] **File Format Filter:**
  * File picker `accept="image/jpeg,image/jpg,image/png"`.
  * Upload handler validates MIME types and file extensions, rejecting non-image payloads.
* [x] **Crop Adjustment Frame (`AvatarCropModal.tsx`):**
  * Opens upon file selection.
  * Allows dragging and zooming ($+$ / $-$ controls) behind a dark circular aperture mask matching WhatsApp's UI.
  * Exports cropped area to HTML `<canvas>` and uploads via `POST /api/users/profile/avatar`.
* [x] **Multi-Panel Split Navigation (`SettingsPage.tsx`):**
  * Left-side navigation with WhatsApp icons (General, Profile, Privacy, Chats, Notifications).
  * Right-side canvas displaying the active section.
* [x] **Privacy & Blocked Contacts:** Displays list of blocked users retrieved from `/api/users/privacy/blocked-contacts` with an "Unblock" button.
* [x] **Notification Center:** Dedicated panel housing desktop push permission requests and audio chime toggles.