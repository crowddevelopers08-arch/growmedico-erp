"use client"

import {
  LayoutDashboard,
  Hash,
  Users,
  Clock,
  CalendarDays,
  DollarSign,
  Settings,
  LogOut,
  ChevronDown,
  UserCircle,
  ClipboardList,
  MessageSquare,
  FolderKanban,
  Bell,
  Network,
} from "lucide-react"
import Image from "next/image"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useSession, signOut } from "next-auth/react"
import { useEffect, useRef, useState } from "react"

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
} from "@/components/ui/sidebar"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useNotifications } from "@/lib/notification-context"

const adminNavItems = [
  { title: "Dashboard", href: "/", icon: LayoutDashboard },
  { title: "My Portal", href: "/my-portal", icon: UserCircle },
  { title: "Notifications", href: "/notifications", icon: Bell },
  { title: "Employees", href: "/employees", icon: Users },
  { title: "Team Directory", href: "/team", icon: Network },
  { title: "Attendance", href: "/attendance", icon: Clock },
  { title: "Leave Requests", href: "/leaves", icon: CalendarDays },
  { title: "Salary", href: "/salary", icon: DollarSign },
  { title: "Tasks", href: "/tasks", icon: ClipboardList },
  { title: "Projects", href: "/projects", icon: FolderKanban },
]

const employeeNavItems = [
  { title: "My Portal", href: "/my-portal", icon: UserCircle },
  { title: "Notifications", href: "/notifications", icon: Bell },
  { title: "Employees", href: "/employees", icon: Users },
  { title: "Team Directory", href: "/team", icon: Network },
  { title: "Attendance", href: "/attendance", icon: Clock },
  { title: "Leave Requests", href: "/leaves", icon: CalendarDays },
  { title: "Tasks", href: "/tasks", icon: ClipboardList },
  { title: "Projects", href: "/projects", icon: FolderKanban },
]

function UnreadBadge({ count }: { count: number }) {
  if (count <= 0) return null
  return (
    <span className="ml-auto grid min-w-5 place-items-center rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-semibold text-primary-foreground group-data-[collapsible=icon]:hidden">
      {count > 99 ? "99+" : count}
    </span>
  )
}

function NotifyDot({ count }: { count: number }) {
  if (count <= 0) return null
  return <span className="ml-auto size-2 shrink-0 rounded-full bg-primary group-data-[collapsible=icon]:hidden" />
}

