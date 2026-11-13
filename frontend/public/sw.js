// Chimuverse service worker: only Web Push. It does not cache pages or data.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  let message = { title: "Chimuverse", body: "Tienes algo nuevo en nuestro universo.", path: "/", tag: "chimuverse" };
  try {
    message = { ...message, ...event.data.json() };
  } catch {
    // Keep the generic text if the payload is missing or unreadable.
  }
  event.waitUntil(
    self.registration.showNotification(message.title, {
      body: message.body,
      tag: message.tag,
      // Replacing a notification with the same tag must still alert, not update silently.
      renotify: true,
      icon: "/icons/icon-192.png",
      badge: "/icons/badge-96.png",
      lang: "es",
      data: { path: message.path },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const path = event.notification.data?.path || "/";
  const target = new URL(path.startsWith("/") ? path : "/", self.location.origin).href;
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      const open = windows.find((w) => new URL(w.url).origin === self.location.origin);
      if (open) {
        await open.focus();
        return open.navigate(target).catch(() => open.postMessage({ type: "navigate", path }));
      }
      return self.clients.openWindow(target);
    })(),
  );
});
