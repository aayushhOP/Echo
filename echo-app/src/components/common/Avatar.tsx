import { FC } from "react";
import { cn } from "../../utils/date";

interface AvatarProps {
  name: string;
  avatarUrl?: string;
  isOnline?: boolean;
  showPresence?: boolean;
  size?: "sm" | "md" | "lg";
  className?: string;
}

export const Avatar: FC<AvatarProps> = ({
  name,
  avatarUrl,
  isOnline = false,
  showPresence = false,
  size = "md",
  className,
}) => {
  const initials = name
    ? name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "?";

  const sizeStyles = {
    sm: "w-8 h-8 text-xs",
    md: "w-10 h-10 text-sm",
    lg: "w-14 h-14 text-lg",
  };

  const presenceDotSize = {
    sm: "w-2.5 h-2.5 border",
    md: "w-3 h-3 border-2",
    lg: "w-3.5 h-3.5 border-2",
  };

  return (
    <div className={cn("relative inline-flex shrink-0", className)}>
      {avatarUrl ? (
        <img
          src={avatarUrl}
          alt={name}
          className={cn(
            "rounded-full object-cover bg-slate-800",
            sizeStyles[size]
          )}
        />
      ) : (
        <div
          className={cn(
            "rounded-full flex items-center justify-center font-semibold bg-indigo-600 text-white select-none",
            sizeStyles[size]
          )}
        >
          {initials}
        </div>
      )}

      {showPresence && (
        <span
          className={cn(
            "absolute bottom-0 right-0 rounded-full border-slate-900",
            presenceDotSize[size],
            isOnline ? "bg-emerald-500" : "bg-slate-500"
          )}
          title={isOnline ? "Online" : "Offline"}
        />
      )}
    </div>
  );
};
