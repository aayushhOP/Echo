import { FC, useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { messageApi } from "../../api/messageApi";
import { useChatStore } from "../../store/chatStore";
import { useAuthStore } from "../../store/authStore";
import { useContactStore } from "../../store/contactStore";
import { Avatar } from "../common/Avatar";
import { NewConversationFullScreen } from "./NewConversationFullScreen";
import { CreateGroupModal } from "./CreateGroupModal";
import { UndoSnackbar } from "./UndoSnackbar";
import { formatTime } from "../../utils/date";
import { getOtherParticipant } from "../../utils/chatUtils";
import { Plus, Users, MessageSquare, Loader2, Search, BellOff, Pin } from "lucide-react";
import { cn } from "../../utils/cn";

export const ConversationList: FC = () => {
  const [isNewConvoOpen, setIsNewConvoOpen] = useState(false);
  const [isGroupModalOpen, setIsGroupModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const currentUser = useAuthStore((state) => state.user);
  const getContactDisplayName = useContactStore((state) => state.getContactDisplayName);
  const {
    conversations,
    setConversations,
    activeConversationId,
    setActiveConversationId,
    addOrUpdateConversation,
    onlineUsers,
    typingUsers,
    undoDeleteState,
    setUndoDeleteState,
    restoreMessageForMe,
  } = useChatStore();

  const handleCreateGroup = async (groupName: string, selectedUserIds: string[]) => {
    try {
      const conv = await messageApi.createConversation({
        type: "group",
        groupName,
        participants: selectedUserIds,
        participantIds: selectedUserIds,
      });
      addOrUpdateConversation(conv);
      setActiveConversationId(conv._id);
    } catch (err: any) {
      console.error("Failed to create group:", err);
      alert(err.response?.data?.message || err.message || "Failed to create group");
    }
  };

  const handleUndoDeleteForMe = async (messageId: string) => {
    if (!undoDeleteState) return;
    const { conversationId, message } = undoDeleteState;
    setUndoDeleteState(null);

    if (message) {
      restoreMessageForMe(conversationId, message);
    }

    try {
      const res = await messageApi.undoDeleteForMe(messageId);
      if (res.success && res.message) {
        restoreMessageForMe(conversationId, res.message);
      }
    } catch (err) {
      console.error("Failed to undo delete for me:", err);
    }
  };

  const { isLoading } = useQuery({
    queryKey: ["conversations"],
    queryFn: async () => {
      const data = await messageApi.getConversations();
      setConversations(data);
      return data;
    },
    staleTime: 1000 * 30, // 30s
  });

  // Filter conversations by search term, sort pinned conversations to top, and hide empty direct chats from the list
  const filteredConversations = useMemo(() => {
    const query = searchQuery.toLowerCase().trim();

    return conversations
      .filter((conv) => {
        // Direct chats should only appear in the sidebar if they have at least one message
        if (conv.type === "direct" && !conv.lastMessage) {
          return false;
        }

        if (!query) return true;

        const isGroup = conv.type === "group";
        if (isGroup) {
          return conv.groupName?.toLowerCase().includes(query);
        }

        const otherParticipant = getOtherParticipant(conv.participants, currentUser);

        return otherParticipant?.username.toLowerCase().includes(query);
      })
      .sort((a, b) => {
        // Pinned conversations always on top
        if (Boolean(a.isPinned) !== Boolean(b.isPinned)) {
          return a.isPinned ? -1 : 1;
        }
        const timeA = a.lastMessage?.createdAt
          ? new Date(a.lastMessage.createdAt).getTime()
          : new Date((a as any).updatedAt || (a as any).createdAt || 0).getTime();
        const timeB = b.lastMessage?.createdAt
          ? new Date(b.lastMessage.createdAt).getTime()
          : new Date((b as any).updatedAt || (b as any).createdAt || 0).getTime();
        return timeB - timeA;
      });
  }, [conversations, searchQuery, currentUser]);

  const visibleConversationsCount = useMemo(() => {
    return conversations.filter((c) => c.type === "group" || !!c.lastMessage).length;
  }, [conversations]);

  return (
    <aside className="w-full h-full flex flex-col bg-[#161722] border-r border-white/[0.04] shrink-0 select-none relative">
      {/* Header with Title and + New Chat button */}
      <div className="p-4 border-b border-white/[0.04] flex items-center justify-between">
        <div>
          <h1 className="text-base font-bold text-white tracking-tight">Chats</h1>
          <p className="text-[11px] text-[#767b93]">
            {visibleConversationsCount} conversation{visibleConversationsCount !== 1 ? "s" : ""}
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setIsGroupModalOpen(true)}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] text-xs font-semibold text-slate-200 hover:text-white transition-all cursor-pointer border border-white/[0.08]"
            title="Create new group"
          >
            <Users className="w-3.5 h-3.5 text-[#0066ff]" />
            <span className="hidden sm:inline">New Group</span>
          </button>
          <button
            onClick={() => setIsNewConvoOpen(true)}
            className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-[#0066ff] hover:bg-[#005ce6] text-xs font-semibold text-white shadow-md shadow-[#0066ff]/25 transition-all cursor-pointer"
            title="Start new chat"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Chat</span>
          </button>
        </div>
      </div>

      {/* Full-width dark search container */}
      <div className="px-3 pt-3 pb-2">
        <div className="relative">
          <Search className="w-4 h-4 text-[#505469] absolute left-3 top-3" />
          <input
            type="text"
            placeholder="Search conversations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-[#13141d] text-white placeholder-[#505469] border border-transparent focus:border-white/[0.06] rounded-xl pl-9 pr-3 py-2.5 text-xs focus:outline-none transition-colors"
          />
        </div>
      </div>

      {/* Conversations Scroll Area */}
      <div className="flex-1 overflow-y-auto px-2.5 py-1.5 space-y-1">
        {isLoading && (
          <div className="flex flex-col items-center justify-center p-8 text-[#767b93]">
            <Loader2 className="w-5 h-5 animate-spin mb-2 text-[#0066ff]" />
            <span className="text-xs">Loading conversations...</span>
          </div>
        )}

        {!isLoading && filteredConversations.length === 0 && (
          <div className="flex flex-col items-center justify-center p-8 text-center text-[#505469]">
            <MessageSquare className="w-8 h-8 mb-2 text-[#505469]/50" />
            <p className="text-xs font-medium text-[#767b93]">No chats found</p>
            <p className="text-[11px] text-[#505469] mt-1 max-w-[200px]">
              {searchQuery ? "Try a different search keyword." : "Tap New Chat to start messaging."}
            </p>
          </div>
        )}

        {filteredConversations.map((conv) => {
          const isSelected = conv._id === activeConversationId;
          const isGroup = conv.type === "group";
          const myId = currentUser?.id || (currentUser as any)?._id;
          const blockedUsers = currentUser?.blockedUsers || [];
          const blockedBy = currentUser?.blockedBy || [];

          const otherParticipant = !isGroup
            ? getOtherParticipant(conv.participants, currentUser)
            : null;

          const otherId = otherParticipant ? otherParticipant.id || (otherParticipant as any)._id : null;
          const otherClerkId = (otherParticipant as any)?.clerkId;
          const title = isGroup
            ? conv.groupName || "Group Chat"
            : otherParticipant
            ? getContactDisplayName(
                otherClerkId || otherId || otherParticipant.username,
                otherParticipant.username
              )
            : "Direct Chat";
          const isBlockedByMe = otherId ? blockedUsers.includes(otherId) : false;
          const isBlockedByOther = otherId ? blockedBy.includes(otherId) : false;
          const isBlocked =
            !isGroup &&
            Boolean(
              isBlockedByMe ||
              isBlockedByOther ||
              (otherParticipant as any)?.isBlocked ||
              (otherParticipant as any)?.blockedUsers?.includes(myId)
            );

          const isParticipantOnline =
            !isGroup && otherId && !isBlocked
              ? onlineUsers.has(otherId) || !!otherParticipant?.isOnline
              : false;

          const lastMsg = conv.lastMessage;
          const senderId =
            typeof lastMsg?.senderId === "string"
              ? lastMsg.senderId
              : (lastMsg?.senderId as any)?._id || (lastMsg?.senderId as any)?.id;
          const isSentByMe = Boolean(myId && senderId && myId === senderId);

          let lastMsgSnippet = "No messages yet";
          if (lastMsg) {
            let bodyText = "";
            if (lastMsg.isDeletedForEveryone) {
              if (isSentByMe && lastMsg.deletedBy?.role === "sender") {
                bodyText = "You deleted this message";
              } else if (lastMsg.deletedBy?.role === "admin") {
                bodyText = `This message was deleted by admin ${
                  lastMsg.deletedBy.userId === myId ? "you" : lastMsg.deletedBy.username
                }`;
              } else {
                bodyText = "This message was deleted";
              }
              lastMsgSnippet = bodyText;
            } else {
              if (lastMsg.type === "image") {
                bodyText = "📷 Photo";
              } else if (lastMsg.type === "audio") {
                bodyText = "🎤 Voice message";
              } else if (lastMsg.type === "file") {
                bodyText = `📎 ${lastMsg.fileName || "Attachment"}`;
              } else {
                bodyText = lastMsg.content || "";
              }

              // WhatsApp Desktop convention: prefix with "You: " if message is from the logged in user
              lastMsgSnippet = isSentByMe ? `You: ${bodyText}` : bodyText;
            }
          }

          const lastMsgTime = lastMsg?.createdAt ? formatTime(lastMsg.createdAt) : "";
          const unreadCount = conv.unreadCount || 0;
          const hasUnread = unreadCount > 0 && !isSelected;

          // Check if someone else in this conversation is typing while this chat is NOT open
          const convTypingMap = typingUsers[conv._id] || {};
          const isSomeoneTyping =
            !isSelected &&
            Object.entries(convTypingMap).some(
              ([userId, isTyping]) => isTyping && userId !== myId
            );

          return (
            <div
              key={conv._id}
              onClick={() => setActiveConversationId(conv._id)}
              className={cn(
                "flex items-center gap-3.5 p-3.5 rounded-2xl cursor-pointer transition-all relative",
                isSelected
                  ? "bg-[#0066ff] text-white shadow-md shadow-[#0066ff]/25"
                  : hasUnread
                  ? "bg-[#0066ff]/10 hover:bg-[#0066ff]/15 text-[#f0f2f8] border border-[#0066ff]/20"
                  : "hover:bg-white/[0.02] text-[#f0f2f8]"
              )}
            >
              {/* Avatar + Live Online Indicator */}
              <div className="relative shrink-0 flex items-center justify-center">
                {isGroup ? (
                  <div
                    className={cn(
                      "w-11 h-11 rounded-full flex items-center justify-center",
                      isSelected
                        ? "bg-white/20 text-white ring-2 ring-white/30"
                        : "bg-[#232533] text-[#767b93] ring-1 ring-white/10"
                    )}
                  >
                    <Users className="w-5 h-5" />
                  </div>
                ) : (
                  <div
                    className={cn(
                      "rounded-full flex items-center justify-center",
                      isSelected
                        ? "ring-2 ring-white/30"
                        : hasUnread
                        ? "ring-2 ring-[#0066ff]/60"
                        : "ring-1 ring-white/10"
                    )}
                  >
                    <Avatar
                      name={title}
                      avatarUrl={otherParticipant?.avatarUrl}
                      size="md"
                    />
                  </div>
                )}

                {!isGroup && isParticipantOnline && (
                  <span
                    className={cn(
                      "absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-400",
                      isSelected ? "ring-2 ring-[#0066ff]" : "ring-2 ring-[#161722]"
                    )}
                    title="Online"
                  />
                )}
              </div>

              {/* Title & snippet */}
              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-baseline mb-0.5">
                  <span
                    className={cn(
                      "text-sm truncate flex items-center gap-1.5",
                      isSelected
                        ? "font-semibold text-white"
                        : hasUnread
                        ? "font-bold text-white"
                        : "font-semibold text-[#f0f2f8]"
                    )}
                  >
                    <span className="truncate">{title}</span>
                    {conv.isMuted && (
                      <BellOff
                        className={cn(
                          "w-3.5 h-3.5 shrink-0",
                          isSelected ? "text-white/70" : "text-[#767b93]"
                        )}
                      />
                    )}
                  </span>
                  {lastMsgTime && (
                    <span
                      className={cn(
                        "text-[11px] shrink-0",
                        isSelected
                          ? "text-white/80"
                          : hasUnread
                          ? "text-[#38bdf8] font-semibold"
                          : "text-[#767b93]"
                      )}
                    >
                      {lastMsgTime}
                    </span>
                  )}
                </div>

                <div className="flex items-center justify-between gap-2">
                  {isSomeoneTyping ? (
                    <p className="text-xs truncate font-medium text-[#25d366] flex items-center gap-1.5 animate-pulse">
                      <span>typing...</span>
                    </p>
                  ) : (
                    <p
                      className={cn(
                        "text-xs truncate",
                        isSelected
                          ? "text-white/90"
                          : hasUnread
                          ? "text-slate-100 font-medium"
                          : "text-[#767b93]"
                      )}
                    >
                      {lastMsgSnippet}
                    </p>
                  )}

                  {/* Unread count badge & Pin icon */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    {conv.isPinned && (
                      <Pin
                        className={cn(
                          "w-3.5 h-3.5 rotate-45",
                          isSelected ? "text-white/80 fill-white/80" : "text-[#767b93] fill-[#767b93]"
                        )}
                      />
                    )}
                    {hasUnread && (
                      <span
                        className="rounded-full text-[11px] font-bold px-2 py-0.5 shrink-0 bg-[#0066ff] text-white shadow-sm shadow-[#0066ff]/40 animate-in fade-in zoom-in-95 duration-150"
                      >
                        {unreadCount}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Full screen new conversation search modal */}
      <NewConversationFullScreen
        isOpen={isNewConvoOpen}
        onClose={() => setIsNewConvoOpen(false)}
      />

      {/* Group creation modal restricted to saved contacts */}
      <CreateGroupModal
        isOpen={isGroupModalOpen}
        onClose={() => setIsGroupModalOpen(false)}
        onCreateGroup={handleCreateGroup}
      />

      {/* WhatsApp-style Undo Snackbar at bottom of Chat List panel */}
      <UndoSnackbar
        messageId={undoDeleteState?.messageId || null}
        onUndo={handleUndoDeleteForMe}
        onDismiss={() => setUndoDeleteState(null)}
      />
    </aside>
  );
};