export function AppSidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const { data: session } = useSession()
  const { unreadCount: notificationsUnread } = useNotifications()
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const [channelsUnread, setChannelsUnread] = useState(0)
  const [chatUnread, setChatUnread] = useState(0)
  const [assignedCount, setAssignedCount] = useState(0)

  const isAdmin = session?.user?.role === "ADMIN"
  const roleLabel = isAdmin ? "Admin" : session?.user?.role === "MANAGER" ? "Manager" : "Employee"
  const navItems = isAdmin ? adminNavItems : employeeNavItems
  const userEmail = session?.user?.email ?? ""
  // Employees carry a real name; name-less logins (e.g. a bootstrap admin with
  // no employee profile) fall back to their email — turn that into a readable
  // name from the local part rather than showing the full address.
  const rawName = session?.user?.name ?? ""
  const userName =
    rawName && rawName !== userEmail
      ? rawName
      : (userEmail.split("@")[0] || "User").replace(/[._-]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
  const userInitials = session?.user?.initials ?? userName.slice(0, 2).toUpperCase()
  const userAvatar = session?.user?.image ?? undefined

  useEffect(() => {
    if (!session) return

    const fetchUnread = async () => {
      try {
        const res = await fetch("/api/channels")
        if (!res.ok) return
        const channels: { kind: string; unreadCount?: number }[] = await res.json()
        const groupUnread = channels
          .filter((ch) => ch.kind === "group")
          .reduce((sum, ch) => sum + (ch.unreadCount ?? 0), 0)
        const dmUnread = channels
          .filter((ch) => ch.kind === "direct" || ch.kind === "group_dm")
          .reduce((sum, ch) => sum + (ch.unreadCount ?? 0), 0)
        setChannelsUnread(groupUnread)
        setChatUnread(dmUnread)
      } catch {
        // silently ignore
      }
    }

    const fetchTaskCounts = async () => {
      const employeeId = session.user?.employeeId
      if (!employeeId) return
      try {
        const res = await fetch("/api/tasks")
        if (!res.ok) return
        const tasks: { assignedToId: string; status: string }[] = await res.json()
        const isActive = (status: string) => status === "pending" || status === "in_progress"
        setAssignedCount(tasks.filter((task) => task.assignedToId === employeeId && isActive(task.status)).length)
      } catch {
        // silently ignore
      }
    }

    const fetchAll = () => { void fetchUnread(); void fetchTaskCounts() }
    fetchAll()
    pollRef.current = setInterval(fetchAll, 5000)
    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [session])

  // Clear badge when user is on the page
  useEffect(() => {
    if (pathname === "/channels") setChannelsUnread(0)
    if (pathname === "/chat") setChatUnread(0)
  }, [pathname])

  const handleSignOut = async () => {
    await signOut({ redirect: false })
    router.push("/login")
  }

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border">
      <SidebarHeader className="p-3">
        <div className="flex items-center justify-center">
          <Image
            src="/gm-fav-icon.png"
            alt="GM"
            width={32}
            height={32}
            className="rounded-md hidden group-data-[collapsible=icon]:block shrink-0"
          />
          <Image
            src="/gmlogo1.png"
            alt="Grow Medico"
            width={148}
            height={50}
            className="rounded-lg group-data-[collapsible=icon]:hidden"
            priority
          />
        </div>
      </SidebarHeader>

      <SidebarSeparator />

      <SidebarContent className="px-2">
        <SidebarGroup>
          <SidebarGroupLabel className="px-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Main
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton
                    asChild
                    isActive={pathname === item.href}
                    tooltip={item.title}
                    className="h-9 rounded-lg transition-colors group"
                  >
                    <Link href={item.href}>
                      <item.icon className="size-4 shrink-0" />
                      <span>{item.title}</span>
                      {item.href === "/tasks" && <NotifyDot count={assignedCount} />}
                      {item.href === "/notifications" && <UnreadBadge count={notificationsUnread} />}
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel className="px-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Channels
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={pathname === "/channels"}
                  tooltip="Channels"
                  className="h-9 rounded-lg transition-colors group"
                >
                  <Link href="/channels">
                    <Hash className="size-4 shrink-0" />
                    <span>Channels</span>
                    <UnreadBadge count={channelsUnread} />
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={pathname === "/chat"}
                  tooltip="Private Chat"
                  className="h-9 rounded-lg transition-colors group"
                >
                  <Link href="/chat">
                    <MessageSquare className="size-4 shrink-0" />
                    <span>Private Chat</span>
                    <UnreadBadge count={chatUnread} />
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {isAdmin && (
          <SidebarGroup>
            <SidebarGroupLabel className="px-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
              System
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    asChild
                    isActive={pathname === "/settings"}
                    tooltip="Settings"
                    className="h-9 rounded-lg transition-colors"
                  >
                    <Link href="/settings">
                      <Settings className="size-4" />
                      <span>Settings</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      <SidebarFooter className="p-2">
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton
                  size="lg"
                  className="h-12 rounded-lg data-[state=open]:bg-sidebar-accent"
                >
                  <Avatar className="size-8">
                    <AvatarImage src={userAvatar} alt={userName} />
                    <AvatarFallback className="bg-primary/10 text-primary text-xs font-medium">
                      {userInitials}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex flex-col items-start text-left group-data-[collapsible=icon]:hidden">
                    <span className="text-sm font-medium text-white">{userName}</span>
                    <span className="text-xs text-white/70">{roleLabel}</span>
                  </div>
                  <ChevronDown className="ml-auto size-4 text-white/70 group-data-[collapsible=icon]:hidden" />
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent side="top" align="start" className="w-56">
                <div className="flex items-center gap-3 p-2">
                  <Avatar className="size-10">
                    <AvatarImage src={userAvatar} alt={userName} />
                    <AvatarFallback className="bg-primary/10 text-primary">{userInitials}</AvatarFallback>
                  </Avatar>
                  <div className="flex flex-col">
                    <span className="text-sm font-medium">{userName}</span>
                    <span className="text-xs text-muted-foreground">{userEmail}</span>
                  </div>
                </div>
                <DropdownMenuSeparator />
                {isAdmin && (
                  <DropdownMenuItem asChild>
                    <Link href="/settings">
                      <Settings className="mr-2 size-4" />
                      Account Settings
                    </Link>
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem asChild>
                  <Link href="/my-portal">
                    <UserCircle className="mr-2 size-4" />
                    My Portal
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive cursor-pointer"
                  onClick={handleSignOut}
                >
                  <LogOut className="mr-2 size-4" />
                  Sign Out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  )
}
