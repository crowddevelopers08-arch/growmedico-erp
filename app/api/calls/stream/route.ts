import { NextRequest } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { subscribeCall } from "@/lib/call/signal"
import type { CallSignal } from "@/lib/call/types"

// Long-lived SSE stream carrying call signals to one user. Opening it also marks
// the user online (presence is derived from having this connection open).
export const dynamic = "force-dynamic"

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return new Response("Unauthorized", { status: 401 })

  const userId = session.user.id
  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    start(controller) {
      const send = (payload: string) => {
        try {
          controller.enqueue(encoder.encode(`data: ${payload}\n\n`))
        } catch {
          // Controller already closed.
        }
      }

      const hello: CallSignal = { event: "signal:connected", ts: Date.now() }
      send(JSON.stringify(hello))

      // subscribeCall flips presence to online on the first connection.
      const unsubscribe = subscribeCall(userId, send)

      // Comment heartbeat keeps proxies from dropping an idle call channel.
      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`: ping\n\n`))
        } catch {
          // ignore
        }
      }, 25_000)

      const cleanup = () => {
        clearInterval(heartbeat)
        unsubscribe() // last connection closing flips presence to offline
        try {
          controller.close()
        } catch {
          // ignore
        }
      }

      req.signal.addEventListener("abort", cleanup)
    },
  })

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  })
}
