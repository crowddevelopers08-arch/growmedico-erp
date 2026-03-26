"use client"

import { useSession } from "next-auth/react"
import { DashboardLayout } from "@/components/dashboard-layout"
import { DashboardStats } from "@/components/dashboard-stats"
import { DashboardRecentActivity } from "@/components/dashboard-recent-activity"
import { DashboardLeaveRequests } from "@/components/dashboard-leave-requests"
import { DashboardEmployeeTable } from "@/components/dashboard-employee-table"
import { DashboardAttendanceChart } from "@/components/dashboard-attendance-chart"
import { DashboardQuickActions } from "@/components/dashboard-quick-actions"

function DashboardContent() {
  const { data: session } = useSession()
  const firstName = session?.user?.name?.split(" ")[0] ?? "there"

  return (
    <>
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          Welcome back, {firstName}. Here&apos;s what&apos;s happening today.
        </p>
      </div>

      <DashboardStats />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <DashboardAttendanceChart />
          <DashboardEmployeeTable />
        </div>
        <div className="space-y-6">
          <DashboardQuickActions />
          <DashboardLeaveRequests />
        </div>
      </div>

      <DashboardRecentActivity />
    </>
  )
}

export default function DashboardPage() {
  return (
    <DashboardLayout>
      <DashboardContent />
    </DashboardLayout>
  )
}
