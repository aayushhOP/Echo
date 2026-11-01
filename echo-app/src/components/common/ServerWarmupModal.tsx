import React from "react";
import { Server, Loader2, Zap } from "lucide-react";

export interface ServerWarmupModalProps {
  isVisible: boolean;
  elapsedSeconds: number;
  progressPercent: number;
}

export const ServerWarmupModal: React.FC<ServerWarmupModalProps> = ({
  isVisible,
  elapsedSeconds,
  progressPercent,
}) => {
  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#13141d]/80 backdrop-blur-md px-4 transition-all duration-300">
      <div className="relative w-full max-w-md rounded-2xl border border-white/[0.08] bg-[#171824] p-6 text-center shadow-2xl shadow-black/60">
        
        {/* Glow & Status Icon */}
        <div className="relative mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#0066ff]/10 border border-[#0066ff]/20">
          <Server className="h-7 w-7 text-[#0066ff]" />
          <Loader2 className="absolute -inset-1.5 h-[76px] w-[76px] animate-spin text-[#0066ff]/30 pointer-events-none" />
        </div>

        {/* Header */}
        <h3 className="text-lg font-semibold tracking-wide text-white">
          Waking Up Cloud Server
        </h3>

        <p className="mt-2 text-xs leading-relaxed text-slate-400">
          Backend is hosted on a free cloud instance. After inactivity, the service needs approximately 30–50 seconds to boot up.
        </p>

        {/* Progress Bar Container */}
        <div className="mt-6 w-full overflow-hidden rounded-full bg-[#13141d] p-1 border border-white/[0.04]">
          <div
            className="h-2 rounded-full bg-gradient-to-r from-[#0066ff] to-[#00d2ff] transition-all duration-700 ease-out"
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        {/* Telemetry Footers */}
        <div className="mt-3 flex items-center justify-between text-[11px] font-mono text-slate-500">
          <span>Elapsed: {elapsedSeconds}s</span>
          <span>Status: Booting runtime... {progressPercent}%</span>
        </div>

        <div className="mt-5 flex items-center justify-center gap-1.5 text-xs text-[#0066ff]">
          <Zap size={14} className="animate-pulse" />
          <span>Sockets and API will connect automatically</span>
        </div>
      </div>
    </div>
  );
};
