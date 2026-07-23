"use client"

import { useEffect, useMemo } from "react"
import { useSession } from "next-auth/react"
import { useForm, type FieldErrors } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { format, parseISO } from "date-fns"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Calendar } from "@/components/ui/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { CalendarIcon } from "lucide-react"
import { useHR } from "@/lib/hr-context"
import type { LeaveType } from "@/lib/types"
import { cn } from "@/lib/utils"
import { leaveRequestSchema } from "@/lib/validations"
import { permissionMonth, permissionNotice, permissionPenalty } from "@/lib/leave"
import type { z } from "zod"

const leaveTypes: LeaveType[] = ["Casual Leave", "Privilege Leave", "Sick Leave", "Work From Home", "Permission"]

type LeaveFormValues = z.infer<typeof leaveRequestSchema>

const emptyValues: LeaveFormValues = {
  employeeId: "",
  type: "Casual Leave",
  startDate: "",
  endDate: "",
  days: 1,
  reason: "",
}

interface LeaveRequestDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function LeaveRequestDialog({ open, onOpenChange }: LeaveRequestDialogProps) {
  const { employees, addLeaveRequest, leaveRequests } = useHR()
  const { data: session } = useSession()
  const currentEmployeeId = session?.user?.employeeId

  // A leave request is always filed for yourself, so the picker only ever
  // offers the logged-in employee.
  const currentEmployee = employees.find((emp) => emp.id === currentEmployeeId)

  const form = useForm<LeaveFormValues>({
    resolver: zodResolver(leaveRequestSchema),
    defaultValues: emptyValues,
  })

  useEffect(() => {
    // Pre-select the logged-in employee each time the dialog opens.
    form.reset(open ? { ...emptyValues, employeeId: currentEmployeeId ?? "" } : emptyValues)
  }, [open, currentEmployeeId, form])

  const startDate = form.watch("startDate")
  const endDate = form.watch("endDate")
  const type = form.watch("type")
  const isPermission = type === "Permission"

  // A permission covers a single day, so its End Date input is hidden. Mirror
  // the picked date into endDate anyway — the schema still requires it, and an
  // empty value would fail validation against a field that isn't rendered,
  // silently blocking submit.
  useEffect(() => {
    if (isPermission && startDate && endDate !== startDate) {
      form.setValue("endDate", startDate, { shouldValidate: true })
    }
  }, [isPermission, startDate, endDate, form])

  const calculateDays = (start: string, end: string) => {
    if (!start || !end) return 0
    const diffTime = Math.abs(new Date(end).getTime() - new Date(start).getTime())
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1
  }

  const days = calculateDays(startDate, endDate)

  // Preview which permission of the month this would be. The server recomputes
  // this authoritatively on submit — this is only to warn the employee first.
  const permissionCount = useMemo(() => {
    if (!isPermission || !startDate || !currentEmployeeId) return 0
    const month = permissionMonth(startDate)
    const taken = leaveRequests.filter(
      (r) =>
        r.employeeId === currentEmployeeId &&
        r.type === "Permission" &&
        r.status !== "rejected" &&
        permissionMonth(r.startDate) === month,
    ).length
    return taken + 1
  }, [isPermission, startDate, currentEmployeeId, leaveRequests])

  // Surface validation failures. Without this, an error on a field that isn't
  // currently rendered makes the submit button look broken.
  const onInvalid = (errors: FieldErrors<LeaveFormValues>) => {
    const first = Object.values(errors).find((error) => error?.message)
    toast.error(String(first?.message ?? "Please check the form for errors"))
  }

  const onSubmit = async (values: LeaveFormValues) => {
    try {
      // A permission covers a single date and is measured in hours, so it
      // carries days: 0 and mirrors startDate into endDate.
      const payload = isPermission
        ? { ...values, endDate: values.startDate, days: 0 }
        : { ...values, hours: undefined, days: calculateDays(values.startDate, values.endDate) }
      await addLeaveRequest(payload)
      onOpenChange(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to submit leave request")
    }
  }

  const formatDate = (value: string) => {
    return parseISO(value).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>New Leave Request</DialogTitle>
          <DialogDescription>
            Submit a leave request for an employee.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit, onInvalid)}>
            <div className="grid gap-4 py-4">
              <FormField
                control={form.control}
                name="employeeId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Employee</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange} disabled>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select employee" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {currentEmployee && (
                          <SelectItem value={currentEmployee.id}>
                            {currentEmployee.name} - {currentEmployee.department}
                          </SelectItem>
                        )}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Leave Type</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select leave type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {leaveTypes.map((type) => (
                          <SelectItem key={type} value={type}>
                            {type}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="startDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{isPermission ? "Date" : "Start Date"}</FormLabel>
                      <Popover>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              type="button"
                              variant="outline"
                              className={cn("w-full justify-start text-left font-normal", !field.value && "text-muted-foreground")}
                            >
                              <CalendarIcon className="mr-2 size-4" />
                              {field.value ? formatDate(field.value) : "Pick date"}
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={field.value ? parseISO(field.value) : undefined}
                            onSelect={(date) => date && field.onChange(format(date, "yyyy-MM-dd"))}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {isPermission ? (
                  <FormField
                    control={form.control}
                    name="hours"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Hours</FormLabel>
                        <FormControl>
                          <Input
                            type="text"
                            inputMode="decimal"
                            placeholder="2"
                            name={field.name}
                            ref={field.ref}
                            onBlur={field.onBlur}
                            value={field.value ?? ""}
                            onChange={(e) => {
                              // Digits and a single decimal point only.
                              const clean = e.target.value.replace(/[^\d.]/g, "").replace(/(\..*)\./g, "$1")
                              field.onChange(clean === "" ? undefined : Number(clean))
                            }}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                ) : (
                  <FormField
                    control={form.control}
                    name="endDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>End Date</FormLabel>
                        <Popover>
                          <PopoverTrigger asChild>
                            <FormControl>
                              <Button
                                type="button"
                                variant="outline"
                                className={cn("w-full justify-start text-left font-normal", !field.value && "text-muted-foreground")}
                              >
                                <CalendarIcon className="mr-2 size-4" />
                                {field.value ? formatDate(field.value) : "Pick date"}
                              </Button>
                            </FormControl>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                              mode="single"
                              selected={field.value ? parseISO(field.value) : undefined}
                              onSelect={(date) => date && field.onChange(format(date, "yyyy-MM-dd"))}
                              disabled={(date) => (startDate ? date < parseISO(startDate) : false)}
                              initialFocus
                            />
                          </PopoverContent>
                        </Popover>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
              </div>

              {isPermission
                ? permissionCount > 0 && (
                    <p
                      className={cn(
                        "text-sm",
                        permissionPenalty(permissionCount) === "full_day"
                          ? "text-destructive"
                          : permissionPenalty(permissionCount) === "half_day"
                          ? "text-warning"
                          : "text-muted-foreground",
                      )}
                    >
                      {permissionNotice(permissionCount)}
                    </p>
                  )
                : startDate &&
                  endDate && (
                    <p className="text-sm text-muted-foreground">
                      Duration: {days} day{days > 1 ? "s" : ""}
                    </p>
                  )}

              <FormField
                control={form.control}
                name="reason"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Reason</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Please provide a reason for your leave request..."
                        rows={3}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={form.formState.isSubmitting}>
                Cancel
              </Button>
              <Button type="submit" loading={form.formState.isSubmitting}>
                Submit Request
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
