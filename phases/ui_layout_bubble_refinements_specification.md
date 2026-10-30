# Chat UI Polish & WhatsApp-Style Micro-Reactions Specification

**Project Stack:** React 19 · TypeScript · Tailwind CSS v4 · Lucide React

**Target:** WhatsApp Desktop reaction interaction model (side hover trigger, popout 5-emoji tray, `+` button, and expandable full emoji picker), viewport centering, image timestamp overlays, and clean file cards.

---

## 1. Interaction Model (WhatsApp Desktop Style)

1. **Hover Trigger:**
   * When hovering over any message, a subtle circular face icon button (`Smile` icon) appears **directly beside the bubble** (`opacity-0 group-hover:opacity-100 transition-opacity`).
   * **Placement:**
     * For **received messages**: docked on the right side of the bubble.
     * For **sent messages**: docked on the left side of the bubble.
2. **Quick Reaction Popup (5 Emojis + `+` Button):**
   * Clicking the smile icon opens a floating capsule popup above/beside the bubble containing the 5 standard reaction emojis: `["👍", "❤️", "😂", "😮", "😢"]` plus an action button `+` (`Plus` icon).
3. **Full Emoji Picker Panel:**
   * Clicking the `+` button transforms or expands the popup into a scrollable emoji grid panel, letting the user choose any unicode emoji.
4. **Docked Counters:**
   * Chosen reactions remain docked under the bubble with reactor counts and tooltip user attribution.

---

## 2. Canvas Centering (`ChatWindow.tsx`)

Update the outer scroll container in `ChatWindow.tsx` so the chat remains readable on wide screens:

```tsx
{/* Outer message viewport in ChatWindow.tsx */}
<div className="flex-1 overflow-y-auto px-6 py-4 flex flex-col justify-start">
  {/* Centered Desktop Column */}
  <div className="w-full max-w-4xl mx-auto flex flex-col gap-2.5">
    {messages.map((msg) => (
      <MessageBubble
        key={msg._id}
        message={msg}
        isOwn={msg.senderId === currentUserId}
        currentUserId={currentUserId}
        onReact={onReact}
      />
    ))}
    <div ref={messagesEndRef} />
  </div>
</div>
```

---

## 3. Complete Updated `MessageBubble.tsx`

Replace `client/src/components/chat/MessageBubble.tsx` with the following implementation:

