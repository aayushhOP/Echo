import React, { useState } from "react";
import { useContactStore } from "../../store/contactStore";
import { Check, X, UserPlus, AlertCircle, Loader2 } from "lucide-react";
import { Avatar } from "../common/Avatar";
import { Conversation } from "../../types/message";

export interface AddGroupMembersModalProps {
  isOpen: boolean;
  onClose: () => void;
  conversation: Conversation;
  onAddMembers: (selectedUserIds: string[]) => Promise<void> | void;
}

export const AddGroupMembersModal: React.FC<AddGroupMembersModalProps> = ({
  isOpen,
  onClose,
  conversation,
  onAddMembers,
}) => {
  const { contacts } = useContactStore();
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  // Set of current participant IDs (MongoDB _id, id, and clerkId)
  const existingParticipantIds = new Set<string>();
  for (const p of conversation.participants) {
    if (p.id) existingParticipantIds.add(p.id);
    if ((p as any)._id) existingParticipantIds.add((p as any)._id);
    if ((p as any).clerkId) existingParticipantIds.add((p as any).clerkId);
    if (p.username) existingParticipantIds.add(p.username.toLowerCase());
  }

  const isAlreadyMember = (contact: any): boolean => {
    return (
      existingParticipantIds.has(contact.contactUserId) ||
      (contact.targetMongoId && existingParticipantIds.has(contact.targetMongoId)) ||
      (contact._id && existingParticipantIds.has(contact._id)) ||
      (contact.username && existingParticipantIds.has(contact.username.toLowerCase()))
    );
  };

  const toggleSelect = (userId: string, alreadyInGroup: boolean) => {
    if (alreadyInGroup) return; // Cannot select someone who is already in the group
    setSelectedUserIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  };

  const handleConfirm = async () => {
    if (selectedUserIds.length === 0) {
      setError("Please select at least 1 contact to add");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      await onAddMembers(selectedUserIds);
      setSelectedUserIds([]);
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || "Failed to add members");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-150">
      <div className="bg-[#171824] border border-white/[0.08] rounded-2xl w-full max-w-md p-6 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between pb-4 border-b border-white/[0.06]">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-[#0066ff]/10 text-[#0066ff]">
              <UserPlus size={18} />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white">Add Members</h3>
              <p className="text-[11px] text-slate-400">
                To {conversation.groupName || "Group"}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/[0.04] transition cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {error && (
          <div className="mt-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-center gap-2">
            <AlertCircle size={15} className="shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="mt-4 mb-2 flex items-center justify-between text-xs text-slate-400 font-medium">
          <span>Select from contacts</span>
          <span className="text-[#0066ff] font-semibold">
            {selectedUserIds.length} selected
          </span>
        </div>

        {/* Contacts List */}
        <div className="max-h-64 overflow-y-auto space-y-1.5 pr-1 py-1">
          {contacts.length === 0 ? (
            <div className="text-center py-8 px-4 rounded-xl bg-[#13141d]/50 border border-white/[0.04]">
              <p className="text-xs text-slate-400">No saved contacts found.</p>
              <p className="text-[11px] text-slate-500 mt-1">
                Save contacts to add them to this group.
              </p>
            </div>
          ) : (
            contacts.map((contact) => {
              const contactKey = contact.targetMongoId || contact.contactUserId;
              const alreadyInGroup = isAlreadyMember(contact);
              const isSelected = selectedUserIds.includes(contactKey);

              return (
                <div
                  key={contact.contactUserId}
                  onClick={() => toggleSelect(contactKey, alreadyInGroup)}
                  className={`flex items-center justify-between p-3 rounded-xl transition-all border ${
                    alreadyInGroup
                      ? "bg-[#13141d]/30 border-white/[0.02] opacity-60 cursor-not-allowed"
                      : isSelected
                      ? "bg-[#0066ff]/15 border-[#0066ff]/40 shadow-sm cursor-pointer"
                      : "bg-[#13141d]/50 hover:bg-[#13141d] border-white/[0.04] cursor-pointer"
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <Avatar
                      name={contact.savedName || contact.username}
                      avatarUrl={contact.avatarUrl}
                      size="sm"
                    />
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-white truncate">
                        {contact.savedName}
                      </p>
                      <p className="text-[11px] text-slate-400 truncate">
                        @{contact.username}
                      </p>
                    </div>
                  </div>

                  <div className="shrink-0 ml-2">
                    {alreadyInGroup ? (
                      <span className="text-[10px] font-medium text-slate-400 bg-white/[0.06] border border-white/[0.08] px-2.5 py-1 rounded-lg">
                        Already joined
                      </span>
                    ) : (
                      <div
                        className={`w-5 h-5 rounded-md flex items-center justify-center border transition-colors ${
                          isSelected
                            ? "bg-[#0066ff] border-[#0066ff]"
                            : "border-white/20 bg-white/[0.02]"
                        }`}
                      >
                        {isSelected && (
                          <Check size={12} className="text-white stroke-[3]" />
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className="mt-6 flex justify-end gap-2.5 pt-3 border-t border-white/[0.06]">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium text-slate-300 hover:text-white hover:bg-white/[0.05] rounded-xl transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={isSubmitting || selectedUserIds.length === 0}
            onClick={handleConfirm}
            className="flex items-center gap-1.5 px-5 py-2 rounded-xl text-xs font-semibold bg-[#0066ff] hover:bg-[#0052cc] text-white disabled:opacity-40 transition-all shadow-md shadow-[#0066ff]/20 cursor-pointer disabled:cursor-not-allowed"
          >
            {isSubmitting ? (
              <>
                <Loader2 size={13} className="animate-spin" />
                <span>Adding...</span>
              </>
            ) : (
              <span>Add to Group</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
