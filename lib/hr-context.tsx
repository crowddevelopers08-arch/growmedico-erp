"use client"

import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from "react"
import type { Employee, Attendance, LeaveRequest, SalaryRecord, Activity, LeaveStatus } from "./types"

interface HRContextType {
  // Employees
  employees: Employee[]
  addEmployee: (employee: Omit<Employee, "id">) => Promise<void>
  updateEmployee: (id: string, updates: Partial<Employee>) => Promise<void>
  deleteEmployee: (id: string) => Promise<void>
  getEmployee: (id: string) => Employee | undefined
  refreshEmployees: () => Promise<void>

  // Attendance
  attendance: Attendance[]
  checkIn: (employeeId: string, photo?: string | null) => Promise<void>
  checkOut: (employeeId: string, photo?: string | null) => Promise<void>
  updateAttendance: (id: string, checkIn: string, checkOut: string | null) => Promise<void>
  getAttendanceByDate: (date: string) => Attendance[]
  getAttendanceByEmployee: (employeeId: string) => Attendance[]
  refreshAttendance: () => Promise<void>

  // Leave Requests
  leaveRequests: LeaveRequest[]
  addLeaveRequest: (request: Omit<LeaveRequest, "id" | "status" | "appliedOn">) => Promise<void>
  updateLeaveStatus: (id: string, status: LeaveStatus, approvedBy?: string, rejectionReason?: string) => Promise<void>
  getLeaveRequestsByEmployee: (employeeId: string) => LeaveRequest[]
  getPendingLeaveRequests: () => LeaveRequest[]
  refreshLeaveRequests: () => Promise<void>

  // Salary
  salaryRecords: SalaryRecord[]
  processSalary: (id: string) => Promise<void>
  markSalaryPaid: (id: string) => Promise<void>
  getSalaryByEmployee: (employeeId: string) => SalaryRecord[]
  refreshSalary: () => Promise<void>

  // Activities
  activities: Activity[]
  refreshActivities: () => Promise<void>

  // Stats
  getStats: () => {
    totalEmployees: number
    presentToday: number
    onLeave: number
    pendingRequests: number
  }

  isLoading: boolean
}

const HRContext = createContext<HRContextType | undefined>(undefined)

async function apiFetch<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    ...options,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Request failed" }))
    throw new Error(err.error || "Request failed")
  }
  return res.json()
}

