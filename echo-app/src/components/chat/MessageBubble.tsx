import { FC, memo, useState, useRef, useEffect } from "react";
import { Clock, FileText, Download, Smile, Plus, X, ImageOff } from "lucide-react";
import { Message } from "../../types/message";
import { useAuthStore } from "../../store/authStore";
import { formatTime } from "../../utils/date";
import { MessageStatusTick } from "./MessageStatusTick";

interface MessageBubbleProps {
  message: Message;
  isGroup?: boolean;
  onReact: (messageId: string, emoji: string) => void;
}

// 5 default quick reactions (WhatsApp Desktop style)
const QUICK_EMOJIS = ["👍", "❤️", "😂", "😮", "😢"];

// Extended emoji panel items
const EXTENDED_EMOJI_CATEGORIES = {
  "Smileys": [
    "😀", "😃", "😄", "😁", "😆", "😅", "🤣", "😂", "🙂", "🙃",
    "😉", "😊", "😇", "🥰", "😍", "🤩", "😘", "😗", "😚", "😋",
    "😛", "😜", "🤪", "😝", "🤑", "🤗", "🤭", "🤫", "🤔", "🤐",
    "🤨", "😐", "😑", "😶", "😏", "😒", "🙄", "😬", "🤥", "😌",
    "😔", "😪", "🤤", "😴", "😷"
  ],
  "Gestures": [
    "👍", "👎", "👊", "✊", "🤛", "🤜", "🤞", "✌️", "🤟", "🤘",
    "👌", "🤌", "🤏", "👈", "👉", "👆", "👇", "☝️", "✋", "🤚",
    "🖐️", "🖖", "👋", "🤙", "💪", "🙏", "👏", "🙌", "🤝"
  ],
  "Hearts & Vibes": [
    "❤️", "🧡", "💛", "💚", "💙", "💜", "🖤", "🤍", "🤎", "💔",
    "❤️‍🔥", "❤️‍🩹", "❣️", "💕", "💞", "💓", "💗", "💖", "💘", "💝",
    "✨", "🔥", "💥", "🎉", "🚀", "💯"
  ],
};

