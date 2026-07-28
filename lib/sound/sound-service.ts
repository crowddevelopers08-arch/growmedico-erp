"use client"

// Reusable notification sound service. Synthesizes short, distinct tones with
// the Web Audio API instead of shipping/licensing mp3s — so it never 404s, has
// zero asset weight, and every notification type gets its own recognizable
// signature. A single shared instance owns one AudioContext.
//
// Public API mirrors a media element: play / pause / resume / stop / loop /
// setVolume / mute / unmute.

/** One tone within a pattern (relative start + duration, in seconds). */
interface Note {
  freq: number
  start: number
  dur: number
  /** 0..1 relative loudness within the pattern. */
  gain?: number
}

export interface SoundPattern {
  notes: Note[]
  /** Total length in seconds — used to schedule loops. */
  length: number
  type?: OscillatorType
}

/**
 * Named signatures. Kept intentionally short and musically distinct so users
 * learn them by ear (Slack/Teams style).
 */
export const SOUND_PATTERNS = {
  // Soft two-note "ding" — chat messages.
  message: {
    length: 0.4,
    notes: [
      { freq: 880, start: 0, dur: 0.12 },
      { freq: 1174, start: 0.1, dur: 0.18 },
    ],
  },
  // Bright ascending triad — a task landed on you.
  task: {
    length: 0.55,
    notes: [
      { freq: 587, start: 0, dur: 0.12 },
      { freq: 784, start: 0.12, dur: 0.12 },
      { freq: 1046, start: 0.26, dur: 0.2 },
    ],
  },
  // Warm major third — approvals / success.
  success: {
    length: 0.5,
    notes: [
      { freq: 659, start: 0, dur: 0.16 },
      { freq: 988, start: 0.14, dur: 0.28 },
    ],
  },
  // Low double-thud — rejections / errors.
  error: {
    length: 0.45,
    notes: [
      { freq: 311, start: 0, dur: 0.16, gain: 0.9 },
      { freq: 233, start: 0.18, dur: 0.22, gain: 0.9 },
    ],
    type: "triangle" as OscillatorType,
  },
  // Single soft blip — general/system notifications.
  general: {
    length: 0.3,
    notes: [{ freq: 660, start: 0, dur: 0.16, gain: 0.7 }],
  },
  // Repeating warble — call ringtone (used via loop()).
  ring: {
    length: 2.4,
    notes: [
      { freq: 480, start: 0, dur: 0.4 },
      { freq: 620, start: 0, dur: 0.4 },
      { freq: 480, start: 0.6, dur: 0.4 },
      { freq: 620, start: 0.6, dur: 0.4 },
    ],
  },
} satisfies Record<string, SoundPattern>

export type SoundName = keyof typeof SOUND_PATTERNS

class SoundService {
  private ctx: AudioContext | null = null
  private master: GainNode | null = null
  private volume = 0.6
  private muted = false
  private loopTimer: ReturnType<typeof setInterval> | null = null
  private currentName: SoundName | null = null

  /** Lazily create the context — must first run inside a user gesture so the
   *  browser's autoplay policy lets it make sound. */
  private ensure(): boolean {
    if (typeof window === "undefined") return false
    if (!this.ctx) {
      try {
        const Ctor =
          window.AudioContext ??
          (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
        this.ctx = new Ctor()
        this.master = this.ctx.createGain()
        this.master.gain.value = this.muted ? 0 : this.volume
        this.master.connect(this.ctx.destination)
      } catch {
        return false
      }
    }
    if (this.ctx.state === "suspended") this.ctx.resume().catch(() => {})
    return true
  }

  private render(pattern: SoundPattern) {
    if (!this.ctx || !this.master) return
    const now = this.ctx.currentTime
    for (const note of pattern.notes) {
      const osc = this.ctx.createOscillator()
      const gain = this.ctx.createGain()
      const peak = 0.5 * (note.gain ?? 1)
      const t = now + note.start
      osc.type = pattern.type ?? "sine"
      osc.frequency.value = note.freq
      gain.gain.setValueAtTime(0, t)
      gain.gain.linearRampToValueAtTime(peak, t + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.0001, t + note.dur)
      osc.connect(gain)
      gain.connect(this.master)
      osc.start(t)
      osc.stop(t + note.dur + 0.02)
    }
  }

  /** Play a named sound once (or looped). Looping replaces any current loop. */
  play(name: SoundName, opts?: { loop?: boolean }) {
    if (!this.ensure()) return
    this.stopLoop()
    this.currentName = name
    const pattern = SOUND_PATTERNS[name]
    this.render(pattern)
    if (opts?.loop) {
      this.loopTimer = setInterval(() => this.render(pattern), pattern.length * 1000)
    }
  }

  /** Convenience for the always-looping case (ringtone). */
  loop(name: SoundName) {
    this.play(name, { loop: true })
  }

  /** Suspend all audio (keeps schedule; resume() continues). */
  pause() {
    this.ctx?.suspend().catch(() => {})
  }

  resume() {
    this.ctx?.resume().catch(() => {})
  }

  /** Stop everything currently playing/looping. */
  stop() {
    this.stopLoop()
    this.currentName = null
    // Recreating the context is the reliable cross-browser way to kill any
    // already-scheduled oscillators immediately.
    if (this.ctx) {
      this.ctx.close().catch(() => {})
      this.ctx = null
      this.master = null
    }
  }

  private stopLoop() {
    if (this.loopTimer) {
      clearInterval(this.loopTimer)
      this.loopTimer = null
    }
  }

  setVolume(v: number) {
    this.volume = Math.min(1, Math.max(0, v))
    if (this.master && !this.muted) this.master.gain.value = this.volume
  }

  getVolume() {
    return this.volume
  }

  mute() {
    this.muted = true
    if (this.master) this.master.gain.value = 0
  }

  unmute() {
    this.muted = false
    if (this.master) this.master.gain.value = this.volume
  }

  isMuted() {
    return this.muted
  }

  get playing(): SoundName | null {
    return this.currentName
  }
}

/** Shared singleton — one AudioContext for the whole app. */
export const soundService = new SoundService()
