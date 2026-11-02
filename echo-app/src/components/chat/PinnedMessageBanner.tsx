import React, { useState, useRef, useEffect } from "react";
import { Pin, ChevronDown, MessageSquareShare, PinOff } from "lucide-react";
import { Message } from "../../types/message";

interface PinnedMessageBannerProps {
  pinnedMessage: Message;
  onGoToMessage: (messageId: string) => void;
  onUnpinMessage: (messageId: string) => void;
}

export const PinnedMessageBanner: React.FC<PinnedMessageBannerProps> = ({
  pinnedMessage,
  onGoToMessage,
  onUnpinMessage,
}) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const triggerButtonRef = useRef<HTMLButtonElement>(null);

  // Close menu on outside click
  useEffect(() => {
    if (!isMenuOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (triggerButtonRef.current && triggerButtonRef.current.contains(target)) {
        return;
      }
      if (menuRef.current && !menuRef.current.contains(target)) {
        setIsMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isMenuOpen]);

  const displaySnippet =
    pinnedMessage.content ||
    (pinnedMessage.type === "image"
      ? "Photo"
      : pinnedMessage.fileName
      ? `Document: ${pinnedMessage.fileName}`
      : "Attachment");

  return (
    <div className="relative z-20 w-full bg-[#182229]/95 border-b border-white/[0.06] backdrop-blur-md px-4 py-2 flex items-center justify-between text-xs text-slate-200 select-none animate-in slide-in-from-top-1 duration-150">
      {/* Clickable banner body to jump to message */}
      <div
        onClick={() => onGoToMessage(pinnedMessage._id)}
        className="flex items-center gap-2.5 flex-1 min-w-0 cursor-pointer group"
      >
        <div className="w-6 h-6 rounded-full bg-white/[0.05] flex items-center justify-center shrink-0 text-slate-300 group-hover:text-white transition-colors">
          <Pin size={13} className="fill-current rotate-45" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="truncate font-medium text-slate-200 group-hover:text-white transition-colors">
            {displaySnippet}
          </p>
        </div>
      </div>

      {/* Action button with dropdown */}
      <div className="relative shrink-0 ml-2">
        <button
          ref={triggerButtonRef}
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setIsMenuOpen((prev) => !prev);
          }}
          className={`p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/[0.06] transition-colors cursor-pointer ${
            isMenuOpen ? "bg-white/[0.08] text-white" : ""
          }`}
          title="Pinned message options"
        >
          <ChevronDown size={16} />
        </button>

        {isMenuOpen && (
          <div
            ref={menuRef}
            onClick={(e) => e.stopPropagation()}
            className="absolute right-0 top-full mt-1 w-44 rounded-xl bg-[#232d36] border border-white/[0.08] shadow-2xl py-1 z-30 animate-in fade-in zoom-in-95 duration-100"
          >
            <button
              type="button"
              onClick={() => {
                setIsMenuOpen(false);
                onUnpinMessage(pinnedMessage._id);
              }}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-slate-200 hover:text-white hover:bg-white/[0.05] transition-colors cursor-pointer text-left"
            >
              <PinOff size={14} className="text-slate-400 shrink-0" />
              <span>Unpin</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setIsMenuOpen(false);
                onGoToMessage(pinnedMessage._id);
              }}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-slate-200 hover:text-white hover:bg-white/[0.05] transition-colors cursor-pointer text-left"
            >
              <MessageSquareShare size={14} className="text-slate-400 shrink-0" />
              <span>Go to message</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
