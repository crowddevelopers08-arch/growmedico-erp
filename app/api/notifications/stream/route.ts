import { NextRequest } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { subscribe } from "@/lib/notification-stream"

// Long-lived Server-Sent Events stream. Each connected client gets pushed the
// notifications created for their user id in real time.
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
          // Controller already closed — ignore.
        }
      }

      // Initial hello so the client knows the channel is open.
      send(JSON.stringify({ kind: "connected" }))

      const unsubscribe = subscribe(userId, (payload) => {
        send(JSON.stringify({ kind: "notification", data: JSON.parse(payload) }))
      })

      // Comment-only heartbeat keeps proxies from closing an idle connection.
      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`: ping\n\n`))
        } catch {
          // ignore
        }
      }, 25000)

      const cleanup = () => {
        clearInterval(heartbeat)
        unsubscribe()
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
