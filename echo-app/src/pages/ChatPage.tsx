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
        {/* Middle Conversation Panel: 320px width (w-80) on desktop */}
        <div
          className={`w-full md:w-80 h-full shrink-0 ${
            activeConversationId ? "hidden md:flex" : "flex"
          }`}
        >
          <ConversationList />
        </div>

        {/* Main Chat Canvas: Fluid flex-1 */}
        <div
          className={`flex-1 h-full min-w-0 ${
            !activeConversationId ? "hidden md:flex" : "flex"
          }`}
        >
          <ChatWindow />
        </div>
      </div>
    </>
  );
};
