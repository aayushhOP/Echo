import { FC, useState } from "react";
import { Loader2 } from "lucide-react";

interface DeleteMessageModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDeleteForMe: () => void;
  onDeleteForEveryone: () => void;
  isSender: boolean;
  isAdmin: boolean;
  messageCreatedAt: string;
}

const SIXTY_HOURS_MS = 60 * 60 * 1000 * 60;

export const DeleteMessageModal: FC<DeleteMessageModalProps> = ({
  isOpen,
  onClose,
  onDeleteForMe,
  onDeleteForEveryone,
  isSender,
  isAdmin,
  messageCreatedAt,
}) => {
  const [actionLoading, setActionLoading] = useState<"me" | "everyone" | null>(null);

  if (!isOpen) return null;

  const ageMs = Date.now() - new Date(messageCreatedAt).getTime();
  const canDeleteForEveryone = (isSender || isAdmin) && ageMs <= SIXTY_HOURS_MS;

  const handleDeleteForEveryone = () => {
    setActionLoading("everyone");
    onDeleteForEveryone();
    onClose();
  };

  const handleDeleteForMe = () => {
    setActionLoading("me");
    onDeleteForMe();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-150">
      <div className="w-full max-w-sm rounded-2xl bg-[#171824] border border-white/[0.08] p-5 shadow-2xl text-left">
        <h3 className="text-base font-semibold text-white">Delete message?</h3>
        <p className="mt-1.5 text-xs text-slate-400 leading-relaxed">
          {canDeleteForEveryone
            ? "You can delete this message for everyone in this chat or only for yourself."
            : "You can delete this message from your device. Other participants will still be able to see it."}
        </p>

        <div className="mt-6 flex flex-col gap-2">
          {canDeleteForEveryone && (
            <button
              type="button"
              disabled={actionLoading !== null}
              onClick={handleDeleteForEveryone}
              className="w-full flex items-center justify-center gap-1.5 py-2.5 px-4 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 font-medium text-xs text-center transition-colors border border-rose-500/20 cursor-pointer disabled:opacity-50"
            >
              {actionLoading === "everyone" && <Loader2 size={13} className="animate-spin" />}
              <span>Delete for everyone</span>
            </button>
          )}

          <button
            type="button"
            disabled={actionLoading !== null}
            onClick={handleDeleteForMe}
            className="w-full flex items-center justify-center gap-1.5 py-2.5 px-4 rounded-xl bg-white/[0.05] hover:bg-white/[0.08] text-slate-200 font-medium text-xs text-center transition-colors cursor-pointer disabled:opacity-50"
          >
            {actionLoading === "me" && <Loader2 size={13} className="animate-spin" />}
            <span>Delete for me</span>
          </button>

          <button
            type="button"
            disabled={actionLoading !== null}
            onClick={onClose}
            className="w-full py-2.5 px-4 rounded-xl text-slate-400 hover:text-white font-medium text-xs text-center transition-colors cursor-pointer disabled:opacity-50"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};
