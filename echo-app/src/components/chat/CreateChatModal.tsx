import React, { useState, useEffect, useRef } from "react";
import { Search, X, Users, User as UserIcon, Check, Loader2, Sparkles } from "lucide-react";
import { UserSearchItem } from "../../types/user";
import { userApi } from "../../api/userApi";
import { messageApi } from "../../api/messageApi";
import { useChatStore } from "../../store/chatStore";
import { useAuthStore } from "../../store/authStore";
import { Avatar } from "../common/Avatar";
import { cn } from "../../utils/cn";

export interface IUserSearchResult {
  _id?: string;
  id?: string;
  username: string;
  email?: string;
  avatarUrl?: string;
  isOnline?: boolean;
  status?: string;
}

export interface CreateChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUserId?: string;
  onConversationCreated?: (conversationId: string) => void;
}

export const CreateChatModal: React.FC<CreateChatModalProps> = ({
  isOpen,
  onClose,
  currentUserId: propCurrentUserId,
  onConversationCreated,
}) => {
  const [mode, setMode] = useState<"direct" | "group">("direct");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<IUserSearchResult[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<IUserSearchResult[]>([]);
  const [groupName, setGroupName] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const searchInputRef = useRef<HTMLInputElement>(null);

  const { addOrUpdateConversation, setActiveConversationId } = useChatStore();
  const authUser = useAuthStore((state) => state.user);
  const currentUserId = propCurrentUserId || authUser?.id || authUser?._id;

  // Helper to extract uniform ID
  const getUserId = (user: IUserSearchResult): string => user.id || user._id || "";

  // Reset state and focus input when modal opens
  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => searchInputRef.current?.focus(), 100);
      setError(null);
      setSearchQuery("");
      setSelectedUsers([]);
      setGroupName("");
      setSearchResults([]);
      setMode("direct");
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  // Debounced search query
  useEffect(() => {
    if (!isOpen) return;

    if (!searchQuery.trim()) {
      setSearchResults([]);
      setLoading(false);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        setLoading(true);
        setError(null);
        const users = await userApi.search(searchQuery.trim());
        // Filter out current user
        const results = (users || []).filter((u: UserSearchItem) => {
          const uid = u.id || u._id;
          return uid !== currentUserId;
        });
        setSearchResults(results);
      } catch (err: unknown) {
        const errorResponse = err as { response?: { data?: { message?: string } } };
        setError(errorResponse.response?.data?.message || "Failed to search users");
      } finally {
        setLoading(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [searchQuery, isOpen, currentUserId]);

  if (!isOpen) return null;

  const toggleSelectUser = (user: IUserSearchResult) => {
    const userId = getUserId(user);
    if (!userId) return;

    if (mode === "direct") {
      handleCreateDirect(userId);
      return;
    }

    if (selectedUsers.some((u) => getUserId(u) === userId)) {
      setSelectedUsers(selectedUsers.filter((u) => getUserId(u) !== userId));
    } else {
      setSelectedUsers([...selectedUsers, user]);
    }
  };

  const handleCreateDirect = async (recipientId: string) => {
    try {
      setSubmitting(true);
      setError(null);
      const conversation = await messageApi.createConversation({
        type: "direct",
        participantId: recipientId,
      });

      addOrUpdateConversation(conversation);
      setActiveConversationId(conversation._id);
      if (onConversationCreated) {
        onConversationCreated(conversation._id);
      }
      onClose();
    } catch (err: unknown) {
      const errorResponse = err as { response?: { data?: { message?: string } } };
      setError(errorResponse.response?.data?.message || "Failed to start chat");
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateGroup = async () => {
    if (!groupName.trim()) {
      setError("Please provide a group name");
      return;
    }
    if (selectedUsers.length < 1) {
      setError("Please select at least 1 member");
      return;
    }

    try {
      setSubmitting(true);
      setError(null);
      const participantIds = selectedUsers
        .map((u) => getUserId(u))
        .filter((id): id is string => Boolean(id));

      const conversation = await messageApi.createConversation({
        type: "group",
        groupName: groupName.trim(),
        participants: participantIds,
        participantIds,
      });

      addOrUpdateConversation(conversation);
      setActiveConversationId(conversation._id);
      if (onConversationCreated) {
        onConversationCreated(conversation._id);
      }
      onClose();
    } catch (err: unknown) {
      const errorResponse = err as { response?: { data?: { message?: string } } };
      setError(errorResponse.response?.data?.message || "Failed to create group");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-[#111622] border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col transition-all max-h-[85vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Bar */}
        <div className="h-14 px-5 border-b border-slate-800/80 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <Sparkles size={16} className="text-indigo-400" />
            <h3 className="font-semibold text-sm text-slate-100 tracking-tight">New Conversation</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition cursor-pointer"
            aria-label="Close dialog"
          >
            <X size={16} />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="px-5 pt-4 shrink-0">
          <div className="grid grid-cols-2 p-1 bg-[#181f2f] rounded-xl border border-slate-700/50">
            <button
              type="button"
              onClick={() => {
                setMode("direct");
                setSelectedUsers([]);
                setError(null);
              }}
              className={cn(
                "flex items-center justify-center gap-2 py-1.5 text-xs font-medium rounded-lg transition-all cursor-pointer",
                mode === "direct"
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "text-slate-400 hover:text-slate-200"
              )}
            >
              <UserIcon size={14} /> Direct Message
            </button>
            <button
              type="button"
              onClick={() => {
                setMode("group");
                setError(null);
              }}
              className={cn(
                "flex items-center justify-center gap-2 py-1.5 text-xs font-medium rounded-lg transition-all cursor-pointer",
                mode === "group"
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "text-slate-400 hover:text-slate-200"
              )}
            >
              <Users size={14} /> Group Chat
            </button>
          </div>
        </div>

        {/* Group Name Field (Group mode only) */}
        {mode === "group" && (
          <div className="px-5 pt-3 shrink-0">
            <input
              type="text"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              placeholder="Group name (e.g., Design Team)..."
              className="w-full bg-[#181f2f] border border-slate-700/60 rounded-xl px-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
            />
          </div>
        )}

        {/* Selected Users Chips (Group mode only) */}
        {mode === "group" && selectedUsers.length > 0 && (
          <div className="px-5 pt-2 flex flex-wrap gap-1.5 max-h-24 overflow-y-auto shrink-0">
            {selectedUsers.map((u) => {
              const uId = getUserId(u);
              return (
                <span
                  key={uId}
                  className="bg-indigo-600/20 border border-indigo-500/40 text-indigo-300 text-[11px] font-medium pl-2.5 pr-1.5 py-1 rounded-full flex items-center gap-1.5"
                >
                  {u.username}
                  <button
                    type="button"
                    onClick={() => toggleSelectUser(u)}
                    className="hover:bg-indigo-500/30 rounded-full p-0.5 transition cursor-pointer"
                  >
                    <X size={12} />
                  </button>
                </span>
              );
            })}
          </div>
        )}

        {/* Search Input Field */}
        <div className="px-5 py-3 shrink-0">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by username..."
              className="w-full bg-[#181f2f] text-slate-100 text-xs rounded-xl pl-9 pr-8 py-2 border border-slate-700/60 placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
            />
            {loading && (
              <Loader2 size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 animate-spin" />
            )}
          </div>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mx-5 mb-2 px-3 py-2 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs shrink-0">
            {error}
          </div>
        )}

        {/* User Search Results List */}
        <div className="flex-1 max-h-60 overflow-y-auto px-4 pb-3 space-y-1">
          {searchResults.length === 0 && searchQuery.trim() && !loading && (
            <p className="text-center py-6 text-xs text-slate-500">No users found</p>
          )}

          {searchResults.length === 0 && !searchQuery.trim() && (
            <p className="text-center py-6 text-xs text-slate-500">Type a name to search</p>
          )}

          {searchResults.map((user) => {
            const userId = getUserId(user);
            const isSelected = selectedUsers.some((u) => getUserId(u) === userId);
            return (
              <div
                key={userId}
                onClick={() => toggleSelectUser(user)}
                className={cn(
                  "flex items-center justify-between p-2 rounded-xl cursor-pointer transition border",
                  isSelected
                    ? "bg-[#1f293d] border-indigo-500/40"
                    : "hover:bg-[#181f2f] border-transparent"
                )}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="relative shrink-0">
                    <Avatar
                      name={user.username}
                      avatarUrl={user.avatarUrl}
                      size="sm"
                    />
                    {user.isOnline && (
                      <span className="absolute bottom-0 right-0 w-2 h-2 bg-emerald-500 border border-[#111622] rounded-full" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-slate-200 truncate">{user.username}</p>
                    {user.status && (
                      <p className="text-[10px] text-slate-400 truncate">{user.status}</p>
                    )}
                    {user.email && !user.status && (
                      <p className="text-[10px] text-slate-400 truncate">{user.email}</p>
                    )}
                  </div>
                </div>

                {mode === "group" && (
                  <div
                    className={cn(
                      "w-4 h-4 rounded border flex items-center justify-center transition-colors shrink-0",
                      isSelected
                        ? "bg-indigo-600 border-indigo-500 text-white"
                        : "border-slate-600"
                    )}
                  >
                    {isSelected && <Check size={11} />}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Footer Actions (Group mode only) */}
        {mode === "group" && (
          <div className="p-4 border-t border-slate-800/80 flex items-center justify-end gap-2 bg-[#0e121b] shrink-0">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-3 py-1.5 text-xs text-slate-400 hover:text-slate-200 transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleCreateGroup}
              disabled={submitting || selectedUsers.length === 0 || !groupName.trim()}
              className="px-4 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-xs font-medium text-white transition flex items-center gap-1.5 shadow-sm cursor-pointer"
            >
              {submitting && <Loader2 size={13} className="animate-spin" />}
              Create Group ({selectedUsers.length})
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

// Backwards compatibility alias
export const NewConversationModal = CreateChatModal;
