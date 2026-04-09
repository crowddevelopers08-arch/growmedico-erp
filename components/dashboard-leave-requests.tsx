"use client"

import { Check, X } from "lucide-react"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle, CardAction } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { useSession } from "next-auth/react"
import { useHR } from "@/lib/hr-context"
import type { LeaveType } from "@/lib/types"

const getLeaveTypeBadge = (type: LeaveType) => {
  switch (type) {
    case "Casual Leave":
      return <Badge variant="secondary" className="bg-chart-1/10 text-chart-1 border-0">Casual Leave</Badge>
    case "Privilege Leave":
      return <Badge variant="secondary" className="bg-chart-5/10 text-chart-5 border-0">Privilege Leave</Badge>
    case "Sick Leave":
      return <Badge variant="secondary" className="bg-destructive/10 text-destructive border-0">Sick Leave</Badge>
    case "Work From Home":
      return <Badge variant="secondary" className="bg-chart-2/10 text-chart-2 border-0">Work From Home</Badge>
    default:
      return <Badge variant="secondary">{type}</Badge>
  }
}

const formatDateRange = (start: string, end: string) => {
  const startDate = new Date(start)
  const endDate = new Date(end)
  const startStr = startDate.toLocaleDateString("en-US", { month: "short", day: "numeric" })
  const endStr = endDate.toLocaleDateString("en-US", { month: "short", day: "numeric" })
  return startDate.getTime() === endDate.getTime() ? startStr : `${startStr} - ${endStr}`
}

export function DashboardLeaveRequests() {
  const { getPendingLeaveRequests, getEmployee, updateLeaveStatus } = useHR()
  const { data: session } = useSession()
  const pendingRequests = getPendingLeaveRequests().slice(0, 3)

  const handleApprove = (id: string) => {
    updateLeaveStatus(id, "approved", session?.user?.id)
  }

  const handleReject = (id: string) => {
    updateLeaveStatus(id, "rejected", undefined, "Rejected by admin")
  }

  return (
    <Card className="border-border/50">
      <CardHeader className="pb-4">
        <CardTitle className="text-base font-semibold">Pending Leave Requests</CardTitle>
        <CardAction>
          <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground" asChild>
            <Link href="/leaves">View All</Link>
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className="p-0">
        {pendingRequests.length === 0 ? (
          <div className="px-6 py-8 text-center text-sm text-muted-foreground">
            No pending leave requests
          </div>
        ) : (
          <div className="divide-y divide-border">
            {pendingRequests.map((request) => {
              const employee = getEmployee(request.employeeId)
              if (!employee) return null
              
              return (
                <div
                  key={request.id}
                  className="flex items-start gap-4 px-6 py-4 hover:bg-muted/30 transition-colors"
                >
                  <Avatar className="size-10 ring-2 ring-background mt-0.5">
                    <AvatarImage src={employee.avatar} alt={employee.name} />
                    <AvatarFallback className="bg-primary/10 text-primary text-xs font-medium">
                      {employee.initials}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-medium text-foreground">{employee.name}</p>
                      <span className="text-xs text-muted-foreground">- {employee.department}</span>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      {getLeaveTypeBadge(request.type)}
                      <span className="text-xs text-muted-foreground">
                        {formatDateRange(request.startDate, request.endDate)} - {request.days} day{request.days > 1 ? "s" : ""}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-1">{request.reason}</p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="size-8 text-muted-foreground hover:text-success hover:bg-success/10"
                      onClick={() => handleApprove(request.id)}
                    >
                      <Check className="size-4" />
                      <span className="sr-only">Approve</span>
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="size-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                      onClick={() => handleReject(request.id)}
                    >
                      <X className="size-4" />
                      <span className="sr-only">Reject</span>
                    </Button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
