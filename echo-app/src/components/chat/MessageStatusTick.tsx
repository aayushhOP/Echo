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
        <span title="Sent (Delivered to server)" className="inline-flex items-center self-end mb-[-1px]">
          <Check
            size={13}
            strokeWidth={2.2}
            className={`text-slate-400 inline-block transition-colors duration-200 ${className}`}
          />
        </span>
      );
    case "delivered":
      // Double Grey Tick
      return (
        <span title="Delivered to recipient" className="inline-flex items-center self-end mb-[-1px]">
          <CheckCheck
            size={14}
            strokeWidth={2.2}
            className={`text-slate-400 inline-block transition-colors duration-200 ${className}`}
          />
        </span>
      );
    case "read":
      // Double Blue Tick (WhatsApp Electric Cyan/Blue #34b7f1 or #38bdf8)
      return (
        <span title="Read by recipient" className="inline-flex items-center self-end mb-[-1px]">
          <CheckCheck
            size={14}
            strokeWidth={2.2}
            className={`text-[#38bdf8] inline-block transition-colors duration-200 ${className}`}
          />
        </span>
      );
    default:
      return null;
  }
};
