"use client"

import { useEffect, useRef } from "react"
import type { LocalVideoTrack, RemoteTrack } from "livekit-client"
import { cn } from "@/lib/utils"

/**
 * Binds a LiveKit video track to a <video> element for its lifetime. Attaching
 * is idempotent and detaching on cleanup prevents leaked media elements.
 */
export function VideoTrackView({
  track,
  mirror,
  muted = true,
  className,
  objectFit = "cover",
}: {
  track: LocalVideoTrack | RemoteTrack | null
  mirror?: boolean
  muted?: boolean
  className?: string
  objectFit?: "cover" | "contain"
}) {
  const ref = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el || !track) return
    track.attach(el)
    return () => {
      track.detach(el)
    }
  }, [track])

  return (
    <video
      ref={ref}
      autoPlay
      playsInline
      muted={muted}
      className={cn(
        "size-full bg-black",
        objectFit === "cover" ? "object-cover" : "object-contain",
        mirror && "-scale-x-100",
        className,
      )}
    />
  )
}
