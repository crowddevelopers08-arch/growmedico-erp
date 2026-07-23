import "next-auth"
import "next-auth/jwt"

declare module "next-auth" {
  interface User {
    role: string
    employeeId?: string
    initials: string
    /** Employee department — some permissions are department-based (e.g. CSM). */
    department?: string
  }
  interface Session {
    user: {
      id: string
      email: string
      name?: string | null
      image?: string | null
      role: string
      employeeId?: string
      initials: string
      department?: string
    }
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role: string
    employeeId?: string
    initials: string
    department?: string
  }
}
