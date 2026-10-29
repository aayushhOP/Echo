import { FC } from "react";
import { ConversationList } from "../components/chat/ConversationList";
import { ChatWindow } from "../components/chat/ChatWindow";
import { useChatStore } from "../store/chatStore";

export const ChatPage: FC = () => {
  const activeConversationId = useChatStore((state) => state.activeConversationId);

  return (
    <div className="flex-1 h-full flex overflow-hidden">
      {/* Sidebar / ConversationList: full width on mobile if no active conv, fixed 340px-380px on desktop */}
      <div
        className={`w-full md:w-80 lg:w-96 h-full shrink-0 ${
          activeConversationId ? "hidden md:flex" : "flex"
        }`}
      >
        <ConversationList />
      </div>

      {/* ChatWindow: full width on mobile when active conv is set, flex-1 on desktop */}
      <div
        className={`flex-1 h-full ${
          !activeConversationId ? "hidden md:flex" : "flex"
        }`}
      >
        <ChatWindow />
      </div>
    </div>
  );
};
