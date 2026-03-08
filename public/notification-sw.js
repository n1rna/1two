// Service worker for push notification testing
self.addEventListener("push", (event) => {
  let data = { title: "Push Notification", body: "No payload" };

  if (event.data) {
    try {
      data = event.data.json();
    } catch {
      data = { title: "Push Notification", body: event.data.text() };
    }
  }

  const options = {
    body: data.body || "",
    icon: data.icon || undefined,
    badge: data.badge || undefined,
    image: data.image || undefined,
    tag: data.tag || undefined,
    data: data,
    timestamp: Date.now(),
  };

  event.waitUntil(
    self.registration.showNotification(data.title || "Notification", options)
  );

  // Post message to all clients so the UI can log it
  event.waitUntil(
    self.clients.matchAll({ type: "window" }).then((clients) => {
      for (const client of clients) {
        client.postMessage({
          type: "push-received",
          payload: data,
          timestamp: Date.now(),
        });
      }
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  // Focus or open the app
  event.waitUntil(
    self.clients.matchAll({ type: "window" }).then((clients) => {
      for (const client of clients) {
        if ("focus" in client) return client.focus();
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow("/tools/notifications");
      }
    })
  );
});
