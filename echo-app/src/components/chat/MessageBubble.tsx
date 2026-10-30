import { FC, useState } from "react";
import { Message, IReaction } from "../../types/message";
import { useAuthStore } from "../../store/authStore";
import { formatTime } from "../../utils/date";
import { cn } from "../../utils/cn";
import { Check, CheckCheck, Clock, FileText, Download } from "lucide-react";

interface MessageBubbleProps {
  message: Message;
  onReact: (messageId: string, emoji: string) => void;
}

const QUICK_REACTIONS = ["👍", "❤️", "😂", "🔥", "😮", "😢"];

export const MessageBubble: FC<MessageBubbleProps> = ({ message, onReact }) => {
  const currentUser = useAuthStore((state) => state.user);
  const [isHovered, setIsHovered] = useState(false);

  const senderId =
    typeof message.senderId === "string"
      ? message.senderId
      : message.senderId?._id || message.senderId?.id;

  const senderName =
    typeof message.senderId === "string"
      ? "User"
      : message.senderId?.username || "User";

  const currentUserId = currentUser?.id || (currentUser as any)?._id;
  const isMine = Boolean(currentUserId && senderId && currentUserId === senderId);
  const isPending = message.status === "pending";

  const reactions: IReaction[] = message.reactions || [];

  const formatFileSize = (bytes?: number | null) => {
    if (!bytes) return "";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div
      className={cn(
        "relative group flex flex-col mb-4 w-full",
        isMine ? "items-end" : "items-start"
      )}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Sender name for received messages */}
      {!isMine && (
        <span className="text-[11px] font-medium text-slate-400 mb-1 px-1">
          {senderName}
        </span>
      )}

      {/* Floating Hover Quick-Reaction Trigger */}
      {isHovered && !isPending && (
        <div
          className={cn(
            "absolute -top-7 z-20 flex items-center gap-0.5 bg-[#141a29]/95 backdrop-blur-md border border-slate-700/80 rounded-full px-2 py-0.5 shadow-xl shadow-black/40 transition-all animate-in fade-in duration-150",
            isMine ? "right-2" : "left-2"
          )}
        >
          {QUICK_REACTIONS.map((emoji) => (
            <button
              key={emoji}
              onClick={() => onReact(message._id, emoji)}
              className="text-sm px-1 py-0.5 hover:scale-125 transition-transform cursor-pointer rounded-full hover:bg-slate-700/50"
              title={`React ${emoji}`}
            >
              {emoji}
            </button>
          ))}
        </div>
      )}

      {/* Message Bubble Body */}
      <div
        className={cn(
          "relative max-w-xl px-4 py-2.5 text-sm shadow-md break-words transition-all",
          isMine
            ? "bg-indigo-600 text-white rounded-2xl rounded-tr-sm shadow-indigo-950/30"
            : "bg-[#182030] text-slate-100 border border-slate-700/60 rounded-2xl rounded-tl-sm shadow-black/20",
          isPending && "opacity-75 ring-1 ring-indigo-400/40"
        )}
      >
        {/* Media rendering (Image) */}
        {message.type === "image" && message.mediaUrl && (
          <div className="mb-2 max-w-sm rounded-lg overflow-hidden border border-white/10">
            <img
              src={message.mediaUrl}
              alt={message.fileName || "Uploaded media"}
              className="w-full h-auto max-h-72 object-cover cursor-pointer hover:opacity-95 transition-opacity"
              onClick={() => window.open(message.mediaUrl!, "_blank")}
            />
          </div>
        )}

        {/* Media rendering (Generic File/PDF) */}
        {message.type === "file" && message.mediaUrl && (
          <div className="mb-2 flex items-center gap-3 p-2.5 rounded-xl bg-black/20 border border-white/10 max-w-xs">
            <div className="p-2 rounded-lg bg-indigo-500/20 text-indigo-300">
              <FileText className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold truncate text-white">
                {message.fileName || "Attached Document"}
              </p>
              {message.fileSize && (
                <p className="text-[10px] text-slate-400">
                  {formatFileSize(message.fileSize)}
                </p>
              )}
            </div>
            <a
              href={message.mediaUrl}
              download={message.fileName || true}
              target="_blank"
              rel="noreferrer"
              className="p-1.5 rounded-lg hover:bg-white/10 text-slate-300 hover:text-white transition-colors"
              title="Download file"
            >
              <Download className="w-4 h-4" />
            </a>
          </div>
        )}

        {/* Text Content */}
        {message.content && (
          <p className="whitespace-pre-wrap leading-relaxed text-sm select-text">
            {message.content}
          </p>
        )}

        {/* Timestamp & Read Indicators */}
        <div
          className={cn(
            "flex items-center justify-end gap-1.5 mt-1 text-[10px] select-none",
            isMine ? "text-indigo-200" : "text-slate-400"
          )}
        >
          <span>{formatTime(message.createdAt)}</span>

          {isMine && (
            <span className="inline-flex items-center ml-0.5">
              {isPending && <Clock className="w-3 h-3 text-indigo-200 animate-pulse" />}
              {!isPending && message.status === "sent" && (
                <Check className="w-3.5 h-3.5 text-indigo-200" />
              )}
              {!isPending && message.status === "delivered" && (
                <CheckCheck className="w-3.5 h-3.5 text-indigo-200" />
              )}
              {!isPending && message.status === "read" && (
                <CheckCheck className="w-3.5 h-3.5 text-cyan-300" />
              )}
            </span>
          )}
        </div>
      </div>

      {/* Docked Reactions Pill */}
      {reactions.length > 0 && (
        <div
          className={cn(
            "flex flex-wrap items-center gap-1 mt-1.5 z-10",
            isMine ? "justify-end" : "justify-start"
          )}
        >
          {reactions.map((reaction) => {
            const hasReacted = currentUserId && reaction.users.includes(currentUserId);
            return (
              <button
                key={reaction.emoji}
                onClick={() => onReact(message._id, reaction.emoji)}
                className={cn(
                  "flex items-center gap-1 bg-[#141a29] border border-slate-700/80 px-2 py-0.5 rounded-full text-xs transition-colors cursor-pointer",
                  hasReacted
                    ? "border-indigo-500/80 bg-indigo-950/40 text-indigo-200 font-semibold"
                    : "text-slate-300 hover:border-slate-600"
                )}
                title={`${reaction.users.length} reaction${reaction.users.length > 1 ? "s" : ""}`}
              >
                <span>{reaction.emoji}</span>
                <span className="text-[10px] font-bold">{reaction.users.length}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
