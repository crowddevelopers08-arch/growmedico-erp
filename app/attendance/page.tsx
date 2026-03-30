"use client"

import { useState, useMemo } from "react"
import { CalendarIcon, Clock, LogIn, LogOut, Search, ChevronLeft, ChevronRight, Users, ImageOff, Download, BarChart2, Pencil } from "lucide-react"
import { DashboardLayout } from "@/components/dashboard-layout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Calendar } from "@/components/ui/calendar"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { useHR } from "@/lib/hr-context"
import { useSession } from "next-auth/react"
import { cn } from "@/lib/utils"

// Convert 24h "HH:MM" to 12h "h:MM AM/PM"
function to12h(time: string | null | undefined): string | null {
  if (!time) return null
  const [h, m] = time.split(":").map(Number)
  const ampm = h >= 12 ? "PM" : "AM"
  const hour = h % 12 || 12
  return `${hour}:${String(m).padStart(2, "0")} ${ampm}`
}

// Convert 12h "h:MM AM/PM" to 24h "HH:MM" for <input type="time">
function to24h(time: string | null | undefined): string {
  if (!time) return ""
  // Already 24h format
  if (/^\d{2}:\d{2}$/.test(time)) return time
  const match = time.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i)
  if (!match) return ""
  let h = parseInt(match[1])
  const m = match[2]
  const ampm = match[3].toUpperCase()
  if (ampm === "AM" && h === 12) h = 0
  if (ampm === "PM" && h !== 12) h += 12
  return `${String(h).padStart(2, "0")}:${m}`
}

