export type EmployeeStatus = "present" | "absent" | "onLeave" | "remote" | "late"

export type LeaveType = "Vacation" | "Sick Leave" | "WFH" | "Personal" | "Maternity" | "Paternity"

export type LeaveStatus = "pending" | "approved" | "rejected"

export type Department = "Engineering" | "Product" | "Design" | "Marketing" | "HR" | "Finance" | "Sales" | "Operations"

export interface Employee {
  id: string
  name: string
  email: string
  phone: string
  avatar: string
  initials: string
  department: Department
  role: string
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

export interface Task {
  id: string
  title: string
  description?: string | null
  assignedToId: string
  assignedById: string
  priority: TaskPriority
  status: TaskStatus
  dueDate?: string | null
  createdAt: string
  updatedAt: string
}

export interface Channel {
  id: string
  name: string
  description?: string | null
  createdById: string
  createdAt: string
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
