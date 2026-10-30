import { FC, useState, useEffect } from "react";
import { ConversationList } from "../components/chat/ConversationList";
import { ChatWindow } from "../components/chat/ChatWindow";
import { ContactDetailDrawer } from "../components/chat/ContactDetailDrawer";
import { useChatStore } from "../store/chatStore";
import { useAuthStore } from "../store/authStore";
import { messageApi } from "../api/messageApi";
import { AppLoader } from "../components/common/AppLoader";

let hasLoadedInitially = false;

export const ChatPage: FC = () => {
  const activeConversationId = useChatStore((state) => state.activeConversationId);
  const conversations = useChatStore((state) => state.conversations);
  const addOrUpdateConversation = useChatStore((state) => state.addOrUpdateConversation);
  const currentUser = useAuthStore((state) => state.user);

  const [isIntroLoading, setIsIntroLoading] = useState(!hasLoadedInitially);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  useEffect(() => {
    if (!hasLoadedInitially) {
      hasLoadedInitially = true;
    }
  }, []);

  // Close drawer if active conversation changes or becomes null
  useEffect(() => {
    setIsDrawerOpen(false);
  }, [activeConversationId]);

  const activeConversation = conversations.find((c) => c._id === activeConversationId);
  const currentUserId = currentUser?.id || (currentUser as any)?._id || "";

  const handleTogglePin = async (conversationId: string) => {
    try {
      const res = await messageApi.togglePinConversation(conversationId);
      if (activeConversation && activeConversation._id === conversationId) {
        addOrUpdateConversation({
          ...activeConversation,
          isPinned: res.isPinned,
        });
      }
    } catch (err) {
      console.error("Failed to toggle pin status", err);
    }
  };

  const handleToggleMute = async (conversationId: string) => {
    try {
      const res = await messageApi.toggleMuteConversation(conversationId);
      if (activeConversation && activeConversation._id === conversationId) {
        addOrUpdateConversation({
          ...activeConversation,
          isMuted: res.isMuted,
        });
      }
    } catch (err) {
      console.error("Failed to toggle mute status", err);
    }
  };

  return (
    <>
      {isIntroLoading && (
        <AppLoader
          duration={1200}
          statusText="Loading conversations and messages..."
          onComplete={() => setIsIntroLoading(false)}
        />
      )}

      <div className="flex-1 h-full flex overflow-hidden relative">
        {/* Middle Conversation Panel: matched to WhatsApp layout (~30-32% of viewport or 380px-440px) */}
        <div
          className={`w-full md:w-[360px] lg:w-[30%] lg:min-w-[380px] lg:max-w-[460px] h-full shrink-0 ${
            activeConversationId ? "hidden md:flex" : "flex"
          }`}
        >
          <ConversationList />
        </div>

        {/* Main Chat Canvas: Fluid flex-1 */}
        <div
          className={`flex-1 h-full min-w-0 flex relative ${
            !activeConversationId ? "hidden md:flex" : "flex"
          }`}
        >
          <ChatWindow
            onHeaderClick={() => setIsDrawerOpen((prev) => !prev)}
            onOpenMenu={() => setIsDrawerOpen((prev) => !prev)}
          />

          {activeConversation && (
            <ContactDetailDrawer
              isOpen={isDrawerOpen}
              onClose={() => setIsDrawerOpen(false)}
              conversation={activeConversation}
              currentUserId={currentUserId}
              onTogglePin={handleTogglePin}
              onToggleMute={handleToggleMute}
            />
          )}
        </div>
      </div>
    </>
  );
};