export function HRProvider({ children }: { children: ReactNode }) {
  const [employees, setEmployees] = useState<Employee[]>([])
  const [attendance, setAttendance] = useState<Attendance[]>([])
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([])
  const [salaryRecords, setSalaryRecords] = useState<SalaryRecord[]>([])
  const [activities, setActivities] = useState<Activity[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const refreshEmployees = useCallback(async () => {
    const data = await apiFetch<Employee[]>("/api/employees")
    setEmployees(data)
  }, [])

  const refreshAttendance = useCallback(async () => {
    const data = await apiFetch<Attendance[]>("/api/attendance")
    setAttendance(data)
  }, [])

  const refreshLeaveRequests = useCallback(async () => {
    const data = await apiFetch<LeaveRequest[]>("/api/leaves")
    setLeaveRequests(data)
  }, [])

  const refreshSalary = useCallback(async () => {
    const data = await apiFetch<SalaryRecord[]>("/api/salary")
    setSalaryRecords(data)
  }, [])

  const refreshActivities = useCallback(async () => {
    const data = await apiFetch<Activity[]>("/api/activities")
    setActivities(data)
  }, [])

  // Load all data on mount
  useEffect(() => {
    const loadAll = async () => {
      setIsLoading(true)
      try {
        await Promise.all([
          refreshEmployees(),
          refreshAttendance(),
          refreshLeaveRequests(),
          refreshSalary(),
          refreshActivities(),
        ])
      } catch (e) {
        console.error("Failed to load HR data:", e)
      } finally {
        setIsLoading(false)
      }
    }
    loadAll()
  }, [])

  const addEmployee = useCallback(async (employee: Omit<Employee, "id">) => {
    await apiFetch("/api/employees", { method: "POST", body: JSON.stringify(employee) })
    await refreshEmployees()
    await refreshActivities()
  }, [refreshEmployees, refreshActivities])

  const updateEmployee = useCallback(async (id: string, updates: Partial<Employee>) => {
    await apiFetch(`/api/employees/${id}`, { method: "PATCH", body: JSON.stringify(updates) })
    await refreshEmployees()
  }, [refreshEmployees])

  const deleteEmployee = useCallback(async (id: string) => {
    await apiFetch(`/api/employees/${id}`, { method: "DELETE" })
    await refreshEmployees()
    await refreshActivities()
  }, [refreshEmployees, refreshActivities])

  const getEmployee = useCallback((id: string) => {
    return employees.find((emp) => emp.id === id)
  }, [employees])

  const checkIn = useCallback(async (employeeId: string, photo?: string | null) => {
    await apiFetch("/api/attendance", {
      method: "POST",
      body: JSON.stringify({ action: "checkIn", employeeId, checkInPhoto: photo ?? null }),
    })
    await refreshAttendance()
    await refreshEmployees()
    await refreshActivities()
  }, [refreshAttendance, refreshEmployees, refreshActivities])

  const checkOut = useCallback(async (employeeId: string, photo?: string | null) => {
    await apiFetch("/api/attendance", {
      method: "POST",
      body: JSON.stringify({ action: "checkOut", employeeId, checkOutPhoto: photo ?? null }),
    })
    await refreshAttendance()
    await refreshActivities()
  }, [refreshAttendance, refreshActivities])

  const updateAttendance = useCallback(async (id: string, checkIn: string, checkOut: string | null) => {
    await apiFetch(`/api/attendance/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ checkIn, checkOut }),
    })
    await refreshAttendance()
    await refreshActivities()
  }, [refreshAttendance, refreshActivities])

  const getAttendanceByDate = useCallback((date: string) => {
    return attendance.filter((a) => a.date === date)
  }, [attendance])

  const getAttendanceByEmployee = useCallback((employeeId: string) => {
    return attendance.filter((a) => a.employeeId === employeeId)
  }, [attendance])

  const addLeaveRequest = useCallback(async (request: Omit<LeaveRequest, "id" | "status" | "appliedOn">) => {
    await apiFetch("/api/leaves", { method: "POST", body: JSON.stringify(request) })
    await refreshLeaveRequests()
    await refreshActivities()
  }, [refreshLeaveRequests, refreshActivities])

  const updateLeaveStatus = useCallback(async (
    id: string,
    status: LeaveStatus,
    approvedBy?: string,
    rejectionReason?: string
  ) => {
    await apiFetch(`/api/leaves/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ status, approvedBy, rejectionReason }),
    })
    await refreshLeaveRequests()
    await refreshActivities()
  }, [refreshLeaveRequests, refreshActivities])

  const getLeaveRequestsByEmployee = useCallback((employeeId: string) => {
    return leaveRequests.filter((r) => r.employeeId === employeeId)
  }, [leaveRequests])

  const getPendingLeaveRequests = useCallback(() => {
    return leaveRequests.filter((r) => r.status === "pending")
  }, [leaveRequests])

  const processSalary = useCallback(async (id: string) => {
    await apiFetch(`/api/salary/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ action: "process" }),
    })
    await refreshSalary()
  }, [refreshSalary])

  const markSalaryPaid = useCallback(async (id: string) => {
    await apiFetch(`/api/salary/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ action: "markPaid" }),
    })
    await refreshSalary()
  }, [refreshSalary])

  const getSalaryByEmployee = useCallback((employeeId: string) => {
    return salaryRecords.filter((r) => r.employeeId === employeeId)
  }, [salaryRecords])

  const getStats = useCallback(() => {
    const today = new Date().toISOString().split("T")[0]
    const todayAttendance = attendance.filter((a) => a.date === today)

    return {
      totalEmployees: employees.length,
      presentToday: todayAttendance.filter((a) => a.status === "present" || a.status === "remote").length,
      onLeave: employees.filter((e) => e.status === "onLeave").length,
      pendingRequests: leaveRequests.filter((r) => r.status === "pending").length,
    }
  }, [employees, attendance, leaveRequests])

  return (
    <HRContext.Provider
      value={{
        employees,
        addEmployee,
        updateEmployee,
        deleteEmployee,
        getEmployee,
        refreshEmployees,
        attendance,
        checkIn,
        checkOut,
        updateAttendance,
        getAttendanceByDate,
        getAttendanceByEmployee,
        refreshAttendance,
        leaveRequests,
        addLeaveRequest,
        updateLeaveStatus,
        getLeaveRequestsByEmployee,
        getPendingLeaveRequests,
        refreshLeaveRequests,
        salaryRecords,
        processSalary,
        markSalaryPaid,
        getSalaryByEmployee,
        refreshSalary,
        activities,
        refreshActivities,
        getStats,
        isLoading,
      }}
    >
      {children}
    </HRContext.Provider>
  )
}

export function useHR() {
  const context = useContext(HRContext)
  if (context === undefined) {
    throw new Error("useHR must be used within an HRProvider")
  }
  return context
}
