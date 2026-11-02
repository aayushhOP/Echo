import React from "react";
import { X, Reply } from "lucide-react";
import { useChatStore } from "../../store/chatStore";

export const QuotedReplyPreview: React.FC = () => {
  const { replyingTo, setReplyingTo } = useChatStore();

  if (!replyingTo) return null;

  return (
    <div className="bg-[#171824]/95 backdrop-blur-sm border-t border-l-4 border-l-[#0066ff] border-white/[0.06] px-4 py-2 flex items-center justify-between animate-in slide-in-from-bottom-2 duration-150 z-20">
      <div className="flex items-center gap-2.5 overflow-hidden min-w-0">
        <Reply size={15} className="text-[#0066ff] flex-shrink-0" />
        <div className="text-left overflow-hidden min-w-0">
          <p className="text-[11px] font-semibold text-[#0066ff] truncate">
            {replyingTo.senderUsername}
          </p>
          <p className="text-xs text-slate-300 truncate max-w-md">
            {replyingTo.content || (replyingTo.type === "image" ? "Photo" : "Attachment")}
          </p>
        </div>
      </div>

      <button
        type="button"
        onClick={() => setReplyingTo(null)}
        className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/[0.05] transition-colors cursor-pointer shrink-0 ml-2"
        title="Cancel reply"
      >
        <X size={15} />
      </button>
    </div>
  );
};
