"use client"

// Zustand store for sound preferences and the currently-playing sound. This is
// the genuinely new state the notification spec calls for — the notification
// list / unread count / permission already live in the notification context,
// and the incoming call lives in the call store, so those aren't re-stored here.
//
// Preferences persist to localStorage and are pushed into the sound service so
// the service and the UI never disagree.

import { create } from "zustand"
import { persist } from "zustand/middleware"
import { soundService, type SoundName } from "./sound-service"

interface SoundState {
  volume: number // 0..1
  muted: boolean
  /** What's playing right now (null when silent) — drives any "now playing" UI. */
  current: SoundName | null

  setVolume: (v: number) => void
  toggleMute: () => void
  setMuted: (v: boolean) => void
  setCurrent: (name: SoundName | null) => void
}

export const useSoundStore = create<SoundState>()(
  persist(
    (set, get) => ({
      volume: 0.6,
      muted: false,
      current: null,

      setVolume: (v) => {
        const volume = Math.min(1, Math.max(0, v))
        soundService.setVolume(volume)
        // Raising the volume from zero implicitly unmutes.
        if (volume > 0 && get().muted) {
          soundService.unmute()
          set({ volume, muted: false })
        } else {
          set({ volume })
        }
      },

      toggleMute: () => {
        const next = !get().muted
        if (next) soundService.mute()
        else soundService.unmute()
        set({ muted: next })
      },

      setMuted: (muted) => {
        if (muted) soundService.mute()
        else soundService.unmute()
        set({ muted })
      },

      setCurrent: (current) => set({ current }),
    }),
    {
      name: "gm-sound-prefs",
      // Only persist preferences, never the transient "current" sound.
      partialize: (s) => ({ volume: s.volume, muted: s.muted }),
      onRehydrateStorage: () => (state) => {
        // Sync the restored prefs into the service on load.
        if (!state) return
        soundService.setVolume(state.volume)
        if (state.muted) soundService.mute()
      },
    },
  ),
)
