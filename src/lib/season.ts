// Easter, worked out for any year, so the "Thinking about a bunny?" reminder
// shows itself in the weeks before Easter without anyone remembering to post
// it. OHRR's research: requests to surrender rise two to three months after
// Easter.

/** Easter Sunday (Western), by the anonymous Gregorian algorithm. */
export function easterSunday(year: number): Date {
  const a = year % 19
  const b = Math.floor(year / 100)
  const c = year % 100
  const d = Math.floor(b / 4)
  const e = b % 4
  const f = Math.floor((b + 8) / 25)
  const g = Math.floor((b - f + 1) / 3)
  const h = (19 * a + b - d - g + 15) % 30
  const i = Math.floor(c / 4)
  const k = c % 4
  const l = (32 + 2 * e + 2 * i - h - k) % 7
  const m = Math.floor((a + 11 * h + 22 * l) / 451)
  const month = Math.floor((h + l - 7 * m + 114) / 31)
  const day = ((h + l - 7 * m + 114) % 31) + 1
  return new Date(year, month - 1, day)
}

/** The Easter date when today falls in the seven weeks before it (through Easter Sunday), else null. */
export function easterAhead(now = new Date()): Date | null {
  const easter = easterSunday(now.getFullYear())
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const days = Math.round((easter.getTime() - today.getTime()) / 86_400_000)
  return days >= 0 && days <= 49 ? easter : null
}
