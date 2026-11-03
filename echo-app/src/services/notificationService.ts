export interface NotificationPayload {
  messageId: string;
  conversationId: string;
  senderId: string;
  senderName: string;
  senderAvatar?: string;
  content: string;
}

class NotificationService {
  private audio: HTMLAudioElement | null = null;
  private isAudioUnlocked = false;
  private swRegistration: ServiceWorkerRegistration | null = null;

  constructor() {
    if (typeof window !== "undefined") {
      this.audio = new Audio("/sounds/notification.mp3");
      this.audio.volume = 0.5;

      // Register service worker for persistent background desktop notifications
      if ("serviceWorker" in navigator) {
        navigator.serviceWorker
          .register("/sw.js")
          .then((reg) => {
            this.swRegistration = reg;
          })
          .catch((err) => {
            console.debug("[notificationService] SW registration failed:", err);
          });

        // Listen for navigation messages from Service Worker notification clicks
        navigator.serviceWorker.addEventListener("message", (event) => {
          if (event.data?.type === "NAVIGATE_CONVERSATION" && event.data?.conversationId) {
            window.dispatchEvent(
              new CustomEvent("echo:navigate-conversation", {
                detail: { conversationId: event.data.conversationId },
              })
            );
          }
        });
      }

      // Unlock browser audio context on initial user interaction
      const unlockAudio = () => {
        if (!this.audio || this.isAudioUnlocked) return;
        this.audio
          .play()
          .then(() => {
            this.audio?.pause();
            if (this.audio) this.audio.currentTime = 0;
            this.isAudioUnlocked = true;
            window.removeEventListener("click", unlockAudio);
            window.removeEventListener("keydown", unlockAudio);
          })
          .catch(() => {
            // Keep listeners if blocked
          });
      };

      window.addEventListener("click", unlockAudio, { once: true });
      window.addEventListener("keydown", unlockAudio, { once: true });
    }
  }

  /**
   * Request browser notification permission
   */
  public async requestDesktopPermission(): Promise<boolean> {
    if (!("Notification" in window)) {
      console.warn("Notifications are not supported in this browser.");
      return false;
    }

    if (Notification.permission === "granted") return true;

    if (Notification.permission !== "denied") {
      const status = await Notification.requestPermission();
      return status === "granted";
    }

    return false;
  }

  /**
   * Play the subtle notification chime
   */
  public playChime(): void {
    if (!this.audio) return;
    try {
      this.audio.currentTime = 0;
      this.audio.play().catch((err) => {
        // Autoplay policy safety
        console.debug("Audio play blocked by browser policy:", err.message);
      });
    } catch (error) {
      console.debug("Error playing notification audio:", error);
    }
  }

  /**
   * Trigger native OS desktop notification banner
   */
  public async showDesktopNotification(
    payload: NotificationPayload,
    onNavigate: (convId: string) => void
  ): Promise<void> {
    if (!("Notification" in window)) {
      console.warn("[notificationService] Notification API not supported in window");
      return;
    }

    if (Notification.permission !== "granted") {
      console.warn("[notificationService] Notification permission is:", Notification.permission);
      return;
    }

    const title = `New message from ${payload.senderName}`;
    const iconUrl = payload.senderAvatar || "/echo-icon.png";
    const options: NotificationOptions = {
      body: payload.content.length > 80 ? `${payload.content.slice(0, 80)}...` : payload.content,
      icon: iconUrl,
      badge: "/echo-icon.png",
      tag: `conv-${payload.conversationId}-${payload.messageId}`, // Unique tag so consecutive messages each show a notification banner
      silent: true, // Custom playChime() avoids duplicate audio
      data: {
        conversationId: payload.conversationId,
        messageId: payload.messageId,
        url: "/chat",
      },
    };

    // Prefer ServiceWorkerRegistration.showNotification if available
    // Chromium / Chrome / Brave reliably deliver OS banners from background tabs via ServiceWorker
    if ("serviceWorker" in navigator) {
      try {
        const reg = this.swRegistration || (await navigator.serviceWorker.ready);
        if (reg && "showNotification" in reg) {
          await reg.showNotification(title, options);
          return;
        }
      } catch (swErr) {
        console.debug("[notificationService] SW showNotification fallback to new Notification:", swErr);
      }
    }

    try {
      const notification = new Notification(title, options);

      notification.onclick = () => {
        window.focus();
        onNavigate(payload.conversationId);
        notification.close();
      };
    } catch (err) {
      console.error("[notificationService] Failed to create Notification:", err);
    }
  }
}

export const notificationService = new NotificationService();
