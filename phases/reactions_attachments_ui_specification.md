# Message Reactions & Attachments UI — Technical Specification & Handlers

**Project Stack:** React 19 · TypeScript · Socket.IO Client · Tailwind CSS v4 · Axios · Lucide React

**Target Features:**
1. Floating Quick-Reaction Bar (on hover over any message)
2. Docked Reaction Counters with User Tooltip List
3. File & Image Attachments (Client upload flow, preview thumbnails, file cards)

---

## 1. Emoji Reactions Flow

### 1.1 Data Schema on Message
```typescript
export interface IReactionUser {
  _id: string;
  username: string;
}

export interface IReaction {
  emoji: string;
  users: IReactionUser[];
}
```

### 1.2 User Interaction Flow
1. **Hover Trigger:** When a user hovers over any message bubble (`MessageBubble.tsx`), a rounded floating pill appears at the top corner of the bubble (`opacity-0 group-hover:opacity-100 transition-opacity`).
2. **Preset Emojis:** The quick bar contains 6 standard emojis: `["👍", "❤️", "😂", "🔥", "😮", "😢"]`.
3. **Toggle Event:** Clicking an emoji emits `message:react`:
   ```typescript
   socket.emit("message:react", {
     conversationId: activeConversationId,
     messageId: message._id,
     emoji: selectedEmoji,
   });
   ```
4. **Optimistic Local Reaction Update:**
   To provide immediate feedback, toggle the current user's ID and username inside `message.reactions` before the server broadcast arrives.
5. **Docked Reaction Badges:** Rendered directly below the bubble:
   * Chip styling: `flex items-center gap-1 bg-[#141a29] border border-slate-700/80 px-2 py-0.5 rounded-full text-xs text-slate-300 hover:bg-[#1c2438] transition cursor-pointer`.
   * Highlighted border (`border-indigo-500/80 text-indigo-300 bg-indigo-950/40`) if the logged-in user is one of the reactors.
   * Native tooltip `title` displaying the comma-separated usernames: `"Alex, John reacted with ❤️"`.

---

## 2. File & Image Upload Flow

### 2.1 File Picker & Upload Handler (`MessageInput.tsx`)
* A hidden file input `<input type="file" ref={fileInputRef} className="hidden" accept="image/*,.pdf,.zip,.docx,.txt" />`.
* Clicking the `Paperclip` button triggers `fileInputRef.current?.click()`.
* When a file is selected:
  1. Set local state `isUploading = true`.
  2. Create `FormData`:
     ```typescript
     const formData = new FormData();
     formData.append("file", file);
     ```
  3. Send `POST /api/messages/upload` with headers `{ "Content-Type": "multipart/form-data" }`.
  4. Response returns:
     ```json
     {
       "url": "https://res.cloudinary.com/.../img.png",
       "fileName": "diagram.png",
       "fileSize": 204850,
       "type": "image"
     }
     ```
  5. The client immediately emits `message:send` via Socket.IO:
     ```typescript
     socket.emit("message:send", {
       conversationId,
       content: captionText.trim(),
       type: uploadedFile.type, // "image" | "file"
       mediaUrl: uploadedFile.url,
       fileName: uploadedFile.fileName,
       fileSize: uploadedFile.fileSize,
     });
     ```

### 2.2 Upload Progress / Staging Preview
Before sending, allow users to see a small preview chip above the input bar with a remove `X` button:
```tsx
{stagedAttachment && (
  <div className="mb-2 px-3 py-1.5 rounded-lg bg-[#182030] border border-slate-700 flex items-center justify-between text-xs text-slate-200">
    <div className="flex items-center gap-2 truncate">
      {stagedAttachment.type === "image" ? <ImageIcon size={14} /> : <FileText size={14} />}
      <span className="truncate">{stagedAttachment.fileName}</span>
      <span className="text-[10px] text-slate-400">({Math.round(stagedAttachment.fileSize / 1024)} KB)</span>
    </div>
    <button onClick={handleClearAttachment} className="text-slate-400 hover:text-white">
      <X size={14} />
    </button>
  </div>
)}
```

---

## 3. Rendering Attachments in `MessageBubble.tsx`

Depending on `message.type`:

### 3.1 Image Type (`message.type === "image"`)
```tsx
{message.mediaUrl && (
  <div className="mb-2 rounded-xl overflow-hidden border border-black/20 bg-black/30">
    <a href={message.mediaUrl} target="_blank" rel="noopener noreferrer">
      <img
        src={message.mediaUrl}
        alt={message.fileName || "Image"}
        className="max-h-72 w-full object-cover rounded-xl hover:scale-[1.02] transition-transform duration-200"
        loading="lazy"
      />
    </a>
  </div>
)}
```

### 3.2 Document / File Type (`message.type === "file"`)
```tsx
{message.mediaUrl && (
  <div className="mb-2 flex items-center justify-between p-2.5 rounded-xl bg-black/20 border border-white/10 gap-3">
    <div className="flex items-center gap-2.5 min-w-0">
      <div className="w-9 h-9 rounded-lg bg-indigo-500/20 text-indigo-400 flex items-center justify-center shrink-0">
        <FileText size={18} />
      </div>
      <div className="min-w-0">
        <p className="text-xs font-medium text-slate-100 truncate">{message.fileName || "Attached Document"}</p>
        <p className="text-[10px] text-slate-400">
          {message.fileSize ? `${Math.round(message.fileSize / 1024)} KB` : "File"}
        </p>
      </div>
    </div>
    <a
      href={message.mediaUrl}
      download={message.fileName}
      className="p-1.5 text-slate-300 hover:text-white rounded-lg hover:bg-white/10 transition"
      title="Download file"
    >
      <Download size={15} />
    </a>
  </div>
)}
```

