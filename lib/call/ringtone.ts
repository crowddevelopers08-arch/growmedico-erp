"use client"

// Asset-free ring tones via the Web Audio API. Avoids shipping/licensing mp3s
// and never 404s. "incoming" is a two-tone ring; "outgoing" is the slower
// single-tone ringback you hear while a call connects.

type Variant = "incoming" | "outgoing"

class RingtonePlayer {
  private ctx: AudioContext | null = null
  private timer: ReturnType<typeof setInterval> | null = null
  private stopped = true

  start(variant: Variant) {
    this.stop()
    this.stopped = false
    // Created lazily inside a user-gesture-adjacent call so autoplay policies
    // don't block it. If the browser still blocks, we simply stay silent.
    try {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      this.ctx = new Ctor()
    } catch {
      return
    }

    const ring = variant === "incoming" ? this.incomingRing : this.outgoingRing
    ring()
    // Repeat the whole pattern on a cadence.
    this.timer = setInterval(ring, variant === "incoming" ? 3000 : 4000)
  }

  private incomingRing = () => {
    // Two quick warbles (≈ classic ringtone).
    this.beep(0, 0.4, 480, 620)
    this.beep(0.6, 0.4, 480, 620)
  }

  private outgoingRing = () => {
    // One long ringback tone.
    this.beep(0, 1.0, 440, 480)
  }

  private beep(offset: number, duration: number, freqA: number, freqB: number) {
    if (!this.ctx || this.stopped) return
    const now = this.ctx.currentTime + offset
    const gain = this.ctx.createGain()
    gain.gain.setValueAtTime(0, now)
    gain.gain.linearRampToValueAtTime(0.15, now + 0.02)
    gain.gain.setValueAtTime(0.15, now + duration - 0.05)
    gain.gain.linearRampToValueAtTime(0, now + duration)
    gain.connect(this.ctx.destination)

    for (const f of [freqA, freqB]) {
      const osc = this.ctx.createOscillator()
      osc.type = "sine"
      osc.frequency.value = f
      osc.connect(gain)
      osc.start(now)
      osc.stop(now + duration)
    }
  }

  stop() {
    this.stopped = true
    if (this.timer) {
      clearInterval(this.timer)
      this.timer = null
    }
    if (this.ctx) {
      this.ctx.close().catch(() => {})
      this.ctx = null
    }
  }
}

// One shared instance — only ever one ring at a time.
let player: RingtonePlayer | null = null

export function playRingtone(variant: Variant) {
  if (typeof window === "undefined") return
  if (!player) player = new RingtonePlayer()
  player.start(variant)
}

export function stopRingtone() {
  player?.stop()
}
