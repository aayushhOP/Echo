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
    <div className="flex items-center gap-2 px-3 py-1.5 text-xs text-[#767b93] my-1 select-none">
      <span className="w-1.5 h-1.5 rounded-full bg-[#0066ff] animate-pulse shrink-0" />
      <span>{text}</span>
    </div>
  );
};
