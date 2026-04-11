export type EmployeeStatus = "present" | "absent" | "onLeave" | "remote" | "late"
export type AccountRole = "ADMIN" | "MANAGER" | "EMPLOYEE"

export type LeaveType = "Casual Leave" | "Privilege Leave" | "Sick Leave" | "Work From Home"

export type LeaveStatus = "pending" | "approved" | "rejected"

export type Department = "Web Developer" | "Media Buyer" | "Video Editors" | "CSM" | "Operations Manager" | "Content Writer" | "SEO"

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
export type TaskStatus = "pending" | "in_progress" | "completed" | "cancelled"
export type ProjectStatus = "open" | "in_progress" | "completed" | "on_hold"

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
  priority: TaskPriority
  status: TaskStatus
  stage?: string | null
  dueDate?: string | null
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
  createdById: string
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
