// Attendance-driven salary maths. Kept framework-free so the salary page, the
// details dialog and any future payroll export can share one source of truth.

import { isAtWork } from "@/lib/attendance"

/** The minimal attendance shape the maths needs — satisfied by both the client
 *  `Attendance` type and a Prisma `select`, so this module runs on either side. */
interface AttendanceLike {
  employeeId: string
  date: string
  status: string | null
}

/** The minimal leave shape the maths needs, from either the client type or a
 *  Prisma `select`. Dates are inclusive "YYYY-MM-DD" strings. */
interface LeaveLike {
  employeeId: string
  startDate: string
  endDate: string
  status: string
}

export const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
] as const

/** Month name ("July") → 0-based index, or -1 if it isn't a known month. */
export function monthIndex(month: string): number {
  return MONTH_NAMES.indexOf(month as (typeof MONTH_NAMES)[number])
}

/** The "YYYY-MM" prefix an attendance date carries for this period. */
export function periodPrefix(month: string, year: number): string | null {
  const index = monthIndex(month)
  if (index < 0) return null
  return `${year}-${String(index + 1).padStart(2, "0")}`
}

/**
 * Payable working days in a month = every day except Sundays. This matches the
 * office-hours convention used elsewhere (10:00–19:00 IST, Sundays excluded).
 * Built on UTC dates so it never shifts by a day across timezones.
 */
export function workingDaysInMonth(month: string, year: number): number {
  const index = monthIndex(month)
  if (index < 0) return 0
  const daysInMonth = new Date(Date.UTC(year, index + 1, 0)).getUTCDate()
  let count = 0
  for (let day = 1; day <= daysInMonth; day += 1) {
    // getUTCDay: 0 = Sunday.
    if (new Date(Date.UTC(year, index, day)).getUTCDay() !== 0) count += 1
  }
  return count
}

/**
 * How many days an employee was at work in the period. "At work" covers present,
 * late and remote — a late arrival or a remote day is still a worked day.
 */
export function presentDaysInMonth(
  attendance: AttendanceLike[],
  employeeId: string,
  month: string,
  year: number,
): number {
  const prefix = periodPrefix(month, year)
  if (!prefix) return 0
  const seen = new Set<string>()
  for (const record of attendance) {
    if (record.employeeId !== employeeId) continue
    if (!record.date.startsWith(prefix)) continue
    if (!isAtWork(record.status)) continue
    seen.add(record.date)
  }
  return seen.size
}

/**
 * Late arrivals in a period. A late day is still a worked day (it counts as
 * present), but lates accrue toward the half-day penalty below.
 */
export function lateDaysInMonth(
  attendance: AttendanceLike[],
  employeeId: string,
  month: string,
  year: number,
): number {
  const prefix = periodPrefix(month, year)
  if (!prefix) return 0
  const seen = new Set<string>()
  for (const record of attendance) {
    if (record.employeeId !== employeeId) continue
    if (!record.date.startsWith(prefix)) continue
    if (record.status !== "late") continue
    seen.add(record.date)
  }
  return seen.size
}

/** Company policy: every 5 late arrivals costs half a day's pay. */
export const LATES_PER_HALF_DAY = 5

/** How many half-days a run of lates works out to. */
export function lateHalfDays(lateCount: number): number {
  return Math.floor(lateCount / LATES_PER_HALF_DAY)
}

/** Rupee deduction from lates: half the per-day rate for each half-day earned. */
export function lateDeduction(baseSalary: number, lateCount: number, month: string, year: number): number {
  const halfDays = lateHalfDays(lateCount)
  if (halfDays <= 0) return 0
  return Math.round((perDayRate(baseSalary, month, year) / 2) * halfDays)
}

/** Per-day pay = base salary spread over the month's working days. */
export function perDayRate(baseSalary: number, month: string, year: number): number {
  const workingDays = workingDaysInMonth(month, year)
  if (workingDays <= 0) return 0
  return baseSalary / workingDays
}

/** What the employee earns for the days actually worked, rounded to the rupee. */
export function attendanceBasedPay(
  baseSalary: number,
  presentDays: number,
  month: string,
  year: number,
): number {
  return Math.round(perDayRate(baseSalary, month, year) * presentDays)
}

/**
 * The take-home figure once attendance is applied:
 *   (per-day × present days) + bonus + overtime − deductions, never below zero.
 * This is the single definition of net salary used by the API when it writes a
 * record, so the stored value always matches what the columns imply.
 */
export function netFromAttendance(args: {
  baseSalary: number
  bonus: number
  overtime: number
  deductions: number
  presentDays: number
  month: string
  year: number
}): number {
  const earned = attendanceBasedPay(args.baseSalary, args.presentDays, args.month, args.year)
  return Math.max(0, earned + args.bonus + args.overtime - args.deductions)
}

