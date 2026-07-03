// Service worker for Grow Medico web push notifications.

// Activate immediately so a freshly-registered worker can receive pushes.
self.addEventListener("install", () => self.skipWaiting())
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()))

// A push arrived from the server — show an OS-level notification.
self.addEventListener("push", (event) => {
  let payload = {}
  try {
    payload = event.data ? event.data.json() : {}
  } catch (e) {
    payload = { title: "Grow Medico", body: event.data ? event.data.text() : "" }
  }

  const title = payload.title || "Grow Medico"
  const options = {
    body: payload.body || "",
    icon: "/gm-fav-icon.png",
    badge: "/gm-fav-icon.png",
    tag: payload.tag || undefined,
    data: { url: payload.url || "/notifications" },
    // Re-alert even if a notification with the same tag exists.
    renotify: Boolean(payload.tag),
  }

  event.waitUntil(self.registration.showNotification(title, options))
})

// User clicked the notification — focus an existing tab or open a new one,
// navigating to the notification's deep link.
self.addEventListener("notificationclick", (event) => {
  event.notification.close()
  const targetUrl = (event.notification.data && event.notification.data.url) || "/notifications"

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        // If any app tab is already open, focus it and route there.
        if ("focus" in client) {
          client.focus()
          if ("navigate" in client) client.navigate(targetUrl).catch(() => {})
          return
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(targetUrl)
    }),
  )
})
