// Echo Service Worker for Native Background Notifications
self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

// Listen for push notifications if configured in future
self.addEventListener("push", (event) => {
  if (!event.data) return;
  try {
    const data = event.data.json();
    event.waitUntil(
      self.registration.showNotification(data.title || "Echo", {
        body: data.body || "",
        icon: data.icon || "/echo-icon.png",
        badge: "/echo-icon.png",
        tag: data.tag || "echo-notification",
        data: data.data || {},
      })
    );
  } catch (err) {
    console.error("[SW] Push error:", err);
  }
});

// Handle clicking on OS notification banner
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || "/chat";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      // If a tab is already open, focus it
      for (const client of clientList) {
        if ("focus" in client) {
          if (event.notification.data?.conversationId) {
            client.postMessage({
              type: "NAVIGATE_CONVERSATION",
              conversationId: event.notification.data.conversationId,
            });
          }
          return client.focus();
        }
      }
      // If no tab is open, open one
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});