/** Every working-day date ("YYYY-MM-DD") in a month — every day but Sundays. */
export function workingDayDates(month: string, year: number): string[] {
  const index = monthIndex(month)
  if (index < 0) return []
  const daysInMonth = new Date(Date.UTC(year, index + 1, 0)).getUTCDate()
  const dates: string[] = []
  for (let day = 1; day <= daysInMonth; day += 1) {
    if (new Date(Date.UTC(year, index, day)).getUTCDay() !== 0) {
      dates.push(`${year}-${String(index + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`)
    }
  }
  return dates
}

/** Inclusive iterator over "YYYY-MM-DD" dates, capped so bad data can't loop. */
function* eachDateInclusive(start: string, end: string): Generator<string> {
  const parse = (value: string) => {
    const [y, m, d] = value.split("-").map(Number)
    if (!y || !m || !d) return null
    return Date.UTC(y, m - 1, d)
  }
  let cursor = parse(start)
  const last = parse(end)
  if (cursor === null || last === null || cursor > last) return
  let guard = 0
  while (cursor <= last && guard < 400) {
    const date = new Date(cursor)
    yield `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`
    cursor += 24 * 60 * 60 * 1000
    guard += 1
  }
}

/** Dates in the month covered by an APPROVED leave request for this employee. */
export function approvedLeaveDatesInMonth(
  leaves: LeaveLike[],
  employeeId: string,
  month: string,
  year: number,
): Set<string> {
  const prefix = periodPrefix(month, year)
  const dates = new Set<string>()
  if (!prefix) return dates
  for (const leave of leaves) {
    if (leave.employeeId !== employeeId) continue
    if (leave.status !== "approved") continue
    for (const date of eachDateInclusive(leave.startDate, leave.endDate)) {
      if (date.startsWith(prefix)) dates.add(date)
    }
  }
  return dates
}

export interface SalaryBreakdown {
  workingDays: number
  presentDays: number
  lateDays: number
  approvedLeaveDays: number
  unapprovedAbsenceDays: number
  perDay: number
  lateDeduction: number
  absenceDeduction: number
  deductions: number
  net: number
}

/**
 * The full attendance-driven breakdown for one employee in one period, and the
 * single source of truth for net salary. The model:
 *   - Worked days (present/late/remote) are paid.
 *   - Approved-leave days are paid (paid leave).
 *   - Every other working day is an UNAPPROVED absence and is deducted at the
 *     per-day rate.
 *   - Lates add a separate penalty (every 5 lates = half a day).
 * Net = base + bonus + overtime − (late + absence) deductions, never below zero.
 * With no approved leave this equals the old "per-day × present days" figure.
 */
export function salaryBreakdown(args: {
  baseSalary: number
  bonus: number
  overtime: number
  attendance: AttendanceLike[]
  leaves: LeaveLike[]
  employeeId: string
  month: string
  year: number
}): SalaryBreakdown {
  const { baseSalary, bonus, overtime, attendance, leaves, employeeId, month, year } = args
  const prefix = periodPrefix(month, year) ?? ""

  const workingSet = new Set(workingDayDates(month, year))
  const workingDays = workingSet.size
  const perDay = workingDays > 0 ? baseSalary / workingDays : 0

  // Dates the employee was at work, restricted to working days.
  const presentSet = new Set<string>()
  for (const record of attendance) {
    if (record.employeeId !== employeeId) continue
    if (!record.date.startsWith(prefix)) continue
    if (!isAtWork(record.status)) continue
    if (workingSet.has(record.date)) presentSet.add(record.date)
  }

  // Approved-leave working days that aren't already counted as worked.
  const approvedSet = approvedLeaveDatesInMonth(leaves, employeeId, month, year)
  let approvedLeaveDays = 0
  for (const date of approvedSet) {
    if (workingSet.has(date) && !presentSet.has(date)) approvedLeaveDays += 1
  }

  const presentDays = presentSet.size
  const lateDays = lateDaysInMonth(attendance, employeeId, month, year)
  const paidDays = presentDays + approvedLeaveDays
  const unapprovedAbsenceDays = Math.max(0, workingDays - paidDays)

  const late = lateDeduction(baseSalary, lateDays, month, year)
  const absence = Math.round(perDay * unapprovedAbsenceDays)
  const deductions = late + absence
  const net = Math.max(0, baseSalary + bonus + overtime - deductions)

  return {
    workingDays,
    presentDays,
    lateDays,
    approvedLeaveDays,
    unapprovedAbsenceDays,
    perDay,
    lateDeduction: late,
    absenceDeduction: absence,
    deductions,
    net,
  }
}
