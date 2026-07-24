// Attendance status helpers.
//
// A "late" check-in still means the person is at work — it is a sub-category of
// present, not a separate absence. Several counters used to exclude it, which
// made late arrivals vanish from "Present Today" (or worse, count as absent).
// Route every present/at-work count through these helpers to stay consistent.

/** Statuses that mean the person showed up (present, late, or working remotely). */
export const AT_WORK_STATUSES = ["present", "late", "remote"] as const

/** Statuses that count as physically/actively present (present or late). */
export const PRESENT_STATUSES = ["present", "late"] as const

export function isAtWork(status?: string | null): boolean {
  return status != null && (AT_WORK_STATUSES as readonly string[]).includes(status)
}

export function isPresent(status?: string | null): boolean {
  return status != null && (PRESENT_STATUSES as readonly string[]).includes(status)
}
