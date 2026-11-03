import React from "react";
import { UserPlus, Ban, AlertCircle } from "lucide-react";
import { useContactStore } from "../../store/contactStore";

interface UnsavedContactBannerProps {
  participant: {
    id?: string;
    _id?: string;
    clerkId?: string;
    username: string;
    email?: string;
    phoneNumber?: string;
    phone?: string;
  };
  onBlock: () => void;
}

export const UnsavedContactBanner: React.FC<UnsavedContactBannerProps> = ({
  participant,
  onBlock,
}) => {
  const isContactSaved = useContactStore((state) => state.isContactSaved);
  const openAddContactModal = useContactStore((state) => state.openAddContactModal);
  useContactStore((state) => state.contacts); // Subscribe to contacts array changes to trigger instant re-renders

  const participantId = participant.id || participant._id;
  const isSaved =
    isContactSaved(participant.clerkId) ||
    isContactSaved(participantId) ||
    isContactSaved(participant.username);

  // If already saved in contacts, render nothing
  if (isSaved) {
    return null;
  }

  return (
    <div className="w-full bg-[#171824]/95 border-b border-amber-500/20 px-6 py-2.5 flex items-center justify-between backdrop-blur-md animate-in slide-in-from-top duration-200 z-20">
      <div className="flex items-center gap-2.5 min-w-0">
        <AlertCircle size={16} className="text-amber-400 shrink-0" />
        <span className="text-xs text-slate-300 truncate">
          <strong className="text-white">@{participant.username}</strong> is not in your contacts.
        </span>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <button
          onClick={onBlock}
          className="px-3 py-1 rounded-lg text-xs font-medium text-rose-400 hover:bg-rose-500/10 transition-colors flex items-center gap-1.5 cursor-pointer"
        >
          <Ban size={13} />
          <span>Block</span>
        </button>

        <button
          onClick={() =>
            openAddContactModal({
              contactUserId: participant.clerkId || participantId,
              targetMongoId: participantId,
              username: participant.username,
              savedName: participant.username,
              email: participant.email || "",
              phoneNumber: participant.phoneNumber || participant.phone || "",
            })
          }
          className="px-3 py-1 rounded-lg text-xs font-medium bg-[#0066ff] hover:bg-[#0052cc] text-white transition-colors flex items-center gap-1.5 shadow-md shadow-[#0066ff]/20 cursor-pointer active:scale-95"
        >
          <UserPlus size={13} />
          <span>Add to Contacts</span>
        </button>
      </div>
    </div>
  );
};
