// Date helpers for the "YYYY-MM-DD" strings used across attendance, leaves and
// salary records.
//
// Never use `new Date().toISOString().split("T")[0]` for these: it converts to
// UTC first. On the server (Vercel runs in UTC) and in the browser alike, every
// IST wall-clock time before 05:30 falls on the *previous* UTC day, so records
// were being stamped a day behind.

/** Today's date in India (Asia/Kolkata) as "YYYY-MM-DD". */
export function todayIST(): string {
  // en-CA formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date())
}

/** Convert a 24h "HH:MM" time to 12h "h:MM AM/PM". Returns null when empty. */
export function to12h(time: string | null | undefined): string | null {
  if (!time) return null
  const [h, m] = time.split(":").map(Number)
  if (Number.isNaN(h) || Number.isNaN(m)) return null
  const ampm = h >= 12 ? "PM" : "AM"
  const hour = h % 12 || 12
  return `${hour}:${String(m).padStart(2, "0")} ${ampm}`
}

/**
 * Format a Date as "YYYY-MM-DD" from its local calendar parts.
 * Use for dates the user picked in a calendar, so the stored day matches the
 * day they actually clicked.
 */
export function toDateStr(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}
