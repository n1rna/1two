// Service worker for Pomodoro timer notifications
// Handles background timer countdown and notification delivery

let timerState = null; // { endTime, type, label }

self.addEventListener("message", (event) => {
  const { type, payload } = event.data;

  if (type === "start-timer") {
    timerState = {
      endTime: payload.endTime,
      type: payload.timerType,
      label: payload.label,
    };
  }

  if (type === "stop-timer") {
    timerState = null;
  }

  if (type === "check-timer") {
    // Respond with current timer state
    event.source.postMessage({ type: "timer-state", payload: timerState });
  }

  if (type === "show-notification") {
    const { title, body, tag } = payload;
    event.waitUntil(
      self.registration.showNotification(title, {
        body,
        tag: tag || "pomodoro",
        icon: undefined,
        requireInteraction: true,
        silent: false,
      })
    );
  }
});

// Check timer periodically
setInterval(() => {
  if (!timerState) return;
  const remaining = timerState.endTime - Date.now();
  if (remaining <= 0) {
    const label =
      timerState.type === "work"
        ? "Time to take a break!"
        : "Break is over — back to work!";
    self.registration.showNotification("Pomodoro Timer", {
      body: label,
      tag: "pomodoro-done",
      requireInteraction: true,
    });
    // Notify all clients
    self.clients.matchAll({ type: "window" }).then((clients) => {
      for (const client of clients) {
        client.postMessage({
          type: "timer-done",
          payload: { timerType: timerState.type },
        });
      }
    });
    timerState = null;
  }
}, 1000);

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: "window" }).then((clients) => {
      for (const client of clients) {
        if ("focus" in client) return client.focus();
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow("/tools/pomodoro");
      }
    })
  );
});
