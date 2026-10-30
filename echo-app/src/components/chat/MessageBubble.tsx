import { FC } from "react";
import { Message } from "../../types/message";
import { useAuthStore } from "../../store/authStore";
import { formatTime, cn } from "../../utils/date";
import { Check, CheckCheck, Clock } from "lucide-react";

interface MessageBubbleProps {
  message: Message;
}

export const MessageBubble: FC<MessageBubbleProps> = ({ message }) => {
  const currentUser = useAuthStore((state) => state.user);

  const senderId =
    typeof message.senderId === "string"
      ? message.senderId
      : message.senderId._id || message.senderId.id;

  const senderName =
    typeof message.senderId === "string" ? "User" : message.senderId.username;

  const currentUserId = currentUser?.id;
  const isMine = Boolean(currentUserId && senderId && currentUserId === senderId);
  const isPending = message.status === "pending";

  return (
    <div
      className={cn(
        "flex flex-col mb-3 max-w-[80%] sm:max-w-[70%]",
        isMine ? "self-end items-end" : "self-start items-start"
      )}
    >
      {!isMine && (
        <span className="text-xs text-slate-400 mb-1 px-1 font-medium">
          {senderName}
        </span>
      )}

      <div
        className={cn(
          "relative rounded-2xl px-4 py-2.5 text-sm shadow-md break-words transition-all",
          isMine
            ? "bg-gradient-to-r from-indigo-600 to-indigo-500 text-white rounded-br-xs shadow-indigo-950/40"
            : "bg-slate-800 text-slate-100 rounded-bl-xs border border-slate-700/60 shadow-slate-950/30",
          isPending && "opacity-70 ring-1 ring-indigo-400/40"
        )}
      >
        <p className="whitespace-pre-wrap leading-relaxed">{message.content}</p>

        <div
          className={cn(
            "flex items-center justify-end gap-1.5 mt-1 text-[10px]",
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
                <CheckCheck className="w-3.5 h-3.5 text-sky-300" />
              )}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
