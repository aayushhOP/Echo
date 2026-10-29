import { FC, useEffect, useState } from "react";
import { MessageSquare, Sparkles } from "lucide-react";

interface AppLoaderProps {
  onComplete?: () => void;
  statusText?: string;
  duration?: number;
}

export const AppLoader: FC<AppLoaderProps> = ({
  onComplete,
  statusText = "Setting up your secure workspace...",
  duration = 1400,
}) => {
  const [progress, setProgress] = useState(15);
  const [fadingOut, setFadingOut] = useState(false);

  useEffect(() => {
    const progressTimer1 = setTimeout(() => setProgress(55), duration * 0.25);
    const progressTimer2 = setTimeout(() => setProgress(88), duration * 0.65);
    const progressTimer3 = setTimeout(() => setProgress(100), duration * 0.9);

    const fadeTimer = setTimeout(() => {
      setFadingOut(true);
    }, duration - 300);

    const completeTimer = setTimeout(() => {
      onComplete?.();
    }, duration);

    return () => {
      clearTimeout(progressTimer1);
      clearTimeout(progressTimer2);
      clearTimeout(progressTimer3);
      clearTimeout(fadeTimer);
      clearTimeout(completeTimer);
    };
  }, [duration, onComplete]);

  return (
    <div
      className={`fixed inset-0 z-50 flex flex-col items-center justify-center bg-slate-950 transition-opacity duration-300 ${
        fadingOut ? "opacity-0 pointer-events-none" : "opacity-100"
      }`}
    >
      {/* Decorative ambient background glows */}
      <div className="absolute w-96 h-96 rounded-full bg-indigo-600/15 blur-3xl -top-12 -left-12 pointer-events-none animate-pulse" />
      <div className="absolute w-96 h-96 rounded-full bg-violet-600/15 blur-3xl -bottom-12 -right-12 pointer-events-none animate-pulse" />

      {/* Center Branding & Animated Logo */}
      <div className="relative flex flex-col items-center">
        {/* Pulsing ring aura */}
        <div className="relative flex items-center justify-center">
          <div className="absolute w-28 h-28 rounded-3xl bg-indigo-500/20 animate-ping" />
          <div className="absolute w-24 h-24 rounded-3xl bg-indigo-500/30 blur-md animate-pulse" />

          {/* Main App Icon */}
          <div className="relative w-20 h-20 rounded-3xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-violet-500 flex items-center justify-center shadow-2xl shadow-indigo-500/40 border border-indigo-400/30 animate-bounce">
            <MessageSquare className="w-10 h-10 text-white fill-white/10" />
            <Sparkles className="w-4 h-4 text-amber-300 absolute -top-1 -right-1 animate-spin" />
          </div>
        </div>

        {/* Brand Name */}
        <div className="mt-8 flex items-center gap-2">
          <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-white via-slate-200 to-indigo-200 bg-clip-text text-transparent">
            Echo
          </h1>
          <span className="px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-indigo-400 bg-indigo-950/60 border border-indigo-800/60 rounded-full">
            Realtime
          </span>
        </div>

        {/* Dynamic Status Text */}
        <p className="text-xs text-slate-400 mt-2 font-medium tracking-wide">
          {statusText}
        </p>

        {/* Sleek Progress Bar */}
        <div className="w-56 h-1.5 bg-slate-800/80 rounded-full overflow-hidden mt-6 border border-slate-700/50 p-0.5">
          <div
            className="h-full bg-gradient-to-r from-indigo-500 via-violet-500 to-pink-500 rounded-full transition-all duration-300 ease-out shadow-sm shadow-indigo-500/50"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    </div>
  );
};
