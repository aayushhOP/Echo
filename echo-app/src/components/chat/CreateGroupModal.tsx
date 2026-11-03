import React, { useState } from "react";
import { useContactStore } from "../../store/contactStore";
import { Check, X, Users, AlertCircle } from "lucide-react";
import { Avatar } from "../common/Avatar";

export interface CreateGroupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateGroup: (groupName: string, selectedUserIds: string[]) => Promise<void> | void;
}

export const CreateGroupModal: React.FC<CreateGroupModalProps> = ({
  isOpen,
  onClose,
  onCreateGroup,
}) => {
  const { contacts } = useContactStore(); // Only saved contacts
  const [groupName, setGroupName] = useState("");
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const toggleSelect = (userId: string) => {
    setSelectedUserIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  };

  const handleCreate = async () => {
    if (!groupName.trim()) {
      setError("Please provide a group name");
      return;
    }
    if (selectedUserIds.length === 0) {
      setError("Please select at least 1 member from your contacts");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      await onCreateGroup(groupName.trim(), selectedUserIds);
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || "Failed to create group");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-150">
      <div className="w-full max-w-md bg-[#171824] rounded-2xl p-6 border border-white/[0.08] shadow-2xl">
        <div className="flex items-center justify-between pb-4 border-b border-white/[0.06] mb-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-[#0066ff]/10 text-[#0066ff]">
              <Users size={18} />
            </div>
            <div>
              <h3 className="text-base font-semibold text-white">Create New Group</h3>
              <p className="text-xs text-slate-400">Add members from your saved contacts</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-center gap-2">
            <AlertCircle size={14} className="shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="mb-4">
          <label className="block text-xs font-medium text-slate-300 mb-1.5">
            Group Subject / Name <span className="text-rose-400">*</span>
          </label>
          <input
            type="text"
            placeholder="e.g. Project Discussion"
            value={groupName}
            onChange={(e) => setGroupName(e.target.value)}
            className="w-full h-11 px-3.5 rounded-xl bg-[#13141d] border border-white/10 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-[#0066ff] focus:ring-2 focus:ring-[#0066ff]/20 transition-all"
            autoFocus
          />
        </div>

        <p className="text-xs font-medium text-slate-300 mb-2">
          Select Members from Contacts ({selectedUserIds.length} selected):
        </p>

        {/* Contacts Only List */}
        <div className="max-h-56 overflow-y-auto space-y-1.5 pr-1">
          {contacts.length === 0 ? (
            <div className="text-center py-8 px-4 rounded-xl bg-[#13141d]/50 border border-white/[0.04]">
              <p className="text-xs text-slate-400">
                No saved contacts yet.
              </p>
              <p className="text-[11px] text-slate-500 mt-1">
                Add users to your contacts before adding them to groups.
              </p>
            </div>
          ) : (
            contacts.map((contact) => {
              const contactKey = contact.targetMongoId || contact.contactUserId;
              const isSelected = selectedUserIds.includes(contactKey);

              return (
                <div
                  key={contact.contactUserId}
                  onClick={() => toggleSelect(contactKey)}
                  className={`flex items-center justify-between p-3 rounded-xl cursor-pointer transition-all border ${
                    isSelected
                      ? "bg-[#0066ff]/15 border-[#0066ff]/40 shadow-sm"
                      : "bg-[#13141d]/50 hover:bg-[#13141d] border-white/[0.04]"
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <Avatar
                      name={contact.savedName || contact.username}
                      avatarUrl={contact.avatarUrl}
                      size="sm"
                    />
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-white truncate">{contact.savedName}</p>
                      <p className="text-[11px] text-slate-400 truncate">@{contact.username}</p>
                    </div>
                  </div>
                  <div
                    className={`w-5 h-5 rounded-md flex items-center justify-center border transition-colors shrink-0 ${
                      isSelected ? "bg-[#0066ff] border-[#0066ff]" : "border-white/20 bg-white/[0.02]"
                    }`}
                  >
                    {isSelected && <Check size={12} className="text-white stroke-[3]" />}
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className="mt-6 flex justify-end gap-2.5 pt-2 border-t border-white/[0.06]">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium text-slate-300 hover:text-white hover:bg-white/[0.05] rounded-xl transition-colors"
          >
            Cancel
          </button>
          <button
            disabled={isSubmitting || !groupName.trim() || selectedUserIds.length === 0}
            onClick={handleCreate}
            className="px-5 py-2 rounded-xl text-xs font-semibold bg-[#0066ff] hover:bg-[#0052cc] text-white disabled:opacity-40 transition-all shadow-md shadow-[#0066ff]/20 cursor-pointer"
          >
            {isSubmitting ? "Creating..." : "Create Group"}
          </button>
        </div>
      </div>
    </div>
  );
};
