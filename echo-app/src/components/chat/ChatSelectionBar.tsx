import { FC } from "react";
import { X, Trash2, CheckCheck } from "lucide-react";
import { useChatStore } from "../../store/chatStore";

interface ChatSelectionBarProps {
  totalMessageCount: number;
  allMessageIds: string[];
  onDeleteSelected: (ids: string[]) => void;
  isDeleting?: boolean;
}

export const ChatSelectionBar: FC<ChatSelectionBarProps> = ({
  totalMessageCount,
  allMessageIds,
  onDeleteSelected,
  isDeleting = false,
}) => {
  const {
    isSelectionMode,
    selectedMessageIds,
    exitSelectionMode,
    selectAllMessages,
  } = useChatStore();

  if (!isSelectionMode) return null;

  const isAllSelected =
    selectedMessageIds.length === totalMessageCount && totalMessageCount > 0;

  return (
    <div className="h-16 bg-[#171824] border-b border-white/[0.06] px-4 md:px-6 flex items-center justify-between animate-in slide-in-from-top duration-150 z-20 shrink-0">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={exitSelectionMode}
          className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/[0.05] transition-colors cursor-pointer"
          title="Cancel selection"
        >
          <X size={18} />
        </button>
        <span className="text-sm font-semibold text-white">
          {selectedMessageIds.length} selected
        </span>
      </div>

      <div className="flex items-center gap-2">
        {/* Toggle Select All */}
        <button
          type="button"
          onClick={() => {
            if (isAllSelected) {
              selectAllMessages([]);
            } else {
              selectAllMessages(allMessageIds);
            }
          }}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-300 hover:text-white hover:bg-white/[0.05] transition-colors cursor-pointer"
        >
          <CheckCheck size={15} />
          <span>{isAllSelected ? "Deselect All" : "Select All"}</span>
        </button>

        {/* Delete Selected Messages */}
        <button
          type="button"
          disabled={selectedMessageIds.length === 0 || isDeleting}
          onClick={() => onDeleteSelected(selectedMessageIds)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
        >
          <Trash2 size={15} />
          <span>{isDeleting ? "Deleting..." : "Delete"}</span>
        </button>
      </div>
    </div>
  );
};
