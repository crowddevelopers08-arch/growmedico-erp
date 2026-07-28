export type EmployeeStatus = "present" | "absent" | "onLeave" | "remote" | "late"
export type AccountRole = "ADMIN" | "MANAGER" | "EMPLOYEE"

export type LeaveType = "Casual Leave" | "Privilege Leave" | "Sick Leave" | "Work From Home" | "Permission"

export type LeaveStatus = "pending" | "approved" | "rejected"

export type Department = "Web Developer" | "Media Buyer" | "Video Editors" | "CSM" | "Operations Manager" | "Content Writer" | "SEO" | "Founder" | "Co-Founder" | "Graphic Designer" | "HR" | "Senior Media Buyer" | "Performance Marketer" | "Social Media Manager"

export interface Employee {
  id: string
  name: string
  email: string
  phone: string
  avatar: string
  initials: string
  department: Department
  role: string
  accountRole?: AccountRole
  status: EmployeeStatus
  joinDate: string
  salary: number
  address: string
  emergencyContact: string
  emergencyContactName: string
  dateOfBirth: string
}

export interface Attendance {
  id: string
  employeeId: string
  date: string
  checkIn: string | null
  checkOut: string | null
  checkInPhoto?: string | null
  checkOutPhoto?: string | null
  status: EmployeeStatus
  workHours: number
  overtime: number
}

export interface LeaveRequest {
  id: string
  employeeId: string
  type: LeaveType
  startDate: string
  endDate: string
  days: number
  /** Permission requests only: duration in hours. */
  hours?: number | null
  /** Permission requests only: which permission of the month this was. */
  permissionIndex?: number | null
  /** Permission requests only: "none" | "half_day" | "full_day". */
  penalty?: string | null
  reason: string
  status: LeaveStatus
  appliedOn: string
  approvedBy?: string
  approvedOn?: string
  rejectionReason?: string
}

export interface SalaryRecord {
  id: string
  employeeId: string
  month: string
  year: number
  baseSalary: number
  bonus: number
  deductions: number
  overtime: number
  netSalary: number
  status: "pending" | "processed" | "paid"
  paidOn?: string
}

export type TaskPriority = "low" | "medium" | "high" | "urgent"
/**
 * The four statuses the app shipped with. Projects can define their own status
 * names on top of these (see ProjectAttribute), so anything reading a status off
 * the wire should treat it as a string and look up its meaning in the project's
 * attribute list rather than switching on this union.
 */
export type TaskStatus = "pending" | "in_progress" | "completed" | "cancelled"
export type ProjectStatus = "open" | "in_progress" | "completed" | "on_hold"

export type AttributeScope = "project" | "task"
export type AttributeKind = "status" | "tag" | "priority"

export interface ProjectStage {
  id: string
  projectId: string
  name: string
  color: string
  orderIndex: number
}

export interface ProjectAttribute {
  id: string
  projectId: string
  scope: AttributeScope
  kind: AttributeKind
  name: string
  color: string
  orderIndex: number
  isTerminal: boolean
}

export interface TaskHistoryEntry {
  id: string
  taskId: string
  actorId: string
  actorName: string
  field: string
  oldValue?: string | null
  newValue?: string | null
  createdAt: string
}

export interface TemplateStage {
  id: string
  name: string
  color: string
  orderIndex: number
}

export interface TemplateAttribute {
  id: string
  scope: AttributeScope
  kind: AttributeKind
  name: string
  color: string
  orderIndex: number
  isTerminal: boolean
}

export interface TemplateTask {
  id: string
  title: string
  description?: string | null
  priority: TaskPriority
  stageName?: string | null
  statusName?: string | null
  estimatedHours?: number | null
  orderIndex: number
}

export interface ProjectTemplate {
  id: string
  name: string
  description?: string | null
  category: string
  tag?: string | null
  coverImage?: string | null
  isBuiltIn: boolean
  stages: TemplateStage[]
  attributes: TemplateAttribute[]
  tasks?: TemplateTask[]
  _count?: { tasks: number }
}

export interface Task {
  id: string
  title: string
  description?: string | null
  projectId?: string | null
  projectName?: string | null
  clientName?: string | null
  assignedToId: string
  assignedById: string
  assignedByName?: string | null
  assignedByAvatar?: string | null
  managerId?: string | null
  managerName?: string | null
  managerAvatar?: string | null
  managerInitials?: string | null
  priority: TaskPriority
  status: TaskStatus
  stage?: string | null
  tags?: string[]
  startDate?: string | null
  dueDate?: string | null
  /** Allocated working hours for the countdown (office hours, Sundays excluded). */
  estimatedHours?: number | null
  /** Banked stopwatch total. timerStartedAt is set only while it is running. */
  trackedSeconds?: number
  timerStartedAt?: string | null
  reminderAt?: string | null
  /** iCal RRULE, e.g. "FREQ=WEEKLY;BYDAY=MO". Null for one-off tasks. */
  recurrenceRule?: string | null
  customFields?: Record<string, string | number | boolean | null> | null
  parentTaskId?: string | null
  orderIndex?: number
  collaborators?: string[]
  commentCount?: number
  createdAt: string
  updatedAt: string
}

export interface ProjectMember {
  id: string
  employeeId: string
  createdAt?: string
  employee: Pick<Employee, "id" | "name" | "avatar" | "initials" | "role" | "department">
}

export interface ClientProject {
  id: string
  clientName: string
  name: string
  description?: string | null
  status: ProjectStatus
  priority: TaskPriority
  dueDate?: string | null
  startDate?: string | null
  createdById: string
  visibility?: "public" | "private"
  ownerId?: string | null
  defaultAssigneeId?: string | null
  tags?: string[]
  /** Ordered stage names. Mirrors projectStages; kept for older call sites. */
  stages?: string[]
  projectStages?: ProjectStage[]
  attributes?: ProjectAttribute[]
  members?: ProjectMember[]
  createdAt: string
  updatedAt: string
}

export interface Channel {
  id: string
  name: string
  description?: string | null
  createdById: string
  createdAt: string
  kind?: "group" | "direct" | "group_dm"
  peerUserId?: string | null
  peerEmployeeId?: string | null
  peerName?: string | null
  peerAvatar?: string | null
  groupTitle?: string | null
  groupMembers?: { userId: string; name: string; avatar?: string | null }[]
  /** Group channels only: who can see it. Empty means open to everyone. */
  memberIds?: string[]
  unreadCount?: number
  lastMessageAt?: string | null
  lastMessagePreview?: string | null
}

export interface Attachment {
  name: string
  type: string
  data: string
  size: number
}

export interface TaskComment {
  id: string
  taskId: string
  senderId: string
  senderName: string
  senderAvatar?: string | null
  content: string
  audioContent?: string | null
  attachments?: Attachment[] | null
  mentions?: string[]
  editedAt?: string | null
  createdAt: string
}

export interface Message {
  id: string
  channelId: string
  senderId: string
  senderName: string
  senderAvatar?: string | null
  content: string
  audioContent?: string | null
  attachments?: Attachment[] | null
  mentions?: string[]
  readBy?: string[]
  editedAt?: string | null
  createdAt: string
}

export interface Activity {
  id: string
  type: "leave" | "attendance" | "employee" | "salary" | "system"
  action: string
  description: string
  createdAt: string
  employeeId?: string
}
