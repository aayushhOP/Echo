import React, { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Trash2, Ban, Info, X } from "lucide-react";
import { useConfirmDialogStore, DialogVariant } from "../../store/confirmDialogStore";

const variantConfig: Record<
  DialogVariant,
  {
    icon: React.ComponentType<{ className?: string; size?: number }>;
    iconBg: string;
    iconColor: string;
    confirmButtonBg: string;
  }
> = {
  danger: {
    icon: Trash2,
    iconBg: "bg-rose-500/10 border-rose-500/20",
    iconColor: "text-rose-400",
    confirmButtonBg: "bg-rose-600 hover:bg-rose-500 text-white shadow-rose-950/40",
  },
  warning: {
    icon: Ban,
    iconBg: "bg-amber-500/10 border-amber-500/20",
    iconColor: "text-amber-400",
    confirmButtonBg: "bg-amber-600 hover:bg-amber-500 text-white shadow-amber-950/40",
  },
  info: {
    icon: Info,
    iconBg: "bg-[#0066ff]/10 border-[#0066ff]/20",
    iconColor: "text-[#0066ff]",
    confirmButtonBg: "bg-[#0066ff] hover:bg-[#0052cc] text-white shadow-blue-950/40",
  },
};

export const ConfirmationModal: React.FC = () => {
  const { isOpen, options, handleConfirm, handleCancel } = useConfirmDialogStore();
  const { title, message, confirmText, cancelText, variant = "danger" } = options;

  const currentVariant = variantConfig[variant] || variantConfig.danger;
  const IconComponent = currentVariant.icon;

  // Keyboard accessibility: Escape cancels, Enter confirms
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        handleCancel();
      } else if (e.key === "Enter") {
        e.preventDefault();
        handleConfirm();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, handleCancel, handleConfirm]);

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* 1. Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={handleCancel}
            className="fixed inset-0 bg-[#0d0e15]/75 backdrop-blur-sm"
          />

          {/* 2. Dialog Card */}
          <motion.div
            initial={{ opacity: 0, scale: 0.92, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: 8 }}
            transition={{ type: "spring", stiffness: 380, damping: 28 }}
            className="relative z-10 w-full max-w-sm rounded-2xl border border-white/[0.08] bg-[#171824] p-5 shadow-2xl shadow-black/80"
          >
            {/* Close cross */}
            <button
              onClick={handleCancel}
              className="absolute right-4 top-4 p-1 text-slate-400 hover:text-white rounded-lg hover:bg-white/[0.04] transition-colors cursor-pointer"
              title="Close modal"
              type="button"
            >
              <X size={16} />
            </button>

            {/* Icon + Headers */}
            <div className="flex items-start gap-3.5">
              <div
                className={`flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl border ${currentVariant.iconBg}`}
              >
                <IconComponent className={currentVariant.iconColor} size={20} />
              </div>

              <div className="flex-1 pr-4">
                <h3 className="text-sm font-semibold tracking-wide text-white">
                  {title}
                </h3>
                <p className="mt-1 text-xs leading-relaxed text-slate-400">
                  {message}
                </p>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="mt-6 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={handleCancel}
                className="px-3.5 py-2 rounded-xl text-xs font-medium text-slate-300 hover:text-white hover:bg-white/[0.06] transition-colors cursor-pointer"
              >
                {cancelText || "Cancel"}
              </button>

              <button
                type="button"
                onClick={handleConfirm}
                className={`px-4 py-2 rounded-xl text-xs font-medium shadow-lg transition-all active:scale-[0.98] cursor-pointer ${currentVariant.confirmButtonBg}`}
              >
                {confirmText || "Confirm"}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
