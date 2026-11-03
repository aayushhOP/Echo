import React from "react";
import { X } from "lucide-react";
import { useChatStore } from "../../store/chatStore";

export const QuotedReplyPreview: React.FC = () => {
  const { replyingTo, setReplyingTo } = useChatStore();

  if (!replyingTo) return null;

  return (
    <div className="w-full bg-[#171824]/90 border-b border-white/[0.06] px-4 py-2 flex items-center justify-between backdrop-blur-md animate-in slide-in-from-bottom-2 duration-150 relative z-20">
      <div className="flex items-center gap-2.5 overflow-hidden min-w-0 border-l-4 border-l-[#38bdf8] pl-2.5">
        <div className="text-left overflow-hidden min-w-0">
          <p className="text-[11px] font-semibold text-[#38bdf8] truncate leading-tight">
            {replyingTo.senderUsername}
          </p>
          <p className="text-xs text-slate-300 truncate max-w-lg mt-0.5">
            {replyingTo.content ||
              (replyingTo.type === "image"
                ? "📷 Photo"
                : replyingTo.type === "audio"
                ? "🎤 Voice message"
                : "📎 Attachment")}
          </p>
        </div>
      </div>

      <button
        type="button"
        onClick={() => setReplyingTo(null)}
        className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/[0.06] transition-colors cursor-pointer shrink-0 ml-2"
        title="Cancel reply"
      >
        <X size={15} />
      </button>
    </div>
  );
};
