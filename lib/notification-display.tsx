import {
  AtSign,
  ClipboardList,
  Handshake,
  MessageCircle,
  CalendarPlus,
  CalendarCheck,
  CalendarX,
  Clock,
  AlarmClock,
  Wallet,
  FolderKanban,
  Bell,
  type LucideIcon,
} from "lucide-react"

interface TypeMeta {
  icon: LucideIcon
  /** Tailwind text color class for the icon. */
  color: string
}

const META: Record<string, TypeMeta> = {
  mention: { icon: AtSign, color: "text-violet-500" },
  message: { icon: MessageCircle, color: "text-sky-500" },
  task_assigned: { icon: ClipboardList, color: "text-blue-500" },
  task_collaborator: { icon: Handshake, color: "text-blue-500" },
  leave_request: { icon: CalendarPlus, color: "text-amber-500" },
  leave_approved: { icon: CalendarCheck, color: "text-emerald-500" },
  leave_rejected: { icon: CalendarX, color: "text-rose-500" },
  attendance: { icon: Clock, color: "text-teal-500" },
  attendance_late: { icon: AlarmClock, color: "text-amber-500" },
  salary_paid: { icon: Wallet, color: "text-emerald-500" },
  project_member: { icon: FolderKanban, color: "text-indigo-500" },
}

export function notificationMeta(type: string): TypeMeta {
  return META[type] ?? { icon: Bell, color: "text-muted-foreground" }
}

/** Compact "2m", "3h", "5d" style relative time. */
export function relativeTime(iso: string): string {
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return ""
  const diff = Date.now() - then
  const sec = Math.round(diff / 1000)
  if (sec < 60) return "now"
  const min = Math.round(sec / 60)
  if (min < 60) return `${min}m`
  const hr = Math.round(min / 60)
  if (hr < 24) return `${hr}h`
  const day = Math.round(hr / 24)
  if (day < 7) return `${day}d`
  const wk = Math.round(day / 7)
  if (wk < 5) return `${wk}w`
  return new Date(iso).toLocaleDateString()
}
