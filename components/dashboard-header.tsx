"use client"

import { Bell, Search, Plus } from "lucide-react"
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

export function DashboardHeader() {
  const { leaveRequests, employees } = useHR()

  const pendingLeaves = leaveRequests
    .filter((r) => r.status === "pending")
    .slice(0, 5)

  return (
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
        <Button variant="outline" size="sm" className="hidden sm:flex gap-2 h-9">
          <Plus className="size-4" />
          Quick Action
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="relative size-9">
              <Bell className="size-4 text-muted-foreground" />
              {pendingLeaves.length > 0 && (
                <span className="absolute top-1.5 right-1.5 size-2 rounded-full bg-chart-1" />
              )}
              <span className="sr-only">Notifications</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-80">
            <DropdownMenuLabel className="flex items-center justify-between">
              Notifications
              {pendingLeaves.length > 0 && (
                <Badge variant="secondary" className="text-xs">{pendingLeaves.length} pending</Badge>
              )}
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            {pendingLeaves.length === 0 ? (
              <DropdownMenuItem className="text-center justify-center text-sm text-muted-foreground py-4">
                No pending notifications
              </DropdownMenuItem>
            ) : (
              pendingLeaves.map((req) => {
                const employee = employees.find((e) => e.id === req.employeeId)
                return (
                  <DropdownMenuItem
                    key={req.id}
                    className="flex flex-col items-start gap-1 p-3 cursor-pointer"
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
              })
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-center justify-center text-sm text-muted-foreground">
              View all notifications
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
