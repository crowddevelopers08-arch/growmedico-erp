"use client"

import { useState } from "react"
import { Bell, Search, Plus, UserPlus, UserCircle, CalendarPlus, Clock, FileText, CheckCheck } from "lucide-react"
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
import { EmployeeDialog } from "@/components/employee-dialog"
import { LeaveRequestDialog } from "@/components/leave-request-dialog"
import { useNotifications } from "@/lib/notification-context"
import { PushToggle } from "@/components/push-toggle"
import { NotificationCard } from "@/components/notifications/notification-card"
import { UnreadBadge } from "@/components/notifications/unread-badge"
import { cn } from "@/lib/utils"

export function DashboardHeader() {
  const router = useRouter()
  const { data: session } = useSession()
  const { notifications, unreadCount, markAllRead, markRead } = useNotifications()
  const [employeeDialogOpen, setEmployeeDialogOpen] = useState(false)
  const [leaveDialogOpen, setLeaveDialogOpen] = useState(false)

  const isAdmin = session?.user?.role === "ADMIN"
  const recent = notifications.slice(0, 8)

  const handleOpen = (n: (typeof notifications)[number]) => {
    if (!n.read) markRead(n.id)
    if (n.link) router.push(n.link)
  }

  const adminQuickActions = [
    { title: "Add Employee", icon: UserPlus, action: () => setEmployeeDialogOpen(true) },
    { title: "Request Leave", icon: CalendarPlus, action: () => setLeaveDialogOpen(true) },
    { title: "View Attendance", icon: Clock, action: () => router.push("/attendance") },
    { title: "Process Payroll", icon: FileText, action: () => router.push("/salary") },
    { title: "My Portal", icon: UserCircle, action: () => router.push("/my-portal") },
  ]

  const employeeQuickActions = [
    { title: "Request Leave", icon: CalendarPlus, action: () => setLeaveDialogOpen(true) },
    { title: "View Attendance", icon: Clock, action: () => router.push("/attendance") },
    { title: "My Portal", icon: UserCircle, action: () => router.push("/my-portal") },
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
                <UnreadBadge count={unreadCount} className="absolute -top-0.5 -right-0.5" />
                <span className="sr-only">Notifications</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-96 p-0">
              <div className="flex items-center justify-between px-3 py-2.5">
                <span className="text-sm font-semibold">Notifications</span>
                <div className="flex items-center gap-2">
                  {unreadCount > 0 && (
                    <Badge variant="secondary" className="">
                      {unreadCount} new
                    </Badge>
                  )}
                  {unreadCount > 0 && (
                    <button
                      className="flex items-center gap-1 text-tiny text-muted-foreground hover:text-foreground transition-colors"
                      onClick={markAllRead}
                    >
                      <CheckCheck className="size-3" />
                      Mark all read
                    </button>
                  )}
                </div>
              </div>
              <DropdownMenuSeparator className="my-0" />

              <PushToggle variant="banner" />

              <div className="max-h-[22rem] overflow-y-auto">
                {recent.length === 0 && (
                  <div className="py-10 text-center text-sm text-muted-foreground">
                    You&apos;re all caught up
                  </div>
                )}

                {recent.map((notif) => (
                  <NotificationCard
                    key={notif.id}
                    notification={notif}
                    variant="compact"
                    onOpen={handleOpen}
                  />
                ))}
              </div>

              <DropdownMenuSeparator className="my-0" />
              <DropdownMenuItem
                className="cursor-pointer justify-center py-2.5 text-sm font-medium text-primary"
                onClick={() => router.push("/notifications")}
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
