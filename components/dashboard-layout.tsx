"use client"

import type { ReactNode } from "react"
import { useSession } from "next-auth/react"
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/app-sidebar"
import { DashboardHeader } from "@/components/dashboard-header"
import { HRProvider } from "@/lib/hr-context"
import { LoadingScreen } from "@/components/loading-screen"

// The layout shell stays mounted while HR data loads — pages render their own
// empty states instead of the whole screen being replaced by a loader on every
// navigation.
function DashboardContent({ children }: { children: ReactNode }) {
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <DashboardHeader />
        <main className="flex-1 overflow-auto">
          <div className="p-3 sm:p-6 space-y-4 sm:space-y-6">
            {children}
          </div>
        </main>
      </SidebarInset>
    </SidebarProvider>
  )
}

interface DashboardLayoutProps {
  children: ReactNode
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const { status } = useSession()

  if (status === "loading") return <LoadingScreen />

  return (
    <HRProvider>
      <DashboardContent>
        {children}
      </DashboardContent>
    </HRProvider>
  )
}
