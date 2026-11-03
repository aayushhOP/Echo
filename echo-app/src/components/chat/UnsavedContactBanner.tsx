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
    <div className="w-full bg-[#171824]/95 border-b border-amber-500/20 px-6 py-3.5 flex items-center justify-between backdrop-blur-md animate-in slide-in-from-top duration-200 z-20">
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-8 h-8 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center shrink-0">
          <AlertCircle size={18} className="text-amber-400" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium text-slate-200 truncate">
            <strong className="text-white">@{participant.username}</strong> is not in your contacts.
          </p>
          <p className="text-xs text-slate-400">
            Add them to your contacts to personalize their name and access details easily.
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2.5 shrink-0 ml-4">
        <button
          onClick={onBlock}
          className="px-3.5 py-1.5 rounded-xl text-xs font-semibold text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 border border-rose-500/20 transition-all flex items-center gap-1.5 cursor-pointer active:scale-95"
        >
          <Ban size={14} />
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
          className="px-4 py-2 rounded-xl text-xs font-semibold bg-[#0066ff] hover:bg-[#0052cc] text-white transition-all flex items-center gap-1.5 shadow-md shadow-[#0066ff]/25 cursor-pointer active:scale-95"
        >
          <UserPlus size={14} />
          <span>Add to Contacts</span>
        </button>
      </div>
    </div>
  );
};
