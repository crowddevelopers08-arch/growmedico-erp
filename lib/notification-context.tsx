"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react"
import { useSession } from "next-auth/react"
import { toast } from "sonner"
import {
  type PushState,
  isPushSupported,
  currentPermission,
  registerServiceWorker,
  subscribeToPush,
  requestAndSubscribe,
  unsubscribeFromPush,
} from "./push-client"

export interface AppNotification {
  id: string
  userId: string
  type: string
  title: string
  message: string
  link: string | null
  read: boolean
  createdAt: string
}

interface NotificationContextValue {
  notifications: AppNotification[]
  unreadCount: number
  connected: boolean
  pushState: PushState
  enablePush: () => Promise<void>
  disablePush: () => Promise<void>
  markAllRead: () => Promise<void>
  markRead: (id: string) => Promise<void>
  dismiss: (id: string) => Promise<void>
  clearAll: () => Promise<void>
  refresh: () => Promise<void>
}

const NotificationContext = createContext<NotificationContextValue | null>(null)

export function useNotifications() {
  const ctx = useContext(NotificationContext)
  if (!ctx) throw new Error("useNotifications must be used within NotificationProvider")
  return ctx
}

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const { status } = useSession()
  const [notifications, setNotifications] = useState<AppNotification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [connected, setConnected] = useState(false)
  const [pushState, setPushState] = useState<PushState>("default")

  // Track ids we've already seen so a re-fetch or reconnect never double-toasts.
  const seenIds = useRef<Set<string>>(new Set())

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications")
      if (!res.ok) return
      const data: { items: AppNotification[]; unreadCount: number } = await res.json()
      data.items.forEach((n) => seenIds.current.add(n.id))
      setNotifications(data.items)
      setUnreadCount(data.unreadCount)
    } catch {
      // offline / transient — leave current state as-is
    }
  }, [])

  // Initial load, refetch on focus, plus a slow poll. The poll is the fallback
  // for serverless hosts (e.g. Vercel) where cross-invocation SSE can't reach an
  // open stream — it keeps the bell/badge current even when SSE never pushes.
  useEffect(() => {
    if (status !== "authenticated") {
      setNotifications([])
      setUnreadCount(0)
      seenIds.current.clear()
      return
    }
    refresh()
    const onFocus = () => refresh()
    window.addEventListener("focus", onFocus)
    const pollId = setInterval(refresh, 30000)
    return () => {
      window.removeEventListener("focus", onFocus)
      clearInterval(pollId)
    }
  }, [status, refresh])

  // Live stream.
  useEffect(() => {
    if (status !== "authenticated") return

    const source = new EventSource("/api/notifications/stream")

    source.onopen = () => setConnected(true)
    source.onerror = () => setConnected(false)

    source.onmessage = (event) => {
      let parsed: { kind: string; data?: AppNotification }
      try {
        parsed = JSON.parse(event.data)
      } catch {
        return
      }
      if (parsed.kind !== "notification" || !parsed.data) return

      const notif = parsed.data
      if (seenIds.current.has(notif.id)) return
      seenIds.current.add(notif.id)

      setNotifications((prev) => [notif, ...prev].slice(0, 100))
      setUnreadCount((c) => c + 1)

      // WhatsApp-style pop.
      toast(notif.title, {
        description: notif.message,
        action: notif.link
          ? { label: "View", onClick: () => { window.location.href = notif.link! } }
          : undefined,
      })
    }

    return () => source.close()
  }, [status])

  // Web Push: register the service worker once authenticated, reflect current
  // permission, and silently re-subscribe if the user already granted it (keeps
  // the server's subscription fresh across logins / new devices).
  useEffect(() => {
    if (status !== "authenticated") return
    if (!isPushSupported()) {
      setPushState("unsupported")
      return
    }
    setPushState(currentPermission())
    registerServiceWorker().then((reg) => {
      if (reg && Notification.permission === "granted") {
        void subscribeToPush()
      }
    })
  }, [status])

  const enablePush = useCallback(async () => {
    const result = await requestAndSubscribe()
    setPushState(result)
  }, [])

  const disablePush = useCallback(async () => {
    await unsubscribeFromPush()
    setPushState(isPushSupported() ? "default" : "unsupported")
  }, [])

  const markAllRead = useCallback(async () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
    setUnreadCount(0)
    await fetch("/api/notifications", { method: "PATCH" }).catch(() => {})
  }, [])

  const markRead = useCallback(async (id: string) => {
    let wasUnread = false
    setNotifications((prev) =>
      prev.map((n) => {
        if (n.id === id && !n.read) wasUnread = true
        return n.id === id ? { ...n, read: true } : n
      }),
    )
    if (wasUnread) setUnreadCount((c) => Math.max(0, c - 1))
    await fetch(`/api/notifications/${id}`, { method: "PATCH" }).catch(() => {})
  }, [])

  const dismiss = useCallback(async (id: string) => {
    setNotifications((prev) => {
      const target = prev.find((n) => n.id === id)
      if (target && !target.read) setUnreadCount((c) => Math.max(0, c - 1))
      return prev.filter((n) => n.id !== id)
    })
    await fetch(`/api/notifications/${id}`, { method: "DELETE" }).catch(() => {})
  }, [])

  const clearAll = useCallback(async () => {
    setNotifications([])
    setUnreadCount(0)
    await fetch("/api/notifications", { method: "DELETE" }).catch(() => {})
  }, [])

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        connected,
        pushState,
        enablePush,
        disablePush,
        markAllRead,
        markRead,
        dismiss,
        clearAll,
        refresh,
      }}
    >
      {children}
    </NotificationContext.Provider>
  )
}
