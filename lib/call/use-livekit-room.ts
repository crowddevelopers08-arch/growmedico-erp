"use client"

// Owns the LiveKit Room lifecycle for one call: connect, publish mic/camera,
// subscribe to the peer's tracks, screen share, network quality, reconnection,
// and full teardown. Feeds high-level state into the call store; hands raw
// video tracks back so the window components can attach them to <video> tags.

import { useCallback, useEffect, useRef, useState } from "react"
import {
  ConnectionQuality as LKQuality,
  LocalVideoTrack,
  RemoteTrack,
  RemoteTrackPublication,
  Room,
  RoomEvent,
  Track,
  VideoPresets,
  type RemoteParticipant,
} from "livekit-client"
import { useCallStore, type ConnectionQuality } from "./store"

interface UseLiveKitRoomArgs {
  token: string | null
  serverUrl: string | null
  isVideo: boolean
  /** Only connect once we're meant to (accepted/connecting phase). */
  enabled: boolean
  onFatal?: (message: string) => void
}

export interface RoomTracks {
  localVideo: LocalVideoTrack | null
  remoteVideo: RemoteTrack | null
  remoteScreen: RemoteTrack | null
}

export interface LiveKitControls {
  connected: boolean
  tracks: RoomTracks
  toggleMic: () => Promise<void>
  toggleCamera: () => Promise<void>
  toggleScreenShare: () => Promise<void>
  switchCamera: () => Promise<void>
}

/**
 * Turn a getUserMedia failure into a message the user can act on. The order
 * matters: an insecure origin blocks media outright, so check it first.
 */
function mediaErrorMessage(err: unknown): string {
  if (typeof window !== "undefined" && !window.isSecureContext) {
    return "Calls need a secure page. Open the app on localhost or over HTTPS — camera/mic are blocked on plain http:// LAN addresses."
  }
  const name = (err as DOMException)?.name
  switch (name) {
    case "NotAllowedError":
    case "SecurityError":
      return "Microphone/camera access was blocked. Allow it for this site (and in your OS privacy settings), then call again."
    case "NotFoundError":
    case "DevicesNotFoundError":
      return "No microphone or camera was found on this device."
    case "NotReadableError":
    case "TrackStartError":
      return "Your microphone or camera is already in use by another app."
    default:
      return "Couldn't access your microphone or camera."
  }
}

function mapQuality(q: LKQuality): ConnectionQuality {
  switch (q) {
    case LKQuality.Excellent:
      return "excellent"
    case LKQuality.Good:
      return "good"
    case LKQuality.Poor:
      return "poor"
    case LKQuality.Lost:
      return "lost"
    default:
      return "unknown"
  }
}

