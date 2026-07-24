// Working-hours countdown engine.
//
// Office hours are 10:00–19:00 IST (9h/day), Monday–Saturday. Sundays are
// non-working and excluded. A task assigned for N "working hours" consumes only
// time that falls inside those windows; nights and Sundays don't count.
//
// India has no DST, so IST is a constant UTC+5:30. That lets us shift an instant
// into "IST clock space" (epoch + offset), read/compose wall-clock parts with
// getUTC*/Date.UTC, and shift back — exact all year, no timezone library.

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000
const OFFICE_START_HOUR = 10 // 10:00 AM
const OFFICE_END_HOUR = 19 // 7:00 PM
const OFFICE_MS_PER_DAY = (OFFICE_END_HOUR - OFFICE_START_HOUR) * 60 * 60 * 1000
const DAY_MS = 24 * 60 * 60 * 1000

/** Office window [start, end] in IST-clock-space epoch ms for the day `ist` lands in. */
function officeWindow(ist: number): { start: number; end: number; sunday: boolean } {
  const d = new Date(ist)
  const dayStart = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())
  return {
    start: dayStart + OFFICE_START_HOUR * 60 * 60 * 1000,
    end: dayStart + OFFICE_END_HOUR * 60 * 60 * 1000,
    sunday: d.getUTCDay() === 0,
  }
}

/**
 * Working milliseconds between two instants, counting only office windows on
 * non-Sundays. Returns 0 if end <= start.
 */
export function workingMsBetween(startEpoch: number, endEpoch: number): number {
  if (endEpoch <= startEpoch) return 0
  // Move into IST clock space.
  let cursor = startEpoch + IST_OFFSET_MS
  const end = endEpoch + IST_OFFSET_MS

  let total = 0
  // Walk day by day. Guard against pathological inputs with a generous cap.
  for (let i = 0; i < 4000 && cursor < end; i++) {
    const win = officeWindow(cursor)
    if (!win.sunday) {
      const from = Math.max(cursor, win.start)
      const to = Math.min(end, win.end)
      if (to > from) total += to - from
    }
    // Jump to the start of the next calendar day.
    const d = new Date(cursor)
    cursor = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) + DAY_MS
  }
  return total
}

/**
 * Deadline instant for a task assigned at `startEpoch` for `hours` working
 * hours. Walks forward filling office windows (skipping Sundays) until the
 * allocation is exhausted.
 */
export function addWorkingHours(startEpoch: number, hours: number): number {
  let remaining = Math.max(0, hours) * 60 * 60 * 1000
  let cursor = startEpoch + IST_OFFSET_MS

  for (let i = 0; i < 4000; i++) {
    const win = officeWindow(cursor)
    const from = Math.max(cursor, win.start)
    if (!win.sunday && from < win.end) {
      const avail = win.end - from
      if (avail >= remaining) {
        // Deadline lands inside this window; convert back to real epoch.
        return from + remaining - IST_OFFSET_MS
      }
      remaining -= avail
    }
    const d = new Date(cursor)
    cursor = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) + DAY_MS
  }
  // Fallback (should not hit for sane inputs).
  return cursor - IST_OFFSET_MS
}

export type UrgencyLevel = "green" | "orange" | "red" | "overdue"

export interface WorkingTimeStatus {
  /** Working ms still available (0 when overdue). */
  remainingMs: number
  /** True once the allocation is spent. */
  overdue: boolean
  /** Deadline instant (epoch ms). */
  deadlineEpoch: number
  level: UrgencyLevel
}

/**
 * Remaining working time and urgency for a task, given when it was assigned,
 * its allocation in hours, and "now". Countdown naturally freezes outside
 * office hours because elapsed working time only grows during office windows.
 */
export function workingTimeStatus(
  assignedEpoch: number,
  hours: number,
  nowEpoch: number,
): WorkingTimeStatus {
  const totalMs = Math.max(0, hours) * 60 * 60 * 1000
  const elapsed = workingMsBetween(assignedEpoch, nowEpoch)
  const remainingMs = Math.max(0, totalMs - elapsed)
  const deadlineEpoch = addWorkingHours(assignedEpoch, hours)
  const overdue = remainingMs <= 0

  let level: UrgencyLevel
  const fraction = totalMs > 0 ? remainingMs / totalMs : 0
  if (overdue) level = "overdue"
  else if (fraction < 0.15) level = "red"
  else if (fraction < 0.4) level = "orange"
  else level = "green"

  return { remainingMs, overdue, deadlineEpoch, level }
}

/** "2d 4h 30m" style label for a working-ms span. Days are 9 office-hours long. */
export function formatWorkingDuration(ms: number): string {
  if (ms <= 0) return "0m"
  const totalMinutes = Math.floor(ms / 60000)
  const days = Math.floor((totalMinutes * 60000) / OFFICE_MS_PER_DAY)
  const afterDays = ms - days * OFFICE_MS_PER_DAY
  const hours = Math.floor(afterDays / (60 * 60 * 1000))
  const minutes = Math.floor((afterDays % (60 * 60 * 1000)) / 60000)
  const parts: string[] = []
  if (days > 0) parts.push(`${days}d`)
  if (hours > 0) parts.push(`${hours}h`)
  if (minutes > 0 || parts.length === 0) parts.push(`${minutes}m`)
  return parts.join(" ")
}
