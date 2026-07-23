// Delivery permissions for the Projects and Tasks pages.
//
// "Operations Manager" carries no special logic in this codebase — it is only a
// department label, and its power comes from the MANAGER account role. CSMs own
// client delivery too, so they are granted the same level of access here by
// department, without needing their account role changed.
//
// Kept free of React/client imports so API routes can use it too.

/** Department that marks someone as a Client Success Manager. */
export const CSM_DEPARTMENT = "CSM"

/** Department that handles people operations (leave approvals). */
export const HR_DEPARTMENT = "HR"

/** Department that runs day-to-day operations. */
export const OPERATIONS_MANAGER_DEPARTMENT = "Operations Manager"

/** Departments allowed to decide on leave requests, alongside ADMIN accounts. */
const LEAVE_APPROVER_DEPARTMENTS = [HR_DEPARTMENT, OPERATIONS_MANAGER_DEPARTMENT]

type PermissionUser =
  | {
      role?: string | null
      department?: string | null
    }
  | null
  | undefined

/**
 * Can create/edit/delete projects and tasks, manage members and stages.
 * ADMIN and MANAGER accounts, plus anyone in the CSM department.
 */
export function canManageDelivery(user: PermissionUser): boolean {
  if (!user) return false
  if (user.role === "ADMIN" || user.role === "MANAGER") return true
  return user.department === CSM_DEPARTMENT
}

/** True for CSM-department employees specifically. */
export function isCsm(user: PermissionUser): boolean {
  return user?.department === CSM_DEPARTMENT
}

/**
 * Can see every employee's leave requests and approve/reject them.
 * ADMIN accounts plus the HR and Operations Manager departments.
 */
export function canApproveLeave(user: PermissionUser): boolean {
  if (!user) return false
  if (user.role === "ADMIN") return true
  return !!user.department && LEAVE_APPROVER_DEPARTMENTS.includes(user.department)
}