export function useLiveKitRoom({ token, serverUrl, isVideo, enabled, onFatal }: UseLiveKitRoomArgs) {
  const roomRef = useRef<Room | null>(null)
  const [tracks, setTracks] = useState<RoomTracks>({ localVideo: null, remoteVideo: null, remoteScreen: null })
  const [connected, setConnected] = useState(false)

  const { setActive, setRemoteJoined, setQuality, setReconnecting, patchMedia } = useCallStore()

  // Remote audio is attached to a hidden, page-level element so it plays
  // regardless of which window is on screen. Kept out of React render.
  const audioElsRef = useRef<Map<string, HTMLMediaElement>>(new Map())

  const attachAudio = useCallback((track: RemoteTrack) => {
    const el = track.attach()
    el.style.display = "none"
    document.body.appendChild(el)
    audioElsRef.current.set(track.sid ?? Math.random().toString(), el)
  }, [])

  const detachAudio = useCallback((track: RemoteTrack) => {
    track.detach().forEach((el) => el.remove())
  }, [])

  useEffect(() => {
    if (!enabled || !token || !serverUrl) return

    let disposed = false
    const room = new Room({
      adaptiveStream: true, // scale video to the element size
      dynacast: true, // pause layers nobody is viewing
      videoCaptureDefaults: { resolution: VideoPresets.h720.resolution },
    })
    roomRef.current = room

    const refreshRemoteVideo = () => {
      const remote = [...room.remoteParticipants.values()][0] as RemoteParticipant | undefined
      const cam = remote?.getTrackPublication(Track.Source.Camera)?.track ?? null
      const screen = remote?.getTrackPublication(Track.Source.ScreenShare)?.track ?? null
      setTracks((t) => ({ ...t, remoteVideo: cam ?? null, remoteScreen: screen ?? null }))
    }

    const onSubscribed = (track: RemoteTrack) => {
      if (track.kind === Track.Kind.Audio) attachAudio(track)
      else refreshRemoteVideo()
    }
    const onUnsubscribed = (track: RemoteTrack, pub: RemoteTrackPublication) => {
      if (track.kind === Track.Kind.Audio) detachAudio(track)
      else refreshRemoteVideo()
      void pub
    }

    room
      .on(RoomEvent.TrackSubscribed, onSubscribed)
      .on(RoomEvent.TrackUnsubscribed, onUnsubscribed)
      .on(RoomEvent.ParticipantConnected, () => {
        setRemoteJoined(true)
        refreshRemoteVideo()
      })
      .on(RoomEvent.ParticipantDisconnected, () => {
        // In a strict 1:1 room, the peer leaving means the call is over.
        setRemoteJoined(false)
        onFatal?.("The other person left the call")
      })
      .on(RoomEvent.ConnectionQualityChanged, (quality, participant) => {
        if (participant === room.localParticipant) setQuality(mapQuality(quality))
      })
      .on(RoomEvent.Reconnecting, () => setReconnecting(true))
      .on(RoomEvent.Reconnected, () => setReconnecting(false))
      .on(RoomEvent.Disconnected, () => setConnected(false))
      .on(RoomEvent.LocalTrackPublished, () => {
        const localCam =
          (room.localParticipant.getTrackPublication(Track.Source.Camera)?.track as LocalVideoTrack | undefined) ?? null
        setTracks((t) => ({ ...t, localVideo: localCam }))
      })
      .on(RoomEvent.LocalTrackUnpublished, () => {
        setTracks((t) => ({ ...t, localVideo: null }))
      })

    // Defer the actual connect by a macrotask. React StrictMode (dev) mounts the
    // effect, runs its cleanup, then mounts again — all synchronously. Deferring
    // means the throwaway mount's cleanup clears this timer before any network
    // happens, so we never connect two participants with the same identity (which
    // makes the server close the first peer connection mid-offer). Only the real
    // mount reaches room.connect().
    const connectTimer = setTimeout(async () => {
      try {
        await room.connect(serverUrl, token)
        if (disposed) return
        setConnected(true)
        setActive()

        // Publish according to call type. Media (getUserMedia) is the most
        // common failure point — permission denied, no device, insecure origin —
        // so it's caught on its own with a message the user can act on, rather
        // than being reported as a generic connection error.
        try {
          await room.localParticipant.setMicrophoneEnabled(true)
          if (isVideo) await room.localParticipant.setCameraEnabled(true)
        } catch (mediaErr) {
          if (disposed) return
          console.error("[livekit] media error", mediaErr)
          onFatal?.(mediaErrorMessage(mediaErr))
          return
        }

        // The peer may already be in the room (they accepted first).
        if (room.remoteParticipants.size > 0) {
          setRemoteJoined(true)
          refreshRemoteVideo()
        }
      } catch (err) {
        if (disposed) return
        console.error("[livekit] connect failed", err)
        onFatal?.("Couldn't connect to the call server")
      }
    }, 0)

    return () => {
      disposed = true
      clearTimeout(connectTimer)
      audioElsRef.current.forEach((el) => el.remove())
      audioElsRef.current.clear()
      room.removeAllListeners()
      // Only disconnect if we actually got past connect — disconnecting a room
      // that never connected is a no-op but avoids a stray close on the
      // throwaway StrictMode mount.
      if (room.state !== "disconnected") room.disconnect().catch(() => {})
      roomRef.current = null
      setConnected(false)
      setTracks({ localVideo: null, remoteVideo: null, remoteScreen: null })
    }
    // Reconnect only when identity of the room changes, not on every store tick.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, token, serverUrl, isVideo])

  // ── Controls ────────────────────────────────────────────────────────────
  const toggleMic = useCallback(async () => {
    const room = roomRef.current
    if (!room) return
    const next = !room.localParticipant.isMicrophoneEnabled
    await room.localParticipant.setMicrophoneEnabled(next)
    patchMedia({ micEnabled: next })
  }, [patchMedia])

  const toggleCamera = useCallback(async () => {
    const room = roomRef.current
    if (!room) return
    const next = !room.localParticipant.isCameraEnabled
    await room.localParticipant.setCameraEnabled(next)
    patchMedia({ cameraEnabled: next })
  }, [patchMedia])

  const toggleScreenShare = useCallback(async () => {
    const room = roomRef.current
    if (!room) return
    const next = !room.localParticipant.isScreenShareEnabled
    try {
      await room.localParticipant.setScreenShareEnabled(next, { audio: true })
      patchMedia({ screenSharing: next })
    } catch {
      // User dismissed the picker — leave state unchanged.
    }
  }, [patchMedia])

  const switchCamera = useCallback(async () => {
    const room = roomRef.current
    if (!room) return
    const devices = await Room.getLocalDevices("videoinput")
    if (devices.length < 2) return
    const activeId = room.getActiveDevice("videoinput")
    const idx = devices.findIndex((d) => d.deviceId === activeId)
    const next = devices[(idx + 1) % devices.length]
    await room.switchActiveDevice("videoinput", next.deviceId)
  }, [])

  return { connected, tracks, toggleMic, toggleCamera, toggleScreenShare, switchCamera }
}
