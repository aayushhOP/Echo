import { FC, useState, FormEvent, KeyboardEvent } from "react";
import { Send } from "lucide-react";
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
  const { handleKeystroke, handleStopTyping } = useTypingIndicator(conversationId);

  const handleSubmit = (e?: FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = content.trim();
    if (!trimmed || disabled) return;

    handleStopTyping();
    onSendMessage(trimmed);
    setContent("");
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

  return (
    <form
      onSubmit={handleSubmit}
      className="p-3 bg-slate-900 border-t border-slate-800 flex items-end gap-2"
    >
      <textarea
        value={content}
        onChange={(e) => handleChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Type a message..."
        rows={1}
        disabled={disabled}
        className="flex-1 max-h-32 min-h-[42px] bg-slate-800 text-slate-100 placeholder-slate-400 text-sm rounded-xl px-4 py-2.5 resize-none border border-slate-700/70 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
      />
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
