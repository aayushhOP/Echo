import { create } from "zustand";

export type DialogVariant = "danger" | "warning" | "info";

export interface ConfirmOptions {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string | null;
  variant?: DialogVariant;
}

interface ConfirmDialogState {
  isOpen: boolean;
  options: ConfirmOptions;
  resolver: ((value: boolean) => void) | null;
  confirm: (options: ConfirmOptions) => Promise<boolean>;
  handleConfirm: () => void;
  handleCancel: () => void;
}

const defaultOptions: ConfirmOptions = {
  title: "Confirm Action",
  message: "Are you sure you want to proceed?",
  confirmText: "Confirm",
  cancelText: "Cancel",
  variant: "danger",
};

export const useConfirmDialogStore = create<ConfirmDialogState>((set, get) => ({
  isOpen: false,
  options: defaultOptions,
  resolver: null,

  confirm: (options: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      set({
        isOpen: true,
        options: { ...defaultOptions, ...options },
        resolver: resolve,
      });
    });
  },

  handleConfirm: () => {
    const { resolver } = get();
    if (resolver) resolver(true);
    set({ isOpen: false, resolver: null });
  },

  handleCancel: () => {
    const { resolver } = get();
    if (resolver) resolver(false);
    set({ isOpen: false, resolver: null });
  },
}));

/**
 * Convenient standalone hook export
 */
export const useConfirm = () => {
  return useConfirmDialogStore((state) => state.confirm);
};
