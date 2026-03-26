"use client"

import type { ReactNode } from "react"
import { useSession } from "next-auth/react"
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/app-sidebar"
import { DashboardHeader } from "@/components/dashboard-header"
import { HRProvider } from "@/lib/hr-context"
import { useHR } from "@/lib/hr-context"
import { LoadingScreen } from "@/components/loading-screen"

function DashboardContent({ children }: { children: ReactNode }) {
  const { isLoading } = useHR()

  if (isLoading) return <LoadingScreen />

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <DashboardHeader />
        <main className="flex-1 overflow-auto">
          <div className="p-6 space-y-6">
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