```tsx
import React, { useState, useRef, useEffect } from "react";
import { Check, CheckCheck, FileText, Download, Smile, Plus, X } from "lucide-react";
import { IMessage } from "../../types/chat";

interface MessageBubbleProps {
  message: IMessage;
  isOwn: boolean;
  currentUserId: string;
  onReact: (messageId: string, emoji: string) => void;
}

// 5 default quick reactions (WhatsApp Desktop style)
const QUICK_EMOJIS = ["👍", "❤️", "😂", "😮", "😢"];

// Extended emoji panel items
const EXTENDED_EMOJI_CATEGORIES = {
  "Smileys": ["😀", "😃", "😄", "😁", "😆", "😅", "🤣", "😂", "🙂", "🙃", "😉", "😊", "😇", "🥰", "😍", "🤩", "😘", "😗", "😚", "😋", "😛", "😜", "🤪", "😝", "🤑", "🤗", "🤭", "🤫", "🤔", "🤐", "🤨", "😐", "😑", "😶", "😏", "😒", "🙄", "😬", "🤥", "😌", "😔", "😪", "🤤", "😴", "😷"],
  "Gestures": ["👍", "👎", "👊", "✊", "🤛", "🤜", "🤞", "✌️", "🤟", "🤘", "👌", "🤌", "🤏", "👈", "👉", "👆", "👇", "☝️", "✋", "🤚", "🖐️", "🖖", "👋", "🤙", "💪", "🙏", "👏", "🙌", "🤝"],
  "Hearts & Vibes": ["❤️", "🧡", "💛", "💚", "💙", "💜", "🖤", "🤍", "🤎", "💔", "❤️‍🔥", "❤️‍🩹", "❣️", "💕", "💞", "💓", "💗", "💖", "💘", "💝", "✨", "🔥", "💥", "🎉", "🚀", "💯"],
};

export const MessageBubble: React.FC<MessageBubbleProps> = ({
  message,
  isOwn,
  currentUserId,
  onReact,
}) => {
  const [showQuickTray, setShowQuickTray] = useState(false);
  const [showFullPicker, setShowFullPicker] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  const formattedTime = new Date(message.createdAt).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

  // Close menus on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setShowQuickTray(false);
        setShowFullPicker(false);
      }
    };
    if (showQuickTray || showFullPicker) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showQuickTray, showFullPicker]);

  const handleSelectEmoji = (emoji: string) => {
    onReact(message._id, emoji);
    setShowQuickTray(false);
    setShowFullPicker(false);
  };

  return (
    <div className={`flex flex-col group relative select-text ${isOwn ? "items-end" : "items-start"}`}>
      {/* Outer row holding Trigger + Bubble */}
      <div className={`relative flex items-center gap-1.5 max-w-md ${isOwn ? "flex-row-reverse" : "flex-row"}`}>
        
        {/* --- Message Bubble Container --- */}
        <div className="relative w-fit">
          {/* Image Type */}
          {message.type === "image" && message.mediaUrl && (
            <div className="relative rounded-2xl overflow-hidden border border-slate-700/60 bg-black/40 shadow-sm max-w-sm">
              <a href={message.mediaUrl} target="_blank" rel="noopener noreferrer" className="block">
                <img
                  src={message.mediaUrl}
                  alt={message.fileName || "Image"}
                  className="max-h-80 w-full object-cover hover:scale-[1.01] transition-transform duration-200"
                  loading="lazy"
                />
              </a>
              <div className="absolute bottom-2 right-2 bg-black/60 backdrop-blur-md px-2 py-0.5 rounded-full flex items-center gap-1 text-[10px] text-white/90 select-none">
                <span>{formattedTime}</span>
                {isOwn && (
                  <span>
                    {message.status === "read" ? (
                      <CheckCheck size={12} className="text-cyan-300" />
                    ) : message.status === "delivered" ? (
                      <CheckCheck size={12} className="text-indigo-300" />
                    ) : (
                      <Check size={12} />
                    )}
                  </span>
                )}
              </div>
            </div>
          )}

          {/* File Attachment Type */}
          {message.type === "file" && message.mediaUrl && (
            <div
              className={`p-3 rounded-2xl border transition-colors shadow-sm min-w-[260px] max-w-sm ${
                isOwn
                  ? "bg-indigo-600/90 border-indigo-500/50 text-white rounded-tr-sm"
                  : "bg-[#161c2b] border-slate-700/60 text-slate-100 rounded-tl-sm"
              }`}
            >
              <div className="flex items-center gap-3">
                <div
                  className={`p-2.5 rounded-xl shrink-0 flex items-center justify-center ${
                    isOwn ? "bg-white/10 text-white" : "bg-indigo-500/10 text-indigo-400 border border-indigo-500/20"
                  }`}
                >
                  <FileText size={20} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate">{message.fileName || "Document"}</p>
                  <p className={`text-[10px] mt-0.5 ${isOwn ? "text-indigo-100/75" : "text-slate-400"}`}>
                    {message.fileSize ? `${Math.round(message.fileSize / 1024)} KB` : "File"}
                  </p>
                </div>
                <a
                  href={message.mediaUrl}
                  download={message.fileName}
                  className={`p-1.5 rounded-lg transition-colors shrink-0 ${
                    isOwn ? "hover:bg-white/20 text-white" : "hover:bg-slate-700/60 text-slate-300 hover:text-white"
                  }`}
                  title="Download file"
                >
                  <Download size={16} />
                </a>
              </div>
              <div
                className={`flex items-center justify-end gap-1 text-[10px] mt-2 select-none ${
                  isOwn ? "text-indigo-100/80" : "text-slate-400"
                }`}
              >
                <span>{formattedTime}</span>
                {isOwn && (
                  <span>
                    {message.status === "read" ? (
                      <CheckCheck size={12} className="text-cyan-300" />
                    ) : message.status === "delivered" ? (
                      <CheckCheck size={12} className="text-indigo-300" />
                    ) : (
                      <Check size={12} />
                    )}
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Standard Text Type */}
          {message.type === "text" && message.content && (
            <div
              className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed shadow-sm ${
                isOwn
                  ? "bg-indigo-600 text-white rounded-tr-sm"
                  : "bg-[#182030] text-slate-100 border border-slate-700/60 rounded-tl-sm"
              }`}
            >
              <p className="whitespace-pre-wrap break-words">{message.content}</p>
              <div
                className={`flex items-center justify-end gap-1 text-[10px] mt-1 select-none ${
                  isOwn ? "text-indigo-100/80" : "text-slate-400"
                }`}
              >
                <span>{formattedTime}</span>
                {isOwn && (
                  <span>
                    {message.status === "read" ? (
                      <CheckCheck size={12} className="text-cyan-300" />
                    ) : message.status === "delivered" ? (
                      <CheckCheck size={12} className="text-indigo-300" />
                    ) : (
                      <Check size={12} />
                    )}
                  </span>
                )}
              </div>
            </div>
          )}
        </div>

        {/* --- WhatsApp-Style Hover Smile Trigger (Beside the Bubble) --- */}
        <div className="relative shrink-0" ref={popoverRef}>
          <button
            onClick={() => {
              setShowQuickTray(!showQuickTray);
              setShowFullPicker(false);
            }}
            className={`p-1.5 rounded-full text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 transition-all ${
              showQuickTray || showFullPicker ? "opacity-100 bg-slate-800/80 text-slate-200" : "opacity-0 group-hover:opacity-100"
            }`}
            title="React"
          >
            <Smile size={16} />
          </button>

          {/* --- 5 Emojis + Plus Button Quick Tray --- */}
          {showQuickTray && !showFullPicker && (
            <div
              className={`absolute -top-12 bg-[#161c2b] border border-slate-700/90 rounded-full px-2 py-1 flex items-center gap-1 shadow-2xl z-30 animate-in fade-in zoom-in-95 duration-100 select-none ${
                isOwn ? "right-0" : "left-0"
              }`}
            >
              {QUICK_EMOJIS.map((emoji) => (
                <button
                  key={emoji}
                  onClick={() => handleSelectEmoji(emoji)}
                  className="hover:scale-130 transition-transform text-base p-1 rounded-full cursor-pointer"
                >
                  {emoji}
                </button>
              ))}

              {/* Plus Button to open full icon panel */}
              <button
                onClick={() => setShowFullPicker(true)}
                className="w-7 h-7 rounded-full flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-700/60 transition-colors ml-0.5"
                title="More reactions"
              >
                <Plus size={15} />
              </button>
            </div>
          )}

          {/* --- Full Emoji Picker Panel (WhatsApp Desktop Modal Style) --- */}
          {showFullPicker && (
            <div
              className={`absolute -top-64 bg-[#141926] border border-slate-700 rounded-2xl w-72 h-64 shadow-2xl z-40 flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150 ${
                isOwn ? "right-0" : "left-0"
              }`}
            >
              {/* Picker Header */}
              <div className="px-3 py-2 border-b border-slate-800 flex items-center justify-between text-xs text-slate-300 font-medium">
                <span>All Reactions</span>
                <button
                  onClick={() => setShowFullPicker(false)}
                  className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
                >
                  <X size={14} />
                </button>
              </div>

              {/* Emoji Grid Scroll */}
              <div className="flex-1 overflow-y-auto p-3 space-y-3">
                {Object.entries(EXTENDED_EMOJI_CATEGORIES).map(([category, emojis]) => (
                  <div key={category}>
                    <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                      {category}
                    </p>
                    <div className="grid grid-cols-6 gap-1">
                      {emojis.map((emoji) => (
                        <button
                          key={emoji}
                          onClick={() => handleSelectEmoji(emoji)}
                          className="w-8 h-8 rounded-lg flex items-center justify-center text-lg hover:bg-slate-800/80 hover:scale-110 transition-all cursor-pointer"
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Docked Reactions Badges (Directly under the bubble) */}
      {message.reactions && message.reactions.length > 0 && (
        <div className={`flex flex-wrap gap-1 mt-1 z-10 ${isOwn ? "justify-end" : "justify-start"}`}>
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
                className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs transition-colors border select-none cursor-pointer ${
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

## 4. Verification Checklist

* [ ] Hovering over a bubble reveals a single face icon button (`Smile`) right beside the bubble (on the right for received messages, on the left for sent messages).
* [ ] Clicking the face button opens the 5-emoji quick tray: `👍`, `❤️`, `😂`, `😮`, `😢`, plus the `+` icon button.
* [ ] Clicking any of the 5 quick emojis dispatches the reaction and closes the tray.
* [ ] Clicking `+` expands the categorized emoji picker panel containing full emoji sections ("Smileys", "Gestures", "Hearts & Vibes").
* [ ] Clicking outside the popup automatically closes the tray and full picker.
* [ ] Selected reactions dock neatly under the bubble with reactor count chips and tooltip attribution.