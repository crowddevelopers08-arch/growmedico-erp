import { withAuth } from "next-auth/middleware"
import { NextResponse } from "next/server"

export default withAuth(
  function middleware(req) {
    const { pathname } = req.nextUrl
    const token = req.nextauth.token

    if (!token) return NextResponse.redirect(new URL("/login", req.url))

    const isAdmin = token.role === "ADMIN"

    // Admin-only routes
    const adminRoutes = ["/employees", "/salary", "/settings", "/dashboard"]
    const isAdminRoute = adminRoutes.some((route) => pathname.startsWith(route))

    if (isAdminRoute && !isAdmin) {
      return NextResponse.redirect(new URL("/my-portal", req.url))
    }

    return NextResponse.next()
  },
  {
    callbacks: {
      authorized: ({ token }) => !!token,
    },
  }
)

export const config = {
  matcher: [
    "/((?!login|api/auth|_next/static|_next/image|favicon.ico|icon|apple-icon|.*\\.(?:png|jpg|jpeg|gif|webp|svg|ico)$).*)",
  ],
}
