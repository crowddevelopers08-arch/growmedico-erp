"use client"

import { useEffect, useRef, useState } from "react"
import { Clock } from "lucide-react"
import { cn } from "@/lib/utils"

// A 12-hour AM/PM time picker that reads and emits the standard 24h "HH:MM"
// string used everywhere else (so it drops in for <input type="time">). Native
// time inputs render 12h/24h based on the OS locale, which we can't control —
// this component forces the Indian-style 12-hour display regardless.

interface TimeInput12hProps {
  value: string // 24h "HH:MM" or ""
  onChange: (value: string) => void
  className?: string
  disabled?: boolean
}

type Period = "AM" | "PM"

function parse(value: string): { h: string; m: string; period: Period } {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value || "")
  if (!match) return { h: "", m: "", period: "AM" }
  const H = Number(match[1])
  const period: Period = H >= 12 ? "PM" : "AM"
  const h12 = H % 12 || 12
  return { h: String(h12), m: match[2], period }
}

export function TimeInput12h({ value, onChange, className, disabled }: TimeInput12hProps) {
  const initial = parse(value)
  const [h, setH] = useState(initial.h)
  const [m, setM] = useState(initial.m)
  const [period, setPeriod] = useState<Period>(initial.period)

  // Re-sync when the external value changes (e.g. the dialog reopens for a
  // different record). We ignore our own emissions via `lastValue`.
  const lastValue = useRef(value)
  useEffect(() => {
    if (value !== lastValue.current) {
      lastValue.current = value
      const p = parse(value)
      setH(p.h)
      setM(p.m)
      setPeriod(p.period)
    }
  }, [value])

  const emit = (nh: string, nm: string, np: Period) => {
    let out = ""
    if (nh !== "" && nm !== "") {
      let H = Number(nh) % 12
      if (np === "PM") H += 12
      out = `${String(H).padStart(2, "0")}:${nm.padStart(2, "0")}`
    }
    lastValue.current = out
    onChange(out)
  }

  const onHour = (raw: string) => {
    let v = raw.replace(/\D/g, "").slice(0, 2)
    if (v && Number(v) > 12) v = "12"
    setH(v)
    emit(v, m, period)
  }

  const onMinute = (raw: string) => {
    let v = raw.replace(/\D/g, "").slice(0, 2)
    if (v && Number(v) > 59) v = "59"
    setM(v)
    emit(h, v, period)
  }

  const togglePeriod = () => {
    const np: Period = period === "AM" ? "PM" : "AM"
    setPeriod(np)
    emit(h, m, np)
  }

  return (
    <div
      className={cn(
        "flex h-9 w-full items-center gap-1 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-within:outline-none focus-within:ring-1 focus-within:ring-ring",
        disabled && "opacity-50 pointer-events-none",
        className,
      )}
    >
      <Clock className="size-4 text-muted-foreground shrink-0" />
      <input
        type="text"
        inputMode="numeric"
        placeholder="--"
        value={h}
        disabled={disabled}
        onChange={(e) => onHour(e.target.value)}
        onBlur={() => h && setH(String(Number(h)))}
        className="w-6 bg-transparent text-center tabular-nums outline-none placeholder:text-muted-foreground"
        aria-label="Hour"
      />
      <span className="text-muted-foreground">:</span>
      <input
        type="text"
        inputMode="numeric"
        placeholder="--"
        value={m}
        disabled={disabled}
        onChange={(e) => onMinute(e.target.value)}
        onBlur={() => m && setM(m.padStart(2, "0"))}
        className="w-6 bg-transparent text-center tabular-nums outline-none placeholder:text-muted-foreground"
        aria-label="Minute"
      />
      <button
        type="button"
        disabled={disabled}
        onClick={togglePeriod}
        className="ml-auto rounded px-2 py-0.5 text-xs font-medium text-foreground hover:bg-accent"
        aria-label="Toggle AM/PM"
      >
        {period}
      </button>
    </div>
  )
}
