import { FC, useState, useMemo } from "react";
import { IReaction, IReactionUser } from "../../types/message";
import { Avatar } from "../common/Avatar";
import { SmilePlus, X } from "lucide-react";

interface ReactionsDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  reactions: IReaction[];
  currentUserId: string;
  onRemoveReaction: (emoji: string) => void;
  onAddReactionClick: () => void;
}

export const ReactionsDetailModal: FC<ReactionsDetailModalProps> = ({
  isOpen,
  onClose,
  reactions,
  currentUserId,
  onRemoveReaction,
  onAddReactionClick,
}) => {
  const [selectedTab, setSelectedTab] = useState<string>("all");

  // Flatten all reactions with their respective user info
  const allReactors = useMemo(() => {
    const list: { user: IReactionUser; emoji: string }[] = [];
    for (const r of reactions) {
      for (const u of r.users) {
        const userObj: IReactionUser =
          typeof u === "string"
            ? { _id: u, username: u === currentUserId ? "You" : "User" }
            : u;
        list.push({ user: userObj, emoji: r.emoji });
      }
    }
    // Put current user on top if present
    list.sort((a, b) => {
      const isACurrent = a.user._id === currentUserId;
      const isBCurrent = b.user._id === currentUserId;
      if (isACurrent && !isBCurrent) return -1;
      if (!isACurrent && isBCurrent) return 1;
      return 0;
    });
    return list;
  }, [reactions, currentUserId]);

  const totalCount = allReactors.length;

  // Filtered reactors based on selected tab
  const displayedReactors = useMemo(() => {
    if (selectedTab === "all") return allReactors;
    return allReactors.filter((item) => item.emoji === selectedTab);
  }, [allReactors, selectedTab]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-2xl bg-[#171824] border border-white/[0.08] shadow-2xl flex flex-col overflow-hidden text-left animate-in fade-in zoom-in-95 slide-in-from-bottom-4 duration-250 ease-out"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header / Tabs */}
        <div className="px-4 pt-3 pb-2 border-b border-white/[0.08] flex items-center justify-between gap-2">
          {/* Reaction Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none py-1">
            {/* Add Reaction Button (+) */}
            <button
              type="button"
              onClick={() => {
                onClose();
                onAddReactionClick();
              }}
              title="Add reaction"
              className="p-1.5 rounded-full hover:bg-white/[0.08] text-slate-400 hover:text-white transition-colors shrink-0 cursor-pointer"
            >
              <SmilePlus className="w-5 h-5" />
            </button>

            {/* "All" Tab */}
            <button
              type="button"
              onClick={() => setSelectedTab("all")}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors shrink-0 cursor-pointer flex items-center gap-1.5 ${
                selectedTab === "all"
                  ? "bg-[#0066ff]/20 text-[#0066ff] border border-[#0066ff]/40"
                  : "text-slate-400 hover:text-white hover:bg-white/[0.05]"
              }`}
            >
              <span>All</span>
              <span className="text-[11px] opacity-80">{totalCount}</span>
            </button>

            {/* Individual Emoji Tabs */}
            {reactions.map((r) => {
              const count = r.users.length;
              const isSelected = selectedTab === r.emoji;
              return (
                <button
                  key={r.emoji}
                  type="button"
                  onClick={() => setSelectedTab(r.emoji)}
                  className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors shrink-0 cursor-pointer flex items-center gap-1.5 ${
                    isSelected
                      ? "bg-[#0066ff]/20 text-[#0066ff] border border-[#0066ff]/40"
                      : "text-slate-400 hover:text-white hover:bg-white/[0.05]"
                  }`}
                >
                  <span className="text-sm">{r.emoji}</span>
                  <span className="text-[11px] opacity-80">{count}</span>
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/[0.06] transition-colors shrink-0 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Reactors List */}
        <div className="max-h-72 overflow-y-auto divide-y divide-white/[0.04] p-2">
          {displayedReactors.length === 0 ? (
            <div className="py-6 text-center text-xs text-slate-400">
              No reactions
            </div>
          ) : (
            displayedReactors.map(({ user, emoji }) => {
              const isMe = user._id === currentUserId;
              return (
                <div
                  key={`${user._id}-${emoji}`}
                  onClick={() => {
                    if (isMe) {
                      onRemoveReaction(emoji);
                      onClose();
                    }
                  }}
                  className={`flex items-center justify-between px-3 py-2.5 rounded-xl transition-colors ${
                    isMe
                      ? "hover:bg-white/[0.06] cursor-pointer group"
                      : "hover:bg-white/[0.02]"
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <Avatar
                      name={user.username || "User"}
                      avatarUrl={user.avatarUrl}
                      size="md"
                    />
                    <div className="flex flex-col min-w-0">
                      <span className="text-sm font-medium text-slate-100 truncate">
                        {isMe ? "You" : user.username || "User"}
                      </span>
                      {isMe && (
                        <span className="text-[11px] text-slate-400 group-hover:text-rose-400 transition-colors">
                          Click to remove
                        </span>
                      )}
                    </div>
                  </div>

                  <span className="text-lg shrink-0 ml-3">{emoji}</span>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
