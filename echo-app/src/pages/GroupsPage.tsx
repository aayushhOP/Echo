import React, { useState } from "react";
import { useChatStore } from "../store/chatStore";
import { useAuthStore } from "../store/authStore";
import { Users, Plus, MessageSquare, ShieldCheck, ChevronRight, Search } from "lucide-react";
import { CreateGroupModal } from "../components/chat/CreateGroupModal";
import { messageApi } from "../api/messageApi";
import { useNavigate } from "react-router-dom";
import { formatTime } from "../utils/date";

export const GroupsPage: React.FC = () => {
  const navigate = useNavigate();
  const conversations = useChatStore((state) => state.conversations);
  const setActiveConversationId = useChatStore((state) => state.setActiveConversationId);
  const addOrUpdateConversation = useChatStore((state) => state.addOrUpdateConversation);
  const currentUser = useAuthStore((state) => state.user);
  const currentUserId = currentUser?.id || (currentUser as any)?._id;

  const [searchQuery, setSearchQuery] = useState("");
  const [isCreateGroupOpen, setIsCreateGroupOpen] = useState(false);

  // Filter conversations to group chats only
  const groupConversations = conversations.filter((c) => c.type === "group");

  const filteredGroups = groupConversations.filter((g) => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    const nameMatch = (g.groupName || g.name || "Group").toLowerCase().includes(q);
    const memberMatch = g.participants?.some((p) => p.username?.toLowerCase().includes(q));
    return nameMatch || memberMatch;
  });

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
      navigate("/chat");
    } catch (err: any) {
      console.error("Failed to create group:", err);
      alert(err.response?.data?.message || err.message || "Failed to create group");
    }
  };

  const handleSelectGroup = (groupId: string) => {
    setActiveConversationId(groupId);
    navigate("/chat");
  };

  return (
    <div className="flex-1 h-full flex flex-col bg-[#13141d] overflow-y-auto">
      {/* Top Bar */}
      <div className="h-20 border-b border-white/[0.06] px-8 flex items-center justify-between shrink-0 bg-[#171824]/40 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-2xl bg-[#0066ff]/10 text-[#0066ff] border border-[#0066ff]/20">
            <Users size={22} />
          </div>
          <div>
            <h1 className="text-lg font-bold text-white tracking-tight">Groups</h1>
            <p className="text-xs text-slate-400">
              {groupConversations.length} group{groupConversations.length !== 1 ? "s" : ""} joined or created
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setIsCreateGroupOpen(true)}
          className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-semibold bg-[#0066ff] hover:bg-[#0052cc] text-white shadow-lg shadow-[#0066ff]/20 transition-all cursor-pointer"
        >
          <Plus size={16} />
          <span>New Group</span>
        </button>
      </div>

      {/* Search Bar */}
      <div className="p-8 pb-4 max-w-4xl mx-auto w-full">
        <div className="relative">
          <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search groups by name or member..."
            className="w-full h-12 pl-11 pr-4 rounded-2xl bg-[#171824] border border-white/[0.06] text-white text-xs placeholder-slate-500 focus:outline-none focus:border-[#0066ff] focus:ring-2 focus:ring-[#0066ff]/20 transition-all shadow-sm"
          />
        </div>
      </div>

      {/* Groups Grid / List */}
      <div className="p-8 pt-2 max-w-4xl mx-auto w-full flex-1">
        {filteredGroups.length === 0 ? (
          <div className="text-center py-16 px-4 rounded-3xl bg-[#171824]/30 border border-white/[0.04]">
            <div className="w-14 h-14 rounded-2xl bg-[#0066ff]/10 text-[#0066ff] flex items-center justify-center mx-auto mb-3">
              <Users size={26} />
            </div>
            <h3 className="text-sm font-semibold text-white">No groups found</h3>
            <p className="text-xs text-slate-400 mt-1 max-w-xs mx-auto">
              {searchQuery
                ? "No group matched your search query. Try another keyword."
                : "You have not created or joined any groups yet."}
            </p>
            {!searchQuery && (
              <button
                type="button"
                onClick={() => setIsCreateGroupOpen(true)}
                className="mt-4 px-4 py-2 rounded-xl text-xs font-semibold bg-[#0066ff] hover:bg-[#0052cc] text-white transition cursor-pointer"
              >
                Create your first group
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredGroups.map((group) => {
              const isAdmin =
                group.admins?.some(
                  (a) => a === currentUserId || (typeof a === "object" && (a as any)?._id === currentUserId)
                ) ||
                group.groupParticipants?.some((gp: any) => {
                  const uid = typeof gp.userId === "string" ? gp.userId : gp.userId?._id || gp.userId?.id;
                  return uid === currentUserId && gp.role === "admin";
                }) ||
                group.creatorId === currentUserId;

              const isCreator = group.creatorId === currentUserId;
              const memberCount = group.participants?.length || 0;
              const lastMsgTime = group.lastMessage?.createdAt
                ? formatTime(group.lastMessage.createdAt)
                : "";

              return (
                <div
                  key={group._id}
                  onClick={() => handleSelectGroup(group._id)}
                  className="p-5 rounded-2xl bg-[#171824] border border-white/[0.06] hover:border-[#0066ff]/40 transition-all cursor-pointer group shadow-lg flex flex-col justify-between"
                >
                  <div className="flex items-start gap-3.5">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-[#0052cc] to-[#0066ff] flex items-center justify-center text-white shrink-0 font-bold text-base shadow-md shadow-[#0066ff]/20">
                      {group.groupName ? group.groupName.slice(0, 2).toUpperCase() : "GP"}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <h3 className="text-sm font-semibold text-white truncate group-hover:text-[#0066ff] transition-colors">
                          {group.groupName || group.name || "Group"}
                        </h3>
                        {lastMsgTime && (
                          <span className="text-[10px] text-slate-500 shrink-0 font-mono">
                            {lastMsgTime}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-slate-400">
                          {memberCount} member{memberCount !== 1 ? "s" : ""}
                        </span>
                        {isAdmin && (
                          <span className="text-[10px] px-2 py-0.5 rounded-md bg-[#0066ff]/15 text-[#0066ff] border border-[#0066ff]/30 font-medium flex items-center gap-1">
                            <ShieldCheck size={11} />
                            {isCreator ? "Creator" : "Admin"}
                          </span>
                        )}
                      </div>

                      {(group.lastMessage?.content || group.lastMessage?.type) && (
                        <p className="text-xs text-slate-400 truncate mt-2">
                          <span className="text-slate-300 font-medium">
                            {typeof group.lastMessage.senderId === "object"
                              ? group.lastMessage.senderId.username
                              : "Member"}
                            :
                          </span>{" "}
                          {group.lastMessage.type === "image"
                            ? "📷 Photo"
                            : group.lastMessage.type === "audio"
                            ? "🎤 Voice message"
                            : group.lastMessage.type === "file"
                            ? `📎 ${group.lastMessage.fileName || "Attachment"}`
                            : group.lastMessage.content}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-white/[0.04] flex items-center justify-between text-xs text-slate-400 group-hover:text-white transition-colors">
                    <span className="flex items-center gap-1.5 text-[11px] text-[#0066ff]">
                      <MessageSquare size={13} /> Open group chat
                    </span>
                    <ChevronRight size={14} className="group-hover:translate-x-1 transition-transform" />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Create Group Modal */}
      <CreateGroupModal
        isOpen={isCreateGroupOpen}
        onClose={() => setIsCreateGroupOpen(false)}
        onCreateGroup={handleCreateGroup}
      />
    </div>
  );
};
