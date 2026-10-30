import { FC, memo, useState } from "react";
import { Check, CheckCheck, Clock, FileText, Download, ImageOff } from "lucide-react";
import { Message } from "../../types/message";
import { useAuthStore } from "../../store/authStore";
import { formatTime } from "../../utils/date";

interface MessageBubbleProps {
  message: Message;
  isGroup?: boolean;
  onReact: (messageId: string, emoji: string) => void;
}

const PRESET_EMOJIS = ["👍", "❤️", "😂", "🔥", "😮", "😢"];

const MessageBubbleComponent: FC<MessageBubbleProps> = ({
  message,
  isGroup = false,
  onReact,
}) => {
  const currentUser = useAuthStore((state) => state.user);
  const [imageError, setImageError] = useState(false);

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

  return (
    <div className={`relative flex flex-col mb-3 group w-full ${isOwn ? "items-end" : "items-start"}`}>
      {/* Sender name for received messages in group chats */}
      {!isOwn && isGroup && (
        <span className="text-[11px] font-medium text-slate-400 mb-1 px-1">
          {senderName}
        </span>
      )}

      {/* Bubble + Floating Reaction Toolbar */}
      <div className="relative max-w-lg">
        {/* Hover Emoji Toolbar */}
        {!isPending && (
          <div
            className={`absolute -top-7 opacity-0 group-hover:opacity-100 transition-opacity bg-[#141a29] border border-slate-700/80 rounded-full px-2 py-0.5 flex gap-1 shadow-lg z-10 select-none ${
              isOwn ? "right-0" : "left-0"
            }`}
          >
            {PRESET_EMOJIS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={() => onReact(message._id, emoji)}
                className="hover:scale-125 transition-transform text-xs p-0.5 cursor-pointer"
                title={`React with ${emoji}`}
              >
                {emoji}
              </button>
            ))}
          </div>
        )}

        {/* Bubble Surface */}
        <div
          className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed shadow-sm break-words ${
            isOwn
              ? "bg-indigo-600 text-white rounded-tr-sm"
              : "bg-[#182030] text-slate-100 border border-slate-700/60 rounded-tl-sm"
          } ${isPending ? "opacity-75 ring-1 ring-indigo-400/40" : ""}`}
        >
          {/* Image Attachment Preview */}
          {message.type === "image" && message.mediaUrl && (
            <div className="mb-2 rounded-xl overflow-hidden border border-black/20 bg-black/20">
              {imageError ? (
                <div className="p-3 flex items-center gap-2.5 text-xs text-slate-300 bg-black/30">
                  <div className="w-8 h-8 rounded-lg bg-rose-500/20 text-rose-300 flex items-center justify-center shrink-0">
                    <ImageOff size={16} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium truncate text-slate-200">{message.fileName || "Image"}</p>
                    <p className="text-[10px] text-slate-400">Image expired or unavailable</p>
                  </div>
                </div>
              ) : (
                <a href={message.mediaUrl} target="_blank" rel="noopener noreferrer">
                  <img
                    src={message.mediaUrl}
                    alt={message.fileName || "Image"}
                    onError={() => setImageError(true)}
                    className="max-h-72 w-full object-cover rounded-xl hover:scale-[1.01] transition-transform duration-200"
                    loading="lazy"
                  />
                </a>
              )}
            </div>
          )}

          {/* Document Attachment Card */}
          {message.type === "file" && message.mediaUrl && (
            <div className="mb-2 flex items-center justify-between p-2 rounded-xl bg-black/20 border border-white/10 gap-3">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-8 h-8 rounded-lg bg-indigo-500/20 text-indigo-300 flex items-center justify-center shrink-0">
                  <FileText size={18} />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-medium truncate text-white">{message.fileName || "File"}</p>
                  <p className="text-[10px] text-slate-300">
                    {message.fileSize ? `${Math.round(message.fileSize / 1024)} KB` : "Document"}
                  </p>
                </div>
              </div>
              <a
                href={message.mediaUrl}
                download={message.fileName || true}
                target="_blank"
                rel="noopener noreferrer"
                className="p-1.5 hover:bg-white/10 rounded-lg transition text-slate-200 shrink-0"
                title="Download file"
              >
                <Download size={14} />
              </a>
            </div>
          )}

          {/* Message Text Content */}
          {message.content && (
            <p className="whitespace-pre-wrap break-words select-text">{message.content}</p>
          )}

          {/* Timestamp & Status Icon */}
          <div
            className={`flex items-center justify-end gap-1 text-[10px] mt-1 select-none ${
              isOwn ? "text-indigo-200/80" : "text-slate-400"
            }`}
          >
            <span>{formattedTime}</span>
            {isOwn && (
              <span className="inline-flex items-center ml-0.5">
                {isPending && <Clock className="w-3 h-3 text-indigo-200 animate-pulse" />}
                {!isPending && message.status === "sent" && (
                  <Check size={13} className="text-indigo-200" />
                )}
                {!isPending && message.status === "delivered" && (
                  <CheckCheck size={13} className="text-indigo-300" />
                )}
                {!isPending && message.status === "read" && (
                  <CheckCheck size={13} className="text-cyan-300" />
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
            const hasReacted = currentUserId
              ? r.users.some((u) =>
                  typeof u === "string" ? u === currentUserId : u._id === currentUserId
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
                    ? "bg-indigo-950/60 border-indigo-500/80 text-indigo-300 font-semibold"
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
