import { FC, useEffect, useState } from "react";
import { Undo2 } from "lucide-react";

interface UndoSnackbarProps {
  messageId: string | null;
  onUndo: (messageId: string) => void;
  onDismiss: () => void;
  durationMs?: number;
}

export const UndoSnackbar: FC<UndoSnackbarProps> = ({
  messageId,
  onUndo,
  onDismiss,
  durationMs = 5000,
}) => {
  const [progress, setProgress] = useState(100);

  useEffect(() => {
    if (!messageId) return;

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
    <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-40 flex flex-col overflow-hidden rounded-xl bg-[#171824] border border-white/[0.08] shadow-2xl animate-in slide-in-from-bottom duration-200">
      <div className="flex items-center gap-4 px-4 py-2.5">
        <span className="text-xs text-slate-300">Message deleted for you</span>
        <button
          type="button"
          onClick={() => {
            onUndo(messageId);
            onDismiss();
          }}
          className="flex items-center gap-1.5 text-xs font-semibold text-[#0066ff] hover:text-[#0052cc] transition-colors cursor-pointer"
        >
          <Undo2 size={14} />
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
