import { FC, useEffect, useState } from "react";
import { Undo2 } from "lucide-react";

interface UndoSnackbarProps {
  messageId: string | null;
  onUndo: (messageId: string) => void;
  onDismiss: () => void;
  durationMs?: number;
  className?: string;
}

export const UndoSnackbar: FC<UndoSnackbarProps> = ({
  messageId,
  onUndo,
  onDismiss,
  durationMs = 5000,
  className,
}) => {
  const [progress, setProgress] = useState(100);

  useEffect(() => {
    if (!messageId) {
      setProgress(100);
      return;
    }

    const startTime = Date.now();
    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const remaining = Math.max(0, 100 - (elapsed / durationMs) * 100);
      setProgress(remaining);

      if (elapsed >= durationMs) {
        clearInterval(interval);
        onDismiss();
      }
    }, 50);

    return () => clearInterval(interval);
  }, [messageId, durationMs, onDismiss]);

  if (!messageId) return null;

  return (
    <div
      className={
        className ||
        "absolute bottom-3 left-1/2 -translate-x-1/2 w-max max-w-[85%] z-40 flex flex-col overflow-hidden rounded-xl bg-[#1c1f2e] border border-white/[0.08] shadow-2xl shadow-black/80 animate-in fade-in slide-in-from-bottom-2 duration-200"
      }
    >
      <div className="flex items-center justify-between gap-5 px-3.5 py-2">
        <span className="text-xs text-slate-200 font-medium whitespace-nowrap">Message deleted for you</span>
        <button
          type="button"
          onClick={() => {
            onUndo(messageId);
            onDismiss();
          }}
          className="flex items-center gap-1 text-xs font-semibold text-[#0066ff] hover:text-[#38bdf8] transition-colors cursor-pointer shrink-0 uppercase tracking-wide"
        >
          <Undo2 size={13} />
          <span>Undo</span>
        </button>
      </div>
      {/* Progress countdown bar */}
      <div
        className="h-0.5 bg-[#0066ff] transition-all duration-75 ease-linear"
        style={{ width: `${progress}%` }}
      />
    </div>
  );
};
