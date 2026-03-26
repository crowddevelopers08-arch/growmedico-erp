export type EmployeeStatus = "present" | "absent" | "onLeave" | "remote"

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

export interface Activity {
  id: string
  type: "leave" | "attendance" | "employee" | "salary" | "system"
  action: string
  description: string
  createdAt: string
  employeeId?: string
}
