import { FC } from "react";
import { MessageSquare } from "lucide-react";
import { NotificationPayload } from "../../services/notificationService";

interface MessageToastProps {
  payload: NotificationPayload;
  onClick: () => void;
  onDismiss: () => void;
}

export const MessageToast: FC<MessageToastProps> = ({
  payload,
  onClick,
  onDismiss,
}) => {
  return (
    <div
      onClick={() => {
        onClick();
        onDismiss();
      }}
      className="flex items-center gap-3 w-80 p-3 rounded-2xl bg-[#171824]/95 border border-white/[0.08] shadow-2xl backdrop-blur-md cursor-pointer hover:border-[#0066ff]/40 transition-all group"
    >
      {/* Avatar or fallback */}
      <div className="relative shrink-0">
        <div className="w-10 h-10 rounded-full bg-slate-800 border border-white/10 flex items-center justify-center overflow-hidden">
          {payload.senderAvatar ? (
            <img
              src={payload.senderAvatar}
              alt={payload.senderName}
              className="w-full h-full object-cover"
            />
          ) : (
            <span className="text-xs font-semibold text-white">
              {payload.senderName.slice(0, 2).toUpperCase()}
            </span>
          )}
        </div>
        <div className="absolute -bottom-0.5 -right-0.5 p-0.5 rounded-full bg-[#13141d]">
          <div className="w-2.5 h-2.5 rounded-full bg-[#0066ff] flex items-center justify-center">
            <MessageSquare size={6} className="text-white" />
          </div>
        </div>
      </div>

      {/* Content preview */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold text-white group-hover:text-[#0066ff] transition-colors truncate">
            {payload.senderName}
          </p>
          <span className="text-[10px] text-slate-500">just now</span>
        </div>
        <p className="text-xs text-slate-400 truncate mt-0.5">
          {payload.content}
        </p>
      </div>
    </div>
  );
};
