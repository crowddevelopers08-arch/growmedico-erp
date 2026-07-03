import webpush from "web-push"
import { prisma } from "./prisma"

// Configure VAPID once per process. If keys are missing we treat push as
// disabled and every send becomes a no-op (SSE + DB still work).
const publicKey = process.env.VAPID_PUBLIC_KEY
const privateKey = process.env.VAPID_PRIVATE_KEY
const subject = process.env.VAPID_SUBJECT ?? "mailto:admin@growmedico.com"

let configured = false
if (publicKey && privateKey) {
  webpush.setVapidDetails(subject, publicKey, privateKey)
  configured = true
} else {
  console.warn("[web-push] VAPID keys missing — browser push disabled")
}

export function isPushConfigured() {
  return configured
}

export interface PushPayload {
  title: string
  body: string
  url?: string
  tag?: string
}

/**
 * Send a browser push to every device the user has registered. Subscriptions
 * that the push service reports as gone (404/410) are pruned automatically.
 * Never throws — push is best-effort on top of the persisted notification.
 */
export async function sendPushToUser(userId: string, payload: PushPayload) {
  if (!configured || !userId) return

  const subs = await prisma.pushSubscription.findMany({ where: { userId } })
  if (subs.length === 0) return

  const body = JSON.stringify(payload)

  await Promise.all(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          body,
        )
      } catch (err: unknown) {
        const statusCode = (err as { statusCode?: number })?.statusCode
        // 404 / 410 = subscription expired or unsubscribed → drop it.
        if (statusCode === 404 || statusCode === 410) {
          await prisma.pushSubscription.delete({ where: { id: sub.id } }).catch(() => {})
        } else {
          console.error("[web-push] send failed", statusCode ?? err)
        }
      }
    }),
  )
}
