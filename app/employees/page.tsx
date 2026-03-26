"use client"

import { useState, useMemo } from "react"
import { Plus, Search, MoreHorizontal, ArrowUpDown, Filter, Download, Trash2 } from "lucide-react"
import { DashboardLayout } from "@/components/dashboard-layout"
import { Card, CardContent, CardHeader, CardTitle, CardAction } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
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
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuCheckboxItem,
  DropdownMenuLabel,
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
import { useHR } from "@/lib/hr-context"
import { EmployeeDialog } from "@/components/employee-dialog"
import { EmployeeDetails } from "@/components/employee-details"
import type { Employee, Department } from "@/lib/types"

const departments: Department[] = ["Engineering", "Product", "Design", "Marketing", "HR", "Finance", "Sales", "Operations"]

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

function EmployeesPageContent() {
  const { employees, deleteEmployee } = useHR()
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedDepartments, setSelectedDepartments] = useState<Department[]>([])
  const [sortField, setSortField] = useState<"name" | "department" | "joinDate">("name")
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc")
  const [dialogOpen, setDialogOpen] = useState(false)
  const [dialogMode, setDialogMode] = useState<"add" | "edit">("add")
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null)
  const [detailsOpen, setDetailsOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [employeeToDelete, setEmployeeToDelete] = useState<Employee | null>(null)

  const filteredEmployees = useMemo(() => {
    let result = [...employees]
    
    // Filter by search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      result = result.filter(
        (emp) =>
          emp.name.toLowerCase().includes(query) ||
          emp.email.toLowerCase().includes(query) ||
          emp.role.toLowerCase().includes(query)
      )
    }
    
    // Filter by departments
    if (selectedDepartments.length > 0) {
      result = result.filter((emp) => selectedDepartments.includes(emp.department))
    }
    
    // Sort
    result.sort((a, b) => {
      let comparison = 0
      switch (sortField) {
        case "name":
          comparison = a.name.localeCompare(b.name)
          break
        case "department":
          comparison = a.department.localeCompare(b.department)
          break
        case "joinDate":
          comparison = new Date(a.joinDate).getTime() - new Date(b.joinDate).getTime()
          break
      }
      return sortDirection === "asc" ? comparison : -comparison
    })
    
    return result
  }, [employees, searchQuery, selectedDepartments, sortField, sortDirection])

  const handleSort = (field: "name" | "department" | "joinDate") => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc")
    } else {
      setSortField(field)
      setSortDirection("asc")
    }
  }

  const handleAddEmployee = () => {
    setDialogMode("add")
    setSelectedEmployee(null)
    setDialogOpen(true)
  }

  const handleEditEmployee = (employee: Employee) => {
    setDialogMode("edit")
    setSelectedEmployee(employee)
    setDialogOpen(true)
    setDetailsOpen(false)
  }

  const handleViewEmployee = (employee: Employee) => {
    setSelectedEmployee(employee)
    setDetailsOpen(true)
  }

  const handleDeleteClick = (employee: Employee) => {
    setEmployeeToDelete(employee)
    setDeleteDialogOpen(true)
  }

  const confirmDelete = () => {
    if (employeeToDelete) {
      deleteEmployee(employeeToDelete.id)
      setDeleteDialogOpen(false)
      setEmployeeToDelete(null)
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
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Employees</h1>
          <p className="text-sm text-muted-foreground">
            Manage your team members and their information.
          </p>
        </div>
        <Button onClick={handleAddEmployee}>
          <Plus className="mr-2 size-4" />
          Add Employee
        </Button>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-4">
        <Card className="border-border/50">
          <CardContent className="pt-6">
            <div className="text-2xl font-semibold">{employees.length}</div>
            <p className="text-sm text-muted-foreground">Total Employees</p>
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardContent className="pt-6">
            <div className="text-2xl font-semibold text-success">
              {employees.filter((e) => e.status === "present").length}
            </div>
            <p className="text-sm text-muted-foreground">Present Today</p>
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardContent className="pt-6">
            <div className="text-2xl font-semibold text-chart-1">
              {employees.filter((e) => e.status === "remote").length}
            </div>
            <p className="text-sm text-muted-foreground">Working Remote</p>
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardContent className="pt-6">
            <div className="text-2xl font-semibold text-warning">
              {employees.filter((e) => e.status === "onLeave").length}
            </div>
            <p className="text-sm text-muted-foreground">On Leave</p>
          </CardContent>
        </Card>
      </div>

      {/* Employee Table */}
      <Card className="border-border/50">
        <CardHeader className="pb-4">
          <CardTitle className="text-base font-semibold">All Employees</CardTitle>
          <CardAction>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search employees..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 w-64"
                />
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Filter className="mr-2 size-4" />
                    Filter
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
              <Button variant="outline" size="sm">
                <Download className="mr-2 size-4" />
                Export
              </Button>
            </div>
          </CardAction>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="pl-6">
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="-ml-3 h-8 text-xs font-medium text-muted-foreground"
                    onClick={() => handleSort("name")}
                  >
                    Employee
                    <ArrowUpDown className="ml-1 size-3" />
                  </Button>
                </TableHead>
                <TableHead>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="-ml-3 h-8 text-xs font-medium text-muted-foreground"
                    onClick={() => handleSort("department")}
                  >
                    Department
                    <ArrowUpDown className="ml-1 size-3" />
                  </Button>
                </TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="-ml-3 h-8 text-xs font-medium text-muted-foreground"
                    onClick={() => handleSort("joinDate")}
                  >
                    Join Date
                    <ArrowUpDown className="ml-1 size-3" />
                  </Button>
                </TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredEmployees.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                    No employees found.
                  </TableCell>
                </TableRow>
              ) : (
                filteredEmployees.map((employee) => (
                  <TableRow 
                    key={employee.id} 
                    className="group cursor-pointer"
                    onClick={() => handleViewEmployee(employee)}
                  >
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
                    <TableCell onClick={(e) => e.stopPropagation()}>
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
                          <DropdownMenuItem onClick={() => handleViewEmployee(employee)}>
                            View Profile
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleEditEmployee(employee)}>
                            Edit Details
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem 
                            className="text-destructive focus:text-destructive"
                            onClick={() => handleDeleteClick(employee)}
                          >
                            <Trash2 className="mr-2 size-4" />
                            Remove Employee
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Dialogs */}
      <EmployeeDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        employee={selectedEmployee}
        mode={dialogMode}
      />

      <EmployeeDetails
        employee={selectedEmployee}
        open={detailsOpen}
        onOpenChange={setDetailsOpen}
        onEdit={handleEditEmployee}
      />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Employee</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove {employeeToDelete?.name}? This action cannot be undone
              and will remove all associated data.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

export default function EmployeesPage() {
  return (
    <DashboardLayout>
      <EmployeesPageContent />
    </DashboardLayout>
  )
}
