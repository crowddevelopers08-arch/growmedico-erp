// Short-leave ("permission") policy.
//
// Employees get a number of free permissions each calendar month. Once the
// running monthly count reaches a multiple of 5 the permission costs a half
// day; every multiple of 10 costs a full day instead.

export type PermissionPenalty = "none" | "half_day" | "full_day"

/** Free permissions per employee per calendar month before deductions start. */
export const FREE_PERMISSIONS_PER_MONTH = 4

/** Maximum hours a single permission may cover. */
export const MAX_PERMISSION_HOURS = 8

/**
 * Penalty incurred by the `count`-th permission of the month.
 * Multiples of 10 take precedence over multiples of 5 (the 10th, 20th … are
 * full days, not half days).
 */
export function permissionPenalty(count: number): PermissionPenalty {
  if (count <= 0) return "none"
  if (count % 10 === 0) return "full_day"
  if (count % 5 === 0) return "half_day"
  return "none"
}

export function penaltyLabel(penalty: PermissionPenalty | string | null | undefined): string | null {
  switch (penalty) {
    case "half_day":
      return "Half Day"
    case "full_day":
      return "Full Day Absent"
    default:
      return null
  }
}

/** Human-readable warning shown before submitting the nth permission. */
export function permissionNotice(count: number): string {
  const penalty = permissionPenalty(count)
  if (penalty === "full_day") {
    return `This is permission #${count} this month — it will be marked as a full day absent.`
  }
  if (penalty === "half_day") {
    return `This is permission #${count} this month — it will be marked as a half-day leave.`
  }
  const remaining = FREE_PERMISSIONS_PER_MONTH - count
  if (remaining > 0) {
    return `Permission #${count} this month — ${remaining} free permission${remaining > 1 ? "s" : ""} remaining.`
  }
  return `Permission #${count} this month.`
}

/** "YYYY-MM" bucket a permission belongs to, derived from its date. */
export function permissionMonth(date: string): string {
  return date.slice(0, 7)
}
