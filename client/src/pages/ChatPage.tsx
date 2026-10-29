import { FC, useState, useEffect } from "react";
import { ConversationList } from "../components/chat/ConversationList";
import { ChatWindow } from "../components/chat/ChatWindow";
import { useChatStore } from "../store/chatStore";
import { AppLoader } from "../components/common/AppLoader";

let hasLoadedInitially = false;

export const ChatPage: FC = () => {
  const activeConversationId = useChatStore((state) => state.activeConversationId);
  const [isIntroLoading, setIsIntroLoading] = useState(!hasLoadedInitially);

  useEffect(() => {
    if (!hasLoadedInitially) {
      hasLoadedInitially = true;
    }
  }, []);

  return (
    <>
      {isIntroLoading && (
        <AppLoader
          duration={1200}
          statusText="Loading conversations and messages..."
          onComplete={() => setIsIntroLoading(false)}
        />
      )}

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
    </>
  );
};
