import { FC } from "react";
import { Search, X } from "lucide-react";
import { useChatStore } from "../../store/chatStore";

export const ChatSearchBar: FC = () => {
  const { isSearchOpen, searchQuery, setSearchQuery, toggleSearch } = useChatStore();

  if (!isSearchOpen) return null;

  return (
    <div className="h-12 bg-[#171824] border-b border-white/[0.06] px-4 flex items-center gap-2 animate-in slide-in-from-top-2 duration-150 relative z-20 shrink-0">
      <Search size={16} className="text-slate-400 shrink-0" />
      <input
        type="text"
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        placeholder="Search in this chat..."
        autoFocus
        className="flex-1 bg-transparent text-xs text-white placeholder-slate-500 focus:outline-none"
      />
      {searchQuery && (
        <button
          type="button"
          onClick={() => setSearchQuery("")}
          className="text-slate-400 hover:text-white p-1 rounded-md hover:bg-white/[0.04] transition-colors cursor-pointer"
          title="Clear search"
        >
          <X size={14} />
        </button>
      )}
      <button
        type="button"
        onClick={toggleSearch}
        className="text-xs text-slate-300 hover:text-white px-2.5 py-1 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] transition-colors cursor-pointer font-medium"
      >
        Done
      </button>
    </div>
  );
};
