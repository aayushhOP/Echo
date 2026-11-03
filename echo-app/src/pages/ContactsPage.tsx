import React, { useState } from "react";
import { useContactStore } from "../store/contactStore";
import { Contact } from "../api/contactApi";
import { Users, UserPlus, Search, Mail, Phone, Trash2, Edit3, MessageSquare, Sparkles } from "lucide-react";
import { Avatar } from "../components/common/Avatar";
import { SaveContactModal } from "../components/contacts/SaveContactModal";
import { NewConversationFullScreen } from "../components/chat/NewConversationFullScreen";
import { CreateGroupModal } from "../components/chat/CreateGroupModal";
import { messageApi } from "../api/messageApi";
import { useChatStore } from "../store/chatStore";
import { useNavigate } from "react-router-dom";
import { useConfirm } from "../store/confirmDialogStore";

export const ContactsPage: React.FC = () => {
  const { contacts, isLoading, deleteContact, openAddContactModal } = useContactStore();
  const { addOrUpdateConversation, setActiveConversationId } = useChatStore();
  const confirm = useConfirm();
  const navigate = useNavigate();

  const [searchQuery, setSearchQuery] = useState("");
  const [isNewConvoOpen, setIsNewConvoOpen] = useState(false);
  const [isCreateGroupOpen, setIsCreateGroupOpen] = useState(false);

  const filteredContacts = contacts.filter((c: Contact) => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return (
      c.savedName.toLowerCase().includes(q) ||
      c.username.toLowerCase().includes(q) ||
      (c.email && c.email.toLowerCase().includes(q)) ||
      (c.phoneNumber && c.phoneNumber.includes(q))
    );
  });

  const handleStartChatWithContact = async (contact: any) => {
    const targetId = contact.targetMongoId || contact.contactUserId;
    try {
      const conv = await messageApi.createConversation({
        type: "direct",
        participantId: targetId,
      });
      addOrUpdateConversation(conv);
      setActiveConversationId(conv._id);
      navigate("/chat");
    } catch (err: any) {
      console.error("Failed to start chat with contact:", err);
      alert(err.response?.data?.message || err.message || "Failed to start chat");
    }
  };

  const handleCreateGroup = async (groupName: string, selectedUserIds: string[]) => {
    const conv = await messageApi.createConversation({
      type: "group",
      groupName,
      participants: selectedUserIds,
      participantIds: selectedUserIds,
    });
    addOrUpdateConversation(conv);
    setActiveConversationId(conv._id);
    navigate("/chat");
  };

  const handleDeleteContact = async (contact: any) => {
    const confirmed = await confirm({
      title: "Remove Contact?",
      message: `Are you sure you want to remove "${contact.savedName}" from your contacts?`,
      confirmText: "Remove",
      cancelText: "Cancel",
      variant: "danger",
    });
    if (!confirmed) return;

    try {
      await deleteContact(contact.contactUserId);
    } catch (err: any) {
      console.error("Failed to delete contact:", err);
      alert(err.response?.data?.message || err.message || "Failed to delete contact");
    }
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
            <h1 className="text-lg font-bold text-white tracking-tight">Contacts</h1>
            <p className="text-xs text-slate-400">
              {contacts.length} saved contact{contacts.length !== 1 ? "s" : ""} in your address book
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setIsCreateGroupOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-white/[0.06] hover:bg-white/[0.12] text-slate-200 hover:text-white transition-colors border border-white/[0.08] cursor-pointer"
          >
            <Users size={14} className="text-[#0066ff]" />
            <span>New Group</span>
          </button>

          <button
            onClick={() => setIsNewConvoOpen(true)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-[#0066ff] hover:bg-[#0052cc] text-white transition-all shadow-md shadow-[#0066ff]/25 cursor-pointer active:scale-95"
          >
            <UserPlus size={14} />
            <span>Find & Add Contact</span>
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 max-w-5xl w-full mx-auto px-6 py-8 flex flex-col min-h-0">
        {/* Search Bar */}
        <div className="relative w-full mb-6 shrink-0">
          <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search saved contacts by name, username, email or phone..."
            className="w-full h-12 pl-12 pr-4 rounded-xl bg-[#171824] border border-white/[0.08] text-white placeholder-slate-500 text-xs focus:outline-none focus:border-[#0066ff] transition-all"
          />
        </div>

        {/* Contacts Grid */}
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="text-center py-16 text-xs text-slate-500 animate-pulse">
              Loading address book...
            </div>
          ) : filteredContacts.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {filteredContacts.map((contact: Contact) => (
                <div
                  key={contact.contactUserId}
                  className="p-4 rounded-2xl bg-[#171824]/60 hover:bg-[#171824] border border-white/[0.04] hover:border-[#0066ff]/30 transition-all flex flex-col justify-between group shadow-sm"
                >
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <Avatar
                          name={contact.savedName || contact.username}
                          avatarUrl={contact.avatarUrl}
                          size="md"
                        />
                        <div className="min-w-0">
                          <h3 className="text-sm font-semibold text-white truncate">
                            {contact.savedName}
                          </h3>
                          <p className="text-xs text-slate-400 truncate">@{contact.username}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => openAddContactModal(contact)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/[0.06] transition-colors"
                          title="Edit contact alias"
                        >
                          <Edit3 size={14} />
                        </button>
                        <button
                          onClick={() => handleDeleteContact(contact)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                          title="Delete contact"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>

                    {/* Metadata details */}
                    <div className="space-y-1 text-[11px] text-slate-400 pt-1 border-t border-white/[0.04]">
                      {contact.email && (
                        <div className="flex items-center gap-2 truncate">
                          <Mail size={12} className="text-slate-500 shrink-0" />
                          <span className="truncate">{contact.email}</span>
                        </div>
                      )}
                      {contact.phoneNumber && (
                        <div className="flex items-center gap-2 truncate">
                          <Phone size={12} className="text-slate-500 shrink-0" />
                          <span className="truncate">{contact.phoneNumber}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-white/[0.04] flex items-center justify-end">
                    <button
                      onClick={() => handleStartChatWithContact(contact)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-[#0066ff] hover:bg-[#0052cc] text-white transition-all shadow-md shadow-[#0066ff]/20 cursor-pointer active:scale-95"
                    >
                      <MessageSquare size={13} />
                      <span>Chat</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : searchQuery ? (
            <div className="text-center py-20 text-slate-400 text-xs">
              No contacts matching &ldquo;{searchQuery}&rdquo;
            </div>
          ) : (
            <div className="text-center py-20 text-slate-500">
              <Sparkles className="mx-auto mb-3 h-8 w-8 text-[#0066ff]/40" />
              <p className="text-sm font-medium text-white mb-1">Your contacts list is empty</p>
              <p className="text-xs text-slate-400 max-w-sm mx-auto mb-4">
                Search for friends and colleagues by their username to start chatting and save them to your contacts.
              </p>
              <button
                onClick={() => setIsNewConvoOpen(true)}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-[#0066ff] text-white shadow-lg shadow-[#0066ff]/20 hover:bg-[#0052cc] transition-all cursor-pointer"
              >
                Find Users
              </button>
            </div>
          )}
        </div>
      </div>

      <SaveContactModal />
      <NewConversationFullScreen
        isOpen={isNewConvoOpen}
        onClose={() => setIsNewConvoOpen(false)}
      />
      <CreateGroupModal
        isOpen={isCreateGroupOpen}
        onClose={() => setIsCreateGroupOpen(false)}
        onCreateGroup={handleCreateGroup}
      />
    </div>
  );
};
