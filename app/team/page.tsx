"use client"

import { useEffect, useMemo, useState } from "react"
import { Search, ShieldCheck, UserCog, Users, Mail, Building2, Network } from "lucide-react"
import { DashboardLayout } from "@/components/dashboard-layout"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import type { AccountRole } from "@/lib/types"

interface TeamMember {
  userId: string
  employeeId: string | null
  name: string
  email: string
  avatar: string | null
  initials: string
  department: string | null
  jobRole: string | null
  accountRole: AccountRole
  status: string | null
}

const roleConfig: Record<
  AccountRole,
  { label: string; plural: string; icon: typeof Users; accent: string; chip: string; dot: string }
> = {
  ADMIN: {
    label: "Admin",
    plural: "Admins",
    icon: ShieldCheck,
    accent: "text-primary",
    chip: "bg-primary/10 text-primary border-primary/20",
    dot: "bg-primary",
  },
  MANAGER: {
    label: "Manager",
    plural: "Managers",
    icon: UserCog,
    accent: "text-info",
    chip: "bg-info/10 text-info border-info/20",
    dot: "bg-info",
  },
  EMPLOYEE: {
    label: "Employee",
    plural: "Employees",
    icon: Users,
    accent: "text-foreground",
    chip: "bg-muted text-muted-foreground border-border",
    dot: "bg-muted-foreground",
  },
}

const roleOrder: AccountRole[] = ["ADMIN", "MANAGER", "EMPLOYEE"]

function StatusBadge({ status }: { status: string | null }) {
  switch (status) {
    case "present":
      return <Badge variant="outline" className="text-success border-success/30 bg-success/10">Present</Badge>
    case "onLeave":
      return <Badge variant="outline" className="text-warning border-warning/30 bg-warning/10">On Leave</Badge>
    case "remote":
      return <Badge variant="outline" className="text-chart-1 border-chart-1/30 bg-chart-1/10">Remote</Badge>
    case "absent":
      return <Badge variant="outline" className="text-destructive border-destructive/30 bg-destructive/10">Absent</Badge>
    default:
      return null
  }
}

function MemberCard({ member }: { member: TeamMember }) {
  const cfg = roleConfig[member.accountRole]
  return (
    <Card className="border-border/50 transition-colors hover:border-border hover:bg-muted/30">
      <CardContent className="flex items-start gap-3 p-4">
        <Avatar className="size-11 ring-2 ring-background">
          <AvatarImage src={member.avatar ?? undefined} alt={member.name} />
          <AvatarFallback className="bg-primary/10 text-primary text-sm font-medium">{member.initials}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex items-center gap-2">
            <p className="truncate text-sm font-medium text-foreground">{member.name}</p>
            <Badge variant="outline" className={`shrink-0 gap-1 text-[10px] ${cfg.chip}`}>
              <cfg.icon className="size-3" />
              {cfg.label}
            </Badge>
          </div>
          {(member.jobRole || member.department) && (
            <p className="flex items-center gap-1.5 truncate text-xs text-muted-foreground">
              <Building2 className="size-3 shrink-0" />
              <span className="truncate">
                {[member.jobRole, member.department].filter(Boolean).join(" · ")}
              </span>
            </p>
          )}
          <p className="flex items-center gap-1.5 truncate text-xs text-muted-foreground">
            <Mail className="size-3 shrink-0" />
            <span className="truncate">{member.email}</span>
          </p>
          {member.status && (
            <div className="pt-0.5">
              <StatusBadge status={member.status} />
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

function TeamPageContent() {
  const [members, setMembers] = useState<TeamMember[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState("")

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch("/api/team")
        if (res.ok) setMembers(await res.json())
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const counts = useMemo(() => {
    const base: Record<AccountRole, number> = { ADMIN: 0, MANAGER: 0, EMPLOYEE: 0 }
    for (const member of members) base[member.accountRole] = (base[member.accountRole] ?? 0) + 1
    return base
  }, [members])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return members
    return members.filter((member) =>
      [member.name, member.email, member.department ?? "", member.jobRole ?? ""]
        .some((field) => field.toLowerCase().includes(q))
    )
  }, [members, query])

  const grouped = useMemo(() => {
    const map: Record<AccountRole, TeamMember[]> = { ADMIN: [], MANAGER: [], EMPLOYEE: [] }
    for (const member of filtered) map[member.accountRole].push(member)
    for (const role of roleOrder) map[role].sort((a, b) => a.name.localeCompare(b.name))
    return map
  }, [filtered])

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
          <Network className="size-6 text-muted-foreground" />
          Team Directory
        </h1>
        <p className="text-sm text-muted-foreground">Everyone on the team, grouped by their account role.</p>
      </div>

      {/* Role summary */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        {roleOrder.map((role) => {
          const cfg = roleConfig[role]
          return (
            <Card key={role} className="border-border/50">
              <CardContent className="flex items-center gap-3 p-4">
                <div className={`flex size-10 items-center justify-center rounded-lg ${cfg.chip}`}>
                  <cfg.icon className="size-5" />
                </div>
                <div>
                  <p className="text-2xl font-semibold leading-none">{counts[role]}</p>
                  <p className="text-xs text-muted-foreground">{cfg.plural}</p>
                </div>
              </CardContent>
            </Card>
          )
        })}
        <Card className="border-border/50">
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex size-10 items-center justify-center rounded-lg bg-muted text-muted-foreground">
              <Users className="size-5" />
            </div>
            <div>
              <p className="text-2xl font-semibold leading-none">{members.length}</p>
              <p className="text-xs text-muted-foreground">Total People</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search by name, email, department..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Grouped members */}
      {loading ? (
        <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">Loading team...</div>
      ) : filtered.length === 0 ? (
        <div className="flex h-32 flex-col items-center justify-center gap-2 text-muted-foreground">
          <Users className="size-8 opacity-40" />
          <p className="text-sm">No people match your search.</p>
        </div>
      ) : (
        <div className="space-y-8">
          {roleOrder.map((role) => {
            const people = grouped[role]
            if (people.length === 0) return null
            const cfg = roleConfig[role]
            return (
              <section key={role} className="space-y-3">
                <div className="flex items-center gap-2">
                  <span className={`size-2 rounded-full ${cfg.dot}`} />
                  <h2 className={`text-sm font-semibold uppercase tracking-wider ${cfg.accent}`}>{cfg.plural}</h2>
                  <span className="grid min-w-5 place-items-center rounded-full bg-muted px-1.5 text-[10px] font-semibold text-muted-foreground">
                    {people.length}
                  </span>
                </div>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {people.map((member) => (
                    <MemberCard key={member.userId} member={member} />
                  ))}
                </div>
              </section>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default function TeamPage() {
  return (
    <DashboardLayout>
      <TeamPageContent />
    </DashboardLayout>
  )
}
