import React, { useState, useEffect } from "react";
import {
  X,
  Bell,
  BellOff,
  Pin,
  Search,
  FileText,
  Download,
  ShieldCheck,
  Video,
  Users,
  ExternalLink,
  Ban,
  MoreVertical,
  LogOut,
  Link,
  Settings,
  Copy,
  Check,
} from "lucide-react";
import { messageApi, MediaItem } from "../../api/messageApi";
import { userApi } from "../../api/userApi";
import { groupApi } from "../../api/groupApi";
import { GroupSettingsModal } from "./GroupSettingsModal";
import { Conversation, IGroupSettings } from "../../types/message";
import { getOtherParticipant } from "../../utils/chatUtils";
import { useChatStore } from "../../store/chatStore";
import { useAuthStore } from "../../store/authStore";

export interface ContactDetailDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  conversation: Conversation;
  currentUserId: string;
  onTogglePin: (conversationId: string) => Promise<void>;
  onToggleMute: (conversationId: string) => Promise<void>;
  onSearchClick?: () => void;
  onOpenMediaItem?: (url: string) => void;
}

export const ContactDetailDrawer: React.FC<ContactDetailDrawerProps> = ({
  isOpen,
  onClose,
  conversation,
  currentUserId,
  onTogglePin,
  onToggleMute,
  onSearchClick,
  onOpenMediaItem,
}) => {
  const [activeTab, setActiveTab] = useState<"media" | "docs">("media");
  const [mediaItems, setMediaItems] = useState<MediaItem[]>([]);
  const [loadingMedia, setLoadingMedia] = useState(false);
  const [isTogglingPin, setIsTogglingPin] = useState(false);
  const [isTogglingMute, setIsTogglingMute] = useState(false);
  const [isTogglingBlock, setIsTogglingBlock] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [isUpdatingSettings, setIsUpdatingSettings] = useState(false);
  const [inviteUrl, setInviteUrl] = useState<string>("");
  const [isGeneratingInvite, setIsGeneratingInvite] = useState(false);
  const [hasCopiedInvite, setHasCopiedInvite] = useState(false);
  const [isLeavingGroup, setIsLeavingGroup] = useState(false);
  const [activeMenuMemberId, setActiveMenuMemberId] = useState<string | null>(null);

  const onlineUsers = useChatStore((state) => state.onlineUsers);
  const currentUser = useAuthStore((state) => state.user);
  const addBlockedUser = useAuthStore((state) => state.addBlockedUser);
  const removeBlockedUser = useAuthStore((state) => state.removeBlockedUser);
  const updateGroupSettingsInConversation = useChatStore(
    (state) => state.updateGroupSettingsInConversation
  );
  const updateMemberRoleInConversation = useChatStore(
    (state) => state.updateMemberRoleInConversation
  );
  const removeMemberFromConversationState = useChatStore(
    (state) => state.removeMemberFromConversationState
  );
  const removeConversationFromList = useChatStore(
    (state) => state.removeConversationFromList
  );

  const isCurrentUserAdmin =
    conversation.type === "group" &&
    (conversation.admins?.includes(currentUserId) ||
      conversation.creatorId === currentUserId ||
      conversation.groupParticipants?.some(
        (gp: any) => {
          const uId = typeof gp.userId === "string" ? gp.userId : gp.userId?._id || gp.userId?.id;
          return uId === currentUserId && gp.role === "admin";
        }
      ));

  const handleUpdateSetting = async (key: keyof IGroupSettings, value: boolean) => {
    try {
      setIsUpdatingSettings(true);
      const res = await groupApi.updateSettings(conversation._id, { [key]: value });
      if (res.success && res.settings) {
        updateGroupSettingsInConversation(conversation._id, res.settings);
      }
    } catch (err: any) {
      alert(err.response?.data?.message || err.message || "Failed to update group setting");
    } finally {
      setIsUpdatingSettings(false);
    }
  };

  const handlePromote = async (targetUserId: string) => {
    try {
      setActiveMenuMemberId(null);
      await groupApi.promoteMember(conversation._id, targetUserId);
      updateMemberRoleInConversation(conversation._id, targetUserId, "admin");
    } catch (err: any) {
      alert(err.response?.data?.message || err.message || "Failed to promote member");
    }
  };

  const handleDemote = async (targetUserId: string) => {
    try {
      setActiveMenuMemberId(null);
      await groupApi.demoteMember(conversation._id, targetUserId);
      updateMemberRoleInConversation(conversation._id, targetUserId, "member");
    } catch (err: any) {
      alert(err.response?.data?.message || err.message || "Failed to demote member");
    }
  };

  const handleRemove = async (targetUserId: string) => {
    if (!window.confirm("Are you sure you want to remove this member?")) return;
    try {
      setActiveMenuMemberId(null);
      await groupApi.removeMember(conversation._id, targetUserId);
      removeMemberFromConversationState(conversation._id, targetUserId);
    } catch (err: any) {
      alert(err.response?.data?.message || err.message || "Failed to remove member");
    }
  };

  const handleLeaveGroup = async () => {
    if (!window.confirm("Are you sure you want to leave this group?")) return;
    try {
      setIsLeavingGroup(true);
      await groupApi.leaveGroup(conversation._id);
      removeConversationFromList(conversation._id);
      onClose();
    } catch (err: any) {
      alert(err.response?.data?.message || err.message || "Failed to leave group");
    } finally {
      setIsLeavingGroup(false);
    }
  };

  const handleGenerateInvite = async () => {
    try {
      setIsGeneratingInvite(true);
      const res = await groupApi.generateInviteLink(conversation._id);
      if (res.success) {
        setInviteUrl(res.inviteUrl);
      }
    } catch (err: any) {
      alert(err.response?.data?.message || err.message || "Failed to generate invite link");
    } finally {
      setIsGeneratingInvite(false);
    }
  };

  const handleCopyInvite = () => {
    if (!inviteUrl) return;
    navigator.clipboard.writeText(inviteUrl);
    setHasCopiedInvite(true);
    setTimeout(() => setHasCopiedInvite(false), 2000);
  };

  // Identify display counterpart for 1-on-1 chats
  const counterpart =
    conversation.type === "direct"
      ? getOtherParticipant(conversation.participants, currentUser)
      : null;

  const counterpartId = counterpart ? (counterpart as any)._id || (counterpart as any).id : null;
  const isBlocked =
    conversation.type === "direct" && counterpartId && currentUser?.blockedUsers
      ? currentUser.blockedUsers.includes(counterpartId)
      : false;

  const isOnline =
    conversation.type === "direct" && counterpartId
      ? onlineUsers.has(counterpartId) || !!counterpart?.isOnline
      : false;

  const displayName =
    conversation.type === "group"
      ? conversation.groupName || "Group Chat"
      : counterpart?.username || "User";

  const displayBio =
    (counterpart as any)?.bio ||
    (counterpart as any)?.status ||
    (conversation.type === "group"
      ? `${conversation.participants.length} participants in this group`
      : "Hey there! I am using Echo");

  // Fetch shared media and files
  useEffect(() => {
    if (!isOpen || !conversation._id) return;

    let isMounted = true;
    const fetchMedia = async () => {
      try {
        setLoadingMedia(true);
        const res = await messageApi.getConversationMedia(conversation._id, {
          type: activeTab === "media" ? "image" : "file",
        });
        if (isMounted) {
          setMediaItems(res.items || []);
        }
      } catch (err) {
        console.error("Failed to fetch conversation media", err);
        if (isMounted) {
          setMediaItems([]);
        }
      } finally {
        if (isMounted) {
          setLoadingMedia(false);
        }
      }
    };

    fetchMedia();

    return () => {
      isMounted = false;
    };
  }, [isOpen, conversation._id, activeTab]);

  const handlePinClick = async () => {
    if (isTogglingPin) return;
    try {
      setIsTogglingPin(true);
      await onTogglePin(conversation._id);
    } finally {
      setIsTogglingPin(false);
    }
  };

  const handleMuteClick = async () => {
    if (isTogglingMute) return;
    try {
      setIsTogglingMute(true);
      await onToggleMute(conversation._id);
    } finally {
      setIsTogglingMute(false);
    }
  };

  const handleToggleBlock = async () => {
    if (!counterpartId || isTogglingBlock) return;
    try {
      setIsTogglingBlock(true);
      if (isBlocked) {
        await userApi.unblockUser(counterpartId);
        removeBlockedUser(counterpartId);
      } else {
        await userApi.blockUser(counterpartId);
        addBlockedUser(counterpartId);
      }
    } catch (err: any) {
      console.error("Failed to toggle block status:", err);
      alert(err.response?.data?.message || err.message || "Failed to update block status");
    } finally {
      setIsTogglingBlock(false);
    }
  };

  const handleImageClick = (url: string) => {
    if (onOpenMediaItem) {
      onOpenMediaItem(url);
    } else {
      window.open(url, "_blank", "noopener,noreferrer");
    }
  };

  return (
    <aside
      className={`fixed top-0 right-0 h-screen w-80 bg-[#161722] border-l border-white/[0.04] z-40 flex flex-col transition-transform duration-300 ease-in-out select-none shadow-2xl ${
        isOpen ? "translate-x-0" : "translate-x-full"
      }`}
      aria-label="Conversation Details"
    >
      {/* Drawer Header */}
      <div className="h-16 px-5 border-b border-white/[0.04] flex items-center justify-between shrink-0">
        <h3 className="font-semibold text-sm text-[#f0f2f8]">
          {conversation.type === "group" ? "Group Info" : "Contact Info"}
        </h3>
        <button
          onClick={onClose}
          className="p-1.5 rounded-lg text-[#767b93] hover:text-white hover:bg-white/[0.04] transition-colors cursor-pointer"
          title="Close drawer"
          type="button"
        >
          <X size={18} />
        </button>
      </div>

      {/* Scrollable Content Container */}
      <div className="flex-1 overflow-y-auto">
        {/* Profile Card Section */}
        <div className="flex flex-col items-center py-6 px-4 border-b border-white/[0.04] text-center">
          <div className="relative">
            <div className="w-20 h-20 rounded-full bg-[#1b1c27] border-2 border-white/[0.08] flex items-center justify-center text-lg font-bold text-white overflow-hidden shadow-inner ring-2 ring-[#0066ff]/20">
              {conversation.type === "group" ? (
                (conversation as any).groupAvatar ? (
                  <img
                    src={(conversation as any).groupAvatar}
                    alt={displayName}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <Users className="w-9 h-9 text-[#0066ff]" />
                )
              ) : counterpart?.avatarUrl ? (
                <img
                  src={counterpart.avatarUrl}
                  alt={displayName}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="flex items-center justify-center w-full h-full bg-[#0066ff] text-white">
                  {displayName.slice(0, 2).toUpperCase()}
                </div>
              )}
            </div>
            {conversation.type === "direct" && isOnline && (
              <span
                className="absolute bottom-1 right-1 w-4 h-4 bg-emerald-500 border-2 border-[#161722] rounded-full ring-2 ring-emerald-500/20"
                title="Online"
              />
            )}
          </div>

          <h4 className="text-base font-semibold text-white mt-3 truncate max-w-full px-2">
            {displayName}
          </h4>
          <p className="text-xs text-[#767b93] mt-1 leading-relaxed max-w-xs px-2 break-words">
            {displayBio}
          </p>

          {conversation.type === "direct" && (counterpart as any)?.email && (
            <p className="text-[11px] text-[#505469] mt-1">
              {(counterpart as any).email}
            </p>
          )}
        </div>

        {/* Quick Action Strip */}
        <div className="grid grid-cols-4 gap-1.5 px-4 py-3 border-b border-white/[0.04]">
          <button
            onClick={handleMuteClick}
            disabled={isTogglingMute}
            className={`flex flex-col items-center gap-1.5 p-2 rounded-xl hover:bg-white/[0.04] transition-colors cursor-pointer ${
              conversation.isMuted ? "text-rose-400" : "text-[#767b93] hover:text-[#0066ff]"
            }`}
            title={conversation.isMuted ? "Unmute conversation" : "Mute conversation"}
            type="button"
          >
            {conversation.isMuted ? (
              <BellOff size={17} className="text-rose-400" />
            ) : (
              <Bell size={17} />
            )}
            <span className="text-[10px] font-medium">{conversation.isMuted ? "Muted" : "Mute"}</span>
          </button>

          <button
            onClick={handlePinClick}
            disabled={isTogglingPin}
            className={`flex flex-col items-center gap-1.5 p-2 rounded-xl hover:bg-white/[0.04] transition-colors cursor-pointer ${
              conversation.isPinned ? "text-[#0066ff]" : "text-[#767b93] hover:text-[#0066ff]"
            }`}
            title={conversation.isPinned ? "Unpin conversation" : "Pin conversation"}
            type="button"
          >
            <Pin
              size={17}
              className={conversation.isPinned ? "text-[#0066ff] fill-[#0066ff]" : ""}
            />
            <span className="text-[10px] font-medium">{conversation.isPinned ? "Pinned" : "Pin"}</span>
          </button>

          <button
            onClick={onSearchClick}
            className="flex flex-col items-center gap-1.5 p-2 rounded-xl hover:bg-white/[0.04] text-[#767b93] hover:text-[#0066ff] transition-colors cursor-pointer"
            title="Search messages"
            type="button"
          >
            <Search size={17} />
            <span className="text-[10px] font-medium">Search</span>
          </button>

          <button
            onClick={() => alert("Voice & Video calls coming soon!")}
            className="flex flex-col items-center gap-1.5 p-2 rounded-xl hover:bg-white/[0.04] text-[#767b93] hover:text-[#0066ff] transition-colors cursor-pointer"
            title="Audio/Video call"
            type="button"
          >
            <Video size={17} />
            <span className="text-[10px] font-medium">Call</span>
          </button>
        </div>

        {/* Group Administration & Settings Section */}
        {conversation.type === "group" && (
          <div className="py-3 px-4 border-b border-white/[0.04] space-y-2">
            {isCurrentUserAdmin && (
              <button
                type="button"
                onClick={() => setIsSettingsModalOpen(true)}
                className="w-full flex items-center justify-between p-2.5 rounded-xl bg-white/[0.03] hover:bg-white/[0.06] text-white text-xs font-medium transition cursor-pointer"
              >
                <div className="flex items-center gap-2.5">
                  <Settings size={16} className="text-[#0066ff]" />
                  <span>Group Settings</span>
                </div>
                <span className="text-[10px] text-[#767b93]">Configure</span>
              </button>
            )}

            {isCurrentUserAdmin && (
              <div className="p-2.5 rounded-xl bg-white/[0.03] space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-white text-xs font-medium">
                    <Link size={15} className="text-[#0066ff]" />
                    <span>Invite via Link</span>
                  </div>
                  <button
                    type="button"
                    onClick={handleGenerateInvite}
                    disabled={isGeneratingInvite}
                    className="text-[11px] text-[#0066ff] hover:underline font-semibold cursor-pointer disabled:opacity-50"
                  >
                    {inviteUrl ? "Reset Link" : "Create Link"}
                  </button>
                </div>
                {inviteUrl && (
                  <div className="flex items-center gap-2 pt-1">
                    <input
                      type="text"
                      readOnly
                      value={inviteUrl}
                      className="flex-1 bg-[#12131c] text-[11px] text-slate-300 px-2 py-1.5 rounded-lg border border-white/[0.06] focus:outline-none select-all"
                    />
                    <button
                      type="button"
                      onClick={handleCopyInvite}
                      className="p-1.5 rounded-lg bg-[#0066ff] text-white hover:bg-[#005ce6] transition cursor-pointer shrink-0"
                      title="Copy link"
                    >
                      {hasCopiedInvite ? <Check size={14} /> : <Copy size={14} />}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Group Participants (Rendered only for group chats) */}
        {conversation.type === "group" && (
          <div className="py-4 border-b border-white/[0.04]">
            <div className="px-5 mb-2 flex items-center justify-between">
              <span className="text-xs font-semibold text-[#f0f2f8]">
                Members ({conversation.participants.length})
              </span>
            </div>
            <div className="space-y-1 px-3">
              {conversation.participants.map((member) => {
                const memberId = (member as any)._id || (member as any).id;
                const isAdmin =
                  conversation.admins?.some(
                    (adminId) =>
                      adminId === memberId ||
                      (typeof adminId === "object" && (adminId as any)?._id === memberId)
                  ) ||
                  conversation.groupParticipants?.some((gp: any) => {
                    const uId = typeof gp.userId === "string" ? gp.userId : gp.userId?._id || gp.userId?.id;
                    return uId === memberId && gp.role === "admin";
                  });
                const isMemberOnline = memberId ? onlineUsers.has(memberId) || !!member.isOnline : false;
                const isCreator = conversation.creatorId === memberId;

                return (
                  <div
                    key={memberId || member.username}
                    className="flex items-center justify-between p-2 rounded-lg hover:bg-white/[0.02] transition-colors relative"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="relative">
                        <div className="w-8 h-8 rounded-full bg-[#1b1c27] flex items-center justify-center text-xs text-white shrink-0 font-medium overflow-hidden">
                          {member.avatarUrl ? (
                            <img
                              src={member.avatarUrl}
                              alt={member.username}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            member.username.slice(0, 2).toUpperCase()
                          )}
                        </div>
                        {isMemberOnline && (
                          <span className="absolute bottom-0 right-0 w-2 h-2 rounded-full bg-emerald-500 ring-1 ring-[#161722]" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <span className="text-xs text-[#f0f2f8] font-medium truncate block">
                          {member.username}
                          {memberId === currentUserId && (
                            <span className="text-[10px] text-[#505469] ml-1">(You)</span>
                          )}
                        </span>
                        {(member as any).status && (
                          <span className="text-[10px] text-[#767b93] truncate block">
                            {(member as any).status}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {isAdmin && (
                        <span className="text-[10px] bg-[#0066ff]/20 text-[#0066ff] border border-[#0066ff]/30 px-1.5 py-0.5 rounded font-medium flex items-center gap-1 shrink-0">
                          <ShieldCheck size={11} /> Admin
                        </span>
                      )}

                      {/* Participant Action Context Menu */}
                      {isCurrentUserAdmin && memberId !== currentUserId && (
                        <div className="relative">
                          <button
                            type="button"
                            onClick={() =>
                              setActiveMenuMemberId(activeMenuMemberId === memberId ? null : memberId)
                            }
                            className="p-1 text-slate-400 hover:text-white rounded hover:bg-white/[0.06] transition cursor-pointer"
                            title="Member options"
                          >
                            <MoreVertical size={14} />
                          </button>

                          {activeMenuMemberId === memberId && (
                            <div className="flex flex-col absolute right-0 top-6 w-36 bg-[#13141d] border border-white/[0.08] rounded-xl shadow-xl py-1 z-30 animate-in fade-in zoom-in-95 duration-150">
                              {!isAdmin ? (
                                <button
                                  type="button"
                                  onClick={() => handlePromote(memberId)}
                                  className="px-3 py-1.5 text-left text-xs text-slate-200 hover:bg-white/[0.05] cursor-pointer"
                                >
                                  Make Admin
                                </button>
                              ) : !isCreator ? (
                                <button
                                  type="button"
                                  onClick={() => handleDemote(memberId)}
                                  className="px-3 py-1.5 text-left text-xs text-slate-200 hover:bg-white/[0.05] cursor-pointer"
                                >
                                  Dismiss as Admin
                                </button>
                              ) : null}

                              {!isCreator && (
                                <button
                                  type="button"
                                  onClick={() => handleRemove(memberId)}
                                  className="px-3 py-1.5 text-left text-xs text-rose-400 hover:bg-rose-500/10 cursor-pointer"
                                >
                                  Remove from Group
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Shared Media & Files Section */}
        <div className="py-4">
          <div className="flex items-center border-b border-white/[0.04] px-5 mb-3 gap-6">
            <button
              onClick={() => setActiveTab("media")}
              className={`pb-2 text-xs font-medium border-b-2 transition-colors cursor-pointer ${
                activeTab === "media"
                  ? "border-[#0066ff] text-[#0066ff] font-semibold"
                  : "border-transparent text-[#767b93] hover:text-[#f0f2f8]"
              }`}
              type="button"
            >
              Media
            </button>
            <button
              onClick={() => setActiveTab("docs")}
              className={`pb-2 text-xs font-medium border-b-2 transition-colors cursor-pointer ${
                activeTab === "docs"
                  ? "border-[#0066ff] text-[#0066ff] font-semibold"
                  : "border-transparent text-[#767b93] hover:text-[#f0f2f8]"
              }`}
              type="button"
            >
              Docs & Files
            </button>
          </div>

          {/* Media Tab View */}
          {activeTab === "media" && (
            <div className="px-5">
              {loadingMedia ? (
                <div className="text-center py-8 text-xs text-[#767b93] animate-pulse">
                  Loading media...
                </div>
              ) : mediaItems.length === 0 ? (
                <div className="text-center py-8 text-xs text-[#505469]">
                  No media shared yet
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-2">
                  {mediaItems.map((item) => (
                    <button
                      key={item._id}
                      onClick={() => handleImageClick(item.mediaUrl)}
                      className="aspect-square bg-[#1b1c27] rounded-xl overflow-hidden border border-white/[0.06] hover:opacity-80 transition cursor-pointer relative group block w-full p-0 text-left"
                      title={item.fileName || "View image"}
                      type="button"
                    >
                      <img
                        src={item.mediaUrl}
                        alt={item.fileName || "media"}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <ExternalLink size={14} className="text-white" />
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Docs Tab View */}
          {activeTab === "docs" && (
            <div className="px-4 space-y-2">
              {loadingMedia ? (
                <div className="text-center py-8 text-xs text-[#767b93] animate-pulse">
                  Loading files...
                </div>
              ) : mediaItems.length === 0 ? (
                <div className="text-center py-8 text-xs text-[#505469]">
                  No documents shared yet
                </div>
              ) : (
                mediaItems.map((item) => (
                  <div
                    key={item._id}
                    className="flex items-center justify-between p-2.5 rounded-xl bg-[#1b1c27] border border-white/[0.04] hover:border-white/[0.08] transition"
                  >
                    <div className="flex items-center gap-2.5 min-w-0 pr-2">
                      <FileText size={18} className="text-[#0066ff] shrink-0" />
                      <div className="min-w-0">
                        <p className="text-xs text-[#f0f2f8] truncate font-medium">
                          {item.fileName || "Document"}
                        </p>
                        <p className="text-[10px] text-[#767b93]">
                          {item.fileSize ? `${Math.round(item.fileSize / 1024)} KB` : "File"}
                        </p>
                      </div>
                    </div>
                    <a
                      href={item.mediaUrl}
                      download={item.fileName || "document"}
                      target="_blank"
                      rel="noreferrer"
                      className="p-1.5 text-[#767b93] hover:text-white rounded-lg hover:bg-white/[0.06] transition-colors shrink-0"
                      title="Download file"
                    >
                      <Download size={14} />
                    </a>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* Danger zone: Leave Group (for group conversations) */}
        {conversation.type === "group" && (
          <div className="mt-auto p-4 border-t border-slate-800/60 bg-[#12131c]">
            <button
              onClick={handleLeaveGroup}
              disabled={isLeavingGroup}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium transition-colors bg-rose-500/10 text-rose-500 hover:bg-rose-500/20 disabled:opacity-50 cursor-pointer"
            >
              <LogOut size={16} />
              <span>{isLeavingGroup ? "Leaving Group..." : "Exit Group"}</span>
            </button>
          </div>
        )}

        {/* Danger zone for 1-on-1 direct conversations */}
        {conversation.type === "direct" && counterpartId && (
          <div className="mt-auto p-4 border-t border-slate-800/60 bg-[#12131c]">
            <button
              onClick={handleToggleBlock}
              disabled={isTogglingBlock}
              className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                isBlocked
                  ? "bg-slate-800 text-slate-300 hover:bg-slate-700"
                  : "bg-rose-500/10 text-rose-500 hover:bg-rose-500/20"
              } disabled:opacity-50`}
            >
              <Ban size={16} />
              {isTogglingBlock
                ? isBlocked
                  ? "Unblocking..."
                  : "Blocking..."
                : isBlocked
                ? "Unblock Contact"
                : "Block Contact"}
            </button>
          </div>
        )}
      </div>

      {/* Group Settings Modal */}
      {conversation.type === "group" && (
        <GroupSettingsModal
          isOpen={isSettingsModalOpen}
          onClose={() => setIsSettingsModalOpen(false)}
          settings={
            conversation.settings || {
              onlyAdminsMessage: false,
              onlyAdminsEditInfo: false,
              onlyAdminsAddMembers: false,
              requireAdminApproval: false,
            }
          }
          onUpdateSetting={handleUpdateSetting}
          isUpdating={isUpdatingSettings}
        />
      )}
    </aside>
  );
};
