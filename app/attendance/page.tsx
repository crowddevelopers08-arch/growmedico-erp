"use client"

import { useState, useMemo } from "react"
import { CalendarIcon, Clock, LogIn, LogOut, Search, ChevronLeft, ChevronRight, Users } from "lucide-react"
import { DashboardLayout } from "@/components/dashboard-layout"
import { Card, CardContent, CardHeader, CardTitle, CardAction } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Calendar } from "@/components/ui/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { useHR } from "@/lib/hr-context"
import { cn } from "@/lib/utils"

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

function AttendancePageContent() {
  const { employees, attendance, checkIn, checkOut, getAttendanceByDate } = useHR()
  const [selectedDate, setSelectedDate] = useState<Date>(new Date())
  const [searchQuery, setSearchQuery] = useState("")

  const dateStr = selectedDate.toISOString().split("T")[0]
  const todayStr = new Date().toISOString().split("T")[0]
  const isToday = dateStr === todayStr

  const attendanceForDate = useMemo(() => {
    const records = getAttendanceByDate(dateStr)
    return employees.map((emp) => {
      const record = records.find((r) => r.employeeId === emp.id)
      return {
        employee: emp,
        attendance: record || null,
      }
    })
  }, [employees, dateStr, getAttendanceByDate])

  const filteredRecords = useMemo(() => {
    if (!searchQuery) return attendanceForDate
    const query = searchQuery.toLowerCase()
    return attendanceForDate.filter(
      (item) =>
        item.employee.name.toLowerCase().includes(query) ||
        item.employee.department.toLowerCase().includes(query)
    )
  }, [attendanceForDate, searchQuery])

  const stats = useMemo(() => {
    const records = attendanceForDate
    const present = records.filter((r) => r.attendance?.status === "present").length
    const remote = records.filter((r) => r.attendance?.status === "remote").length
    const absent = records.filter((r) => !r.attendance || r.attendance.status === "absent").length
    const onLeave = records.filter((r) => r.attendance?.status === "onLeave").length
    const totalHours = records.reduce((sum, r) => sum + (r.attendance?.workHours || 0), 0)
    const totalOvertime = records.reduce((sum, r) => sum + (r.attendance?.overtime || 0), 0)
    
    return { present, remote, absent, onLeave, totalHours, totalOvertime }
  }, [attendanceForDate])

  const formatDate = (date: Date) => {
    return date.toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    })
  }

  const goToPreviousDay = () => {
    const prev = new Date(selectedDate)
    prev.setDate(prev.getDate() - 1)
    setSelectedDate(prev)
  }

  const goToNextDay = () => {
    const next = new Date(selectedDate)
    next.setDate(next.getDate() + 1)
    setSelectedDate(next)
  }

  const handleCheckIn = (employeeId: string) => {
    checkIn(employeeId)
  }

  const handleCheckOut = (employeeId: string) => {
    checkOut(employeeId)
  }

  return (
    <>
      {/* Page Title */}
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Attendance</h1>
          <p className="text-sm text-muted-foreground">
            Track and manage employee attendance record.
          </p>
        </div>
      </div>

      {/* Date Selector */}
      <Card className="border-border/50">
        <CardContent className="py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button variant="outline" size="icon" onClick={goToPreviousDay}>
                <ChevronLeft className="size-4" />
              </Button>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="min-w-64 justify-start">
                    <CalendarIcon className="mr-2 size-4" />
                    {formatDate(selectedDate)}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={selectedDate}
                    onSelect={(date) => date && setSelectedDate(date)}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
              <Button variant="outline" size="icon" onClick={goToNextDay}>
                <ChevronRight className="size-4" />
              </Button>
            </div>
            {!isToday && (
              <Button variant="ghost" onClick={() => setSelectedDate(new Date())}>
                Go to Today
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="border-border/50">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Present</p>
                <p className="text-2xl font-semibold text-success">{stats.present}</p>
              </div>
              <div className="flex size-10 items-center justify-center rounded-lg bg-success/10">
                <Users className="size-5 text-success" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Remote</p>
                <p className="text-2xl font-semibold text-chart-1">{stats.remote}</p>
              </div>
              <div className="flex size-10 items-center justify-center rounded-lg bg-chart-1/10">
                <Users className="size-5 text-chart-1" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Absent</p>
                <p className="text-2xl font-semibold text-destructive">{stats.absent}</p>
              </div>
              <div className="flex size-10 items-center justify-center rounded-lg bg-destructive/10">
                <Users className="size-5 text-destructive" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Hours</p>
                <p className="text-2xl font-semibold">{stats.totalHours.toFixed(1)}h</p>
                {stats.totalOvertime > 0 && (
                  <p className="text-xs text-muted-foreground">+{stats.totalOvertime.toFixed(1)}h overtime</p>
                )}
              </div>
              <div className="flex size-10 items-center justify-center rounded-lg bg-muted">
                <Clock className="size-5 text-muted-foreground" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Attendance Table */}
      <Card className="border-border/50">
        <CardHeader className="pb-4">
          <CardTitle className="text-base font-semibold">
            Attendance Records - {formatDate(selectedDate)}
          </CardTitle>
          <CardAction>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search employees..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 w-64"
              />
            </div>
          </CardAction>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="pl-6">Employee</TableHead>
                <TableHead>Department</TableHead>
                <TableHead>Check In</TableHead>
                <TableHead>Check Out</TableHead>
                <TableHead>Work Hours</TableHead>
                <TableHead>Status</TableHead>
                {isToday && <TableHead className="w-32">Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredRecords.map(({ employee, attendance: record }) => (
                <TableRow key={employee.id} className="group">
                  <TableCell className="pl-6">
                    <div className="flex items-center gap-3">
                      <Avatar className="size-9 ring-2 ring-background">
                        <AvatarImage src={employee.avatar} alt={employee.name} />
                        <AvatarFallback className="bg-primary/10 text-primary text-xs font-medium">
                          {employee.initials}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="text-sm font-medium text-foreground">{employee.name}</p>
                        <p className="text-xs text-muted-foreground">{employee.role}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{employee.department}</TableCell>
                  <TableCell className="text-sm">
                    {record?.checkIn ? (
                      <span className="font-mono">{record.checkIn}</span>
                    ) : (
                      <span className="text-muted-foreground">--:--</span>
                    )}
                  </TableCell>
                  <TableCell className="text-sm">
                    {record?.checkOut ? (
                      <span className="font-mono">{record.checkOut}</span>
                    ) : (
                      <span className="text-muted-foreground">--:--</span>
                    )}
                  </TableCell>
                  <TableCell className="text-sm">
                    {record?.workHours ? (
                      <div>
                        <span className="font-mono">{record.workHours.toFixed(1)}h</span>
                        {record.overtime > 0 && (
                          <span className="text-xs text-success ml-1">(+{record.overtime.toFixed(1)}h OT)</span>
                        )}
                      </div>
                    ) : (
                      <span className="text-muted-foreground">0.0h</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {record ? getStatusBadge(record.status) : getStatusBadge("absent")}
                  </TableCell>
                  {isToday && (
                    <TableCell>
                      <div className="flex items-center gap-1">
                        {!record?.checkIn && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8"
                            onClick={() => handleCheckIn(employee.id)}
                          >
                            <LogIn className="mr-1 size-3" />
                            In
                          </Button>
                        )}
                        {record?.checkIn && !record.checkOut && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8"
                            onClick={() => handleCheckOut(employee.id)}
                          >
                            <LogOut className="mr-1 size-3" />
                            Out
                          </Button>
                        )}
                        {record?.checkIn && record.checkOut && (
                          <span className="text-xs text-muted-foreground">Complete</span>
                        )}
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </>
  )
}

export default function AttendancePage() {
  return (
    <DashboardLayout>
      <AttendancePageContent />
    </DashboardLayout>
  )
}
