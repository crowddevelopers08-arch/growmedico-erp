"use client"

import { Mail, Phone, MapPin, Calendar, IndianRupee, AlertCircle, Building2, Briefcase } from "lucide-react"
import { useSession } from "next-auth/react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { useHR } from "@/lib/hr-context"
import { to12h } from "@/lib/date"
import type { Employee } from "@/lib/types"

interface EmployeeDetailsProps {
  employee: Employee | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onEdit: (employee: Employee) => void
}

const getStatusBadge = (status: string) => {
  switch (status) {
    case "present":
      return <Badge variant="outline" className="text-success border-success/30 bg-success/10">Present</Badge>
    case "late":
      return <Badge variant="outline" className="text-warning border-warning/30 bg-warning/10">Late</Badge>
    case "onLeave":
      return <Badge variant="outline" className="text-warning border-warning/30 bg-warning/10">On Leave</Badge>
    case "remote":
      return <Badge variant="outline" className="text-chart-1 border-chart-1/30 bg-chart-1/10">Remote</Badge>
    case "absent":
      return <Badge variant="outline" className="text-destructive border-destructive/30 bg-destructive/10">Absent</Badge>
    default:
      return <Badge variant="outline">Unknown</Badge>
  }
}

export function EmployeeDetails({ employee, open, onOpenChange, onEdit }: EmployeeDetailsProps) {
  const { data: session } = useSession()
  const role = session?.user?.role
  const canSeeSalary = role === "ADMIN" || role === "MANAGER"
  const canEdit = role === "ADMIN"
  const { getAttendanceByEmployee, getLeaveRequestsByEmployee, getSalaryByEmployee } = useHR()
  
  if (!employee) return null
  
  const attendance = getAttendanceByEmployee(employee.id)
  const leaveRequests = getLeaveRequestsByEmployee(employee.id)
  const salaryRecords = getSalaryByEmployee(employee.id)
  
  const recentAttendance = attendance.slice(0, 5)
  const pendingLeaves = leaveRequests.filter((r) => r.status === "pending")
  const latestSalary = salaryRecords[salaryRecords.length - 1]

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    })
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      minimumFractionDigits: 0,
    }).format(amount)
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
        <SheetHeader className="gap-4 pr-14 sm:pl-6 sm:pr-14">
          <div className="flex items-center gap-3 sm:gap-4">
            <Avatar className="size-12 shrink-0 ring-2 ring-border sm:size-16">
              <AvatarImage src={employee.avatar} alt={employee.name} />
              <AvatarFallback className="bg-primary/10 text-primary font-medium sm:text-lg">
                {employee.initials}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <SheetTitle className="text-lg wrap-break-word sm:text-xl">{employee.name}</SheetTitle>
              <p className="text-sm text-muted-foreground wrap-break-word">{employee.role}</p>
              <div className="mt-2">{getStatusBadge(employee.status)}</div>
            </div>
          </div>
        </SheetHeader>

        <div className="space-y-6 px-4 pb-6 sm:px-6">
          {/* Contact Information */}
          <Card className="border-border/50">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Contact Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-start gap-3 text-sm">
                <Mail className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                <span className="min-w-0 wrap-break-word">{employee.email}</span>
              </div>
              <div className="flex items-start gap-3 text-sm">
                <Phone className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                <span className="min-w-0 wrap-break-word">{employee.phone}</span>
              </div>
              <div className="flex items-start gap-3 text-sm">
                <MapPin className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                <span className="min-w-0 wrap-break-word">{employee.address}</span>
              </div>
              <div className="flex items-start gap-3 text-sm">
                <AlertCircle className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                <span className="min-w-0 wrap-break-word">
                  Emergency: {employee.emergencyContactName
                    ? `${employee.emergencyContactName} — ${employee.emergencyContact}`
                    : employee.emergencyContact}
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Employment Details */}
          <Card className="border-border/50">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Employment Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {employee.department && (
                <div className="flex items-start gap-3 text-sm">
                  <Building2 className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                  <span className="min-w-0 wrap-break-word">{employee.department}</span>
                </div>
              )}
              {employee.role && (
                <div className="flex items-start gap-3 text-sm">
                  <Briefcase className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                  <span className="min-w-0 wrap-break-word">{employee.role}</span>
                </div>
              )}
              {employee.joinDate && (
                <div className="flex items-start gap-3 text-sm">
                  <Calendar className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                  <span className="min-w-0 wrap-break-word">Joined {formatDate(employee.joinDate)}</span>
                </div>
              )}
              {canSeeSalary && (
                <div className="flex items-start gap-3 text-sm">
                  <IndianRupee className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                  <span className="min-w-0 wrap-break-word">{formatCurrency(employee.salary)} / year</span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Recent Attendance */}
          <Card className="border-border/50">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Recent Attendance</CardTitle>
            </CardHeader>
            <CardContent>
              {recentAttendance.length > 0 ? (
                <div className="space-y-2">
                  {recentAttendance.map((record) => (
                    <div key={record.id} className="flex flex-col gap-1 border-b border-border/50 py-2 last:border-0 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
                      <div className="text-sm">
                        <span className="text-muted-foreground">{formatDate(record.date)}</span>
                      </div>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                        <span className="text-muted-foreground">
                          {record.checkIn
                            ? `${to12h(record.checkIn)} - ${to12h(record.checkOut) ?? "Present"}`
                            : "No record"}
                        </span>
                        {getStatusBadge(record.status)}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No attendance records</p>
              )}
            </CardContent>
          </Card>

          {/* Pending Leave Requests */}
          {pendingLeaves.length > 0 && (
            <Card className="border-border/50">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Pending Leave Requests</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {pendingLeaves.map((request) => (
                    <div key={request.id} className="flex items-center justify-between gap-3 border-b border-border/50 py-2 last:border-0">
                      <div className="min-w-0 text-sm">
                        <p className="font-medium wrap-break-word">{request.type}</p>
                        <p className="text-muted-foreground">{request.days} day{request.days > 1 ? "s" : ""}</p>
                      </div>
                      <Badge variant="outline" className="shrink-0 text-warning border-warning/30 bg-warning/10">Pending</Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Latest Salary — admin/manager only */}
          {canSeeSalary && latestSalary && (
            <Card className="border-border/50">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium wrap-break-word">Latest Salary ({latestSalary.month} {latestSalary.year})</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex justify-between gap-3 text-sm">
                  <span className="text-muted-foreground">Base Salary</span>
                  <span>{formatCurrency(latestSalary.baseSalary)}</span>
                </div>
                <div className="flex justify-between gap-3 text-sm">
                  <span className="text-muted-foreground">Bonus</span>
                  <span className="text-success">+{formatCurrency(latestSalary.bonus)}</span>
                </div>
                <div className="flex justify-between gap-3 text-sm">
                  <span className="text-muted-foreground">Overtime</span>
                  <span className="text-success">+{formatCurrency(latestSalary.overtime)}</span>
                </div>
                <div className="flex justify-between gap-3 text-sm">
                  <span className="text-muted-foreground">Deductions</span>
                  <span className="text-destructive">-{formatCurrency(latestSalary.deductions)}</span>
                </div>
                <Separator />
                <div className="flex justify-between gap-3 text-sm font-medium">
                  <span>Net Salary</span>
                  <span>{formatCurrency(latestSalary.netSalary)}</span>
                </div>
              </CardContent>
            </Card>
          )}

          <div className="flex flex-col gap-3 pt-4 sm:flex-row">
            {canEdit && (
              <Button className="w-full sm:flex-1" onClick={() => onEdit(employee)}>
                Edit Employee
              </Button>
            )}
            <Button variant="outline" className="w-full sm:flex-1" onClick={() => onOpenChange(false)}>
              Close
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
