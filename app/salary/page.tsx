"use client"

import { useState, useMemo } from "react"
import { Search, DollarSign, TrendingUp, CreditCard, FileText, Download, Filter, Eye } from "lucide-react"
import { DashboardLayout } from "@/components/dashboard-layout"
import { Card, CardContent, CardHeader, CardTitle, CardAction } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
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
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { useHR } from "@/lib/hr-context"
import type { SalaryRecord, Department } from "@/lib/types"

const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"]
const departments: Department[] = ["Engineering", "Product", "Design", "Marketing", "HR", "Finance", "Sales", "Operations"]

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

function SalaryPageContent() {
  const { salaryRecords, employees, getEmployee, processSalary, markSalaryPaid } = useHR()
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedMonth, setSelectedMonth] = useState(() => months[new Date().getMonth()])
  const [selectedYear] = useState(() => new Date().getFullYear())
  const [selectedDepartments, setSelectedDepartments] = useState<Department[]>([])
  const [activeTab, setActiveTab] = useState<SalaryRecord["status"] | "all">("all")
  const [detailsOpen, setDetailsOpen] = useState(false)
  const [selectedRecord, setSelectedRecord] = useState<SalaryRecord | null>(null)

  const filteredRecords = useMemo(() => {
    let result = salaryRecords.filter((r) => r.month === selectedMonth && r.year === selectedYear)
    
    // Filter by tab
    if (activeTab !== "all") {
      result = result.filter((r) => r.status === activeTab)
    }
    
    // Filter by search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      result = result.filter((r) => {
        const employee = getEmployee(r.employeeId)
        return employee?.name.toLowerCase().includes(query)
      })
    }
    
    // Filter by departments
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

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount)
  }

  const handleViewDetails = (record: SalaryRecord) => {
    setSelectedRecord(record)
    setDetailsOpen(true)
  }

  const handleProcess = (record: SalaryRecord) => {
    processSalary(record.id)
  }

  const handleMarkPaid = (record: SalaryRecord) => {
    markSalaryPaid(record.id)
  }

  const selectedEmployee = selectedRecord ? getEmployee(selectedRecord.employeeId) : null

  return (
    <>
      {/* Page Title */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Salary & Payroll</h1>
          <p className="text-sm text-muted-foreground">
            Manage employee salaries and process payroll.
          </p>
        </div>
        <div className="flex items-center gap-2">
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
          <Button variant="outline">
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
                <p className="text-sm font-medium text-muted-foreground">Total Payroll</p>
                <p className="text-2xl font-semibold">{formatCurrency(stats.totalPayroll)}</p>
                <p className="text-xs text-muted-foreground">{selectedMonth} {selectedYear}</p>
              </div>
              <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10">
                <DollarSign className="size-5 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Bonus</p>
                <p className="text-2xl font-semibold text-success">{formatCurrency(stats.totalBonus)}</p>
                <p className="text-xs text-muted-foreground">This month</p>
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
                <p className="text-sm font-medium text-muted-foreground">Overtime Pay</p>
                <p className="text-2xl font-semibold text-chart-1">{formatCurrency(stats.totalOvertime)}</p>
                <p className="text-xs text-muted-foreground">Extra hours</p>
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
                <p className="text-sm font-medium text-muted-foreground">Payment Status</p>
                <p className="text-2xl font-semibold">{stats.paid}/{stats.total}</p>
                <p className="text-xs text-muted-foreground">
                  {stats.pending > 0 ? `${stats.pending} pending` : "All paid"}
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
                <TableHead className="text-right">Base Salary</TableHead>
                <TableHead className="text-right">Bonus</TableHead>
                <TableHead className="text-right">Deductions</TableHead>
                <TableHead className="text-right">Net Salary</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-32">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredRecords.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="h-24 text-center text-muted-foreground">
                    No salary records found.
                  </TableCell>
                </TableRow>
              ) : (
                filteredRecords.map((record) => {
                  const employee = getEmployee(record.employeeId)
                  if (!employee) return null
                  
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
                      <TableCell className="text-sm text-right font-mono">
                        {formatCurrency(record.baseSalary)}
                      </TableCell>
                      <TableCell className="text-sm text-right font-mono text-success">
                        +{formatCurrency(record.bonus + record.overtime)}
                      </TableCell>
                      <TableCell className="text-sm text-right font-mono text-destructive">
                        -{formatCurrency(record.deductions)}
                      </TableCell>
                      <TableCell className="text-sm text-right font-mono font-medium">
                        {formatCurrency(record.netSalary)}
                      </TableCell>
                      <TableCell>{getStatusBadge(record.status)}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8"
                            onClick={() => handleViewDetails(record)}
                          >
                            <Eye className="mr-1 size-3" />
                            View
                          </Button>
                          {record.status === "pending" && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-8"
                              onClick={() => handleProcess(record)}
                            >
                              Process
                            </Button>
                          )}
                          {record.status === "processed" && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-8"
                              onClick={() => handleMarkPaid(record)}
                            >
                              Mark Paid
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
                  <p className="text-sm text-muted-foreground">{selectedEmployee.department} - {selectedEmployee.role}</p>
                </div>
              </div>
              
              <Separator />
              
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
                  <span className="text-muted-foreground">Deductions (Tax + Benefits)</span>
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
