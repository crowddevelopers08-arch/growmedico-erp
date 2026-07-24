// Single source of truth for the live "where is this person today?" status the
// employees list, team directory and dashboard cards all render.
//
// The rules used to be duplicated per route and they disagreed with each other:
// /api/employees let any approved leave override a real check-in, while the
// dashboard counted check-ins only. The same day therefore read as "2 present"
// on the dashboard and "0 present, 2 on leave" on the employees page.

import type { EmployeeStatus } from "./types"

/**
 * Leave types that only take part of the day off. A "Permission" is a couple of
 * hours, so the person is still expected at work and must not be shown as away
 * for the whole day.
 */
const PARTIAL_DAY_LEAVE_TYPES = new Set(["Permission"])

/** Does an approved leave of this type keep the person away all day? */
export function isFullDayLeave(type: string): boolean {
  return !PARTIAL_DAY_LEAVE_TYPES.has(type)
}

/**
 * Resolve today's status from the attendance record (if any) plus whether an
 * approved full-day leave covers today.
 *
 * A real check-in wins over leave: someone who punched in is at work, whatever
 * their leave record says.
 */
export function resolveLiveStatus(
  attendanceStatus: string | null | undefined,
  onFullDayLeave: boolean
): EmployeeStatus {
  if (attendanceStatus === "remote") return "remote"
  if (attendanceStatus === "present" || attendanceStatus === "late") return "present"
  if (onFullDayLeave || attendanceStatus === "onLeave") return "onLeave"
  // No attendance record yet today (or an explicit "absent") means absent.
  return "absent"
}
