import React, { useState, useRef, useEffect } from "react";
import { Play, Pause, Mic } from "lucide-react";

interface VoiceNotePlayerProps {
  audioUrl: string;
  duration: number;
  waveform?: number[];
  isOwnMessage: boolean;
  senderAvatar?: string;
}

const PLAYBACK_SPEEDS = [1, 1.5, 2];

export const VoiceNotePlayer: React.FC<VoiceNotePlayerProps> = ({
  audioUrl,
  duration,
  waveform = [],
  isOwnMessage,
  senderAvatar,
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [speedIndex, setSpeedIndex] = useState(0);

  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Normalize fallback waveform if none provided
  const bars = waveform && waveform.length > 0 ? waveform : new Array(32).fill(30);

  useEffect(() => {
    const audio = new Audio(audioUrl);
    audioRef.current = audio;

    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
    };

    const handleEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };

    audio.addEventListener("timeupdate", handleTimeUpdate);
    audio.addEventListener("ended", handleEnded);

    return () => {
      audio.pause();
      audio.removeEventListener("timeupdate", handleTimeUpdate);
      audio.removeEventListener("ended", handleEnded);
    };
  }, [audioUrl]);

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play().catch((err) => {
        console.error("Playback error:", err);
      });
      setIsPlaying(true);
    }
  };

  const handleSeek = (index: number) => {
    if (!audioRef.current) return;
    const progress = index / bars.length;
    const targetDuration = audioRef.current.duration || duration;
    const targetTime = progress * targetDuration;
    audioRef.current.currentTime = targetTime;
    setCurrentTime(targetTime);
  };

  const toggleSpeed = () => {
    if (!audioRef.current) return;
    const nextIdx = (speedIndex + 1) % PLAYBACK_SPEEDS.length;
    setSpeedIndex(nextIdx);
    audioRef.current.playbackRate = PLAYBACK_SPEEDS[nextIdx];
  };

  const formatTime = (seconds: number) => {
    const safeSecs = Math.max(0, Math.floor(seconds || 0));
    const mins = Math.floor(safeSecs / 60);
    const secs = safeSecs % 60;
    return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
  };

  const currentProgressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className="flex items-center gap-3 py-1 px-1 min-w-[260px] max-w-[320px]">
      {/* Sender Avatar with Mic Badge */}
      <div className="relative flex-shrink-0">
        <div className="w-10 h-10 rounded-full bg-slate-800 border border-white/10 overflow-hidden flex items-center justify-center">
          {senderAvatar ? (
            <img src={senderAvatar} alt="Voice sender" className="w-full h-full object-cover" />
          ) : (
            <Mic size={18} className="text-slate-300" />
          )}
        </div>
        <div className="absolute -bottom-0.5 -right-0.5 p-0.5 rounded-full bg-[#13141d]">
          <div
            className={`w-3.5 h-3.5 rounded-full flex items-center justify-center ${
              isOwnMessage ? "bg-white text-[#0066ff]" : "bg-[#0066ff] text-white"
            }`}
          >
            <Mic size={9} />
          </div>
        </div>
      </div>

      {/* Play / Pause Button */}
      <button
        type="button"
        onClick={togglePlay}
        className={`w-9 h-9 rounded-full flex items-center justify-center transition-all cursor-pointer ${
          isOwnMessage
            ? "bg-white text-[#0066ff] hover:bg-white/90"
            : "bg-[#0066ff] text-white hover:bg-[#0052cc]"
        }`}
      >
        {isPlaying ? (
          <Pause size={16} fill="currentColor" />
        ) : (
          <Play size={16} fill="currentColor" className="ml-0.5" />
        )}
      </button>

      {/* Waveform Scrubber & Timer */}
      <div className="flex-1 flex flex-col justify-center">
        {/* Waveform visual bars */}
        <div className="flex items-center gap-[2.5px] h-7 cursor-pointer" title="Seek audio">
          {bars.map((amplitude, i) => {
            const barProgress = (i / bars.length) * 100;
            const isPlayed = barProgress <= currentProgressPercent;

            return (
              <div
                key={i}
                onClick={() => handleSeek(i)}
                className={`w-[2.5px] rounded-full transition-colors ${
                  isPlayed
                    ? isOwnMessage
                      ? "bg-white"
                      : "bg-[#0066ff]"
                    : isOwnMessage
                    ? "bg-white/35 hover:bg-white/60"
                    : "bg-slate-600 hover:bg-slate-400"
                }`}
                style={{ height: `${Math.max(20, Math.min(100, amplitude))}%` }}
              />
            );
          })}
        </div>

        {/* Time & Speed Controls */}
        <div className="flex items-center justify-between text-[11px] text-white/70 mt-0.5 font-mono">
          <span>{isPlaying ? formatTime(currentTime) : formatTime(duration)}</span>

          {/* Speed Toggle (1x, 1.5x, 2x) */}
          <button
            type="button"
            onClick={toggleSpeed}
            className={`text-[10px] font-bold px-1.5 py-0.5 rounded transition-all cursor-pointer ${
              isOwnMessage
                ? "bg-white/20 hover:bg-white/30 text-white"
                : "bg-white/[0.08] hover:bg-white/[0.15] text-slate-300"
            }`}
          >
            {PLAYBACK_SPEEDS[speedIndex]}x
          </button>
        </div>
      </div>
    </div>
  );
};
