import React from "react";
import { Check, CheckCheck } from "lucide-react";

export type MessageStatus = "sent" | "delivered" | "read";

interface MessageStatusTickProps {
  status: MessageStatus;
  isOwnMessage: boolean;
  className?: string;
}

export const MessageStatusTick: React.FC<MessageStatusTickProps> = ({
  status,
  isOwnMessage,
  className = "",
}) => {
  if (!isOwnMessage) return null;

  switch (status) {
    case "sent":
      // Single Grey Tick
      return (
        <span title="Sent (Delivered to server)" className="inline-flex items-center">
          <Check
            size={14}
            strokeWidth={2.5}
            className={`text-slate-400 inline-block ml-1 transition-colors duration-200 ${className}`}
          />
        </span>
      );
    case "delivered":
      // Double Grey Tick
      return (
        <span title="Delivered to recipient" className="inline-flex items-center">
          <CheckCheck
            size={15}
            strokeWidth={2.5}
            className={`text-slate-400 inline-block ml-1 transition-colors duration-200 ${className}`}
          />
        </span>
      );
    case "read":
      // Double Blue Tick (Electric blue matching the theme #0066ff)
      return (
        <span title="Read by recipient" className="inline-flex items-center">
          <CheckCheck
            size={15}
            strokeWidth={2.5}
            className={`text-[#0066ff] inline-block ml-1 transition-colors duration-200 ${className}`}
          />
        </span>
      );
    default:
      return null;
  }
};
