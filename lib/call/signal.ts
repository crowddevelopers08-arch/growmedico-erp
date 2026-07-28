// In-process signaling bus for calls, plus online presence. Same shape as
// lib/notification-stream.ts (a globalThis registry that survives HMR), but kept
// separate so call traffic and notification traffic don't share a channel.
//
// This is single-process: it works for one Next server (dev, or a single node).
// To scale horizontally, swap the Map for a Redis pub/sub with the same API —
// nothing outside this file needs to change.

import type { CallSignal } from "./types"

type Subscriber = (payload: string) => void

const g = globalThis as unknown as {
  __callSubscribers?: Map<string, Set<Subscriber>>
  __presenceListeners?: Set<(userId: string, online: boolean) => void>
}

const subscribers = g.__callSubscribers ?? new Map<string, Set<Subscriber>>()
g.__callSubscribers = subscribers

const presenceListeners = g.__presenceListeners ?? new Set<(userId: string, online: boolean) => void>()
g.__presenceListeners = presenceListeners

/** Register a user's live SSE connection. Returns an unsubscribe fn. */
export function subscribeCall(userId: string, fn: Subscriber): () => void {
  let set = subscribers.get(userId)
  const wasOffline = !set || set.size === 0
  if (!set) {
    set = new Set()
    subscribers.set(userId, set)
  }
  set.add(fn)
  if (wasOffline) notifyPresence(userId, true)

  return () => {
    const current = subscribers.get(userId)
    if (!current) return
    current.delete(fn)
    if (current.size === 0) {
      subscribers.delete(userId)
      notifyPresence(userId, false)
    }
  }
}

/** Push a signal to every live connection a user has open. */
export function emitCall(userId: string, signal: CallSignal): void {
  const set = subscribers.get(userId)
  if (!set || set.size === 0) return
  const serialized = JSON.stringify(signal)
  for (const fn of set) {
    try {
      fn(serialized)
    } catch {
      // A dead connection must not break the others.
    }
  }
}

/** True while the user has at least one open signaling connection. */
export function isUserOnline(userId: string): boolean {
  const set = subscribers.get(userId)
  return !!set && set.size > 0
}

/** Snapshot of everyone currently connected. */
export function onlineUserIds(): string[] {
  return [...subscribers.keys()]
}

/** Subscribe to presence flips (used to fan out user:online/offline). */
export function onPresenceChange(fn: (userId: string, online: boolean) => void): () => void {
  presenceListeners.add(fn)
  return () => presenceListeners.delete(fn)
}

function notifyPresence(userId: string, online: boolean) {
  for (const fn of presenceListeners) {
    try {
      fn(userId, online)
    } catch {
      // ignore
    }
  }
}

// Fan a presence flip out to everyone else who's connected, so open call
// directories update live. Registered once (guarded against HMR re-runs).
const gInit = globalThis as unknown as { __callPresenceWired?: boolean }
if (!gInit.__callPresenceWired) {
  gInit.__callPresenceWired = true
  onPresenceChange((userId, online) => {
    const signal: CallSignal = {
      event: online ? "user:online" : "user:offline",
      userId,
      ts: Date.now(),
    }
    const serialized = JSON.stringify(signal)
    for (const [otherId, set] of subscribers) {
      if (otherId === userId) continue
      for (const fn of set) {
        try {
          fn(serialized)
        } catch {
          // ignore
        }
      }
    }
  })
}
