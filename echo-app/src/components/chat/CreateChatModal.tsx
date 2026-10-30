import { FC, useState } from "react";
import { UserSearchItem } from "../../types/user";
import { userApi } from "../../api/userApi";
import { messageApi } from "../../api/messageApi";
import { useChatStore } from "../../store/chatStore";
import { Avatar } from "../common/Avatar";
import { X, Search, Users, User as UserIcon, Loader2 } from "lucide-react";
import { cn } from "../../utils/cn";

interface CreateChatModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CreateChatModal: FC<CreateChatModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [tab, setTab] = useState<"direct" | "group">("direct");
  const [query, setQuery] = useState("");
  const [groupName, setGroupName] = useState("");
  const [searchResults, setSearchResults] = useState<UserSearchItem[]>([]);
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<UserSearchItem[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { addOrUpdateConversation, setActiveConversationId } = useChatStore();

  if (!isOpen) return null;

  const handleSearch = async (val: string) => {
    setQuery(val);
    if (!val.trim()) {
      setSearchResults([]);
      return;
    }
    setIsSearching(true);
    try {
      const results = await userApi.search(val.trim());
      setSearchResults(results);
    } catch (err) {
      console.error("Search error", err);
    } finally {
      setIsSearching(false);
    }
  };

  const toggleSelectUser = (user: UserSearchItem) => {
    if (tab === "direct") {
      createDirectChat(user.id);
    } else {
      if (selectedUserIds.includes(user.id)) {
        setSelectedUserIds((prev) => prev.filter((id) => id !== user.id));
        setSelectedUsers((prev) => prev.filter((u) => u.id !== user.id));
      } else {
        setSelectedUserIds((prev) => [...prev, user.id]);
        setSelectedUsers((prev) => [...prev, user]);
      }
    }
  };

  const createDirectChat = async (participantId: string) => {
    setIsSubmitting(true);
    try {
      const conversation = await messageApi.createConversation({
        type: "direct",
        participantId,
      });
      addOrUpdateConversation(conversation);
      setActiveConversationId(conversation._id);
      onClose();
    } catch (err) {
      console.error("Failed to create direct conversation", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const createGroupChat = async () => {
    if (!groupName.trim() || selectedUserIds.length === 0) return;
    setIsSubmitting(true);
    try {
      const conversation = await messageApi.createConversation({
        type: "group",
        groupName: groupName.trim(),
        participants: selectedUserIds,
      });
      addOrUpdateConversation(conversation);
      setActiveConversationId(conversation._id);
      onClose();
    } catch (err) {
      console.error("Failed to create group conversation", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4">
      <div className="bg-[#111622] border border-slate-700/80 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <h2 className="text-base font-bold text-white tracking-tight">New Conversation</h2>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab selection */}
        <div className="flex border-b border-slate-800">
          <button
            onClick={() => setTab("direct")}
            className={cn(
              "flex-1 py-3 text-xs font-semibold flex items-center justify-center gap-2 border-b-2 transition-all cursor-pointer",
              tab === "direct"
                ? "border-indigo-500 text-indigo-400 bg-indigo-500/5"
                : "border-transparent text-slate-400 hover:text-slate-200"
            )}
          >
            <UserIcon className="w-4 h-4" />
            Direct Message
          </button>
          <button
            onClick={() => setTab("group")}
            className={cn(
              "flex-1 py-3 text-xs font-semibold flex items-center justify-center gap-2 border-b-2 transition-all cursor-pointer",
              tab === "group"
                ? "border-indigo-500 text-indigo-400 bg-indigo-500/5"
                : "border-transparent text-slate-400 hover:text-slate-200"
            )}
          >
            <Users className="w-4 h-4" />
            New Group
          </button>
        </div>

        {/* Form Body */}
        <div className="p-4 flex-1 overflow-y-auto space-y-4">
          {tab === "group" && (
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Group Name
              </label>
              <input
                type="text"
                placeholder="e.g. Study Group, Project Team"
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                className="w-full bg-[#181f2f] text-slate-200 placeholder-slate-500 text-sm px-3.5 py-2.5 rounded-xl border border-slate-700/60 focus:border-indigo-500 focus:outline-none transition-colors"
              />
            </div>
          )}

          {/* User Search Input */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              {tab === "direct" ? "Search for a user" : "Add participants"}
            </label>
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              <input
                type="text"
                placeholder="Search username or email..."
                value={query}
                onChange={(e) => handleSearch(e.target.value)}
                className="w-full bg-[#181f2f] text-slate-200 placeholder-slate-500 text-sm pl-9 pr-3.5 py-2.5 rounded-xl border border-slate-700/60 focus:border-indigo-500 focus:outline-none transition-colors"
              />
              {isSearching && (
                <Loader2 className="w-4 h-4 animate-spin text-indigo-400 absolute right-3 top-3" />
              )}
            </div>
          </div>

          {/* Group: Selected users pill display */}
          {tab === "group" && selectedUsers.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-1">
              {selectedUsers.map((u) => (
                <div
                  key={u.id}
                  className="bg-indigo-950/60 border border-indigo-500/30 text-indigo-200 text-xs px-2.5 py-1 rounded-full flex items-center gap-1.5"
                >
                  <span>{u.username}</span>
                  <button
                    type="button"
                    onClick={() => toggleSelectUser(u)}
                    className="hover:text-white"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Search Result List */}
          <div className="space-y-1.5 pt-2">
            {searchResults.map((user) => {
              const isSelected = selectedUserIds.includes(user.id);
              return (
                <div
                  key={user.id}
                  onClick={() => toggleSelectUser(user)}
                  className={cn(
                    "flex items-center justify-between p-2.5 rounded-xl cursor-pointer transition-colors border",
                    isSelected
                      ? "bg-indigo-600/15 border-indigo-500/50"
                      : "bg-[#181f2f]/60 hover:bg-[#181f2f] border-slate-800"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <Avatar name={user.username} avatarUrl={user.avatarUrl} size="sm" />
                    <div>
                      <p className="text-xs font-semibold text-white">{user.username}</p>
                      {user.status && (
                        <p className="text-[11px] text-slate-400">{user.status}</p>
                      )}
                    </div>
                  </div>
                  {tab === "group" && (
                    <div
                      className={cn(
                        "w-5 h-5 rounded-md border flex items-center justify-center transition-colors",
                        isSelected
                          ? "bg-indigo-600 border-indigo-600 text-white"
                          : "border-slate-600"
                      )}
                    >
                      {isSelected && <span className="text-xs">✓</span>}
                    </div>
                  )}
                </div>
              );
            })}

            {query.trim().length > 0 && !isSearching && searchResults.length === 0 && (
              <div className="text-center py-6 text-slate-500 text-xs">
                No users found matching "{query}"
              </div>
            )}
          </div>
        </div>

        {/* Footer (Group Only) */}
        {tab === "group" && (
          <div className="p-4 border-t border-slate-800 flex justify-end gap-2 bg-[#0e121b]">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-300 hover:bg-slate-800 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              disabled={isSubmitting || !groupName.trim() || selectedUserIds.length === 0}
              onClick={createGroupChat}
              className="px-4 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white shadow-md shadow-indigo-600/20 transition-all cursor-pointer flex items-center gap-2"
            >
              {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Create Group ({selectedUserIds.length})
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

// Also export alias NewConversationModal for backwards compatibility
export const NewConversationModal = CreateChatModal;
