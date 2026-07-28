"use client"

import { useCallback, useEffect } from "react"
import { soundService, type SoundName } from "./sound-service"
import { useSoundStore } from "./sound-store"

/**
 * Maps a notification `type` (as stored on the Notification model) to a sound
 * signature. Types not listed fall back to the soft "general" blip.
 */
export function soundForNotificationType(type: string): SoundName {
  switch (type) {
    case "message":
    case "mention":
      return "message"
    case "task_assigned":
    case "task_collaborator":
      return "task"
    case "leave_approved":
    case "salary_paid":
      return "success"
    case "leave_rejected":
      return "error"
    default:
      return "general"
  }
}

/**
 * Play notification sounds by type, honoring the user's mute/volume prefs, and
 * guarantee any looping sound is stopped when the component unmounts.
 */
export function useNotificationSound() {
  const muted = useSoundStore((s) => s.muted)
  const setCurrent = useSoundStore((s) => s.setCurrent)

  const playType = useCallback(
    (type: string) => {
      if (muted) return
      const name = soundForNotificationType(type)
      soundService.play(name)
      setCurrent(name)
      // Clear "current" after the blip finishes so any UI indicator resets.
      setTimeout(() => setCurrent(null), 800)
    },
    [muted, setCurrent],
  )

  const play = useCallback(
    (name: SoundName, opts?: { loop?: boolean }) => {
      if (muted) return
      soundService.play(name, opts)
      setCurrent(name)
    },
    [muted, setCurrent],
  )

  const stop = useCallback(() => {
    soundService.stop()
    setCurrent(null)
  }, [setCurrent])

  // Safety net: never leave a loop ringing after the owner unmounts.
  useEffect(() => {
    return () => {
      soundService.stop()
    }
  }, [])

  return { playType, play, stop }
}
