import { FC, useState } from "react";
import { UserSearchItem } from "../../types/user";
import { userApi } from "../../api/userApi";
import { messageApi } from "../../api/messageApi";
import { useChatStore } from "../../store/chatStore";
import { Avatar } from "../common/Avatar";
import { X, Search, Users, User as UserIcon, Loader2 } from "lucide-react";

interface NewConversationModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const NewConversationModal: FC<NewConversationModalProps> = ({
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <h2 className="text-base font-semibold text-white">New Conversation</h2>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-800">
          <button
            onClick={() => {
              setTab("direct");
              setSelectedUserIds([]);
              setSelectedUsers([]);
            }}
            className={`flex-1 py-3 text-xs font-medium flex items-center justify-center gap-2 border-b-2 transition-colors cursor-pointer ${
              tab === "direct"
                ? "border-indigo-500 text-indigo-400 bg-slate-800/40"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <UserIcon className="w-4 h-4" />
            Direct Message
          </button>
          <button
            onClick={() => setTab("group")}
            className={`flex-1 py-3 text-xs font-medium flex items-center justify-center gap-2 border-b-2 transition-colors cursor-pointer ${
              tab === "group"
                ? "border-indigo-500 text-indigo-400 bg-slate-800/40"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <Users className="w-4 h-4" />
            Group Chat
          </button>
        </div>

        {/* Form Body */}
        <div className="p-4 flex-1 overflow-y-auto space-y-4">
          {tab === "group" && (
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Group Name
              </label>
              <input
                type="text"
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                placeholder="e.g. Project Team"
                className="w-full bg-slate-800 border border-slate-700/80 rounded-xl px-3 py-2 text-sm text-white placeholder-slate-400 focus:outline-none focus:border-indigo-500"
              />
            </div>
          )}

          {/* Selected pills for group */}
          {tab === "group" && selectedUsers.length > 0 && (
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">
                Selected ({selectedUsers.length})
              </label>
              <div className="flex flex-wrap gap-1.5">
                {selectedUsers.map((u) => (
                  <span
                    key={u.id}
                    className="inline-flex items-center gap-1.5 bg-indigo-900/60 text-indigo-200 border border-indigo-700/50 rounded-full px-2.5 py-1 text-xs"
                  >
                    <span>{u.username}</span>
                    <button
                      type="button"
                      onClick={() => toggleSelectUser(u)}
                      className="hover:text-white cursor-pointer"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* User Search Input */}
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              Find Users
            </label>
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                value={query}
                onChange={(e) => handleSearch(e.target.value)}
                placeholder="Search by username..."
                className="w-full bg-slate-800 border border-slate-700/80 rounded-xl pl-9 pr-4 py-2 text-sm text-white placeholder-slate-400 focus:outline-none focus:border-indigo-500"
              />
              {isSearching && (
                <Loader2 className="w-4 h-4 absolute right-3 top-2.5 text-slate-400 animate-spin" />
              )}
            </div>
          </div>

          {/* Search Results */}
          <div className="space-y-1">
            {searchResults.length === 0 && query.trim() && !isSearching && (
              <p className="text-xs text-slate-400 text-center py-4">No users found</p>
            )}

            {searchResults.map((user) => {
              const isSelected = selectedUserIds.includes(user.id);
              return (
                <div
                  key={user.id}
                  onClick={() => toggleSelectUser(user)}
                  className={`flex items-center justify-between p-2.5 rounded-xl cursor-pointer transition-colors ${
                    isSelected
                      ? "bg-indigo-600/20 border border-indigo-500/40"
                      : "hover:bg-slate-800"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Avatar
                      name={user.username}
                      avatarUrl={user.avatarUrl}
                      isOnline={user.isOnline}
                      showPresence
                      size="sm"
                    />
                    <div>
                      <p className="text-sm font-medium text-white">{user.username}</p>
                      {user.status && (
                        <p className="text-xs text-slate-400 truncate max-w-[180px]">
                          {user.status}
                        </p>
                      )}
                    </div>
                  </div>

                  {tab === "group" && (
                    <div
                      className={`w-5 h-5 rounded-md border flex items-center justify-center ${
                        isSelected
                          ? "bg-indigo-600 border-indigo-600 text-white"
                          : "border-slate-600"
                      }`}
                    >
                      {isSelected && <span className="text-xs">✓</span>}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        {tab === "group" && (
          <div className="p-4 border-t border-slate-800 flex justify-end gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-medium text-slate-300 hover:bg-slate-800 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={createGroupChat}
              disabled={isSubmitting || !groupName.trim() || selectedUserIds.length === 0}
              className="px-4 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white transition-colors cursor-pointer disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Create Group
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