const MessageBubbleComponent: FC<MessageBubbleProps> = ({
  message,
  isGroup = false,
  onReact,
}) => {
  const currentUser = useAuthStore((state) => state.user);
  const [showQuickTray, setShowQuickTray] = useState(false);
  const [showFullPicker, setShowFullPicker] = useState(false);
  const [imageError, setImageError] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  const senderId =
    typeof message.senderId === "string"
      ? message.senderId
      : message.senderId?._id || message.senderId?.id;

  const senderName =
    typeof message.senderId === "string"
      ? "User"
      : message.senderId?.username || "User";

  const currentUserId = currentUser?.id || (currentUser as any)?._id;
  const isOwn = Boolean(currentUserId && senderId && currentUserId === senderId);
  const isPending = message.status === "pending";

  const formattedTime = message.createdAt
    ? formatTime(message.createdAt)
    : new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

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
    <div className={`flex flex-col group relative select-text mb-1.5 ${isOwn ? "items-end" : "items-start"}`}>
      {/* Sender name for received messages in group chats */}
      {!isOwn && isGroup && (
        <span className="text-[11px] font-medium text-[#767b93] mb-1 px-1">
          {senderName}
        </span>
      )}

      {/* Outer row holding Trigger + Bubble */}
      <div className={`relative flex items-center gap-1.5 max-w-md ${isOwn ? "flex-row-reverse" : "flex-row"}`}>
        {/* --- Message Bubble Container --- */}
        <div className="relative w-fit">
          {/* Image Type */}
          {message.type === "image" && message.mediaUrl && (
            <div
              className={`relative rounded-2xl overflow-hidden border border-white/[0.06] bg-[#13141d] shadow-sm max-w-sm ${
                isPending ? "opacity-75 ring-1 ring-[#0066ff]/40" : ""
              }`}
            >
              {imageError ? (
                <div className="p-3 flex items-center gap-2.5 text-xs text-[#767b93] bg-[#13141d]">
                  <div className="w-8 h-8 rounded-lg bg-rose-500/20 text-rose-300 flex items-center justify-center shrink-0">
                    <ImageOff size={16} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium truncate text-[#f0f2f8]">{message.fileName || "Image"}</p>
                    <p className="text-[10px] text-[#505469]">Image expired or unavailable</p>
                  </div>
                </div>
              ) : (
                <a href={message.mediaUrl} target="_blank" rel="noopener noreferrer" className="block">
                  <img
                    src={message.mediaUrl}
                    alt={message.fileName || "Image"}
                    onError={() => setImageError(true)}
                    className="max-h-80 w-full object-cover hover:scale-[1.01] transition-transform duration-200"
                    loading="lazy"
                  />
                </a>
              )}
              <div className="absolute bottom-2 right-2 bg-[#13141d]/80 backdrop-blur-md px-2 py-0.5 rounded-full flex items-center gap-1 text-[10px] text-white/90 select-none">
                <span>{formattedTime}</span>
                {isOwn && (
                  <span>
                    {isPending ? (
                      <Clock className="w-3 h-3 text-white/80 animate-pulse" />
                    ) : (
                      <MessageStatusTick status={message.status as any} isOwnMessage={isOwn} />
                    )}
                  </span>
                )}
              </div>
            </div>
          )}

          {/* File Attachment Type */}
          {message.type === "file" && message.mediaUrl && (
            <div
              className={`p-2.5 rounded-2xl border transition-colors shadow-sm min-w-[240px] max-w-sm ${
                isOwn
                  ? "bg-[#0066ff] border-transparent text-white rounded-tr-sm shadow-md shadow-[#0066ff]/20"
                  : "bg-[#232533] border-white/[0.04] text-[#f0f2f8] rounded-tl-sm hover:bg-[#282a3b]"
              } ${isPending ? "opacity-75 ring-1 ring-[#0066ff]/40" : ""}`}
            >
              <div className="flex items-center gap-3">
                <div
                  className={`p-2 rounded-xl shrink-0 flex items-center justify-center ${
                    isOwn ? "bg-white/10 text-white" : "bg-[#0066ff]/15 text-[#0066ff] border border-[#0066ff]/20"
                  }`}
                >
                  <FileText size={18} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate">{message.fileName || "Document"}</p>
                  <p className={`text-[10px] mt-0.5 ${isOwn ? "text-white/75" : "text-[#767b93]"}`}>
                    {message.fileSize ? `${Math.round(message.fileSize / 1024)} KB` : "File"}
                  </p>
                </div>
                <a
                  href={message.mediaUrl}
                  download={message.fileName || true}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`p-1.5 rounded-lg transition-colors shrink-0 ${
                    isOwn ? "hover:bg-white/20 text-white" : "hover:bg-white/[0.06] text-[#767b93] hover:text-white"
                  }`}
                  title="Download file"
                >
                  <Download size={15} />
                </a>
              </div>
              <div
                className={`flex items-center justify-end gap-1 text-[10px] mt-1 select-none ${
                  isOwn ? "text-white/70" : "text-[#767b93]"
                }`}
              >
                <span>{formattedTime}</span>
                {isOwn && (
                  <span>
                    {isPending ? (
                      <Clock className="w-2.5 h-2.5 text-white/70 animate-pulse ml-0.5" />
                    ) : (
                      <MessageStatusTick status={message.status as any} isOwnMessage={isOwn} />
                    )}
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Standard Text Type */}
          {message.type === "text" && message.content && (
            <div
              className={`px-3 py-1.5 rounded-2xl text-[13px] md:text-sm leading-normal transition-all shadow-sm ${
                isOwn
                  ? "bg-gradient-to-r from-[#0052cc] via-[#0066ff] to-[#0070f3] text-white rounded-tr-sm shadow-md shadow-[#0066ff]/25 border border-white/10"
                  : "bg-[#232533] text-[#f0f2f8] rounded-tl-sm hover:bg-[#282a3b] border border-white/[0.04] shadow-sm"
              } ${isPending ? "opacity-75 ring-1 ring-[#0066ff]/40" : ""}`}
            >
              <div className="flex flex-wrap items-baseline justify-end gap-x-2 gap-y-0.5">
                <span className="whitespace-pre-wrap break-words mr-auto text-left flex-1 min-w-[20px] select-text">
                  {message.content}
                </span>

                <span
                  className={`inline-flex items-center gap-1 text-[10px] shrink-0 select-none self-end translate-y-[2px] ${
                    isOwn ? "text-white/70" : "text-[#767b93]"
                  }`}
                >
                  <span className="leading-none">{formattedTime}</span>
                  {isOwn && (
                    <span className="inline-flex items-center">
                      {isPending ? (
                        <Clock className="w-2.5 h-2.5 text-white/70 animate-pulse ml-0.5" />
                      ) : (
                        <MessageStatusTick status={message.status as any} isOwnMessage={isOwn} />
                      )}
                    </span>
                  )}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* --- WhatsApp-Style Hover Smile Trigger (Beside the Bubble) --- */}
        {!isPending && (
          <div className="relative shrink-0" ref={popoverRef}>
            <button
              type="button"
              onClick={() => {
                setShowQuickTray(!showQuickTray);
                setShowFullPicker(false);
              }}
              className={`p-1.5 rounded-full text-[#505469] hover:text-[#f0f2f8] hover:bg-white/[0.04] transition-all cursor-pointer ${
                showQuickTray || showFullPicker ? "opacity-100 bg-white/[0.08] text-[#f0f2f8]" : "opacity-0 group-hover:opacity-100"
              }`}
              title="React"
            >
              <Smile size={16} />
            </button>

            {/* --- 5 Emojis + Plus Button Quick Tray --- */}
            {showQuickTray && !showFullPicker && (
              <div
                className={`absolute -top-12 bg-[#1b1c27] border border-white/[0.08] rounded-full px-2 py-1 flex items-center gap-1 shadow-2xl z-30 animate-in fade-in zoom-in-95 duration-100 select-none ${
                  isOwn ? "right-0" : "left-0"
                }`}
              >
                {QUICK_EMOJIS.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => handleSelectEmoji(emoji)}
                    className="hover:scale-125 transition-transform text-base p-1 rounded-full cursor-pointer"
                  >
                    {emoji}
                  </button>
                ))}

                {/* Plus Button to open full icon panel */}
                <button
                  type="button"
                  onClick={() => setShowFullPicker(true)}
                  className="w-7 h-7 rounded-full flex items-center justify-center text-[#767b93] hover:text-white hover:bg-white/[0.08] transition-colors ml-0.5 cursor-pointer"
                  title="More reactions"
                >
                  <Plus size={15} />
                </button>
              </div>
            )}

            {/* --- Full Emoji Picker Panel (Modal Style) --- */}
            {showFullPicker && (
              <div
                className={`absolute -top-64 bg-[#1b1c27] border border-white/[0.08] rounded-2xl w-72 h-64 shadow-2xl z-40 flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150 ${
                  isOwn ? "right-0" : "left-0"
                }`}
              >
                {/* Picker Header */}
                <div className="px-3 py-2 border-b border-white/[0.04] flex items-center justify-between text-xs text-[#f0f2f8] font-medium">
                  <span>All Reactions</span>
                  <button
                    type="button"
                    onClick={() => setShowFullPicker(false)}
                    className="p-1 text-[#767b93] hover:text-white rounded-lg hover:bg-white/[0.06] cursor-pointer"
                  >
                    <X size={14} />
                  </button>
                </div>

                {/* Emoji Grid Scroll */}
                <div className="flex-1 overflow-y-auto p-3 space-y-3">
                  {Object.entries(EXTENDED_EMOJI_CATEGORIES).map(([category, emojis]) => (
                    <div key={category}>
                      <p className="text-[10px] font-semibold text-[#505469] uppercase tracking-wider mb-1.5">
                        {category}
                      </p>
                      <div className="grid grid-cols-6 gap-1">
                        {emojis.map((emoji) => (
                          <button
                            key={emoji}
                            type="button"
                            onClick={() => handleSelectEmoji(emoji)}
                            className="w-8 h-8 rounded-lg flex items-center justify-center text-lg hover:bg-white/[0.06] hover:scale-110 transition-all cursor-pointer"
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
        )}
      </div>

      {/* Docked Reactions Badges (Directly under the bubble) */}
      {message.reactions && message.reactions.length > 0 && (
        <div className={`flex flex-wrap gap-1 mt-1 z-10 ${isOwn ? "justify-end" : "justify-start"}`}>
          {message.reactions.map((r) => {
            const hasReacted = currentUserId
              ? r.users.some(
                  (u) => (typeof u === "string" ? u === currentUserId : u._id === currentUserId)
                )
              : false;
            const userNames = r.users
              .map((u) => (typeof u === "string" ? "User" : u.username || "User"))
              .join(", ");

            return (
              <button
                key={r.emoji}
                type="button"
                onClick={() => onReact(message._id, r.emoji)}
                title={userNames ? `${userNames} reacted with ${r.emoji}` : `React with ${r.emoji}`}
                className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs transition-colors border select-none cursor-pointer ${
                  hasReacted
                    ? "bg-[#0066ff]/20 border-[#0066ff]/60 text-[#0066ff] font-semibold"
                    : "bg-[#1b1c27] hover:bg-[#232533] border-white/[0.04] text-[#f0f2f8]"
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

export const MessageBubble = memo(MessageBubbleComponent, (prevProps, nextProps) => {
  return (
    prevProps.message._id === nextProps.message._id &&
    prevProps.message.status === nextProps.message.status &&
    prevProps.message.content === nextProps.message.content &&
    prevProps.message.reactions === nextProps.message.reactions &&
    prevProps.message.readBy?.length === nextProps.message.readBy?.length &&
    prevProps.isGroup === nextProps.isGroup
  );
});
