import { FC, useState, useRef, useEffect, FormEvent, KeyboardEvent } from "react";
import { Send, Smile } from "lucide-react";
import EmojiPicker, { Theme, EmojiClickData } from "emoji-picker-react";
import { useTypingIndicator } from "../../hooks/useTypingIndicator";

interface MessageInputProps {
  conversationId: string;
  onSendMessage: (content: string) => void;
  disabled?: boolean;
}

export const MessageInput: FC<MessageInputProps> = ({
  conversationId,
  onSendMessage,
  disabled = false,
}) => {
  const [content, setContent] = useState("");
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

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

  const handleSubmit = (e?: FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = content.trim();
    if (!trimmed || disabled) return;

    handleStopTyping();
    onSendMessage(trimmed);
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

  return (
    <form
      onSubmit={handleSubmit}
      className="relative p-3 bg-slate-900 border-t border-slate-800 flex items-end gap-2"
    >
      {/* Emoji Picker Popup */}
      {showEmojiPicker && (
        <div
          ref={pickerRef}
          className="absolute bottom-16 left-3 z-50 shadow-2xl rounded-2xl overflow-hidden border border-slate-800"
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

      {/* Emoji Button */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => setShowEmojiPicker((prev) => !prev)}
        className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors shrink-0 cursor-pointer ${
          showEmojiPicker
            ? "bg-indigo-600/20 text-indigo-400 border border-indigo-500/30"
            : "text-slate-400 hover:text-white hover:bg-slate-800"
        }`}
        title="Choose emoji"
      >
        <Smile className="w-5 h-5" />
      </button>

      {/* Text input */}
      <textarea
        ref={textareaRef}
        value={content}
        onChange={(e) => handleChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Type a message..."
        rows={1}
        disabled={disabled}
        className="flex-1 max-h-32 min-h-[42px] bg-slate-800 text-slate-100 placeholder-slate-400 text-sm rounded-xl px-4 py-2.5 resize-none border border-slate-700/70 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
      />

      {/* Send Button */}
      <button
        type="submit"
        disabled={!content.trim() || disabled}
        className="w-10 h-10 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:hover:bg-indigo-600 text-white flex items-center justify-center transition-all shrink-0 cursor-pointer disabled:cursor-not-allowed shadow-sm"
      >
        <Send className="w-4 h-4 ml-0.5" />
      </button>
    </form>
  );
};
