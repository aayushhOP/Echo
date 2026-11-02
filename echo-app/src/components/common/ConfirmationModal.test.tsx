/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, screen, fireEvent, act, cleanup } from "@testing-library/react";
import { ConfirmationModal } from "./ConfirmationModal";
import { useConfirmDialogStore } from "../../store/confirmDialogStore";

describe("ConfirmationModal", () => {
  beforeEach(() => {
    act(() => {
      useConfirmDialogStore.setState({
        isOpen: false,
        options: {
          title: "Confirm Action",
          message: "Are you sure you want to proceed?",
          confirmText: "Confirm",
          cancelText: "Cancel",
          variant: "danger",
        },
        resolver: null,
      });
    });
  });

  afterEach(() => {
    cleanup();
  });

  it("renders when open with options and resolves true when confirm clicked", async () => {
    render(<ConfirmationModal />);

    let resultPromise!: Promise<boolean>;
    act(() => {
      resultPromise = useConfirmDialogStore.getState().confirm({
        title: "Delete this chat?",
        message: "Are you sure?",
        confirmText: "Delete",
        cancelText: "Keep",
        variant: "danger",
      });
    });

    expect(screen.getByText("Delete this chat?")).toBeInTheDocument();
    expect(screen.getByText("Are you sure?")).toBeInTheDocument();

    const confirmBtn = screen.getByText("Delete");
    act(() => {
      fireEvent.click(confirmBtn);
    });

    const result = await resultPromise;
    expect(result).toBe(true);
    expect(useConfirmDialogStore.getState().isOpen).toBe(false);
  });

  it("resolves false when cancel button is clicked", async () => {
    render(<ConfirmationModal />);

    let resultPromise!: Promise<boolean>;
    act(() => {
      resultPromise = useConfirmDialogStore.getState().confirm({
        title: "Block User",
        message: "Block contact?",
        confirmText: "Block",
        cancelText: "Cancel",
        variant: "warning",
      });
    });

    const cancelBtn = screen.getByText("Cancel");
    act(() => {
      fireEvent.click(cancelBtn);
    });

    const result = await resultPromise;
    expect(result).toBe(false);
    expect(useConfirmDialogStore.getState().isOpen).toBe(false);
  });

  it("resolves false on Escape key and true on Enter key", async () => {
    render(<ConfirmationModal />);

    // Test Escape
    let resultPromise!: Promise<boolean>;
    act(() => {
      resultPromise = useConfirmDialogStore.getState().confirm({
        title: "Test Escape",
        message: "Escape key test",
      });
    });

    act(() => {
      fireEvent.keyDown(window, { key: "Escape" });
    });
    let result = await resultPromise;
    expect(result).toBe(false);

    // Test Enter
    act(() => {
      resultPromise = useConfirmDialogStore.getState().confirm({
        title: "Test Enter",
        message: "Enter key test",
      });
    });

    act(() => {
      fireEvent.keyDown(window, { key: "Enter" });
    });
    result = await resultPromise;
    expect(result).toBe(true);
  });
});
