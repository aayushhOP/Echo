import { FC } from "react";

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
  if (!isOpen) return null;

  const ageMs = Date.now() - new Date(messageCreatedAt).getTime();
  const canDeleteForEveryone = (isSender || isAdmin) && ageMs <= SIXTY_HOURS_MS;

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
              onClick={() => {
                onDeleteForEveryone();
                onClose();
              }}
              className="w-full py-2.5 px-4 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 font-medium text-xs text-center transition-colors border border-rose-500/20 cursor-pointer"
            >
              Delete for everyone
            </button>
          )}

          <button
            type="button"
            onClick={() => {
              onDeleteForMe();
              onClose();
            }}
            className="w-full py-2.5 px-4 rounded-xl bg-white/[0.05] hover:bg-white/[0.08] text-slate-200 font-medium text-xs text-center transition-colors cursor-pointer"
          >
            Delete for me
          </button>

          <button
            type="button"
            onClick={onClose}
            className="w-full py-2.5 px-4 rounded-xl text-slate-400 hover:text-white font-medium text-xs text-center transition-colors cursor-pointer"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};
