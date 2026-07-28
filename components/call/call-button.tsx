"use client"

import { Phone, Video } from "lucide-react"
import { useSession } from "next-auth/react"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { useCallStore } from "@/lib/call/store"
import { useCallContext } from "./call-context"
import { cn } from "@/lib/utils"

/**
 * Drop next to any user to place a voice or video call. Pass the target's User
 * id (not Employee id). Disables itself when the target is offline or you're
 * already in a call. Must render inside <CallProvider>.
 */
export function CallButton({
  userId,
  variant = "both",
  size = "icon",
  className,
}: {
  userId: string
  variant?: "voice" | "video" | "both"
  size?: "icon" | "sm"
  className?: string
}) {
  const { data: session } = useSession()
  const { startCall, isOnline } = useCallContext()
  const phase = useCallStore((s) => s.phase)

  // Can't call yourself; hide entirely in that case.
  if (session?.user?.id === userId) return null

  const online = isOnline(userId)
  const busy = phase !== "idle"
  const disabled = !online || busy
  const reason = busy ? "You're already on a call" : !online ? "Offline" : ""

  const base = cn(
    "inline-flex items-center justify-center rounded-full transition-colors",
    size === "icon" ? "size-9" : "h-8 gap-1.5 px-3 text-sm",
    "text-muted-foreground hover:bg-accent hover:text-foreground",
    "disabled:pointer-events-none disabled:opacity-40",
    className,
  )

  return (
    <div className="inline-flex items-center gap-1">
      {(variant === "voice" || variant === "both") && (
        <Tooltip>
          <TooltipTrigger asChild>
            <button type="button" disabled={disabled} onClick={() => startCall(userId, "voice")} aria-label="Voice call" className={base}>
              <Phone className="size-4" />
              {size === "sm" && "Call"}
            </button>
          </TooltipTrigger>
          <TooltipContent>{reason || "Voice call"}</TooltipContent>
        </Tooltip>
      )}
      {(variant === "video" || variant === "both") && (
        <Tooltip>
          <TooltipTrigger asChild>
            <button type="button" disabled={disabled} onClick={() => startCall(userId, "video")} aria-label="Video call" className={base}>
              <Video className="size-4" />
              {size === "sm" && "Video"}
            </button>
          </TooltipTrigger>
          <TooltipContent>{reason || "Video call"}</TooltipContent>
        </Tooltip>
      )}
    </div>
  )
}
