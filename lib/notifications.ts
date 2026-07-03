import { prisma } from "./prisma"
import { emitToUser } from "./notification-stream"
import { sendPushToUser } from "./web-push"

export interface NotificationData {
  type: string
  title: string
  message: string
  link?: string
}

export async function getUserIdsForEmployees(employeeIds: string[]) {
  const uniqueIds = Array.from(new Set(employeeIds.filter(Boolean)))
  if (!uniqueIds.length) return new Map<string, string>()

  const users = await prisma.user.findMany({
    where: { employeeId: { in: uniqueIds } },
    select: { id: true, employeeId: true },
  })

  const map = new Map<string, string>()
  users.forEach((user) => {
    if (user.employeeId) map.set(user.employeeId, user.id)
  })
  return map
}

/** All ADMIN user ids — used to fan requests/approvals out to management. */
export async function getAdminUserIds() {
  const admins = await prisma.user.findMany({
    where: { role: "ADMIN" },
    select: { id: true },
  })
  return admins.map((a) => a.id)
}

/** The user id backing a single employee, if that employee has a login. */
export async function getUserIdForEmployee(employeeId: string) {
  if (!employeeId) return null
  const user = await prisma.user.findFirst({
    where: { employeeId },
    select: { id: true },
  })
  return user?.id ?? null
}

/**
 * Persist a notification and push it to any live SSE connection for the user.
 * Safe to call from any service route — failures never throw.
 */
export async function notify(userId: string, data: NotificationData) {
  if (!userId) return null
  try {
    const notif = await prisma.notification.create({
      data: {
        userId,
        type: data.type,
        title: data.title,
        message: data.message,
        link: data.link ?? null,
      },
    })

    // Live in-app push (SSE) for any open tabs...
    emitToUser(userId, notif)

    // ...and OS-level browser push for closed tabs / other apps. Best-effort:
    // don't let a push failure roll back the persisted notification.
    void sendPushToUser(userId, {
      title: data.title,
      body: data.message,
      url: data.link ?? "/notifications",
      tag: notif.id,
    })

    return notif
  } catch (err) {
    console.error("[notify] failed to create notification", err)
    return null
  }
}

/** Deliver the same notification to many users (deduped, skips falsy ids). */
export async function notifyMany(userIds: Array<string | null | undefined>, data: NotificationData) {
  const unique = Array.from(new Set(userIds.filter((id): id is string => Boolean(id))))
  await Promise.all(unique.map((id) => notify(id, data)))
}

// Backwards-compatible alias for existing call sites.
export const pushNotification = notify
