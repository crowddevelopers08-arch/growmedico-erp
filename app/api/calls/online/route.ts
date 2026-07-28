import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { onlineUserIds } from "@/lib/call/signal"

/**
 * The set of users currently reachable for a call (have the signaling stream
 * open). The directory fetches this once, then keeps it live via user:online /
 * user:offline signals.
 */
export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  return NextResponse.json({ userIds: onlineUserIds() })
}
