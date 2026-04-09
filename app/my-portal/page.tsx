"use client"

import { useState, useMemo, useRef } from "react"
import {
  Clock,
  CalendarDays,
  LogIn,
  LogOut,
  Briefcase,
  Timer,
  CheckCircle2,
  XCircle,
  HourglassIcon,
  CalendarPlus,
  TrendingUp,
  Calendar,
  Camera,
} from "lucide-react"
import { CameraPunchDialog } from "@/components/camera-punch-dialog"
import { toast } from "sonner"
import { DashboardLayout } from "@/components/dashboard-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Progress } from "@/components/ui/progress"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Calendar as CalendarComponent } from "@/components/ui/calendar"
import { useHR } from "@/lib/hr-context"
import { useSession } from "next-auth/react"

function to12h(time: string | null | undefined): string {
  if (!time) return ""
  const [h, m] = time.split(":").map(Number)
  const ampm = h >= 12 ? "PM" : "AM"
  const hour = h % 12 || 12
  return `${hour}:${String(m).padStart(2, "0")} ${ampm}`
}
import type { LeaveType } from "@/lib/types"
import { cn } from "@/lib/utils"

const leaveTypes: LeaveType[] = ["Casual Leave", "Privilege Leave", "Sick Leave", "Work From Home"]

const leaveBalanceDefaults = {
  casualLeave: { total: 6 },
  privilegeLeave: { total: 6 },
  sickLeave: { total: 12 },
  workFromHome: { total: 24, quarterlyLimit: 6 },
}