const getStatusBadge = (status: string) => {
  switch (status) {
    case "present":
      return <Badge variant="outline" className="text-success border-success/30 bg-success/10">Present</Badge>
    case "late":
      return <Badge variant="outline" className="text-orange-500 border-orange-500/30 bg-orange-500/10">Late</Badge>
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
  const { employees, attendance, checkIn, checkOut, updateAttendance, getAttendanceByDate, getAttendanceByEmployee } = useHR()
  const { data: session } = useSession()
  const isAdmin = session?.user?.role === "ADMIN"
  const currentEmployeeId = session?.user?.employeeId
  const [selectedDate, setSelectedDate] = useState<Date>(new Date())
  const [searchQuery, setSearchQuery] = useState("")
  const [photoPreview, setPhotoPreview] = useState<{ src: string; label: string } | null>(null)
  const [downloadOpen, setDownloadOpen] = useState(false)
  const [dlEmployeeId, setDlEmployeeId] = useState("")
  const [dlMonth, setDlMonth] = useState(() => {
    const now = new Date()
    return `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, "0")}`
  })

  // Admin edit state
  const [editRecord, setEditRecord] = useState<{ id: string; employeeName: string; checkIn: string; checkOut: string } | null>(null)
  const [editCheckIn, setEditCheckIn] = useState("")
  const [editCheckOut, setEditCheckOut] = useState("")
  const [editSaving, setEditSaving] = useState(false)

  const openEdit = (id: string, employeeName: string, checkIn: string | null, checkOut: string | null) => {
    setEditRecord({ id, employeeName, checkIn: checkIn ?? "", checkOut: checkOut ?? "" })
    setEditCheckIn(to24h(checkIn))
    setEditCheckOut(to24h(checkOut))
  }

  const handleEditSave = async () => {
    if (!editRecord) return
    setEditSaving(true)
    try {
      // Convert input time (HH:MM) to store format (already 24h)
      await updateAttendance(editRecord.id, editCheckIn, editCheckOut || null)
      setEditRecord(null)
    } finally {
      setEditSaving(false)
    }
  }

  // Monthly report state
  const [reportMonth, setReportMonth] = useState(() => {
    const now = new Date()
    return `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, "0")}`
  })
  const [reportEmployeeId, setReportEmployeeId] = useState(() => "")

  // Resolve which employee to show in monthly report
  const monthlyReportEmployeeId = isAdmin ? reportEmployeeId : (currentEmployeeId ?? "")

  // Build monthly report records
  const monthlyReportRecords = useMemo(() => {
    if (!monthlyReportEmployeeId || !reportMonth) return []
    const [yearStr, monthStr] = reportMonth.split("-")
    const year = parseInt(yearStr)
    const month = parseInt(monthStr)
    const lastDay = new Date(year, month, 0).getDate()
    const pad = (n: number) => n.toString().padStart(2, "0")
    const allRecords = getAttendanceByEmployee(monthlyReportEmployeeId)
    const recordMap = new Map(allRecords.map((r) => [r.date, r]))
    return Array.from({ length: lastDay }, (_, i) => {
      const day = i + 1
      const dateStr = `${year}-${pad(month)}-${pad(day)}`
      return { date: dateStr, record: recordMap.get(dateStr) ?? null }
    })
  }, [monthlyReportEmployeeId, reportMonth, getAttendanceByEmployee])

  const monthlyStats = useMemo(() => {
    const present = monthlyReportRecords.filter((r) => r.record?.status === "present" || r.record?.status === "remote").length
    const absent = monthlyReportRecords.filter((r) => !r.record || r.record.status === "absent").length
    const onLeave = monthlyReportRecords.filter((r) => r.record?.status === "onLeave").length
    const totalHours = monthlyReportRecords.reduce((s, r) => s + (r.record?.workHours ?? 0), 0)
    const overtime = monthlyReportRecords.reduce((s, r) => s + (r.record?.overtime ?? 0), 0)
    return { present, absent, onLeave, totalHours, overtime }
  }, [monthlyReportRecords])

  const reportEmployee = useMemo(
    () => employees.find((e) => e.id === monthlyReportEmployeeId),
    [employees, monthlyReportEmployeeId]
  )

  const dateStr = selectedDate.toISOString().split("T")[0]
  const todayStr = new Date().toISOString().split("T")[0]
  const isToday = dateStr === todayStr

  const attendanceForDate = useMemo(() => {
    const records = getAttendanceByDate(dateStr)
    const empList = isAdmin ? employees : employees.filter((emp) => emp.id === currentEmployeeId)
    return empList.map((emp) => {
      const record = records.find((r) => r.employeeId === emp.id)
      return {
        employee: emp,
        attendance: record || null,
      }
    })
  }, [employees, dateStr, getAttendanceByDate, isAdmin, currentEmployeeId])

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
    <div className="space-y-4">
      {/* Page Title */}
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Attendance</h1>
          <p className="text-sm text-muted-foreground">
            {isAdmin ? "Track and manage employee attendance records." : "View your attendance records."}
          </p>
        </div>
      </div>

      <Tabs defaultValue="daily">
        <TabsList>
          <TabsTrigger value="daily">Daily View</TabsTrigger>
          <TabsTrigger value="monthly">
            <BarChart2 className="mr-1.5 size-3.5" />Monthly Report
          </TabsTrigger>
        </TabsList>

        {/* ── DAILY TAB ── */}
        <TabsContent value="daily" className="space-y-4 mt-4">
          {/* Date Selector */}
          <Card className="border-border/50">
            <CardContent className="py-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="icon" className="shrink-0" onClick={goToPreviousDay}>
                    <ChevronLeft className="size-4" />
                  </Button>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="flex-1 sm:min-w-64 justify-start text-left">
                        <CalendarIcon className="mr-2 size-4 shrink-0" />
                        <span className="truncate">{formatDate(selectedDate)}</span>
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
                  <Button variant="outline" size="icon" className="shrink-0" onClick={goToNextDay}>
                    <ChevronRight className="size-4" />
                  </Button>
                </div>
                {!isToday && (
                  <Button variant="ghost" size="sm" onClick={() => setSelectedDate(new Date())}>
                    Go to Today
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Stats */}
          <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
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
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <CardTitle className="text-base font-semibold">
                  Attendance Records — {formatDate(selectedDate)}
                </CardTitle>
                {isAdmin && (
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      placeholder="Search employees..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-9 w-full sm:w-56"
                    />
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="pl-6">Employee</TableHead>
                      <TableHead>Department</TableHead>
                      <TableHead>Check In</TableHead>
                      <TableHead>Check Out</TableHead>
                      {isAdmin && <TableHead className="w-28">Punch Photos</TableHead>}
                      <TableHead>Work Hours</TableHead>
                      <TableHead>Status</TableHead>
                      {isToday && <TableHead className="w-32">Actions</TableHead>}
                      {isAdmin && <TableHead className="w-10" />}
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
                            <span className="font-mono">{to12h(record.checkIn)}</span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-sm">
                          {record?.checkOut ? (
                            <span className="font-mono">{to12h(record.checkOut)}</span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        {isAdmin && (
                          <TableCell>
                            <div className="flex items-center gap-1.5">
                              {record?.checkInPhoto ? (
                                <button
                                  onClick={() => setPhotoPreview({ src: record.checkInPhoto!, label: `${employee.name} — Punch In` })}
                                  className="relative group/photo"
                                  title="View punch-in photo"
                                >
                                  <img
                                    src={record.checkInPhoto}
                                    alt="Punch In"
                                    className="size-8 rounded-md object-cover ring-2 ring-emerald-500/40 hover:ring-emerald-500 transition-all"
                                  />
                                  <span className="absolute -bottom-0.5 -right-0.5 flex size-3.5 items-center justify-center rounded-full bg-emerald-500 text-[8px] text-white font-bold">I</span>
                                </button>
                              ) : record?.checkIn ? (
                                <div className="size-8 rounded-md bg-muted flex items-center justify-center" title="No punch-in photo">
                                  <ImageOff className="size-3.5 text-muted-foreground/50" />
                                </div>
                              ) : null}
                              {record?.checkOutPhoto ? (
                                <button
                                  onClick={() => setPhotoPreview({ src: record.checkOutPhoto!, label: `${employee.name} — Punch Out` })}
                                  className="relative group/photo"
                                  title="View punch-out photo"
                                >
                                  <img
                                    src={record.checkOutPhoto}
                                    alt="Punch Out"
                                    className="size-8 rounded-md object-cover ring-2 ring-orange-500/40 hover:ring-orange-500 transition-all"
                                  />
                                  <span className="absolute -bottom-0.5 -right-0.5 flex size-3.5 items-center justify-center rounded-full bg-orange-500 text-[8px] text-white font-bold">O</span>
                                </button>
                              ) : record?.checkOut ? (
                                <div className="size-8 rounded-md bg-muted flex items-center justify-center" title="No punch-out photo">
                                  <ImageOff className="size-3.5 text-muted-foreground/50" />
                                </div>
                              ) : null}
                              {!record?.checkIn && !record?.checkOut && (
                                <span className="text-xs text-muted-foreground">—</span>
                              )}
                            </div>
                          </TableCell>
                        )}
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
                                <Button size="sm" variant="outline" className="h-8" onClick={() => handleCheckIn(employee.id)}>
                                  <LogIn className="mr-1 size-3" />In
                                </Button>
                              )}
                              {record?.checkIn && !record.checkOut && (
                                <Button size="sm" variant="outline" className="h-8" onClick={() => handleCheckOut(employee.id)}>
                                  <LogOut className="mr-1 size-3" />Out
                                </Button>
                              )}
                              {record?.checkIn && record.checkOut && (
                                <span className="text-xs text-muted-foreground">Complete</span>
                              )}
                            </div>
                          </TableCell>
                        )}
                        {isAdmin && (
                          <TableCell className="pr-4">
                            {record && (
                              <Button
                                size="icon"
                                variant="ghost"
                                className="size-7 text-muted-foreground hover:text-foreground"
                                title="Edit times"
                                onClick={() => openEdit(record.id, employee.name, record.checkIn, record.checkOut)}
                              >
                                <Pencil className="size-3.5" />
                              </Button>
                            )}
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          {/* Photo Preview Dialog */}
          <Dialog open={!!photoPreview} onOpenChange={(o) => !o && setPhotoPreview(null)}>
            <DialogContent className="max-w-sm p-0 overflow-hidden">
              <DialogHeader className="px-6 pt-6 pb-3">
                <DialogTitle className="text-sm font-medium">{photoPreview?.label}</DialogTitle>
              </DialogHeader>
              {photoPreview && (
                <img src={photoPreview.src} alt={photoPreview.label} className="w-full object-cover" />
              )}
            </DialogContent>
          </Dialog>

          {/* Admin Edit Attendance Dialog */}
          <Dialog open={!!editRecord} onOpenChange={(o) => !o && setEditRecord(null)}>
            <DialogContent className="max-w-sm">
              <DialogHeader>
                <DialogTitle>Edit Attendance</DialogTitle>
                <DialogDescription>
                  Editing times for <span className="font-medium text-foreground">{editRecord?.employeeName}</span>.
                  Office hours: 10:00 AM – 7:00 PM. Check-in after 10:30 AM will be marked as Late.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-2">
                <div className="space-y-1.5">
                  <Label>Check In Time</Label>
                  <input
                    type="time"
                    value={editCheckIn}
                    onChange={(e) => setEditCheckIn(e.target.value)}
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  />
                  {editCheckIn && (() => {
                    const [h, m] = editCheckIn.split(":").map(Number)
                    const late = h > 10 || (h === 10 && m > 30)
                    return late ? (
                      <p className="text-xs text-orange-500">This time will be marked as Late.</p>
                    ) : null
                  })()}
                </div>
                <div className="space-y-1.5">
                  <Label>Check Out Time <span className="text-muted-foreground text-xs">(optional)</span></Label>
                  <input
                    type="time"
                    value={editCheckOut}
                    onChange={(e) => setEditCheckOut(e.target.value)}
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  />
                </div>
                {editCheckIn && editCheckOut && (() => {
                  const [ciH, ciM] = editCheckIn.split(":").map(Number)
                  const [coH, coM] = editCheckOut.split(":").map(Number)
                  const wh = Math.max(0, (coH + coM / 60) - (ciH + ciM / 60))
                  const ot = Math.max(0, wh - 9)
                  return (
                    <p className="text-xs text-muted-foreground">
                      Work hours: <span className="font-medium text-foreground">{wh.toFixed(1)}h</span>
                      {ot > 0 && <span className="text-success ml-1">(+{ot.toFixed(1)}h overtime)</span>}
                    </p>
                  )
                })()}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setEditRecord(null)}>Cancel</Button>
                <Button disabled={!editCheckIn || editSaving} onClick={handleEditSave}>
                  {editSaving ? "Saving…" : "Save Changes"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </TabsContent>

        {/* ── MONTHLY REPORT TAB ── */}
        <TabsContent value="monthly" className="space-y-4 mt-4">
          {/* Controls */}
          <Card className="border-border/50">
            <CardContent className="py-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                  {isAdmin && (
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">Employee</Label>
                      <Select value={reportEmployeeId} onValueChange={setReportEmployeeId}>
                        <SelectTrigger className="w-52">
                          <SelectValue placeholder="Select employee" />
                        </SelectTrigger>
                        <SelectContent>
                          {employees.map((e) => (
                            <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Month</Label>
                    <input
                      type="month"
                      value={reportMonth}
                      onChange={(e) => setReportMonth(e.target.value)}
                      className="flex h-9 w-44 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    />
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!monthlyReportEmployeeId || !reportMonth}
                  onClick={() => window.open(`/api/attendance/export?employeeId=${monthlyReportEmployeeId}&month=${reportMonth}`, "_blank")}
                >
                  <Download className="mr-2 size-4" />Download CSV
                </Button>
              </div>
            </CardContent>
          </Card>

          {monthlyReportEmployeeId && reportEmployee ? (
            <>
              {/* Monthly Stats */}
              <div className="grid gap-4 grid-cols-2 lg:grid-cols-5">
                <Card className="border-border/50">
                  <CardContent className="pt-6">
                    <p className="text-sm font-medium text-muted-foreground">Present</p>
                    <p className="text-2xl font-semibold text-success">{monthlyStats.present}</p>
                    <p className="text-xs text-muted-foreground">days</p>
                  </CardContent>
                </Card>
                <Card className="border-border/50">
                  <CardContent className="pt-6">
                    <p className="text-sm font-medium text-muted-foreground">Absent</p>
                    <p className="text-2xl font-semibold text-destructive">{monthlyStats.absent}</p>
                    <p className="text-xs text-muted-foreground">days</p>
                  </CardContent>
                </Card>
                <Card className="border-border/50">
                  <CardContent className="pt-6">
                    <p className="text-sm font-medium text-muted-foreground">On Leave</p>
                    <p className="text-2xl font-semibold text-warning">{monthlyStats.onLeave}</p>
                    <p className="text-xs text-muted-foreground">days</p>
                  </CardContent>
                </Card>
                <Card className="border-border/50">
                  <CardContent className="pt-6">
                    <p className="text-sm font-medium text-muted-foreground">Total Hours</p>
                    <p className="text-2xl font-semibold">{monthlyStats.totalHours.toFixed(1)}h</p>
                    <p className="text-xs text-muted-foreground">worked</p>
                  </CardContent>
                </Card>
                <Card className="border-border/50">
                  <CardContent className="pt-6">
                    <p className="text-sm font-medium text-muted-foreground">Overtime</p>
                    <p className="text-2xl font-semibold text-chart-1">{monthlyStats.overtime.toFixed(1)}h</p>
                    <p className="text-xs text-muted-foreground">extra</p>
                  </CardContent>
                </Card>
              </div>

              {/* Monthly Records Table */}
              <Card className="border-border/50">
                <CardHeader className="pb-4">
                  <CardTitle className="text-base font-semibold">
                    {reportEmployee.name} — {new Date(reportMonth + "-01").toLocaleDateString("en-US", { month: "long", year: "numeric" })}
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="hover:bg-transparent">
                          <TableHead className="pl-6">Date</TableHead>
                          <TableHead>Day</TableHead>
                          <TableHead>Check In</TableHead>
                          <TableHead>Check Out</TableHead>
                          <TableHead>Work Hours</TableHead>
                          <TableHead>Overtime</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {monthlyReportRecords.map(({ date, record }) => {
                          const d = new Date(date + "T00:00:00")
                          const dayName = d.toLocaleDateString("en-US", { weekday: "short" })
                          const isWeekend = d.getDay() === 0 || d.getDay() === 6
                          return (
                            <TableRow key={date} className={cn("group", isWeekend && "bg-muted/30")}>
                              <TableCell className="pl-6 text-sm font-mono">{date}</TableCell>
                              <TableCell className="text-sm text-muted-foreground">{dayName}</TableCell>
                              <TableCell className="text-sm font-mono">
                                {record?.checkIn ? to12h(record.checkIn) : <span className="text-muted-foreground">—</span>}
                              </TableCell>
                              <TableCell className="text-sm font-mono">
                                {record?.checkOut ? to12h(record.checkOut) : <span className="text-muted-foreground">—</span>}
                              </TableCell>
                              <TableCell className="text-sm">
                                {record?.workHours ? `${record.workHours.toFixed(1)}h` : <span className="text-muted-foreground">0.0h</span>}
                              </TableCell>
                              <TableCell className="text-sm">
                                {record?.overtime && record.overtime > 0
                                  ? <span className="text-success">+{record.overtime.toFixed(1)}h</span>
                                  : <span className="text-muted-foreground">—</span>}
                              </TableCell>
                              <TableCell>
                                {isWeekend && !record
                                  ? <Badge variant="outline" className="text-muted-foreground border-border">Weekend</Badge>
                                  : record ? getStatusBadge(record.status) : getStatusBadge("absent")}
                              </TableCell>
                            </TableRow>
                          )
                        })}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </>
          ) : (
            <Card className="border-border/50">
              <CardContent className="h-40 flex items-center justify-center text-muted-foreground text-sm">
                {isAdmin ? "Select an employee and month to view the report." : "Select a month to view your attendance report."}
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}

export default function AttendancePage() {
  return (
    <DashboardLayout>
      <AttendancePageContent />
    </DashboardLayout>
  )
}
