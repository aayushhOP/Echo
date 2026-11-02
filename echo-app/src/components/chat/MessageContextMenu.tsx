import React, { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Reply,
  Copy,
  Forward,
  Pin,
  CheckSquare,
  Trash2,
  Check,
} from "lucide-react";

interface MessageContextMenuProps {
  isOpen: boolean;
  onClose: () => void;
  triggerRef?: React.RefObject<HTMLButtonElement | null>;
  isOwnMessage: boolean;
  isPinned?: boolean;
  onReply: () => void;
  onCopy: () => void;
  onForward: () => void;
  onTogglePin: () => void;
  onSelect: () => void;
  onDelete: () => void;
}

export const MessageContextMenu: React.FC<MessageContextMenuProps> = ({
  isOpen,
  onClose,
  triggerRef,
  isOwnMessage,
  isPinned,
  onReply,
  onCopy,
  onForward,
  onTogglePin,
  onSelect,
  onDelete,
}) => {
  const menuRef = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);
  const [placement, setPlacement] = useState<"top" | "bottom">("top");

  // Determine whether to place on top or bottom based on available space
  useEffect(() => {
    if (!isOpen) return;

    if (menuRef.current) {
      const parent = menuRef.current.parentElement;
      if (parent) {
        const rect = parent.getBoundingClientRect();
        const spaceAbove = rect.top;
        const spaceBelow = window.innerHeight - rect.bottom;

        // If space above is sufficient (>= 220px), show on top.
        // Otherwise, if space below is larger or above is cramped, show on bottom.
        if (spaceAbove >= 220) {
          setPlacement("top");
        } else if (spaceBelow >= 220) {
          setPlacement("bottom");
        } else {
          // If neither has 220px, place wherever there is more space
          setPlacement(spaceAbove >= spaceBelow ? "top" : "bottom");
        }
      }
    }
  }, [isOpen]);

  // Close on click outside (ignoring clicks on the trigger button which handles its own toggle)
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (triggerRef?.current && triggerRef.current.contains(target)) {
        return;
      }
      if (menuRef.current && !menuRef.current.contains(target)) {
        onClose();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen, onClose, triggerRef]);

  const handleCopyClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onCopy();
    setCopied(true);
    setTimeout(() => {
      setCopied(false);
      onClose();
    }, 600);
  };

  const isTop = placement === "top";

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          ref={menuRef}
          initial={{ opacity: 0, scale: 0.88, y: isTop ? 6 : -6 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.88, y: isTop ? 6 : -6 }}
          transition={{ duration: 0.15, ease: "easeOut" }}
          onClick={(e) => e.stopPropagation()}
          className={`absolute z-40 w-44 rounded-xl bg-[#171824] border border-white/[0.08] shadow-2xl py-1 backdrop-blur-md ${
            isTop ? "bottom-full mb-1.5 origin-bottom" : "top-full mt-1.5 origin-top"
          } ${
            isOwnMessage ? "right-0" : "left-0"
          }`}
        >
          {/* 1. Reply */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onClose();
              onReply();
            }}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-slate-200 hover:text-white hover:bg-white/[0.05] transition-colors cursor-pointer text-left"
          >
            <Reply size={15} className="text-slate-400 shrink-0" />
            <span>Reply</span>
          </button>

          {/* 2. Copy */}
          <button
            type="button"
            onClick={handleCopyClick}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-slate-200 hover:text-white hover:bg-white/[0.05] transition-colors cursor-pointer text-left"
          >
            {copied ? (
              <Check size={15} className="text-emerald-400 shrink-0" />
            ) : (
              <Copy size={15} className="text-slate-400 shrink-0" />
            )}
            <span>{copied ? "Copied!" : "Copy"}</span>
          </button>

          {/* 3. Forward */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onClose();
              onForward();
            }}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-slate-200 hover:text-white hover:bg-white/[0.05] transition-colors cursor-pointer text-left"
          >
            <Forward size={15} className="text-slate-400 shrink-0" />
            <span>Forward</span>
          </button>

          {/* 4. Pin / Unpin */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onClose();
              onTogglePin();
            }}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-slate-200 hover:text-white hover:bg-white/[0.05] transition-colors cursor-pointer text-left"
          >
            <Pin
              size={15}
              className={isPinned ? "text-[#0066ff] fill-[#0066ff] shrink-0" : "text-slate-400 shrink-0"}
            />
            <span>{isPinned ? "Unpin" : "Pin"}</span>
          </button>

          {/* 5. Select */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onClose();
              onSelect();
            }}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-slate-200 hover:text-white hover:bg-white/[0.05] transition-colors cursor-pointer text-left"
          >
            <CheckSquare size={15} className="text-slate-400 shrink-0" />
            <span>Select</span>
          </button>

          <div className="h-px bg-white/[0.06] my-1" />

          {/* 6. Delete */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onClose();
              onDelete();
            }}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer text-left"
          >
            <Trash2 size={15} className="shrink-0" />
            <span>Delete</span>
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
