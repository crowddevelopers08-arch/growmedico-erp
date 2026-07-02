import { prisma } from "./prisma"

interface NotificationData {
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

export async function pushNotification(userId: string, data: NotificationData) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { notifications: true } })
  if (!user) return
  const existing = (user.notifications as any[]) ?? []
  const notif = {
    id: `notif_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    ...data,
    read: false,
    createdAt: new Date().toISOString(),
  }
  await prisma.user.update({
    where: { id: userId },
    data: { notifications: [notif, ...existing].slice(0, 50) },
  })
}
