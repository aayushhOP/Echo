import { FC } from "react";

interface TypingIndicatorProps {
  names: string[];
}

export const TypingIndicator: FC<TypingIndicatorProps> = ({ names }) => {
  if (names.length === 0) return null;

  let text = "";
  if (names.length === 1) {
    text = `${names[0]} is typing...`;
  } else if (names.length === 2) {
    text = `${names[0]} and ${names[1]} are typing...`;
  } else {
    text = `${names[0]} and ${names.length - 1} others are typing...`;
  }

  return (
    <div className="flex items-center gap-2 px-4 py-1.5 text-xs text-slate-400 bg-slate-900/60">
      <div className="flex items-center gap-1">
        <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce [animation-delay:-0.3s]" />
        <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce [animation-delay:-0.15s]" />
        <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce" />
      </div>
      <span>{text}</span>
    </div>
  );
};
