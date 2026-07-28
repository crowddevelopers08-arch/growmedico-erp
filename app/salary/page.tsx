"use client"

import { useState, useMemo, useCallback } from "react"
import { Search, IndianRupee, TrendingUp, CreditCard, FileText, Download, Filter, Eye, Sparkles, Pencil, Trash2, RotateCcw, RefreshCw } from "lucide-react"
import { useSession } from "next-auth/react"
import { toast } from "sonner"
import { DashboardLayout } from "@/components/dashboard-layout"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { useHR } from "@/lib/hr-context"
import { lateHalfDays, perDayRate, salaryBreakdown, workingDaysInMonth } from "@/lib/salary"
import type { SalaryRecord, Department } from "@/lib/types"

const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"]
const departments: Department[] = ["Web Developer", "Media Buyer", "Video Editors", "CSM", "Operations Manager", "Content Writer", "SEO", "Founder", "Co-Founder", "Graphic Designer", "HR", "Senior Media Buyer", "Performance Marketer", "Social Media Manager"]

// A few years around now, newest first, for the period selector.
const currentYear = new Date().getFullYear()
const years = [currentYear + 1, currentYear, currentYear - 1, currentYear - 2]

const getStatusBadge = (status: SalaryRecord["status"]) => {
  switch (status) {
    case "paid":
      return <Badge variant="outline" className="text-success border-success/30 bg-success/10">Paid</Badge>
    case "processed":
      return <Badge variant="outline" className="text-chart-1 border-chart-1/30 bg-chart-1/10">Processed</Badge>
    case "pending":
      return <Badge variant="outline" className="text-warning border-warning/30 bg-warning/10">Pending</Badge>
    default:
      return <Badge variant="outline">Unknown</Badge>
  }
}

// Deductions aren't in the form — they're the late penalty, computed from
// attendance, not something the admin types.
const emptyEdit = { baseSalary: "", bonus: "", overtime: "" }

