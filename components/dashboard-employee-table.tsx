"use client"

import { MoreHorizontal } from "lucide-react"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle, CardAction } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useHR } from "@/lib/hr-context"

const getStatusBadge = (status: string) => {
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
      return <Badge variant="outline">Unknown</Badge>
  }
}

export function DashboardEmployeeTable() {
  const { employees } = useHR()
  const displayedEmployees = employees.slice(0, 5)

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    })
  }

  return (
    <Card className="border-border/50">
      <CardHeader className="pb-4">
        <CardTitle className="text-base font-semibold">Team Members</CardTitle>
        <CardAction>
          <Button variant="outline" size="sm" asChild>
            <Link href="/employees">View All</Link>
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="pl-6">Employee</TableHead>
              <TableHead>Department</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Join Date</TableHead>
              <TableHead className="w-12"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {displayedEmployees.map((employee) => (
              <TableRow key={employee.id} className="group">
                <TableCell className="pl-6">
                  <div className="flex items-center gap-3">
                    <Avatar className="size-9 ring-2 ring-background">
                      <AvatarImage src={employee.avatar} alt={employee.name} />
                      <AvatarFallback className="bg-primary/10 text-primary text-xs font-medium">
                        {employee.initials}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="text-sm font-medium text-foreground">{employee.name}</p>
                      <p className="text-xs text-muted-foreground">{employee.email}</p>
                    </div>
                  </div>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">{employee.department}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{employee.role}</TableCell>
                <TableCell>{getStatusBadge(employee.status)}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{formatDate(employee.joinDate)}</TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <MoreHorizontal className="size-4" />
                        <span className="sr-only">Actions</span>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem asChild>
                        <Link href="/employees">View Profile</Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <Link href="/attendance">View Attendance</Link>
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}