function MyPortalContent() {
  const { data: session } = useSession()
  const CURRENT_EMPLOYEE_ID = session?.user?.employeeId ?? ""
  const {
    employees,
    attendance,
    leaveRequests,
    checkIn,
    checkOut,
    addLeaveRequest,
    getAttendanceByEmployee,
    getLeaveRequestsByEmployee
  } = useHR()

  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [avatarUploading, setAvatarUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [cameraOpen, setCameraOpen] = useState(false)
  const [cameraAction, setCameraAction] = useState<"in" | "out">("in")
  const [leaveDialogOpen, setLeaveDialogOpen] = useState(false)
  const [leaveType, setLeaveType] = useState<LeaveType>("Casual Leave")
  const [startDate, setStartDate] = useState<Date>()
  const [endDate, setEndDate] = useState<Date>()
  const [reason, setReason] = useState("")

  // Get current employee
  const currentEmployee = employees.find(e => e.id === CURRENT_EMPLOYEE_ID)
  
  // Get today's attendance
  const today = new Date().toISOString().split("T")[0]
  const todayAttendance = attendance.find(
    a => a.employeeId === CURRENT_EMPLOYEE_ID && a.date === today
  )

  // Get employee's leave requests
  const myLeaveRequests = getLeaveRequestsByEmployee(CURRENT_EMPLOYEE_ID)
  const pendingRequests = myLeaveRequests.filter(r => r.status === "pending")
  const approvedRequests = myLeaveRequests.filter(r => r.status === "approved")
  const rejectedRequests = myLeaveRequests.filter(r => r.status === "rejected")

  // Get this month's attendance
  const thisMonth = new Date().toISOString().slice(0, 7)
  const monthlyAttendance = getAttendanceByEmployee(CURRENT_EMPLOYEE_ID).filter(
    a => a.date.startsWith(thisMonth)
  )
  const presentDays = monthlyAttendance.filter(a => a.status === "present" || a.status === "remote").length
  const totalWorkHours = monthlyAttendance.reduce((sum, a) => sum + a.workHours, 0)
  const totalOvertime = monthlyAttendance.reduce((sum, a) => sum + a.overtime, 0)

  // Calculate leave balances
  const leaveBalance = useMemo(() => {
    const approved = approvedRequests.filter(r => {
      const year = new Date(r.startDate).getFullYear()
      return year === new Date().getFullYear()
    })
    
    const usedCasual = approved.filter(r => r.type === "Casual Leave").reduce((sum, r) => sum + r.days, 0)
    const usedPrivilege = approved.filter(r => r.type === "Privilege Leave").reduce((sum, r) => sum + r.days, 0)
    const usedSick = approved.filter(r => r.type === "Sick Leave").reduce((sum, r) => sum + r.days, 0)
    const usedWFH = approved.filter(r => r.type === "Work From Home").reduce((sum, r) => sum + r.days, 0)

    return {
      casualLeave: { total: leaveBalanceDefaults.casualLeave.total, used: usedCasual },
      privilegeLeave: { total: leaveBalanceDefaults.privilegeLeave.total, used: usedPrivilege },
      sickLeave: { total: leaveBalanceDefaults.sickLeave.total, used: usedSick },
      workFromHome: { total: leaveBalanceDefaults.workFromHome.total, used: usedWFH, quarterlyLimit: leaveBalanceDefaults.workFromHome.quarterlyLimit },
    }
  }, [approvedRequests])

  const handleCheckIn = () => {
    setCameraAction("in")
    setCameraOpen(true)
  }

  const handleCheckOut = () => {
    setCameraAction("out")
    setCameraOpen(true)
  }

  const handleCameraConfirm = (photo: string | null) => {
    if (cameraAction === "in") checkIn(CURRENT_EMPLOYEE_ID, photo)
    else checkOut(CURRENT_EMPLOYEE_ID, photo)
  }

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setAvatarUploading(true)
    try {
      const form = new FormData()
      form.append("avatar", file)
      const res = await fetch("/api/settings/avatar", { method: "POST", body: form })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setAvatarUrl(data.avatarUrl)
      toast.success("Profile photo updated")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to upload photo")
    } finally {
      setAvatarUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ""
    }
  }

  const calculateDays = () => {
    if (!startDate || !endDate) return 0
    const diffTime = Math.abs(endDate.getTime() - startDate.getTime())
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1
  }

  const handleSubmitLeave = (e: React.FormEvent) => {
    e.preventDefault()
    if (!startDate || !endDate || !reason) return

    addLeaveRequest({
      employeeId: CURRENT_EMPLOYEE_ID,
      type: leaveType,
      startDate: startDate.toISOString().split("T")[0],
      endDate: endDate.toISOString().split("T")[0],
      days: calculateDays(),
      reason,
    })
    
    setLeaveDialogOpen(false)
    setLeaveType("Casual Leave")
    setStartDate(undefined)
    setEndDate(undefined)
    setReason("")
  }

  const formatDate = (date: Date) => {
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    })
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "approved":
        return <Badge variant="default" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20">Approved</Badge>
      case "rejected":
        return <Badge variant="destructive">Rejected</Badge>
      default:
        return <Badge variant="secondary">Pending</Badge>
    }
  }

  const isCheckedIn = todayAttendance?.checkIn && !todayAttendance?.checkOut

  if (!currentEmployee) {
    return <div>Employee not found</div>
  }

  return (
    <>
      {/* Page Title */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">My Portal</h1>
          <p className="text-sm text-muted-foreground">
            Welcome back, {currentEmployee.name.split(" ")[0]}! Manage your attendance and leave requests.
          </p>
        </div>
        <Button onClick={() => setLeaveDialogOpen(true)} className="gap-2">
          <CalendarPlus className="size-4" />
          Request Leave
        </Button>
      </div>

      {/* Employee Info Card */}
      <Card className="border-border/50">
        <CardContent className="p-6">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <div className="relative group cursor-pointer" onClick={() => !avatarUploading && fileInputRef.current?.click()}>
                <Avatar className="size-16 border-2 border-primary/20">
                  <AvatarImage src={avatarUrl ?? currentEmployee.avatar} alt={currentEmployee.name} />
                  <AvatarFallback className="bg-primary/10 text-primary text-lg font-semibold">
                    {currentEmployee.initials}
                  </AvatarFallback>
                </Avatar>
                <div className="absolute inset-0 rounded-full bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  {avatarUploading
                    ? <div className="size-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                    : <Camera className="size-4 text-white" />
                  }
                </div>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleAvatarChange}
              />
              <div>
                <h2 className="text-xl font-semibold text-foreground">{currentEmployee.name}</h2>
                <p className="text-sm text-muted-foreground">{currentEmployee.role}</p>
                <p className="text-xs text-muted-foreground">{currentEmployee.department}</p>
              </div>
            </div>
            
            {/* Punch In/Out Section */}
            <div className="flex flex-col items-center gap-3 rounded-xl bg-muted/50 p-6">
              <div className="text-center">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Today</p>
                <p className="text-2xl font-bold text-foreground">
                  {new Date().toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
                </p>
              </div>
              
              {!todayAttendance?.checkIn ? (
                <Button onClick={handleCheckIn} size="lg" className="w-full gap-2">
                  <LogIn className="size-4" />
                  Punch In
                </Button>
              ) : isCheckedIn ? (
                <div className="w-full space-y-2">
                  <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                    <Clock className="size-4 text-emerald-500" />
                    <span>Checked in at {to12h(todayAttendance.checkIn)}</span>
                  </div>
                  <Button onClick={handleCheckOut} size="lg" variant="outline" className="w-full gap-2">
                    <LogOut className="size-4" />
                    Punch Out
                  </Button>
                </div>
              ) : (
                <div className="w-full space-y-2 text-center">
                  <div className="flex items-center justify-center gap-4 text-sm">
                    <span className="text-muted-foreground">In: <span className="text-foreground font-medium">{to12h(todayAttendance.checkIn)}</span></span>
                    <span className="text-muted-foreground">Out: <span className="text-foreground font-medium">{to12h(todayAttendance.checkOut)}</span></span>
                  </div>
                  <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-600">
                    <CheckCircle2 className="size-3 mr-1" />
                    Completed - {todayAttendance.workHours}h
                  </Badge>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats Grid */}
      <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
        <Card className="border-border/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10">
                <Briefcase className="size-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{presentDays}</p>
                <p className="text-xs text-muted-foreground">Days Present (This Month)</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-lg bg-emerald-500/10">
                <Timer className="size-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{totalWorkHours.toFixed(1)}h</p>
                <p className="text-xs text-muted-foreground">Total Hours Worked</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-lg bg-amber-500/10">
                <TrendingUp className="size-5 text-amber-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{totalOvertime.toFixed(1)}h</p>
                <p className="text-xs text-muted-foreground">Overtime Hours</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-lg bg-blue-500/10">
                <HourglassIcon className="size-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{pendingRequests.length}</p>
                <p className="text-xs text-muted-foreground">Pending Requests</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Leave Balance */}
        <Card className="border-border/50 lg:col-span-1">
          <CardHeader className="pb-4">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Calendar className="size-4" />
              Leave Balance
            </CardTitle>
            <CardDescription>Your remaining leave days for this year</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Casual Leave</span>
                <span className="font-medium">{leaveBalance.casualLeave.total - leaveBalance.casualLeave.used} / {leaveBalance.casualLeave.total}</span>
              </div>
              <Progress value={((leaveBalance.casualLeave.total - leaveBalance.casualLeave.used) / leaveBalance.casualLeave.total) * 100} className="h-2" />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Privilege Leave</span>
                <span className="font-medium">{leaveBalance.privilegeLeave.total - leaveBalance.privilegeLeave.used} / {leaveBalance.privilegeLeave.total}</span>
              </div>
              <Progress value={((leaveBalance.privilegeLeave.total - leaveBalance.privilegeLeave.used) / leaveBalance.privilegeLeave.total) * 100} className="h-2" />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Sick Leave</span>
                <span className="font-medium">{leaveBalance.sickLeave.total - leaveBalance.sickLeave.used} / {leaveBalance.sickLeave.total}</span>
              </div>
              <Progress value={((leaveBalance.sickLeave.total - leaveBalance.sickLeave.used) / leaveBalance.sickLeave.total) * 100} className="h-2" />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Work From Home</span>
                <span className="font-medium">{leaveBalance.workFromHome.total - leaveBalance.workFromHome.used} / {leaveBalance.workFromHome.total}</span>
              </div>
              <Progress value={((leaveBalance.workFromHome.total - leaveBalance.workFromHome.used) / leaveBalance.workFromHome.total) * 100} className="h-2" />
              <p className="text-xs text-muted-foreground">6 days allowed per 3-month period</p>
            </div>
          </CardContent>
        </Card>

        {/* Leave Requests */}
        <Card className="border-border/50 lg:col-span-2">
          <CardHeader className="pb-4">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <CalendarDays className="size-4" />
              My Leave Requests
            </CardTitle>
            <CardDescription>Track your leave request status</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="all" className="w-full">
              <TabsList className="grid w-full grid-cols-4 mb-4">
                <TabsTrigger value="all">All ({myLeaveRequests.length})</TabsTrigger>
                <TabsTrigger value="pending">Pending ({pendingRequests.length})</TabsTrigger>
                <TabsTrigger value="approved">Approved ({approvedRequests.length})</TabsTrigger>
                <TabsTrigger value="rejected">Rejected ({rejectedRequests.length})</TabsTrigger>
              </TabsList>

              <TabsContent value="all" className="space-y-3">
                {myLeaveRequests.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <CalendarDays className="size-10 mx-auto mb-2 opacity-50" />
                    <p>No leave requests yet</p>
                  </div>
                ) : (
                  myLeaveRequests.slice(0, 5).map((request) => (
                    <LeaveRequestItem key={request.id} request={request} getStatusBadge={getStatusBadge} />
                  ))
                )}
              </TabsContent>

              <TabsContent value="pending" className="space-y-3">
                {pendingRequests.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <HourglassIcon className="size-10 mx-auto mb-2 opacity-50" />
                    <p>No pending requests</p>
                  </div>
                ) : (
                  pendingRequests.map((request) => (
                    <LeaveRequestItem key={request.id} request={request} getStatusBadge={getStatusBadge} />
                  ))
                )}
              </TabsContent>

              <TabsContent value="approved" className="space-y-3">
                {approvedRequests.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <CheckCircle2 className="size-10 mx-auto mb-2 opacity-50" />
                    <p>No approved requests</p>
                  </div>
                ) : (
                  approvedRequests.map((request) => (
                    <LeaveRequestItem key={request.id} request={request} getStatusBadge={getStatusBadge} />
                  ))
                )}
              </TabsContent>

              <TabsContent value="rejected" className="space-y-3">
                {rejectedRequests.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <XCircle className="size-10 mx-auto mb-2 opacity-50" />
                    <p>No rejected requests</p>
                  </div>
                ) : (
                  rejectedRequests.map((request) => (
                    <LeaveRequestItem key={request.id} request={request} getStatusBadge={getStatusBadge} />
                  ))
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>

      {/* Camera Punch Dialog */}
      <CameraPunchDialog
        open={cameraOpen}
        onOpenChange={setCameraOpen}
        action={cameraAction}
        onConfirm={handleCameraConfirm}
      />

      {/* Leave Request Dialog */}
      <Dialog open={leaveDialogOpen} onOpenChange={setLeaveDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Request Leave</DialogTitle>
            <DialogDescription>
              Submit a new leave request. Your manager will be notified.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmitLeave}>
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="leaveType">Leave Type</Label>
                <Select value={leaveType} onValueChange={(v: LeaveType) => setLeaveType(v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select leave type" />
                  </SelectTrigger>
                  <SelectContent>
                    {leaveTypes.map((type) => (
                      <SelectItem key={type} value={type}>
                        {type}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Start Date</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !startDate && "text-muted-foreground"
                        )}
                      >
                        <Calendar className="mr-2 size-4" />
                        {startDate ? formatDate(startDate) : "Pick date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <CalendarComponent
                        mode="single"
                        selected={startDate}
                        onSelect={setStartDate}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="space-y-2">
                  <Label>End Date</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !endDate && "text-muted-foreground"
                        )}
                      >
                        <Calendar className="mr-2 size-4" />
                        {endDate ? formatDate(endDate) : "Pick date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <CalendarComponent
                        mode="single"
                        selected={endDate}
                        onSelect={setEndDate}
                        disabled={(date) => startDate ? date < startDate : false}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>

              {startDate && endDate && (
                <p className="text-sm text-muted-foreground">
                  Duration: {calculateDays()} day{calculateDays() > 1 ? "s" : ""}
                </p>
              )}

              <div className="space-y-2">
                <Label htmlFor="reason">Reason</Label>
                <Textarea
                  id="reason"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Please provide a reason for your leave request..."
                  rows={3}
                  required
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setLeaveDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={!startDate || !endDate || !reason}>
                Submit Request
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}

function LeaveRequestItem({ 
  request, 
  getStatusBadge 
}: { 
  request: any
  getStatusBadge: (status: string) => React.ReactNode 
}) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-border/50 p-3 hover:bg-muted/30 transition-colors">
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <span className="font-medium text-sm">{request.type}</span>
          {getStatusBadge(request.status)}
        </div>
        <p className="text-xs text-muted-foreground">
          {request.startDate} - {request.endDate} ({request.days} day{request.days > 1 ? "s" : ""})
        </p>
        <p className="text-xs text-muted-foreground line-clamp-1">{request.reason}</p>
      </div>
    </div>
  )
}

export default function MyPortalPage() {
  return (
    <DashboardLayout>
      <MyPortalContent />
    </DashboardLayout>
  )
}
