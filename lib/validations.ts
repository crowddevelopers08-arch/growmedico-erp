import { z } from "zod"

const phoneRegex = /^[\d\s()+-]{7,20}$/
const channelSlugRegex = /^[a-z0-9-]{1,50}$/

const departments = ["Web Developer", "Media Buyer", "Video Editors", "CSM", "Operations Manager", "Content Writer", "SEO", "Founder", "Co-Founder", "Graphic Designer", "HR", "Senior Media Buyer", "Performance Marketer", "Social Media Manager"] as const
const accountRoles = ["ADMIN", "MANAGER", "EMPLOYEE"] as const
const employeeStatuses = ["present", "absent", "onLeave", "remote", "late"] as const
const leaveTypes = ["Casual Leave", "Privilege Leave", "Sick Leave", "Work From Home", "Permission"] as const
const taskPriorities = ["low", "medium", "high", "urgent"] as const
const taskStatuses = ["pending", "in_progress", "completed", "cancelled"] as const

// Core fields the user actually fills in. Used directly by the client-side
// form resolver — avatar/initials are derived from `name` at submit time and
// are never rendered as their own inputs, so they must not be validated here
// (a required field with no matching UI control blocks submission silently).
export const employeeBaseSchema = z.object({
  name: z.string().trim().min(2, "Full name must be at least 2 characters"),
  email: z.string().trim().email("Enter a valid email address"),
  phone: z.string().trim().regex(phoneRegex, "Enter a valid phone number"),
  department: z.enum(departments, { message: "Select a department" }),
  role: z.string().trim().max(100, "Job role is too long").optional().default(""),
  accountRole: z.enum(accountRoles, { message: "Select an account role" }),
  status: z.enum(employeeStatuses, { message: "Select a status" }),
  salary: z.coerce.number({ message: "Enter a valid salary" }).positive("Salary must be greater than 0"),
  address: z.string().trim().min(1, "Address is required"),
  emergencyContactName: z.string().trim().min(2, "Emergency contact name must be at least 2 characters"),
  emergencyContact: z.string().trim().regex(phoneRegex, "Enter a valid emergency contact number"),
  dateOfBirth: z.string().trim().min(1, "Date of birth is required"),
  joinDate: z.string().trim().min(1, "Join date is required"),
})

export const employeeFormSchema = employeeBaseSchema.extend({
  password: z.string().min(6, "Password must be at least 6 characters").optional().or(z.literal("")),
})

// Server-side variants additionally cover the derived fields the client
// computes and sends alongside the form values.
const employeeDerivedFieldsSchema = z.object({
  avatar: z.string().trim().optional(),
  initials: z.string().trim().min(1, "Initials are required"),
})

export const employeeCreateSchema = employeeBaseSchema.merge(employeeDerivedFieldsSchema).extend({
  password: z.string().min(6, "Password must be at least 6 characters"),
})

export const employeeUpdateSchema = employeeBaseSchema.merge(employeeDerivedFieldsSchema).extend({
  password: z.string().min(6, "Password must be at least 6 characters").optional().or(z.literal("")),
})

export const leaveRequestSchema = z
  .object({
    employeeId: z.string().trim().min(1, "Select an employee"),
    type: z.enum(leaveTypes, { message: "Select a leave type" }),
    startDate: z.string().trim().min(1, "Start date is required"),
    endDate: z.string().trim().min(1, "End date is required"),
    // A Permission is measured in hours, not days, so it submits days: 0.
    days: z.coerce.number().int().min(0),
    hours: z.coerce
      .number()
      .positive("Hours must be greater than 0")
      .max(8, "A permission cannot exceed 8 hours")
      .optional(),
    reason: z.string().trim().min(5, "Reason must be at least 5 characters"),
  })
  .refine((data) => new Date(data.endDate) >= new Date(data.startDate), {
    message: "End date cannot be before start date",
    path: ["endDate"],
  })
  .superRefine((data, ctx) => {
    if (data.type === "Permission") {
      if (data.hours === undefined) {
        ctx.addIssue({ code: "custom", path: ["hours"], message: "Enter the number of hours" })
      }
    } else if (data.days < 1) {
      ctx.addIssue({ code: "custom", path: ["days"], message: "Days must be at least 1" })
    }
  })

export const leaveDecisionSchema = z.object({
  status: z.enum(["pending", "approved", "rejected"], { message: "Invalid status" }),
  approvedBy: z.string().trim().optional(),
  rejectionReason: z.string().trim().optional(),
})

export const taskCreateSchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(200, "Title is too long"),
  description: z.string().trim().max(2000, "Description is too long").optional().nullable(),
  projectId: z.string().trim().min(1, "Select a client project"),
  assignedToId: z.string().trim().min(1, "Select who this task is assigned to"),
  managerId: z.string().trim().min(1).optional().nullable(),
  collaborators: z.array(z.string()).optional(),
  priority: z.enum(taskPriorities).optional(),
  status: z.enum(taskStatuses).optional(),
  stage: z.string().trim().optional().nullable(),
  dueDate: z.string().trim().optional().nullable(),
})

export const taskUpdateSchema = taskCreateSchema.partial()

export const projectCreateSchema = z.object({
  clientName: z.string().trim().min(1, "Client name is required").max(150, "Client name is too long"),
  name: z.string().trim().min(1, "Project name is required").max(150, "Project name is too long"),
  description: z.string().trim().max(2000, "Description is too long").optional().nullable(),
  dueDate: z.string().trim().optional().nullable(),
  priority: z.enum(taskPriorities).optional(),
  status: z.enum(["open", "in_progress", "completed", "on_hold"]).optional(),
  memberIds: z.array(z.string()).optional(),
})

export const channelCreateSchema = z.object({
  name: z.string().trim().toLowerCase().regex(channelSlugRegex, "Use lowercase letters, numbers, and hyphens only"),
  description: z.string().trim().max(300, "Description is too long").optional().nullable(),
})

export const loginSchema = z.object({
  email: z.string().trim().email("Enter a valid email address"),
  password: z.string().min(1, "Password is required"),
})

export const passwordUpdateSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
  newPassword: z.string().min(8, "New password must be at least 8 characters"),
})

export const changePasswordSchema = passwordUpdateSchema
  .extend({
    confirmPassword: z.string().min(1, "Please confirm your new password"),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "New passwords do not match",
    path: ["confirmPassword"],
  })

export const profileSchema = z.object({
  name: z.string().trim().min(2, "Full name must be at least 2 characters"),
})

export const companySchema = z.object({
  name: z.string().trim().max(150).optional().or(z.literal("")),
  email: z.string().trim().email("Enter a valid email address").optional().or(z.literal("")),
  phone: z.string().trim().regex(phoneRegex, "Enter a valid phone number").optional().or(z.literal("")),
  address: z.string().trim().max(300).optional().or(z.literal("")),
  website: z
    .string()
    .trim()
    .regex(/^(https?:\/\/)?[\w-]+(\.[\w-]+)+[/#?]?.*$/, "Enter a valid website URL")
    .optional()
    .or(z.literal("")),
  timezone: z.string().trim().optional(),
  dateFormat: z.string().trim().optional(),
  currency: z.string().trim().optional(),
})

export function firstIssueMessage(error: z.ZodError) {
  return error.issues[0]?.message ?? "Invalid input"
}

export function fieldErrors(error: z.ZodError) {
  const errors: Record<string, string> = {}
  for (const issue of error.issues) {
    const key = issue.path[0]
    if (typeof key === "string" && !errors[key]) errors[key] = issue.message
  }
  return errors
}
