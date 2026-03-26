import type { NextAuthOptions } from "next-auth"
import CredentialsProvider from "next-auth/providers/credentials"
import bcrypt from "bcryptjs"
import { prisma } from "./prisma"

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null

        try {
          const user = await prisma.user.findUnique({
            where: { email: credentials.email },
            include: { employee: true },
          })

          if (!user) return null

          const passwordValid = await bcrypt.compare(credentials.password, user.password)
          if (!passwordValid) return null

          return {
            id: user.id,
            email: user.email,
            role: user.role,
            employeeId: user.employeeId ?? undefined,
            name: user.employee?.name ?? user.email,
            image: user.employee?.avatar ?? undefined,
            initials: user.employee?.initials ?? user.email.slice(0, 2).toUpperCase(),
          }
        } catch (err) {
          console.error("[Auth] Database error during login:", err)
          return null
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = user.role
        token.employeeId = user.employeeId
        token.initials = user.initials
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub!
        session.user.role = token.role as string
        session.user.employeeId = token.employeeId as string | undefined
        session.user.initials = token.initials as string
      }
      return session
    },
  },
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
  },
  secret: process.env.NEXTAUTH_SECRET,
}
