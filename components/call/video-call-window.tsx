"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Minus, PictureInPicture2, VideoOff } from "lucide-react"
import { useCallStore, selectPeer } from "@/lib/call/store"
import { useCallContext } from "./call-context"
import { UserAvatar } from "./user-avatar"
import { CallTimer } from "./call-timer"
import { CallControls } from "./call-controls"
import { NetworkQuality } from "./status-badge"
import { VideoTrackView } from "./video-track-view"

/** In-call screen for a video call: remote video full-bleed, local preview PiP,
 *  screen-share promotion, fullscreen and native Picture-in-Picture. */
export function VideoCallWindow() {
  const phase = useCallStore((s) => s.phase)
  const call = useCallStore((s) => s.call)
  const peer = useCallStore(selectPeer)
  const media = useCallStore((s) => s.media)
  const quality = useCallStore((s) => s.quality)
  const reconnecting = useCallStore((s) => s.reconnecting)
  const remoteJoined = useCallStore((s) => s.remoteJoined)
  const connectedAt = useCallStore((s) => s.connectedAt)
  const minimized = useCallStore((s) => s.minimized)
  const setMinimized = useCallStore((s) => s.setMinimized)

  const { hangUp, media: lk } = useCallContext()
  const containerRef = useRef<HTMLDivElement>(null)
  const [fullscreen, setFullscreen] = useState(false)

  useEffect(() => {
    const onChange = () => setFullscreen(Boolean(document.fullscreenElement))
    document.addEventListener("fullscreenchange", onChange)
    return () => document.removeEventListener("fullscreenchange", onChange)
  }, [])

  const toggleFullscreen = useCallback(() => {
    const el = containerRef.current
    if (!el) return
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {})
    else el.requestFullscreen().catch(() => {})
  }, [])

  // Native PiP on the main (remote) video so the call floats when the user
  // switches tabs. Best-effort — unsupported browsers simply no-op.
  const requestPip = useCallback(async () => {
    const video = containerRef.current?.querySelector<HTMLVideoElement>("[data-remote-video] video")
    if (!video) return
    try {
      if (document.pictureInPictureElement) await document.exitPictureInPicture()
      else await video.requestPictureInPicture()
    } catch {
      /* not supported / dismissed */
    }
  }, [])

  const active = (phase === "active" || phase === "connecting") && call?.type === "video"
  if (!active || !call || !peer || minimized) return null

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-[100] flex flex-col bg-black text-white"
    >
      {/* Remote video / screen fills the frame */}
      <div className="relative flex-1 overflow-hidden" data-remote-video>
        {lk.tracks.remoteScreen ? (
          <VideoTrackView track={lk.tracks.remoteScreen} objectFit="contain" muted />
        ) : lk.tracks.remoteVideo ? (
          <VideoTrackView track={lk.tracks.remoteVideo} muted />
        ) : (
          <div className="flex size-full flex-col items-center justify-center gap-4 bg-neutral-900">
            <UserAvatar name={peer.name} avatar={peer.avatar} initials={peer.initials} size="xl" pulse={!remoteJoined} />
            <p className="text-lg font-medium">{peer.name}</p>
            <p className="text-sm text-white/60">{reconnecting ? "Reconnecting…" : "Connecting…"}</p>
          </div>
        )}

        {/* Top overlay: name, timer, quality, window controls */}
        <div className="absolute inset-x-0 top-0 flex items-center justify-between bg-gradient-to-b from-black/60 to-transparent p-4">
          <div className="min-w-0">
            <p className="truncate font-medium">{peer.name}</p>
            <div className="flex items-center gap-2 text-xs text-white/70">
              {remoteJoined && !reconnecting && <CallTimer startedAt={connectedAt} />}
              <NetworkQuality quality={quality} reconnecting={reconnecting} />
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button type="button" onClick={requestPip} aria-label="Picture in picture" className="inline-flex size-9 items-center justify-center rounded-full text-white/80 hover:bg-white/10">
              <PictureInPicture2 className="size-5" />
            </button>
            <button type="button" onClick={() => setMinimized(true)} aria-label="Minimize" className="inline-flex size-9 items-center justify-center rounded-full text-white/80 hover:bg-white/10">
              <Minus className="size-5" />
            </button>
          </div>
        </div>

        {/* Local preview PiP */}
        <div className="absolute right-4 bottom-4 aspect-video w-32 overflow-hidden rounded-xl border border-white/20 shadow-lg sm:w-44">
          {media.cameraEnabled && lk.tracks.localVideo ? (
            <VideoTrackView track={lk.tracks.localVideo} mirror muted />
          ) : (
            <div className="flex size-full items-center justify-center bg-neutral-800 text-white/50">
              <VideoOff className="size-6" />
            </div>
          )}
        </div>
      </div>

      {/* Controls */}
      <div className="bg-gradient-to-t from-black/70 to-transparent p-5">
        <CallControls
          variant="video"
          micEnabled={media.micEnabled}
          cameraEnabled={media.cameraEnabled}
          screenSharing={media.screenSharing}
          fullscreen={fullscreen}
          onToggleMic={lk.toggleMic}
          onToggleCamera={lk.toggleCamera}
          onToggleScreenShare={lk.toggleScreenShare}
          onSwitchCamera={lk.switchCamera}
          onToggleFullscreen={toggleFullscreen}
          onEnd={() => hangUp()}
        />
      </div>
    </div>
  )
}
