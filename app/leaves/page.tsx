"use client"

import { useState, useMemo } from "react"
import { Plus, Search, Check, X, Clock, CalendarDays, Filter } from "lucide-react"
import { DashboardLayout } from "@/components/dashboard-layout"
import { Card, CardContent, CardHeader, CardTitle, CardAction } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
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
  DropdownMenuCheckboxItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Textarea } from "@/components/ui/textarea"
import { useSession } from "next-auth/react"
import { useHR } from "@/lib/hr-context"
import { LeaveRequestDialog } from "@/components/leave-request-dialog"
import type { LeaveRequest, LeaveStatus, LeaveType } from "@/lib/types"

const leaveTypes: LeaveType[] = ["Vacation", "Sick Leave", "WFH", "Personal", "Maternity", "Paternity"]

const getStatusBadge = (status: LeaveStatus) => {
  switch (status) {
    case "approved":
      return <Badge variant="outline" className="text-success border-success/30 bg-success/10">Approved</Badge>
    case "pending":
      return <Badge variant="outline" className="text-warning border-warning/30 bg-warning/10">Pending</Badge>
    case "rejected":
      return <Badge variant="outline" className="text-destructive border-destructive/30 bg-destructive/10">Rejected</Badge>
    default:
      return <Badge variant="outline">Unknown</Badge>
  }
}

const getLeaveTypeBadge = (type: LeaveType) => {
  switch (type) {
    case "Vacation":
      return <Badge variant="secondary" className="bg-chart-1/10 text-chart-1 border-0">Vacation</Badge>
    case "Sick Leave":
      return <Badge variant="secondary" className="bg-destructive/10 text-destructive border-0">Sick Leave</Badge>
    case "WFH":
      return <Badge variant="secondary" className="bg-chart-2/10 text-chart-2 border-0">WFH</Badge>
    case "Personal":
      return <Badge variant="secondary" className="bg-chart-5/10 text-chart-5 border-0">Personal</Badge>
    case "Maternity":
      return <Badge variant="secondary" className="bg-chart-3/10 text-chart-3 border-0">Maternity</Badge>
    case "Paternity":
      return <Badge variant="secondary" className="bg-chart-4/10 text-chart-4 border-0">Paternity</Badge>
    default:
      return <Badge variant="secondary">{type}</Badge>
  }
}

