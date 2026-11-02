import React, { useState } from "react";
import { X, Forward, Search, Send, Loader2 } from "lucide-react";
import { useChatStore } from "../../store/chatStore";
import { Conversation } from "../../types/message";
import { useAuthStore } from "../../store/authStore";
import { getOtherParticipant } from "../../utils/chatUtils";

interface ForwardMessageModalProps {
  conversations: Conversation[];
  onForwardMessage: (targetConversationId: string, content: string) => Promise<void>;
}

export const ForwardMessageModal: React.FC<ForwardMessageModalProps> = ({
  conversations,
  onForwardMessage,
}) => {
  const { forwardingMessage, setForwardingMessage } = useChatStore();
  const currentUser = useAuthStore((state) => state.user);
  const [search, setSearch] = useState("");
  const [sendingId, setSendingId] = useState<string | null>(null);

  if (!forwardingMessage) return null;

  const getConversationTitle = (c: Conversation) => {
    if (c.type === "group") {
      return c.groupName || c.name || "Group";
    }
    const counterpart = getOtherParticipant(c.participants, currentUser);
    return counterpart?.username || "Direct Chat";
  };

  const filtered = conversations.filter((c) => {
    const title = getConversationTitle(c);
    return title.toLowerCase().includes(search.toLowerCase());
  });

  const handleSend = async (targetId: string) => {
    try {
      setSendingId(targetId);
      await onForwardMessage(targetId, forwardingMessage.content);
    } catch (err) {
      console.error("Failed to forward message:", err);
    } finally {
      setSendingId(null);
      setForwardingMessage(null);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={() => setForwardingMessage(null)}
    >
      <div
        className="w-full max-w-sm rounded-2xl bg-[#171824] border border-white/[0.08] p-5 shadow-2xl animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between pb-3 border-b border-white/[0.06]">
          <div className="flex items-center gap-2 text-white font-semibold text-sm">
            <Forward size={16} className="text-[#0066ff]" />
            <span>Forward message to...</span>
          </div>
          <button
            type="button"
            onClick={() => setForwardingMessage(null)}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/[0.05] transition-colors cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>

        {/* Search */}
        <div className="mt-3 relative">
          <Search size={14} className="absolute left-3 top-2.5 text-slate-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search chats..."
            className="w-full bg-[#13141d] rounded-xl pl-8 pr-3 py-1.5 text-xs text-white border border-white/[0.06] focus:outline-none focus:border-[#0066ff] placeholder:text-slate-500"
          />
        </div>

        {/* Conversation List */}
        <div className="mt-3 max-h-56 overflow-y-auto space-y-1">
          {filtered.length === 0 ? (
            <div className="py-6 text-center text-xs text-slate-500">
              No conversations found
            </div>
          ) : (
            filtered.map((conv) => {
              const title = getConversationTitle(conv);
              const isSending = sendingId === conv._id;

              return (
                <div
                  key={conv._id}
                  className="flex items-center justify-between p-2 rounded-xl hover:bg-white/[0.04] transition-colors"
                >
                  <div className="min-w-0 flex-1 mr-2">
                    <span className="text-xs text-slate-200 font-medium truncate block">
                      {title}
                    </span>
                    <span className="text-[10px] text-slate-500 uppercase">
                      {conv.type}
                    </span>
                  </div>
                  <button
                    type="button"
                    disabled={isSending}
                    onClick={() => handleSend(conv._id)}
                    className="p-1.5 rounded-lg bg-[#0066ff] hover:bg-[#0052cc] text-white disabled:opacity-50 transition-colors cursor-pointer shrink-0"
                    title="Send forward"
                  >
                    {isSending ? (
                      <Loader2 size={13} className="animate-spin" />
                    ) : (
                      <Send size={13} />
                    )}
                  </button>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
