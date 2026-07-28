"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { CheckCheck, Trash2, BellOff, Search, Filter, Loader2, Volume2, VolumeX } from "lucide-react"
import { DashboardLayout } from "@/components/dashboard-layout"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuLabel,
  DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Slider } from "@/components/ui/slider"
import { useNotifications, type AppNotification } from "@/lib/notification-context"
import { NotificationCard } from "@/components/notifications/notification-card"
import { UnreadBadge } from "@/components/notifications/unread-badge"
import { PushToggle } from "@/components/push-toggle"
import { useSoundStore } from "@/lib/sound/sound-store"
import { soundService } from "@/lib/sound/sound-service"

const PAGE_SIZE = 30

/** Human label for a stored notification type. */
function typeLabel(type: string) {
  return type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
}

function startOfDay(iso: string) {
  const d = new Date(iso)
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
}
function groupLabel(iso: string) {
  const today = startOfDay(new Date().toISOString())
  const diffDays = Math.round((today - startOfDay(iso)) / 86_400_000)
  if (diffDays <= 0) return "Today"
  if (diffDays === 1) return "Yesterday"
  if (diffDays < 7) return "Earlier this week"
  return "Older"
}

/** Compact mute + volume control wired to the sound store. */
function SoundSettings() {
  const { volume, muted, setVolume, toggleMute } = useSoundStore()
  return (
    <div className="flex items-center gap-2 rounded-lg border px-2.5 py-1.5">
      <button
        type="button"
        onClick={toggleMute}
        aria-label={muted ? "Unmute notifications" : "Mute notifications"}
        className="text-muted-foreground hover:text-foreground"
      >
        {muted ? <VolumeX className="size-4" /> : <Volume2 className="size-4" />}
      </button>
      <Slider
        value={[muted ? 0 : Math.round(volume * 100)]}
        max={100}
        step={5}
        className="w-24"
        onValueChange={([v]) => setVolume(v / 100)}
        onValueCommit={() => soundService.play("general")}
      />
    </div>
  )
}

export default function NotificationsPage() {
  const router = useRouter()
  const { unreadCount, markAllRead, markRead, dismiss, clearAll } = useNotifications()

  // The center owns its own paginated list (the context caps at 100 for the
  // bell/badge; history needs to page deeper via ?before).
  const [items, setItems] = useState<AppNotification[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [query, setQuery] = useState("")
  const [typeFilter, setTypeFilter] = useState<string>("all")

  const loadPage = useCallback(async (before?: string) => {
    const params = new URLSearchParams({ limit: String(PAGE_SIZE) })
    if (before) params.set("before", before)
    const res = await fetch(`/api/notifications?${params}`)
    if (!res.ok) return { items: [] as AppNotification[], hasMore: false }
    const data: { items: AppNotification[] } = await res.json()
    return { items: data.items, hasMore: data.items.length === PAGE_SIZE }
  }, [])

  // Initial load.
  useEffect(() => {
    let cancelled = false
    setLoading(true)
    loadPage().then((res) => {
      if (cancelled) return
      setItems(res.items)
      setHasMore(res.hasMore)
      setLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [loadPage])

  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore || items.length === 0) return
    setLoadingMore(true)
    const res = await loadPage(items[items.length - 1].createdAt)
    setItems((prev) => [...prev, ...res.items])
    setHasMore(res.hasMore)
    setLoadingMore(false)
  }, [loadingMore, hasMore, items, loadPage])

  // Infinite-scroll sentinel.
  const sentinelRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = sentinelRef.current
    if (!el) return
    const io = new IntersectionObserver((entries) => {
      if (entries[0]?.isIntersecting) void loadMore()
    }, { rootMargin: "200px" })
    io.observe(el)
    return () => io.disconnect()
  }, [loadMore])

  const availableTypes = useMemo(
    () => ["all", ...Array.from(new Set(items.map((n) => n.type))).sort()],
    [items],
  )

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return items.filter((n) => {
      if (typeFilter !== "all" && n.type !== typeFilter) return false
      if (!q) return true
      return n.title.toLowerCase().includes(q) || n.message.toLowerCase().includes(q)
    })
  }, [items, query, typeFilter])

  const groups = useMemo(() => {
    const order = ["Today", "Yesterday", "Earlier this week", "Older"]
    const map = new Map<string, AppNotification[]>()
    for (const n of filtered) {
      const label = groupLabel(n.createdAt)
      if (!map.has(label)) map.set(label, [])
      map.get(label)!.push(n)
    }
    return order.filter((l) => map.has(l)).map((l) => ({ label: l, items: map.get(l)! }))
  }, [filtered])

  const handleOpen = (n: AppNotification) => {
    if (!n.read) {
      markRead(n.id)
      setItems((prev) => prev.map((x) => (x.id === n.id ? { ...x, read: true } : x)))
    }
    if (n.link) router.push(n.link)
  }

  const handleDismiss = (id: string) => {
    dismiss(id)
    setItems((prev) => prev.filter((n) => n.id !== id))
  }

  const handleMarkAll = () => {
    markAllRead()
    setItems((prev) => prev.map((n) => ({ ...n, read: true })))
  }

  const handleClearAll = () => {
    clearAll()
    setItems([])
    setHasMore(false)
  }

  return (
    <DashboardLayout>
      <div className="flex flex-col gap-4">
        {/* Header */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <h1 className="text-3xl font-bold tracking-tight text-foreground">Notifications</h1>
            <UnreadBadge count={unreadCount} className="h-5 min-w-5 text-xs" />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <SoundSettings />
            <PushToggle />
            <Button variant="outline" size="sm" onClick={handleMarkAll} disabled={unreadCount === 0} className="gap-1.5">
              <CheckCheck className="size-4" /> Mark all read
            </Button>
            <Button variant="outline" size="sm" onClick={handleClearAll} disabled={items.length === 0} className="gap-1.5 text-muted-foreground">
              <Trash2 className="size-4" /> Clear all
            </Button>
          </div>
        </div>

        {/* Search + filter */}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search notifications…"
              className="pl-9"
            />
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-1.5">
                <Filter className="size-4" />
                {typeFilter === "all" ? "All types" : typeLabel(typeFilter)}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuLabel>Filter by type</DropdownMenuLabel>
              <DropdownMenuRadioGroup value={typeFilter} onValueChange={setTypeFilter}>
                {availableTypes.map((t) => (
                  <DropdownMenuRadioItem key={t} value={t}>
                    {t === "all" ? "All types" : typeLabel(t)}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* List */}
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-20 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Loading…
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed py-20 text-center">
            <BellOff className="size-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              {items.length === 0 ? "No notifications yet" : "Nothing matches your filters"}
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {groups.map((group) => (
              <div key={group.label} className="space-y-2">
                <div className="flex items-center gap-2">
                  <h2 className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">{group.label}</h2>
                  <Badge variant="secondary">{group.items.length}</Badge>
                </div>
                <div className="divide-y overflow-hidden rounded-xl border">
                  {group.items.map((n) => (
                    <NotificationCard key={n.id} notification={n} onOpen={handleOpen} onDismiss={handleDismiss} />
                  ))}
                </div>
              </div>
            ))}

            {/* Infinite-scroll trigger */}
            {hasMore && !query && typeFilter === "all" && (
              <div ref={sentinelRef} className="flex items-center justify-center py-4 text-sm text-muted-foreground">
                {loadingMore && <Loader2 className="size-4 animate-spin" />}
              </div>
            )}
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}