function LeavesPageContent() {
  const { leaveRequests, employees, updateLeaveStatus, getEmployee } = useHR()
  const { data: session } = useSession()
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedTypes, setSelectedTypes] = useState<LeaveType[]>([])
  const [activeTab, setActiveTab] = useState<LeaveStatus | "all">("all")
  const [dialogOpen, setDialogOpen] = useState(false)
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false)
  const [selectedRequest, setSelectedRequest] = useState<LeaveRequest | null>(null)
  const [rejectionReason, setRejectionReason] = useState("")

  const filteredRequests = useMemo(() => {
    let result = [...leaveRequests]
    
    // Filter by tab
    if (activeTab !== "all") {
      result = result.filter((r) => r.status === activeTab)
    }
    
    // Filter by search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      result = result.filter((r) => {
        const employee = getEmployee(r.employeeId)
        return (
          employee?.name.toLowerCase().includes(query) ||
          r.type.toLowerCase().includes(query) ||
          r.reason.toLowerCase().includes(query)
        )
      })
    }
    
    // Filter by leave type
    if (selectedTypes.length > 0) {
      result = result.filter((r) => selectedTypes.includes(r.type))
    }
    
    // Sort by date (newest first)
    result.sort((a, b) => new Date(b.appliedOn).getTime() - new Date(a.appliedOn).getTime())
    
    return result
  }, [leaveRequests, activeTab, searchQuery, selectedTypes, getEmployee])

  const stats = useMemo(() => ({
    total: leaveRequests.length,
    pending: leaveRequests.filter((r) => r.status === "pending").length,
    approved: leaveRequests.filter((r) => r.status === "approved").length,
    rejected: leaveRequests.filter((r) => r.status === "rejected").length,
  }), [leaveRequests])

  const handleApprove = (request: LeaveRequest) => {
    updateLeaveStatus(request.id, "approved", session?.user?.id)
  }

  const handleRejectClick = (request: LeaveRequest) => {
    setSelectedRequest(request)
    setRejectionReason("")
    setRejectDialogOpen(true)
  }

  const confirmReject = () => {
    if (selectedRequest && rejectionReason) {
      updateLeaveStatus(selectedRequest.id, "rejected", undefined, rejectionReason)
      setRejectDialogOpen(false)
      setSelectedRequest(null)
      setRejectionReason("")
    }
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    })
  }

  return (
    <>
      {/* Page Title */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Leave Requests</h1>
          <p className="text-sm text-muted-foreground">
            Manage and approve employee leave requests.
          </p>
        </div>
        <Button onClick={() => setDialogOpen(true)} className="sm:shrink-0">
          <Plus className="mr-2 size-4" />
          New Request
        </Button>
      </div>

      {/* Stats */}
      <div className="grid gap-4 grid-cols-2 sm:grid-cols-4">
        <Card className="border-border/50">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Requests</p>
                <p className="text-2xl font-semibold">{stats.total}</p>
              </div>
              <div className="flex size-10 items-center justify-center rounded-lg bg-muted">
                <CalendarDays className="size-5 text-muted-foreground" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Pending</p>
                <p className="text-2xl font-semibold text-warning">{stats.pending}</p>
              </div>
              <div className="flex size-10 items-center justify-center rounded-lg bg-warning/10">
                <Clock className="size-5 text-warning" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Approved</p>
                <p className="text-2xl font-semibold text-success">{stats.approved}</p>
              </div>
              <div className="flex size-10 items-center justify-center rounded-lg bg-success/10">
                <Check className="size-5 text-success" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Rejected</p>
                <p className="text-2xl font-semibold text-destructive">{stats.rejected}</p>
              </div>
              <div className="flex size-10 items-center justify-center rounded-lg bg-destructive/10">
                <X className="size-5 text-destructive" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Requests Table */}
      <Card className="border-border/50">
        <CardHeader className="pb-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as LeaveStatus | "all")}>
              <TabsList>
                <TabsTrigger value="all">All</TabsTrigger>
                <TabsTrigger value="pending">
                  Pending
                  {stats.pending > 0 && (
                    <Badge variant="secondary" className="ml-2 bg-warning/10 text-warning">
                      {stats.pending}
                    </Badge>
                  )}
                </TabsTrigger>
                <TabsTrigger value="approved">Approved</TabsTrigger>
                <TabsTrigger value="rejected">Rejected</TabsTrigger>
              </TabsList>
            </Tabs>
            <div className="flex items-center gap-2">
              <div className="relative flex-1 sm:flex-none">
                <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search requests..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 w-full sm:w-52"
                />
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Filter className="mr-2 size-4" />
                    Type
                    {selectedTypes.length > 0 && (
                      <Badge variant="secondary" className="ml-2">
                        {selectedTypes.length}
                      </Badge>
                    )}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuLabel>Leave Types</DropdownMenuLabel>
                  {leaveTypes.map((type) => (
                    <DropdownMenuCheckboxItem
                      key={type}
                      checked={selectedTypes.includes(type)}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setSelectedTypes([...selectedTypes, type])
                        } else {
                          setSelectedTypes(selectedTypes.filter((t) => t !== type))
                        }
                      }}
                    >
                      {type}
                    </DropdownMenuCheckboxItem>
                  ))}
                  {selectedTypes.length > 0 && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => setSelectedTypes([])}>
                        Clear filters
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="pl-6">Employee</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Dates</TableHead>
                <TableHead>Days</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead>Applied On</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-24">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredRequests.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="h-24 text-center text-muted-foreground">
                    No leave requests found.
                  </TableCell>
                </TableRow>
              ) : (
                filteredRequests.map((request) => {
                  const employee = getEmployee(request.employeeId)
                  if (!employee) return null
                  
                  return (
                    <TableRow key={request.id} className="group">
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
                            <p className="text-xs text-muted-foreground">{employee.department}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>{getLeaveTypeBadge(request.type)}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDate(request.startDate)} - {formatDate(request.endDate)}
                      </TableCell>
                      <TableCell className="text-sm">{request.days}</TableCell>
                      <TableCell className="text-sm text-muted-foreground max-w-48 truncate">
                        {request.reason}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDate(request.appliedOn)}
                      </TableCell>
                      <TableCell>{getStatusBadge(request.status)}</TableCell>
                      <TableCell>
                        {request.status === "pending" && (
                          <div className="flex items-center gap-1">
                            <Button
                              size="icon"
                              variant="ghost"
                              className="size-8 text-muted-foreground hover:text-success hover:bg-success/10"
                              onClick={() => handleApprove(request)}
                            >
                              <Check className="size-4" />
                              <span className="sr-only">Approve</span>
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="size-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                              onClick={() => handleRejectClick(request)}
                            >
                              <X className="size-4" />
                              <span className="sr-only">Reject</span>
                            </Button>
                          </div>
                        )}
                        {request.status === "approved" && request.approvedOn && (
                          <span className="text-xs text-muted-foreground">
                            {formatDate(request.approvedOn)}
                          </span>
                        )}
                        {request.status === "rejected" && request.rejectionReason && (
                          <span className="text-xs text-destructive truncate max-w-20" title={request.rejectionReason}>
                            {request.rejectionReason}
                          </span>
                        )}
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
          </div>
        </CardContent>
      </Card>

      {/* Dialogs */}
      <LeaveRequestDialog open={dialogOpen} onOpenChange={setDialogOpen} />

      <AlertDialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reject Leave Request</AlertDialogTitle>
            <AlertDialogDescription>
              Please provide a reason for rejecting this leave request.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <Textarea
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder="Enter rejection reason..."
              rows={3}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={confirmReject}
              disabled={!rejectionReason}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Reject
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

export default function LeavesPage() {
  return (
    <DashboardLayout>
      <LeavesPageContent />
    </DashboardLayout>
  )
}
