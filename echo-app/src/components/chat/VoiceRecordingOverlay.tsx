import React from "react";
import { Trash2, Send } from "lucide-react";

interface VoiceRecordingOverlayProps {
  isRecording: boolean;
  duration: number;
  onCancel: () => void;
  onSend: () => void;
}

export const VoiceRecordingOverlay: React.FC<VoiceRecordingOverlayProps> = ({
  isRecording,
  duration,
  onCancel,
  onSend,
}) => {
  if (!isRecording) return null;

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
  };

  return (
    <div className="h-16 w-full bg-[#171824] border-t border-white/[0.08] px-4 flex items-center justify-between animate-in slide-in-from-bottom duration-150 z-20">
      {/* Delete / Cancel Button */}
      <button
        type="button"
        onClick={onCancel}
        className="p-2.5 rounded-full text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
        title="Cancel voice note"
      >
        <Trash2 size={18} />
      </button>

      {/* Recording Indicator & Timer */}
      <div className="flex items-center gap-3">
        <span className="relative flex h-3 w-3">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-3 w-3 bg-rose-500" />
        </span>
        <span className="font-mono text-sm font-semibold text-white">
          {formatDuration(duration)}
        </span>
        {/* Animated Soundwave Pulse Bars */}
        <div className="flex items-center gap-1 h-5 px-2">
          {[40, 75, 55, 90, 60, 85, 45].map((height, i) => (
            <div
              key={i}
              className="w-0.5 bg-rose-400 rounded-full animate-pulse"
              style={{
                height: `${height}%`,
                animationDelay: `${i * 120}ms`,
                animationDuration: "800ms",
              }}
            />
          ))}
        </div>
      </div>

      {/* Commit & Send Button */}
      <button
        type="button"
        onClick={onSend}
        className="flex items-center justify-center w-10 h-10 rounded-full bg-[#0066ff] hover:bg-[#0052cc] text-white shadow-lg shadow-[#0066ff]/25 transition-transform active:scale-95 cursor-pointer"
        title="Send voice note"
      >
        <Send size={16} />
      </button>
    </div>
  );
};
