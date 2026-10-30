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
} from "lucide-react";
import { messageApi, MediaItem } from "../../api/messageApi";
import { Conversation } from "../../types/message";
import { useChatStore } from "../../store/chatStore";

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

  const onlineUsers = useChatStore((state) => state.onlineUsers);

  // Identify display counterpart for 1-on-1 chats
  const counterpart =
    conversation.type === "direct"
      ? conversation.participants.find((p) => {
          const pId = (p as any)._id || (p as any).id;
          return pId && pId !== currentUserId;
        }) || conversation.participants[0]
      : null;

  const counterpartId = counterpart ? (counterpart as any)._id || (counterpart as any).id : null;
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

  const handleImageClick = (url: string) => {
    if (onOpenMediaItem) {
      onOpenMediaItem(url);
    } else {
      window.open(url, "_blank", "noopener,noreferrer");
    }
  };

  return (
    <aside
      className={`fixed top-0 right-0 h-screen w-80 bg-[#0e121b] border-l border-slate-800/80 z-40 flex flex-col transition-transform duration-300 ease-in-out select-none shadow-2xl ${
        isOpen ? "translate-x-0" : "translate-x-full"
      }`}
      aria-label="Conversation Details"
    >
      {/* Drawer Header */}
      <div className="h-16 px-5 border-b border-slate-800/70 flex items-center justify-between shrink-0">
        <h3 className="font-semibold text-sm text-slate-100">
          {conversation.type === "group" ? "Group Info" : "Contact Info"}
        </h3>
        <button
          onClick={onClose}
          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 transition-colors cursor-pointer"
          title="Close drawer"
          type="button"
        >
          <X size={18} />
        </button>
      </div>

      {/* Scrollable Content Container */}
      <div className="flex-1 overflow-y-auto">
        {/* Profile Card Section */}
        <div className="flex flex-col items-center py-6 px-4 border-b border-slate-800/60 text-center">
          <div className="relative">
            <div className="w-20 h-20 rounded-full bg-slate-800 border-2 border-slate-700/80 flex items-center justify-center text-lg font-bold text-slate-200 overflow-hidden shadow-inner">
              {conversation.type === "group" ? (
                (conversation as any).groupAvatar ? (
                  <img
                    src={(conversation as any).groupAvatar}
                    alt={displayName}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <Users className="w-9 h-9 text-indigo-400" />
                )
              ) : counterpart?.avatarUrl ? (
                <img
                  src={counterpart.avatarUrl}
                  alt={displayName}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="flex items-center justify-center w-full h-full bg-indigo-900/60 text-indigo-200">
                  {displayName.slice(0, 2).toUpperCase()}
                </div>
              )}
            </div>
            {conversation.type === "direct" && isOnline && (
              <span
                className="absolute bottom-1 right-1 w-4 h-4 bg-emerald-500 border-2 border-[#0e121b] rounded-full ring-2 ring-emerald-500/20"
                title="Online"
              />
            )}
          </div>

          <h4 className="text-base font-semibold text-white mt-3 truncate max-w-full px-2">
            {displayName}
          </h4>
          <p className="text-xs text-slate-400 mt-1 leading-relaxed max-w-xs px-2 break-words">
            {displayBio}
          </p>

          {conversation.type === "direct" && (counterpart as any)?.email && (
            <p className="text-[11px] text-slate-500 mt-1">
              {(counterpart as any).email}
            </p>
          )}
        </div>

        {/* Quick Action Strip */}
        <div className="grid grid-cols-4 gap-1.5 px-4 py-3 border-b border-slate-800/60">
          <button
            onClick={handleMuteClick}
            disabled={isTogglingMute}
            className={`flex flex-col items-center gap-1.5 p-2 rounded-xl hover:bg-slate-800/50 transition-colors cursor-pointer ${
              conversation.isMuted ? "text-rose-400" : "text-slate-400 hover:text-slate-200"
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
            className={`flex flex-col items-center gap-1.5 p-2 rounded-xl hover:bg-slate-800/50 transition-colors cursor-pointer ${
              conversation.isPinned ? "text-indigo-400" : "text-slate-400 hover:text-slate-200"
            }`}
            title={conversation.isPinned ? "Unpin conversation" : "Pin conversation"}
            type="button"
          >
            <Pin
              size={17}
              className={conversation.isPinned ? "text-indigo-400 fill-indigo-400" : ""}
            />
            <span className="text-[10px] font-medium">{conversation.isPinned ? "Pinned" : "Pin"}</span>
          </button>

          <button
            onClick={onSearchClick}
            className="flex flex-col items-center gap-1.5 p-2 rounded-xl hover:bg-slate-800/50 text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
            title="Search messages"
            type="button"
          >
            <Search size={17} />
            <span className="text-[10px] font-medium">Search</span>
          </button>

          <button
            onClick={() => alert("Voice & Video calls coming soon!")}
            className="flex flex-col items-center gap-1.5 p-2 rounded-xl hover:bg-slate-800/50 text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
            title="Audio/Video call"
            type="button"
          >
            <Video size={17} />
            <span className="text-[10px] font-medium">Call</span>
          </button>
        </div>

        {/* Group Participants (Rendered only for group chats) */}
        {conversation.type === "group" && (
          <div className="py-4 border-b border-slate-800/60">
            <div className="px-5 mb-2 flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-300">
                Members ({conversation.participants.length})
              </span>
            </div>
            <div className="space-y-1 px-3">
              {conversation.participants.map((member) => {
                const memberId = (member as any)._id || (member as any).id;
                const isAdmin = conversation.admins?.some(
                  (adminId) =>
                    adminId === memberId ||
                    (typeof adminId === "object" && (adminId as any)?._id === memberId)
                );
                const isMemberOnline = memberId ? onlineUsers.has(memberId) || !!member.isOnline : false;

                return (
                  <div
                    key={memberId || member.username}
                    className="flex items-center justify-between p-2 rounded-lg hover:bg-slate-800/30 transition-colors"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="relative">
                        <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-xs text-slate-300 shrink-0 font-medium overflow-hidden">
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
                          <span className="absolute bottom-0 right-0 w-2 h-2 rounded-full bg-emerald-500 ring-1 ring-[#0e121b]" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <span className="text-xs text-slate-200 font-medium truncate block">
                          {member.username}
                          {memberId === currentUserId && (
                            <span className="text-[10px] text-slate-500 ml-1">(You)</span>
                          )}
                        </span>
                        {(member as any).status && (
                          <span className="text-[10px] text-slate-500 truncate block">
                            {(member as any).status}
                          </span>
                        )}
                      </div>
                    </div>
                    {isAdmin && (
                      <span className="text-[10px] bg-indigo-950/80 text-indigo-400 border border-indigo-800/50 px-1.5 py-0.5 rounded font-medium flex items-center gap-1 shrink-0">
                        <ShieldCheck size={11} /> Admin
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Shared Media & Files Section */}
        <div className="py-4">
          <div className="flex items-center border-b border-slate-800/60 px-5 mb-3 gap-6">
            <button
              onClick={() => setActiveTab("media")}
              className={`pb-2 text-xs font-medium border-b-2 transition-colors cursor-pointer ${
                activeTab === "media"
                  ? "border-indigo-500 text-indigo-400 font-semibold"
                  : "border-transparent text-slate-400 hover:text-slate-200"
              }`}
              type="button"
            >
              Media
            </button>
            <button
              onClick={() => setActiveTab("docs")}
              className={`pb-2 text-xs font-medium border-b-2 transition-colors cursor-pointer ${
                activeTab === "docs"
                  ? "border-indigo-500 text-indigo-400 font-semibold"
                  : "border-transparent text-slate-400 hover:text-slate-200"
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
                <div className="text-center py-8 text-xs text-slate-500 animate-pulse">
                  Loading media...
                </div>
              ) : mediaItems.length === 0 ? (
                <div className="text-center py-8 text-xs text-slate-500">
                  No media shared yet
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-2">
                  {mediaItems.map((item) => (
                    <button
                      key={item._id}
                      onClick={() => handleImageClick(item.mediaUrl)}
                      className="aspect-square bg-slate-800 rounded-lg overflow-hidden border border-slate-700/60 hover:opacity-80 transition cursor-pointer relative group block w-full p-0 text-left"
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
                <div className="text-center py-8 text-xs text-slate-500 animate-pulse">
                  Loading files...
                </div>
              ) : mediaItems.length === 0 ? (
                <div className="text-center py-8 text-xs text-slate-500">
                  No documents shared yet
                </div>
              ) : (
                mediaItems.map((item) => (
                  <div
                    key={item._id}
                    className="flex items-center justify-between p-2.5 rounded-lg bg-slate-800/30 border border-slate-800 hover:border-slate-700/80 transition"
                  >
                    <div className="flex items-center gap-2.5 min-w-0 pr-2">
                      <FileText size={18} className="text-indigo-400 shrink-0" />
                      <div className="min-w-0">
                        <p className="text-xs text-slate-200 truncate font-medium">
                          {item.fileName || "Document"}
                        </p>
                        <p className="text-[10px] text-slate-500">
                          {item.fileSize ? `${Math.round(item.fileSize / 1024)} KB` : "File"}
                        </p>
                      </div>
                    </div>
                    <a
                      href={item.mediaUrl}
                      download={item.fileName || "document"}
                      target="_blank"
                      rel="noreferrer"
                      className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-700/50 transition-colors shrink-0"
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
      </div>
    </aside>
  );
};
