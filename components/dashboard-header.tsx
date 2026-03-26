"use client"

import { useState, useEffect, useCallback } from "react"
import { Bell, Search, Plus, UserPlus, CalendarPlus, Clock, FileText, AtSign } from "lucide-react"
import { useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { SidebarTrigger } from "@/components/ui/sidebar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Badge } from "@/components/ui/badge"
import { useHR } from "@/lib/hr-context"
import { EmployeeDialog } from "@/components/employee-dialog"
import { LeaveRequestDialog } from "@/components/leave-request-dialog"

export function DashboardHeader() {
  const router = useRouter()
  const { data: session } = useSession()
  const { leaveRequests, employees } = useHR()
  const [employeeDialogOpen, setEmployeeDialogOpen] = useState(false)
  const [leaveDialogOpen, setLeaveDialogOpen] = useState(false)
  const [mentionNotifs, setMentionNotifs] = useState<any[]>([])

  const isAdmin = session?.user?.role === "ADMIN"

  const pendingLeaves = leaveRequests
    .filter((r) => r.status === "pending")
    .slice(0, 5)

  const loadMentionNotifs = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications")
      if (!res.ok) return
      const all: any[] = await res.json()
      setMentionNotifs(all.filter((n) => n.type === "mention" && !n.read))
    } catch {}
  }, [])

  useEffect(() => {
    if (!session) return
    loadMentionNotifs()
    const handler = () => loadMentionNotifs()
    window.addEventListener("focus", handler)
    return () => window.removeEventListener("focus", handler)
  }, [session, loadMentionNotifs])

  const handleMarkAllRead = async () => {
    await fetch("/api/notifications", { method: "PATCH" })
    setMentionNotifs([])
  }

  const adminQuickActions = [
    { title: "Add Employee", icon: UserPlus, action: () => setEmployeeDialogOpen(true) },
    { title: "Request Leave", icon: CalendarPlus, action: () => setLeaveDialogOpen(true) },
    { title: "View Attendance", icon: Clock, action: () => router.push("/attendance") },
    { title: "Process Payroll", icon: FileText, action: () => router.push("/salary") },
  ]

  const employeeQuickActions = [
    { title: "Request Leave", icon: CalendarPlus, action: () => setLeaveDialogOpen(true) },
    { title: "View Attendance", icon: Clock, action: () => router.push("/attendance") },
    { title: "My Portal", icon: UserPlus, action: () => router.push("/my-portal") },
  ]

  const quickActions = isAdmin ? adminQuickActions : employeeQuickActions

  return (
    <>
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-border bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/60 px-4">
        <div className="flex items-center gap-4">
          <SidebarTrigger className="text-muted-foreground hover:text-foreground transition-colors" />
          <div className="relative hidden md:block">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              placeholder="Search employees, requests..."
              className="w-72 pl-9 h-9 bg-muted/50 border-transparent focus:border-border focus:bg-background transition-all"
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="hidden sm:flex gap-2 h-9">
                <Plus className="size-4" />
                Quick Action
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuLabel>Quick Actions</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {quickActions.map((action) => (
                <DropdownMenuItem
                  key={action.title}
                  className="gap-2 cursor-pointer"
                  onClick={action.action}
                >
                  <action.icon className="size-4 text-muted-foreground" />
                  {action.title}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="relative size-9">
                <Bell className="size-4 text-muted-foreground" />
                {(pendingLeaves.length > 0 || mentionNotifs.length > 0) && (
                  <span className="absolute top-1.5 right-1.5 size-2 rounded-full bg-chart-1" />
                )}
                <span className="sr-only">Notifications</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-80">
              <DropdownMenuLabel className="flex items-center justify-between">
                Notifications
                <div className="flex items-center gap-1.5">
                  {(pendingLeaves.length > 0 || mentionNotifs.length > 0) && (
                    <Badge variant="secondary" className="text-xs">
                      {pendingLeaves.length + mentionNotifs.length} new
                    </Badge>
                  )}
                  {mentionNotifs.length > 0 && (
                    <button
                      className="text-[10px] text-muted-foreground hover:text-foreground underline"
                      onClick={handleMarkAllRead}
                    >
                      Mark all read
                    </button>
                  )}
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />

              {/* Mention notifications first */}
              {mentionNotifs.map((notif) => (
                <DropdownMenuItem
                  key={notif.id}
                  className="flex flex-col items-start gap-1 p-3 cursor-pointer"
                  onClick={() => { if (notif.link) router.push(notif.link) }}
                >
                  <div className="flex items-center gap-2">
                    <AtSign className="size-3.5 text-primary shrink-0" />
                    <span className="font-medium text-sm">{notif.title}</span>
                  </div>
                  <p className="text-xs text-muted-foreground pl-5 line-clamp-2">{notif.message}</p>
                </DropdownMenuItem>
              ))}

              {/* Leave notifications */}
              {pendingLeaves.map((req) => {
                const employee = employees.find((e) => e.id === req.employeeId)
                return (
                  <DropdownMenuItem
                    key={req.id}
                    className="flex flex-col items-start gap-1 p-3 cursor-pointer"
                    onClick={() => router.push("/leaves")}
                  >
                    <div className="flex items-center gap-2">
                      <div className="size-2 rounded-full bg-chart-1" />
                      <span className="font-medium text-sm">Leave Request</span>
                    </div>
                    <p className="text-xs text-muted-foreground pl-4">
                      {employee?.name ?? "Unknown"} requested {req.days} day{req.days > 1 ? "s" : ""} {req.type.toLowerCase()}
                    </p>
                    <span className="text-xs text-muted-foreground pl-4">
                      Applied {req.appliedOn}
                    </span>
                  </DropdownMenuItem>
                )
              })}

              {pendingLeaves.length === 0 && mentionNotifs.length === 0 && (
                <DropdownMenuItem className="text-center justify-center text-sm text-muted-foreground py-4">
                  No pending notifications
                </DropdownMenuItem>
              )}

              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-center justify-center text-sm text-muted-foreground cursor-pointer"
                onClick={() => router.push("/leaves")}
              >
                View all notifications
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      <EmployeeDialog
        open={employeeDialogOpen}
        onOpenChange={setEmployeeDialogOpen}
        mode="add"
      />
      <LeaveRequestDialog
        open={leaveDialogOpen}
        onOpenChange={setLeaveDialogOpen}
      />
    </>
  )
}
