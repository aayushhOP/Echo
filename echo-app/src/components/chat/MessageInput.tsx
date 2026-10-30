import { FC, useState, useRef, useEffect, FormEvent, KeyboardEvent, ChangeEvent } from "react";
import { Send, Smile, Paperclip, Loader2, X, FileText, Image as ImageIcon } from "lucide-react";
import EmojiPicker, { Theme, EmojiClickData } from "emoji-picker-react";
import { useTypingIndicator } from "../../hooks/useTypingIndicator";
import { messageApi } from "../../api/messageApi";
import { cn } from "../../utils/cn";

interface MessageInputProps {
  conversationId: string;
  onSendMessage: (
    content: string,
    type?: "text" | "image" | "file",
    metadata?: { mediaUrl?: string; fileName?: string; fileSize?: number }
  ) => void;
  disabled?: boolean;
}

export const MessageInput: FC<MessageInputProps> = ({
  conversationId,
  onSendMessage,
  disabled = false,
}) => {
  const [content, setContent] = useState("");
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [pendingFile, setPendingFile] = useState<{
    file: File;
    previewUrl?: string;
    isImage: boolean;
  } | null>(null);

  const pickerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { handleKeystroke, handleStopTyping } = useTypingIndicator(conversationId);

  // Close emoji picker when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setShowEmojiPicker(false);
      }
    };

    if (showEmojiPicker) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showEmojiPicker]);

  // Clean up preview object URL
  useEffect(() => {
    return () => {
      if (pendingFile?.previewUrl) {
        URL.revokeObjectURL(pendingFile.previewUrl);
      }
    };
  }, [pendingFile]);

  const handleFileSelect = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      alert("File size exceeds 10MB limit.");
      return;
    }

    const isImage = file.type.startsWith("image/");
    const previewUrl = isImage ? URL.createObjectURL(file) : undefined;

    setPendingFile({
      file,
      previewUrl,
      isImage,
    });

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const removePendingFile = () => {
    if (pendingFile?.previewUrl) {
      URL.revokeObjectURL(pendingFile.previewUrl);
    }
    setPendingFile(null);
  };

  const handleSubmit = async (e?: FormEvent) => {
    if (e) e.preventDefault();
    if (disabled || isUploading) return;

    const trimmed = content.trim();

    // If there is an attached file, upload first
    if (pendingFile) {
      setIsUploading(true);
      try {
        const uploadResult = await messageApi.uploadFile(pendingFile.file);
        const msgType = pendingFile.isImage ? "image" : "file";

        handleStopTyping();
        onSendMessage(trimmed, msgType, {
          mediaUrl: uploadResult.url,
          fileName: uploadResult.fileName || pendingFile.file.name,
          fileSize: uploadResult.fileSize || pendingFile.file.size,
        });

        setContent("");
        removePendingFile();
        setShowEmojiPicker(false);
      } catch (err: any) {
        console.error("Upload failed", err);
        alert(err?.response?.data?.message || "Failed to upload file");
      } finally {
        setIsUploading(false);
      }
      return;
    }

    // Standard text message
    if (!trimmed) return;

    handleStopTyping();
    onSendMessage(trimmed, "text");
    setContent("");
    setShowEmojiPicker(false);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleChange = (val: string) => {
    setContent(val);
    if (val.trim().length > 0) {
      handleKeystroke();
    } else {
      handleStopTyping();
    }
  };

  const handleEmojiClick = (emojiData: EmojiClickData) => {
    setContent((prev) => prev + emojiData.emoji);
    handleKeystroke();
    textareaRef.current?.focus();
  };

  const canSend = (content.trim().length > 0 || !!pendingFile) && !isUploading && !disabled;

  return (
    <div className="p-4 bg-[#0b0e14] shrink-0">
      <div className="max-w-4xl mx-auto w-full relative">
        {/* Emoji Picker Popup */}
        {showEmojiPicker && (
          <div
            ref={pickerRef}
            className="absolute bottom-16 left-3 z-50 shadow-2xl rounded-2xl overflow-hidden border border-slate-700/80"
          >
            <EmojiPicker
              onEmojiClick={handleEmojiClick}
              theme={Theme.DARK}
              lazyLoadEmojis
              searchPlaceHolder="Search emoji..."
              width={320}
              height={380}
            />
          </div>
        )}

        {/* Upload Progress / Staging Preview */}
        {pendingFile && (
          <div className="mb-2 px-3 py-1.5 rounded-lg bg-[#182030] border border-slate-700 flex items-center justify-between text-xs text-slate-200">
            <div className="flex items-center gap-2 truncate">
              {pendingFile.isImage ? <ImageIcon size={14} className="text-indigo-400 shrink-0" /> : <FileText size={14} className="text-indigo-400 shrink-0" />}
              <span className="truncate font-medium">{pendingFile.file.name}</span>
              <span className="text-[10px] text-slate-400 shrink-0">
                ({Math.round(pendingFile.file.size / 1024)} KB)
              </span>
            </div>
            <button
              type="button"
              onClick={removePendingFile}
              className="text-slate-400 hover:text-white p-1 rounded transition-colors cursor-pointer"
              title="Remove attachment"
            >
              <X size={14} />
            </button>
          </div>
        )}

        {/* Main Docked Input Surface */}
        <form
          onSubmit={handleSubmit}
          className="bg-[#161c29] border border-slate-700/60 rounded-xl px-3 py-2 flex items-center gap-2 focus-within:border-indigo-500/80 transition-colors shadow-lg"
        >
          {/* Hidden File Input */}
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileSelect}
            className="hidden"
            accept="image/*,.pdf,.zip,.docx,.txt"
          />

          {/* Attachment Paperclip Button */}
          <button
            type="button"
            disabled={disabled || isUploading}
            onClick={() => fileInputRef.current?.click()}
            className="p-2 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 transition-colors shrink-0 cursor-pointer disabled:opacity-50"
            title="Attach file (Images, PDFs up to 10MB)"
          >
            <Paperclip className="w-4 h-4" />
          </button>

          {/* Emoji Trigger */}
          <button
            type="button"
            disabled={disabled || isUploading}
            onClick={() => setShowEmojiPicker((prev) => !prev)}
            className={cn(
              "p-2 rounded-lg transition-colors shrink-0 cursor-pointer disabled:opacity-50",
              showEmojiPicker
                ? "text-indigo-400 bg-indigo-500/10"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60"
            )}
            title="Pick an emoji"
          >
            <Smile className="w-4 h-4" />
          </button>

          {/* Textarea */}
          <textarea
            ref={textareaRef}
            rows={1}
            value={content}
            onChange={(e) => handleChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              isUploading
                ? "Uploading attachment..."
                : pendingFile
                ? "Add an optional caption (Press Enter to send)..."
                : "Type a message... (Press Enter to send)"
            }
            disabled={disabled || isUploading}
            className="flex-1 bg-transparent text-slate-100 placeholder-slate-500 text-sm outline-none resize-none max-h-32 py-1 leading-relaxed"
          />

          {/* Send Button */}
          <button
            type="submit"
            disabled={!canSend}
            className={cn(
              "w-9 h-9 rounded-xl flex items-center justify-center transition-all shrink-0 cursor-pointer",
              canSend
                ? "bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-600/30 scale-100"
                : "bg-slate-800 text-slate-500 cursor-not-allowed scale-95"
            )}
            title="Send message"
          >
            {isUploading ? (
              <Loader2 className="w-4 h-4 animate-spin text-white" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </button>
        </form>
      </div>
    </div>
  );
};
