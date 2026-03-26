"use client"

import { X, Mail, Phone, MapPin, Calendar, DollarSign, AlertCircle, Building2, Briefcase } from "lucide-react"
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
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
    }).format(amount)
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader className="space-y-4">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4">
              <Avatar className="size-16 ring-2 ring-border">
                <AvatarImage src={employee.avatar} alt={employee.name} />
                <AvatarFallback className="bg-primary/10 text-primary text-lg font-medium">
                  {employee.initials}
                </AvatarFallback>
              </Avatar>
              <div>
                <SheetTitle className="text-xl">{employee.name}</SheetTitle>
                <p className="text-sm text-muted-foreground">{employee.role}</p>
                <div className="mt-2">{getStatusBadge(employee.status)}</div>
              </div>
            </div>
            <Button variant="ghost" size="icon" onClick={() => onOpenChange(false)}>
              <X className="size-4" />
            </Button>
          </div>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* Contact Information */}
          <Card className="border-border/50">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Contact Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-3 text-sm">
                <Mail className="size-4 text-muted-foreground" />
                <span>{employee.email}</span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <Phone className="size-4 text-muted-foreground" />
                <span>{employee.phone}</span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <MapPin className="size-4 text-muted-foreground" />
                <span>{employee.address}</span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <AlertCircle className="size-4 text-muted-foreground" />
                <span>Emergency: {employee.emergencyContact}</span>
              </div>
            </CardContent>
          </Card>

          {/* Employment Details */}
          <Card className="border-border/50">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Employment Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-3 text-sm">
                <Building2 className="size-4 text-muted-foreground" />
                <span>{employee.department}</span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <Briefcase className="size-4 text-muted-foreground" />
                <span>{employee.role}</span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <Calendar className="size-4 text-muted-foreground" />
                <span>Joined {formatDate(employee.joinDate)}</span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <DollarSign className="size-4 text-muted-foreground" />
                <span>{formatCurrency(employee.salary)} / year</span>
              </div>
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
                    <div key={record.id} className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
                      <div className="text-sm">
                        <span className="text-muted-foreground">{formatDate(record.date)}</span>
                      </div>
                      <div className="flex items-center gap-3 text-sm">
                        <span className="text-muted-foreground">
                          {record.checkIn ? `${record.checkIn} - ${record.checkOut || "Present"}` : "No record"}
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
                    <div key={request.id} className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
                      <div className="text-sm">
                        <p className="font-medium">{request.type}</p>
                        <p className="text-muted-foreground">{request.days} day{request.days > 1 ? "s" : ""}</p>
                      </div>
                      <Badge variant="outline" className="text-warning border-warning/30 bg-warning/10">Pending</Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Latest Salary */}
          {latestSalary && (
            <Card className="border-border/50">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Latest Salary ({latestSalary.month} {latestSalary.year})</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Base Salary</span>
                  <span>{formatCurrency(latestSalary.baseSalary)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Bonus</span>
                  <span className="text-success">+{formatCurrency(latestSalary.bonus)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Overtime</span>
                  <span className="text-success">+{formatCurrency(latestSalary.overtime)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Deductions</span>
                  <span className="text-destructive">-{formatCurrency(latestSalary.deductions)}</span>
                </div>
                <Separator />
                <div className="flex justify-between text-sm font-medium">
                  <span>Net Salary</span>
                  <span>{formatCurrency(latestSalary.netSalary)}</span>
                </div>
              </CardContent>
            </Card>
          )}

          <div className="flex gap-3 pt-4">
            <Button className="flex-1" onClick={() => onEdit(employee)}>
              Edit Employee
            </Button>
            <Button variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>
              Close
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
