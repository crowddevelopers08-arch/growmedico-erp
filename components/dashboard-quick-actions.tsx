"use client"

import { useState } from "react"
import { UserPlus, CalendarPlus, Clock, FileText } from "lucide-react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { EmployeeDialog } from "@/components/employee-dialog"
import { LeaveRequestDialog } from "@/components/leave-request-dialog"

export function DashboardQuickActions() {
  const router = useRouter()
  const [employeeDialogOpen, setEmployeeDialogOpen] = useState(false)
  const [leaveDialogOpen, setLeaveDialogOpen] = useState(false)

  const quickActions = [
    {
      title: "Add Employee",
      icon: UserPlus,
      description: "Onboard new team member",
      action: () => setEmployeeDialogOpen(true),
    },
    {
      title: "Request Leave",
      icon: CalendarPlus,
      description: "Submit leave request",
      action: () => setLeaveDialogOpen(true),
    },
    {
      title: "View Attendance",
      icon: Clock,
      description: "Check today's records",
      action: () => router.push("/attendance"),
    },
    {
      title: "Process Payroll",
      icon: FileText,
      description: "Manage salaries",
      action: () => router.push("/salary"),
    },
  ]

  return (
    <>
      <Card className="border-border/50">
        <CardHeader className="pb-4">
          <CardTitle className="text-base font-semibold">Quick Actions</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-3">
          {quickActions.map((action) => (
            <Button
              key={action.title}
              variant="outline"
              className="h-auto flex-col items-start gap-2 p-4 text-left hover:bg-muted/50"
              onClick={action.action}
            >
              <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <action.icon className="size-4" />
              </div>
              <div>
                <p className="text-sm font-medium">{action.title}</p>
                <p className="text-xs text-muted-foreground">{action.description}</p>
              </div>
            </Button>
          ))}
        </CardContent>
      </Card>

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