---

## 4. Complete Updated `MessageBubble.tsx`

```tsx
import React from "react";
import { Check, CheckCheck, FileText, Download, Image as ImageIcon } from "lucide-react";
import { IMessage } from "../../types/chat";

interface MessageBubbleProps {
  message: IMessage;
  isOwn: boolean;
  currentUserId: string;
  onReact: (messageId: string, emoji: string) => void;
}

const PRESET_EMOJIS = ["👍", "❤️", "😂", "🔥", "😮", "😢"];

export const MessageBubble: React.FC<MessageBubbleProps> = ({
  message,
  isOwn,
  currentUserId,
  onReact,
}) => {
  const formattedTime = new Date(message.createdAt).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className={`flex flex-col mb-3 group ${isOwn ? "items-end" : "items-start"}`}>
      {/* Bubble + Floating Reaction Toolbar */}
      <div className="relative max-w-lg">
        {/* Hover Emoji Toolbar */}
        <div
          className={`absolute -top-7 opacity-0 group-hover:opacity-100 transition-opacity bg-[#141a29] border border-slate-700/80 rounded-full px-2 py-0.5 flex gap-1 shadow-lg z-10 select-none ${
            isOwn ? "right-0" : "left-0"
          }`}
        >
          {PRESET_EMOJIS.map((emoji) => (
            <button
              key={emoji}
              onClick={() => onReact(message._id, emoji)}
              className="hover:scale-125 transition-transform text-xs p-0.5"
              title={`React with ${emoji}`}
            >
              {emoji}
            </button>
          ))}
        </div>

        {/* Bubble Surface */}
        <div
          className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed shadow-sm ${
            isOwn
              ? "bg-indigo-600 text-white rounded-tr-sm"
              : "bg-[#182030] text-slate-100 border border-slate-700/60 rounded-tl-sm"
          }`}
        >
          {/* Image Attachment Preview */}
          {message.type === "image" && message.mediaUrl && (
            <div className="mb-2 rounded-xl overflow-hidden border border-black/20 bg-black/20">
              <a href={message.mediaUrl} target="_blank" rel="noopener noreferrer">
                <img
                  src={message.mediaUrl}
                  alt={message.fileName || "Image"}
                  className="max-h-72 w-full object-cover rounded-xl hover:scale-[1.01] transition-transform"
                />
              </a>
            </div>
          )}

          {/* Document Attachment Card */}
          {message.type === "file" && message.mediaUrl && (
            <div className="mb-2 flex items-center justify-between p-2 rounded-xl bg-black/20 border border-white/10 gap-3">
              <div className="flex items-center gap-2 min-w-0">
                <FileText size={18} className="text-indigo-300 shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs font-medium truncate text-white">{message.fileName || "File"}</p>
                  <p className="text-[10px] text-slate-300">
                    {message.fileSize ? `${Math.round(message.fileSize / 1024)} KB` : "Document"}
                  </p>
                </div>
              </div>
              <a
                href={message.mediaUrl}
                download={message.fileName}
                className="p-1.5 hover:bg-white/10 rounded-lg transition text-slate-200"
              >
                <Download size={14} />
              </a>
            </div>
          )}

          {/* Message Text Content */}
          {message.content && (
            <p className="whitespace-pre-wrap break-words">{message.content}</p>
          )}

          {/* Timestamp & Status Icon */}
          <div
            className={`flex items-center justify-end gap-1 text-[10px] mt-1 select-none ${
              isOwn ? "text-indigo-200/80" : "text-slate-400"
            }`}
          >
            <span>{formattedTime}</span>
            {isOwn && (
              <span>
                {message.status === "read" ? (
                  <CheckCheck size={13} className="text-cyan-300" />
                ) : message.status === "delivered" ? (
                  <CheckCheck size={13} className="text-indigo-300" />
                ) : (
                  <Check size={13} />
                )}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Docked Reactions Badges */}
      {message.reactions && message.reactions.length > 0 && (
        <div className={`flex flex-wrap gap-1 mt-1 ${isOwn ? "justify-end" : "justify-start"}`}>
          {message.reactions.map((r) => {
            const hasReacted = r.users.some(
              (u) => (typeof u === "string" ? u === currentUserId : u._id === currentUserId)
            );
            const userNames = r.users
              .map((u) => (typeof u === "string" ? "User" : u.username))
              .join(", ");

            return (
              <button
                key={r.emoji}
                onClick={() => onReact(message._id, r.emoji)}
                title={`${userNames} reacted`}
                className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs transition-colors border select-none ${
                  hasReacted
                    ? "bg-indigo-950/60 border-indigo-500/80 text-indigo-300"
                    : "bg-[#141a29] hover:bg-[#1c2438] border-slate-700/80 text-slate-300"
                }`}
              >
                <span>{r.emoji}</span>
                <span className="font-semibold text-[10px]">{r.users.length}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
```

---

## 5. Verification Checklist for the Agent

- [ ] Hovering over any bubble reveals the floating 6-emoji bar.
- [ ] Tapping an emoji dispatches `message:react` and toggles the docked count badge underneath the bubble.
- [ ] Docked badges indicate whether the current user reacted (accented border & background).
- [ ] Paperclip icon opens file selector and calls `POST /api/messages/upload`.
- [ ] Images render as responsive preview cards with click-to-view.
- [ ] Files render as cards with filename, file size, and direct download buttons.