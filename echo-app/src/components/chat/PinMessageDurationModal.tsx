import React, { useState } from "react";
import { Pin, X, Loader2 } from "lucide-react";
import { useChatStore } from "../../store/chatStore";

interface PinMessageDurationModalProps {
  onConfirmPin: (duration: "24h" | "7d" | "30d") => void;
}

export const PinMessageDurationModal: React.FC<PinMessageDurationModalProps> = ({
  onConfirmPin,
}) => {
  const { pinningMessage, setPinningMessage } = useChatStore();
  const [selectedDuration, setSelectedDuration] = useState<"24h" | "7d" | "30d">("7d");
  const [isPinning, setIsPinning] = useState(false);

  if (!pinningMessage) return null;

  const handleCancel = () => {
    setPinningMessage(null);
  };

  const handlePin = () => {
    setIsPinning(true);
    onConfirmPin(selectedDuration);
    setPinningMessage(null);
  };

  const options: Array<{ id: "24h" | "7d" | "30d"; label: string }> = [
    { id: "24h", label: "24 hours" },
    { id: "7d", label: "7 days" },
    { id: "30d", label: "30 days" },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150"
      onClick={handleCancel}
    >
      <div
        className="relative w-full max-w-sm rounded-2xl border border-white/[0.08] bg-[#171824] p-5 shadow-2xl shadow-black/80 text-left animate-in zoom-in-95 duration-150 select-none"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          type="button"
          onClick={handleCancel}
          className="absolute right-4 top-4 p-1 text-slate-400 hover:text-white rounded-lg hover:bg-white/[0.04] transition-colors cursor-pointer"
          title="Close modal"
        >
          <X size={16} />
        </button>

        {/* Header with Icon */}
        <div className="flex items-start gap-3.5 mb-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#0066ff]/20 bg-[#0066ff]/10 text-[#0066ff]">
            <Pin size={18} className="fill-[#0066ff]" />
          </div>
          <div className="flex-1 pr-4">
            <h3 className="text-sm font-semibold tracking-wide text-white">
              Choose how long your pin lasts
            </h3>
            <p className="mt-0.5 text-xs text-slate-400">
              You can unpin at any time.
            </p>
          </div>
        </div>

        {/* Radio Option List */}
        <div className="space-y-2 mb-5">
          {options.map((opt) => {
            const isChecked = selectedDuration === opt.id;
            return (
              <div
                key={opt.id}
                onClick={() => setSelectedDuration(opt.id)}
                className={`flex items-center justify-between p-2.5 rounded-xl border transition-all cursor-pointer ${
                  isChecked
                    ? "bg-[#0066ff]/10 border-[#0066ff]/40 text-white"
                    : "bg-[#13141d]/50 border-white/[0.04] text-slate-300 hover:bg-white/[0.04] hover:text-white"
                }`}
              >
                <span className="font-medium text-xs">{opt.label}</span>
                <div
                  className={`w-4 h-4 rounded-full border flex items-center justify-center transition-colors ${
                    isChecked
                      ? "border-[#0066ff] bg-[#0066ff]"
                      : "border-slate-500 bg-transparent"
                  }`}
                >
                  {isChecked && (
                    <div className="w-1.5 h-1.5 rounded-full bg-white" />
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={handleCancel}
            disabled={isPinning}
            className="px-3.5 py-2 rounded-xl text-xs font-medium text-slate-300 hover:text-white hover:bg-white/[0.06] transition-colors cursor-pointer disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handlePin}
            disabled={isPinning}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-medium bg-[#0066ff] hover:bg-[#0052cc] text-white shadow-lg shadow-blue-950/40 active:scale-[0.98] transition-all cursor-pointer disabled:opacity-50"
          >
            {isPinning && <Loader2 size={13} className="animate-spin" />}
            <span>Pin</span>
          </button>
        </div>
      </div>
    </div>
  );
};
