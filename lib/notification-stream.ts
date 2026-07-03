// In-process pub/sub used to push notifications to connected SSE clients.
// Next.js dev reloads modules on HMR, so we stash the registry on globalThis to
// survive reloads and keep a single source of truth across route handlers.

type Subscriber = (payload: string) => void

const globalForStream = globalThis as unknown as {
  __notifSubscribers?: Map<string, Set<Subscriber>>
}

const subscribers = globalForStream.__notifSubscribers ?? new Map<string, Set<Subscriber>>()
globalForStream.__notifSubscribers = subscribers

/** Register a listener for a user's notifications. Returns an unsubscribe fn. */
export function subscribe(userId: string, fn: Subscriber) {
  let set = subscribers.get(userId)
  if (!set) {
    set = new Set()
    subscribers.set(userId, set)
  }
  set.add(fn)

  return () => {
    const current = subscribers.get(userId)
    if (!current) return
    current.delete(fn)
    if (current.size === 0) subscribers.delete(userId)
  }
}

/** Push a payload (already a plain object) to every live connection for a user. */
export function emitToUser(userId: string, payload: unknown) {
  const set = subscribers.get(userId)
  if (!set || set.size === 0) return
  const serialized = JSON.stringify(payload)
  for (const fn of set) {
    try {
      fn(serialized)
    } catch {
      // A broken connection shouldn't take down the others.
    }
  }
}
