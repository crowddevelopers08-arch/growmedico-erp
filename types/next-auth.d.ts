import "next-auth"
import "next-auth/jwt"

declare module "next-auth" {
  interface User {
    role: string
    employeeId?: string
    initials: string
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
    }
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role: string
    employeeId?: string
    initials: string
  }
}