function SalaryPageContent() {
  const { data: session } = useSession()
  const isAdmin = session?.user?.role === "ADMIN"
  const {
    salaryRecords, employees, attendance, leaveRequests, getEmployee,
    processSalary, markSalaryPaid, generatePayroll, recalculatePayroll, updateSalary, revertSalary, deleteSalary,
  } = useHR()

  const [searchQuery, setSearchQuery] = useState("")
  const [selectedMonth, setSelectedMonth] = useState(() => months[new Date().getMonth()])
  const [selectedYear, setSelectedYear] = useState(() => new Date().getFullYear())
  const [selectedDepartments, setSelectedDepartments] = useState<Department[]>([])
  const [activeTab, setActiveTab] = useState<SalaryRecord["status"] | "all">("all")

  const [detailsOpen, setDetailsOpen] = useState(false)
  const [selectedRecord, setSelectedRecord] = useState<SalaryRecord | null>(null)

  // Which row-level action is mid-flight, keyed by record id, so only that
  // button spins rather than the whole table.
  const [busyId, setBusyId] = useState<string | null>(null)
  const [generating, setGenerating] = useState(false)
  const [recalculating, setRecalculating] = useState(false)

  const [editRecord, setEditRecord] = useState<SalaryRecord | null>(null)
  const [editForm, setEditForm] = useState(emptyEdit)
  const [savingEdit, setSavingEdit] = useState(false)

  const [deleteTarget, setDeleteTarget] = useState<SalaryRecord | null>(null)

  const filteredRecords = useMemo(() => {
    let result = salaryRecords.filter((r) => r.month === selectedMonth && r.year === selectedYear)

    if (activeTab !== "all") {
      result = result.filter((r) => r.status === activeTab)
    }

    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      result = result.filter((r) => {
        const employee = getEmployee(r.employeeId)
        return employee?.name.toLowerCase().includes(query)
      })
    }

    if (selectedDepartments.length > 0) {
      result = result.filter((r) => {
        const employee = getEmployee(r.employeeId)
        return employee && selectedDepartments.includes(employee.department)
      })
    }

    return result
  }, [salaryRecords, selectedMonth, selectedYear, activeTab, searchQuery, selectedDepartments, getEmployee])

  const stats = useMemo(() => {
    const monthRecords = salaryRecords.filter((r) => r.month === selectedMonth && r.year === selectedYear)
    const totalPayroll = monthRecords.reduce((sum, r) => sum + r.netSalary, 0)
    const totalBonus = monthRecords.reduce((sum, r) => sum + r.bonus, 0)
    const totalOvertime = monthRecords.reduce((sum, r) => sum + r.overtime, 0)
    const pending = monthRecords.filter((r) => r.status === "pending").length
    const paid = monthRecords.filter((r) => r.status === "paid").length

    return { totalPayroll, totalBonus, totalOvertime, pending, paid, total: monthRecords.length }
  }, [salaryRecords, selectedMonth, selectedYear])

  // How many employees still have no record this period — surfaced on the
  // Generate button so an admin knows there's something to create.
  const missingCount = useMemo(() => {
    const withRecord = new Set(
      salaryRecords.filter((r) => r.month === selectedMonth && r.year === selectedYear).map((r) => r.employeeId)
    )
    return employees.filter((employee) => !withRecord.has(employee.id)).length
  }, [salaryRecords, employees, selectedMonth, selectedYear])

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount)
  }

  // The full attendance + leave breakdown for a record, matching what the server
  // stored. Computed from data already in context, so no extra fetch. Wrapped in
  // useCallback so the table and dialogs share one definition.
  const breakdownFor = useCallback(
    (record: { employeeId: string; baseSalary: number; bonus: number; overtime: number; month: string; year: number }) =>
      salaryBreakdown({
        baseSalary: record.baseSalary,
        bonus: record.bonus,
        overtime: record.overtime,
        attendance,
        leaves: leaveRequests,
        employeeId: record.employeeId,
        month: record.month,
        year: record.year,
      }),
    [attendance, leaveRequests],
  )

  const handleViewDetails = (record: SalaryRecord) => {
    setSelectedRecord(record)
    setDetailsOpen(true)
  }

  // Wraps a row action so its button shows a spinner and errors surface as a
  // toast instead of an unhandled rejection.
  const runRowAction = async (record: SalaryRecord, action: () => Promise<void>, successMessage: string) => {
    setBusyId(record.id)
    try {
      await action()
      toast.success(successMessage)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong")
    } finally {
      setBusyId(null)
    }
  }

  const handleGenerate = async () => {
    setGenerating(true)
    try {
      const result = await generatePayroll(selectedMonth, selectedYear)
      if (result.created === 0) {
        toast.info(`Every employee already has a record for ${selectedMonth} ${selectedYear}.`)
      } else {
        toast.success(`Created ${result.created} salary record${result.created === 1 ? "" : "s"} for ${selectedMonth} ${selectedYear}.`)
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not generate payroll")
    } finally {
      setGenerating(false)
    }
  }

  // Attendance keeps changing through the month, so the stored net can go stale.
  // This refreshes every non-paid record for the period from current attendance.
  const handleRecalculate = async () => {
    setRecalculating(true)
    try {
      const result = await recalculatePayroll(selectedMonth, selectedYear)
      if (result.updated === 0) {
        toast.info("Net salaries are already up to date with attendance.")
      } else {
        toast.success(`Updated ${result.updated} record${result.updated === 1 ? "" : "s"} from attendance.`)
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not recalculate")
    } finally {
      setRecalculating(false)
    }
  }

  const openEdit = (record: SalaryRecord) => {
    setEditRecord(record)
    setEditForm({
      baseSalary: String(record.baseSalary),
      bonus: String(record.bonus),
      overtime: String(record.overtime),
    })
  }

  // Live preview inside the edit dialog. Mirrors the server exactly: deductions
  // (late penalty + unapproved absences) are derived from attendance and leave,
  // not read from the form.
  const editPreview = useMemo(() => {
    if (!editRecord) {
      return { net: 0, workingDays: 0, perDay: 0, presentDays: 0, lateDays: 0, approvedLeaveDays: 0, unapprovedAbsenceDays: 0, deductions: 0, lateDeduction: 0, absenceDeduction: 0 }
    }
    const num = (value: string) => {
      const parsed = Number(value)
      return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0
    }
    return breakdownFor({
      employeeId: editRecord.employeeId,
      baseSalary: num(editForm.baseSalary),
      bonus: num(editForm.bonus),
      overtime: num(editForm.overtime),
      month: editRecord.month,
      year: editRecord.year,
    })
  }, [editForm, editRecord, breakdownFor])

  const handleSaveEdit = async () => {
    if (!editRecord) return
    const num = (value: string) => {
      const parsed = Number(value)
      return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0
    }
    setSavingEdit(true)
    try {
      // Deductions are computed server-side from lates, so they aren't sent.
      await updateSalary(editRecord.id, {
        baseSalary: num(editForm.baseSalary),
        bonus: num(editForm.bonus),
        overtime: num(editForm.overtime),
      })
      toast.success("Salary updated")
      setEditRecord(null)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not update salary")
    } finally {
      setSavingEdit(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    const target = deleteTarget
    setDeleteTarget(null)
    await runRowAction(target, () => deleteSalary(target.id), "Salary record deleted")
  }

  // Build a CSV from whatever is currently on screen and trigger a download —
  // no server round-trip needed since the rows are already loaded.
  const handleExport = () => {
    if (filteredRecords.length === 0) {
      toast.info("Nothing to export for this view.")
      return
    }
    const header = ["Employee", "Department", "Role", "Month", "Year", "Present Days", "Approved Leave", "Unapproved Absence", "Late Days", "Working Days", "Per Day", "Base", "Bonus", "Overtime", "Deductions", "Net", "Status", "Paid On"]
    const rows = filteredRecords.map((record) => {
      const employee = getEmployee(record.employeeId)
      const b = breakdownFor(record)
      return [
        employee?.name ?? "Unknown",
        employee?.department ?? "",
        employee?.role ?? "",
        record.month,
        record.year,
        b.presentDays,
        b.approvedLeaveDays,
        b.unapprovedAbsenceDays,
        b.lateDays,
        b.workingDays,
        Math.round(perDayRate(record.baseSalary, record.month, record.year)),
        record.baseSalary,
        record.bonus,
        record.overtime,
        record.deductions,
        record.netSalary,
        record.status,
        record.paidOn ?? "",
      ]
    })
    // Quote every field and escape embedded quotes so commas in names/roles
    // don't split into extra columns.
    const csv = [header, ...rows]
      .map((line) => line.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
      .join("\n")

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = `payroll-${selectedMonth}-${selectedYear}.csv`
    link.click()
    URL.revokeObjectURL(url)
    toast.success("Payroll exported")
  }

  const selectedEmployee = selectedRecord ? getEmployee(selectedRecord.employeeId) : null

  return (
    <>
      {/* Page Title */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Salary & Payroll</h1>
          <p className="text-sm text-muted-foreground">
            Manage employee salaries and process payroll.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={selectedMonth} onValueChange={setSelectedMonth}>
            <SelectTrigger className="w-36">
              <SelectValue placeholder="Select month" />
            </SelectTrigger>
            <SelectContent>
              {months.map((month) => (
                <SelectItem key={month} value={month}>
                  {month}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={String(selectedYear)} onValueChange={(value) => setSelectedYear(Number(value))}>
            <SelectTrigger className="w-24">
              <SelectValue placeholder="Year" />
            </SelectTrigger>
            <SelectContent>
              {years.map((year) => (
                <SelectItem key={year} value={String(year)}>
                  {year}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {isAdmin && (
            <Button variant="outline" onClick={handleRecalculate} loading={recalculating} title="Refresh net salaries from current attendance">
              <RefreshCw className="mr-2 size-4" />
              Recalculate
            </Button>
          )}
          {isAdmin && (
            <Button onClick={handleGenerate} loading={generating}>
              <Sparkles className="mr-2 size-4" />
              Generate Payroll
              {missingCount > 0 && (
                <Badge variant="secondary" className="ml-2 bg-primary-foreground/20">
                  {missingCount}
                </Badge>
              )}
            </Button>
          )}
          <Button variant="outline" onClick={handleExport}>
            <Download className="mr-2 size-4" />
            Export
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <Card className="border-border/50">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2sm font-medium text-muted-foreground">Total Payroll</p>
                <p className="text-stat font-semibold">{formatCurrency(stats.totalPayroll)}</p>
                <p className="text-2sm text-muted-foreground">{selectedMonth} {selectedYear}</p>
              </div>
              <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10">
                <IndianRupee className="size-5 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2sm font-medium text-muted-foreground">Total Bonus</p>
                <p className="text-stat font-semibold text-success">{formatCurrency(stats.totalBonus)}</p>
                <p className="text-2sm text-muted-foreground">This month</p>
              </div>
              <div className="flex size-10 items-center justify-center rounded-lg bg-success/10">
                <TrendingUp className="size-5 text-success" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2sm font-medium text-muted-foreground">Overtime Pay</p>
                <p className="text-stat font-semibold text-chart-1">{formatCurrency(stats.totalOvertime)}</p>
                <p className="text-2sm text-muted-foreground">Extra hours</p>
              </div>
              <div className="flex size-10 items-center justify-center rounded-lg bg-chart-1/10">
                <CreditCard className="size-5 text-chart-1" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2sm font-medium text-muted-foreground">Payment Status</p>
                <p className="text-stat font-semibold">{stats.paid}/{stats.total}</p>
                <p className="text-2sm text-muted-foreground">
                  {stats.pending > 0 ? `${stats.pending} pending` : stats.total > 0 ? "All paid" : "No records"}
                </p>
              </div>
              <div className="flex size-10 items-center justify-center rounded-lg bg-muted">
                <FileText className="size-5 text-muted-foreground" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Salary Table */}
      <Card className="border-border/50">
        <CardHeader className="pb-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as SalaryRecord["status"] | "all")}>
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
                <TabsTrigger value="processed">Processed</TabsTrigger>
                <TabsTrigger value="paid">Paid</TabsTrigger>
              </TabsList>
            </Tabs>
            <div className="flex items-center gap-2">
              <div className="relative flex-1 sm:flex-none">
                <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search employees..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 w-full sm:w-52"
                />
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Filter className="mr-2 size-4" />
                    Department
                    {selectedDepartments.length > 0 && (
                      <Badge variant="secondary" className="ml-2">
                        {selectedDepartments.length}
                      </Badge>
                    )}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuLabel>Departments</DropdownMenuLabel>
                  {departments.map((dept) => (
                    <DropdownMenuCheckboxItem
                      key={dept}
                      checked={selectedDepartments.includes(dept)}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setSelectedDepartments([...selectedDepartments, dept])
                        } else {
                          setSelectedDepartments(selectedDepartments.filter((d) => d !== dept))
                        }
                      }}
                    >
                      {dept}
                    </DropdownMenuCheckboxItem>
                  ))}
                  {selectedDepartments.length > 0 && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => setSelectedDepartments([])}>
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
                <TableHead>Department</TableHead>
                <TableHead className="text-center">Present</TableHead>
                <TableHead className="text-right">Per Day</TableHead>
                <TableHead className="text-right">Base Salary</TableHead>
                <TableHead className="text-right">Bonus</TableHead>
                <TableHead className="text-right">Deductions</TableHead>
                <TableHead className="text-right">Net Salary</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-40 text-right pr-6">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredRecords.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} className="h-32 text-center text-muted-foreground">
                    <p>No salary records for {selectedMonth} {selectedYear}.</p>
                    {isAdmin && missingCount > 0 && (
                      <Button variant="outline" size="sm" className="mt-3" onClick={handleGenerate} loading={generating}>
                        <Sparkles className="mr-2 size-4" />
                        Generate for {missingCount} employee{missingCount === 1 ? "" : "s"}
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ) : (
                filteredRecords.map((record) => {
                  const employee = getEmployee(record.employeeId)
                  if (!employee) return null

                  const b = breakdownFor(record)
                  const dayRate = perDayRate(record.baseSalary, record.month, record.year)

                  return (
                    <TableRow key={record.id} className="group">
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
                            <p className="text-xs text-muted-foreground">{employee.role}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{employee.department}</TableCell>
                      <TableCell className="text-center text-sm">
                        <span className="font-medium text-foreground">{b.presentDays}</span>
                        <span className="text-muted-foreground">/{b.workingDays}</span>
                        <div className="text-xs">
                          {b.lateDays > 0 && <span className="text-warning">{b.lateDays} late</span>}
                          {b.lateDays > 0 && b.approvedLeaveDays > 0 && <span className="text-muted-foreground"> · </span>}
                          {b.approvedLeaveDays > 0 && <span className="text-chart-1">{b.approvedLeaveDays} leave</span>}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-right font-mono text-muted-foreground">
                        {formatCurrency(dayRate)}
                      </TableCell>
                      <TableCell className="text-sm text-right font-mono">
                        {formatCurrency(record.baseSalary)}
                      </TableCell>
                      <TableCell className="text-sm text-right font-mono text-success">
                        +{formatCurrency(record.bonus + record.overtime)}
                      </TableCell>
                      <TableCell className="text-sm text-right font-mono text-destructive">
                        -{formatCurrency(record.deductions)}
                        {(b.unapprovedAbsenceDays > 0 || lateHalfDays(b.lateDays) > 0) && (
                          <p className="text-xs font-sans text-muted-foreground">
                            {[
                              b.unapprovedAbsenceDays > 0 ? `${b.unapprovedAbsenceDays} absent` : null,
                              lateHalfDays(b.lateDays) > 0 ? `${lateHalfDays(b.lateDays)} half-day` : null,
                            ].filter(Boolean).join(" + ")}
                          </p>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-right font-mono font-medium">
                        {formatCurrency(record.netSalary)}
                      </TableCell>
                      <TableCell>{getStatusBadge(record.status)}</TableCell>
                      <TableCell className="pr-6">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="size-8"
                            title="View details"
                            onClick={() => handleViewDetails(record)}
                          >
                            <Eye className="size-4" />
                          </Button>

                          {isAdmin && record.status === "pending" && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-8"
                              loading={busyId === record.id}
                              onClick={() => runRowAction(record, () => processSalary(record.id), "Salary processed")}
                            >
                              Process
                            </Button>
                          )}
                          {isAdmin && record.status === "processed" && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-8"
                              loading={busyId === record.id}
                              onClick={() => runRowAction(record, () => markSalaryPaid(record.id), "Salary marked paid")}
                            >
                              Mark Paid
                            </Button>
                          )}

                          {isAdmin && record.status !== "paid" && (
                            <Button
                              size="icon"
                              variant="ghost"
                              className="size-8"
                              title="Edit amounts"
                              onClick={() => openEdit(record)}
                            >
                              <Pencil className="size-4" />
                            </Button>
                          )}
                          {isAdmin && record.status !== "pending" && (
                            <Button
                              size="icon"
                              variant="ghost"
                              className="size-8"
                              title="Revert to pending"
                              loading={busyId === record.id}
                              onClick={() => runRowAction(record, () => revertSalary(record.id), "Reverted to pending")}
                            >
                              <RotateCcw className="size-4" />
                            </Button>
                          )}
                          {isAdmin && record.status !== "paid" && (
                            <Button
                              size="icon"
                              variant="ghost"
                              className="size-8 text-muted-foreground hover:text-destructive"
                              title="Delete record"
                              onClick={() => setDeleteTarget(record)}
                            >
                              <Trash2 className="size-4" />
                            </Button>
                          )}
                        </div>
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

      {/* Details Dialog */}
      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Salary Details</DialogTitle>
            <DialogDescription>
              {selectedRecord?.month} {selectedRecord?.year} - {selectedEmployee?.name}
            </DialogDescription>
          </DialogHeader>
          {selectedRecord && selectedEmployee && (
            <div className="space-y-4 py-4">
              <div className="flex items-center gap-4">
                <Avatar className="size-12 ring-2 ring-border">
                  <AvatarImage src={selectedEmployee.avatar} alt={selectedEmployee.name} />
                  <AvatarFallback className="bg-primary/10 text-primary font-medium">
                    {selectedEmployee.initials}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-medium">{selectedEmployee.name}</p>
                  <p className="text-sm text-muted-foreground">{[selectedEmployee.department, selectedEmployee.role].filter(Boolean).join(" - ")}</p>
                </div>
              </div>

              <Separator />

              {/* Attendance + leave basis for this period. */}
              {(() => {
                const b = breakdownFor(selectedRecord)
                const dayRate = perDayRate(selectedRecord.baseSalary, selectedRecord.month, selectedRecord.year)
                return (
                  <div className="space-y-3 rounded-xl border bg-muted/30 p-4">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Days Present</span>
                      <span className="font-medium">{b.presentDays} <span className="text-muted-foreground">/ {b.workingDays} working days</span></span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Per Day Rate</span>
                      <span className="font-mono">{formatCurrency(dayRate)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Approved leave (paid)</span>
                      <span className="text-chart-1">{b.approvedLeaveDays} day{b.approvedLeaveDays === 1 ? "" : "s"}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Unapproved absence</span>
                      <span className={b.unapprovedAbsenceDays > 0 ? "text-destructive" : ""}>
                        {b.unapprovedAbsenceDays} day{b.unapprovedAbsenceDays === 1 ? "" : "s"}
                        {b.absenceDeduction > 0 && <span className="text-muted-foreground"> · -{formatCurrency(b.absenceDeduction)}</span>}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Late arrivals</span>
                      <span>
                        {b.lateDays}
                        {lateHalfDays(b.lateDays) > 0 && (
                          <span className="text-warning"> → -{formatCurrency(b.lateDeduction)}</span>
                        )}
                      </span>
                    </div>
                  </div>
                )
              })()}

              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Base Salary</span>
                  <span className="font-mono">{formatCurrency(selectedRecord.baseSalary)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Bonus</span>
                  <span className="font-mono text-success">+{formatCurrency(selectedRecord.bonus)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Overtime</span>
                  <span className="font-mono text-success">+{formatCurrency(selectedRecord.overtime)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Deductions (absences + lates)</span>
                  <span className="font-mono text-destructive">-{formatCurrency(selectedRecord.deductions)}</span>
                </div>

                <Separator />

                <div className="flex justify-between font-medium">
                  <span>Net Salary</span>
                  <span className="font-mono text-lg">{formatCurrency(selectedRecord.netSalary)}</span>
                </div>
              </div>

              <Separator />

              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Status</span>
                {getStatusBadge(selectedRecord.status)}
              </div>

              {selectedRecord.paidOn && (
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Paid On</span>
                  <span className="text-sm">
                    {new Date(selectedRecord.paidOn).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </span>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Amounts Dialog */}
      <Dialog open={!!editRecord} onOpenChange={(open) => !open && setEditRecord(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Salary</DialogTitle>
            <DialogDescription>
              {editRecord && getEmployee(editRecord.employeeId)?.name} — {editRecord?.month} {editRecord?.year}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-base">Base Salary</Label>
                <Input
                  id="edit-base"
                  type="number"
                  min={0}
                  value={editForm.baseSalary}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, baseSalary: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-bonus">Bonus</Label>
                <Input
                  id="edit-bonus"
                  type="number"
                  min={0}
                  value={editForm.bonus}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, bonus: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-overtime">Overtime</Label>
                <Input
                  id="edit-overtime"
                  type="number"
                  min={0}
                  value={editForm.overtime}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, overtime: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Deductions (auto)</Label>
                <div className="flex h-9 items-center rounded-md border bg-muted/40 px-3 font-mono text-sm text-destructive">
                  -{formatCurrency(editPreview.deductions)}
                </div>
              </div>
            </div>

            {/* Attendance summary — all read-only, straight from attendance and
                approved leave. Deductions can't be hand-edited. */}
            <div className="space-y-1.5 rounded-xl border bg-muted/20 px-4 py-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Present</span>
                <span className="font-medium">{editPreview.presentDays} / {editPreview.workingDays} working days</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Approved leave (paid)</span>
                <span className="text-chart-1">{editPreview.approvedLeaveDays} day{editPreview.approvedLeaveDays === 1 ? "" : "s"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Unapproved absence</span>
                <span className={editPreview.unapprovedAbsenceDays > 0 ? "text-destructive" : ""}>
                  {editPreview.unapprovedAbsenceDays} day{editPreview.unapprovedAbsenceDays === 1 ? "" : "s"} · -{formatCurrency(editPreview.absenceDeduction)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Lates</span>
                <span>
                  {editPreview.lateDays}
                  {lateHalfDays(editPreview.lateDays) > 0 && (
                    <span className="text-warning"> · -{formatCurrency(editPreview.lateDeduction)}</span>
                  )}
                </span>
              </div>
            </div>
            <div className="flex items-center justify-between rounded-xl border bg-muted/30 px-4 py-3">
              <span className="text-sm text-muted-foreground">Net Salary</span>
              <span className="font-mono text-lg font-medium">{formatCurrency(editPreview.net)}</span>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditRecord(null)} disabled={savingEdit}>
              Cancel
            </Button>
            <Button onClick={handleSaveEdit} loading={savingEdit}>
              Save changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete salary record?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the {deleteTarget?.month} {deleteTarget?.year} record for{" "}
              {deleteTarget && getEmployee(deleteTarget.employeeId)?.name}. You can regenerate it later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

export default function SalaryPage() {
  return (
    <DashboardLayout>
      <SalaryPageContent />
    </DashboardLayout>
  )
}
