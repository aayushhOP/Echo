import { useRef, useCallback } from "react";
import { useSocket } from "./useSocket";

export const useTypingIndicator = (conversationId: string | null) => {
  const { startTyping, stopTyping } = useSocket();
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isTypingRef = useRef(false);

  const handleKeystroke = useCallback(() => {
    if (!conversationId) return;

    if (!isTypingRef.current) {
      isTypingRef.current = true;
      startTyping(conversationId);
    }

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    typingTimeoutRef.current = setTimeout(() => {
      if (conversationId && isTypingRef.current) {
        stopTyping(conversationId);
        isTypingRef.current = false;
      }
    }, 2000);
  }, [conversationId, startTyping, stopTyping]);

  const handleStopTyping = useCallback(() => {
    if (!conversationId) return;
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }
    if (isTypingRef.current) {
      stopTyping(conversationId);
      isTypingRef.current = false;
    }
  }, [conversationId, stopTyping]);

  return {
    handleKeystroke,
    handleStopTyping,
  };
};
