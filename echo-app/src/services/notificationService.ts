import { NOTIFICATION_SOUND_B64 } from "./notificationSoundBase64";

export interface NotificationPayload {
  messageId: string;
  conversationId: string;
  senderId: string;
  senderName: string;
  senderAvatar?: string;
  content: string;
}

class NotificationService {
  private audioCtx: AudioContext | null = null;
  private audioBuffer: AudioBuffer | null = null;
  private fallbackAudio: HTMLAudioElement | null = null;
  private isAudioUnlocked = false;
  private swRegistration: ServiceWorkerRegistration | null = null;

  constructor() {
    if (typeof window !== "undefined") {
      this.initAudio();

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

      // Unlock browser audio context on any user interaction anywhere on page
      const unlockAudio = () => {
        if (this.isAudioUnlocked) return;
        this.unlock();
      };

      window.addEventListener("click", unlockAudio, { passive: true });
      window.addEventListener("keydown", unlockAudio, { passive: true });
      window.addEventListener("touchstart", unlockAudio, { passive: true });
      window.addEventListener("pointerdown", unlockAudio, { passive: true });
    }
  }

  private async initAudio() {
    try {
      const AudioContextClass =
        window.AudioContext || (window as any).webkitAudioContext;
      if (AudioContextClass) {
        this.audioCtx = new AudioContextClass();
      }

      // Pre-fetch and decode the base64 audio data into an AudioBuffer
      const res = await fetch(NOTIFICATION_SOUND_B64);
      const arrayBuf = await res.arrayBuffer();
      if (this.audioCtx) {
        this.audioBuffer = await this.audioCtx.decodeAudioData(arrayBuf);
      }
    } catch (e) {
      console.debug("[notificationService] Web Audio init fallback to HTMLAudio:", e);
    }

    try {
      this.fallbackAudio = new Audio(NOTIFICATION_SOUND_B64);
      this.fallbackAudio.volume = 0.8;
      this.fallbackAudio.load();
    } catch (e) {
      console.debug("[notificationService] Fallback audio init error:", e);
    }
  }

  private async unlock() {
    this.isAudioUnlocked = true;
    if (this.audioCtx && this.audioCtx.state === "suspended") {
      try {
        await this.audioCtx.resume();
      } catch (err) {
        console.debug("[notificationService] Resume audio context error:", err);
      }
    }
    if (this.fallbackAudio) {
      try {
        this.fallbackAudio.volume = 0.01;
        await this.fallbackAudio.play();
        this.fallbackAudio.pause();
        this.fallbackAudio.currentTime = 0;
        this.fallbackAudio.volume = 0.8;
      } catch {
        // Ignored
      }
    }
  }

  /**
   * Request browser notification permission
   */
  public async requestDesktopPermission(): Promise<boolean> {
    this.unlock();

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
    // 1. Try Web Audio API (most reliable in background tabs, unaffected by media element policies)
    if (this.audioCtx && this.audioBuffer) {
      try {
        if (this.audioCtx.state === "suspended") {
          this.audioCtx.resume().catch(() => {});
        }
        const source = this.audioCtx.createBufferSource();
        source.buffer = this.audioBuffer;
        const gainNode = this.audioCtx.createGain();
        gainNode.gain.value = 0.8;
        source.connect(gainNode);
        gainNode.connect(this.audioCtx.destination);
        source.start(0);
        return;
      } catch (err) {
        console.debug("[notificationService] Web Audio play failed:", err);
      }
    }

    // 2. Fallback to HTML Audio
    if (this.fallbackAudio) {
      try {
        this.fallbackAudio.currentTime = 0;
        this.fallbackAudio.play().catch((err) => {
          console.debug("[notificationService] HTML Audio play blocked:", err.message);
        });
      } catch (error) {
        console.debug("[notificationService] HTML Audio error:", error);
      }
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
