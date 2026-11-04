import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Search, X, User, MessageSquare, Sparkles, UserPlus, Check, Loader2 } from "lucide-react";
import { userApi } from "../../api/userApi";
import { messageApi } from "../../api/messageApi";
import { useContactStore } from "../../store/contactStore";
import { useChatStore } from "../../store/chatStore";
import { useAuthStore } from "../../store/authStore";
import { UserSearchItem } from "../../types/user";

interface NewConversationFullScreenProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectUserToChat?: (targetUser: any) => void;
}

export const NewConversationFullScreen: React.FC<NewConversationFullScreenProps> = ({
  isOpen,
  onClose,
  onSelectUserToChat,
}) => {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState("");
  const [results, setResults] = useState<UserSearchItem[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [startingChatUserId, setStartingChatUserId] = useState<string | null>(null);

  const { isContactSaved, openAddContactModal } = useContactStore();
  const { addOrUpdateConversation, setActiveConversationId } = useChatStore();
  const currentUser = useAuthStore((state) => state.user);
  const myId = currentUser?._id || currentUser?.id;
  const myClerkId = currentUser?.clerkId;

  // Debounced search by username
  useEffect(() => {
    if (!searchTerm.trim()) {
      setResults([]);
      setIsSearching(false);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const users = await userApi.search(searchTerm.trim());
        // Filter out current user
        const filtered = (users || []).filter((u: UserSearchItem) => {
          const uId = u.id || u._id;
          return uId !== myId && (!myClerkId || u.clerkId !== myClerkId);
        });
        setResults(filtered);
      } catch (err) {
        console.error("User search failed:", err);
      } finally {
        setIsSearching(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [searchTerm, myId, myClerkId]);

  if (!isOpen) return null;

  const handleStartChat = async (user: UserSearchItem) => {
    const targetId = user.id || user._id;
    if (!targetId) return;

    try {
      setStartingChatUserId(targetId);
      const conversation = await messageApi.createConversation({
        type: "direct",
        participantId: targetId,
      });

      addOrUpdateConversation(conversation);
      setActiveConversationId(conversation._id);

      if (onSelectUserToChat) {
        onSelectUserToChat(user);
      }

      onClose();
      navigate("/chat");
    } catch (err: any) {
      console.error("Failed to start direct conversation:", err);
      alert(err.response?.data?.message || err.message || "Failed to start chat");
    } finally {
      setStartingChatUserId(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[#13141d]/95 backdrop-blur-xl animate-in fade-in duration-200">
      {/* Top Header */}
      <div className="h-20 border-b border-white/[0.06] px-8 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-2xl bg-[#0066ff]/10 text-[#0066ff] border border-[#0066ff]/20">
            <MessageSquare size={22} />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white tracking-tight">New Conversation</h2>
            <p className="text-xs text-slate-400">Search anyone on Echo by their unique username</p>
          </div>
        </div>

        <button
          onClick={onClose}
          className="p-2.5 rounded-full text-slate-400 hover:text-white hover:bg-white/[0.06] transition-colors cursor-pointer"
          title="Close search"
        >
          <X size={22} />
        </button>
      </div>

      {/* Main Search Content Area */}
      <div className="flex-1 max-w-3xl w-full mx-auto px-6 py-10 flex flex-col min-h-0">
        {/* Search Input Box */}
        <div className="relative w-full shrink-0">
          <Search size={20} className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Type a unique username to search..."
            autoFocus
            className="w-full h-14 pl-14 pr-16 rounded-2xl bg-[#171824] border border-white/[0.08] text-white placeholder-slate-500 text-sm focus:outline-none focus:border-[#0066ff] focus:ring-4 focus:ring-[#0066ff]/10 transition-all shadow-xl"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm("")}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white text-xs px-2 py-1 rounded-md hover:bg-white/[0.06] transition-colors"
            >
              Clear
            </button>
          )}
        </div>

        {/* Results / Empty States */}
        <div className="flex-1 mt-6 overflow-y-auto space-y-2.5 pr-1">
          {isSearching ? (
            <div className="text-center py-16 text-xs text-slate-500 animate-pulse">
              Searching directory...
            </div>
          ) : results.length > 0 ? (
            results.map((user) => {
              const uId = user.id || user._id || "";
              const alreadySaved =
                isContactSaved(user.clerkId) ||
                isContactSaved(uId) ||
                isContactSaved(user.username);

              return (
                <div
                  key={uId}
                  className="flex items-center justify-between p-4 rounded-2xl bg-[#171824]/60 hover:bg-[#171824] border border-white/[0.04] hover:border-[#0066ff]/30 transition-all shadow-md group"
                >
                  {/* Left: Avatar & Username info */}
                  <div className="flex items-center gap-4 min-w-0">
                    <div className="w-12 h-12 rounded-full bg-slate-800 border border-white/10 flex items-center justify-center overflow-hidden shrink-0">
                      {user.avatarUrl ? (
                        <img src={user.avatarUrl} alt={user.username} className="w-full h-full object-cover" />
                      ) : (
                        <User size={20} className="text-slate-400" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-semibold text-white truncate">
                          @{user.username}
                        </h3>
                        {alreadySaved && (
                          <span className="flex items-center gap-1 text-[10px] font-medium text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                            <Check size={10} />
                            Contact
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-400 line-clamp-1 mt-0.5">
                        {user.status || "Hey there! I am using Echo."}
                      </p>
                    </div>
                  </div>

                  {/* Right: Actions (Add to Contact + Start Chat) */}
                  <div className="flex items-center gap-2 shrink-0">
                    {!alreadySaved && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          openAddContactModal({
                            contactUserId: user.clerkId || uId,
                            targetMongoId: uId,
                            username: user.username,
                            savedName: user.username,
                            email: (user as any).email || "",
                            phoneNumber: (user as any).phone || "",
                          });
                        }}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium bg-white/[0.06] hover:bg-white/[0.12] text-slate-200 hover:text-white transition-colors border border-white/[0.08] cursor-pointer"
                        title="Save to contacts"
                      >
                        <UserPlus size={14} className="text-[#0066ff]" />
                        <span>Add Contact</span>
                      </button>
                    )}

                    <button
                      type="button"
                      disabled={startingChatUserId === uId}
                      onClick={() => handleStartChat(user)}
                      className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-[#0066ff] hover:bg-[#0052cc] text-white transition-all shadow-md shadow-[#0066ff]/20 active:scale-95 cursor-pointer disabled:opacity-50"
                    >
                      {startingChatUserId === uId ? (
                        <Loader2 size={13} className="animate-spin" />
                      ) : (
                        <MessageSquare size={13} />
                      )}
                      <span>{startingChatUserId === uId ? "Starting..." : "Start Chat"}</span>
                    </button>
                  </div>
                </div>
              );
            })
          ) : searchTerm ? (
            <div className="text-center py-16">
              <p className="text-sm font-medium text-white">No user found with @{searchTerm}</p>
              <p className="text-xs text-slate-400 mt-1">Make sure the username is spelled correctly</p>
            </div>
          ) : (
            <div className="text-center py-20 text-slate-500">
              <Sparkles className="mx-auto mb-3 h-8 w-8 text-[#0066ff]/40" />
              <p className="text-sm">Find friends and colleagues by typing their exact username above</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
