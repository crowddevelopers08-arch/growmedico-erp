import { prisma } from "./prisma"

interface NotificationData {
  type: string
  title: string
  message: string
  link?: string
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
