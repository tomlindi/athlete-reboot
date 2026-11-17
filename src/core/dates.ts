// Datums-Hilfen. Alles in lokaler Zeit, Wochen beginnen am Montag.

/** Lokales Datum als JJJJ-MM-TT. */
export function dateKey(d: Date | number): string {
  const date = typeof d === 'number' ? new Date(d) : d
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** Montag 0:00 der Woche, in der der Zeitpunkt liegt. */
export function startOfWeek(t: number): number {
  const d = new Date(t)
  const weekday = (d.getDay() + 6) % 7 // Montag = 0
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() - weekday)
  return d.getTime()
}

/** Überschrift für eine Woche im Verlauf. */
export function weekLabel(weekStart: number, now = Date.now()): string {
  const thisWeek = startOfWeek(now)
  if (weekStart === thisWeek) return 'Diese Woche'
  const lastWeek = new Date(thisWeek)
  lastWeek.setDate(lastWeek.getDate() - 7)
  if (weekStart === lastWeek.getTime()) return 'Letzte Woche'
  const end = new Date(weekStart)
  end.setDate(end.getDate() + 6)
  const fmt = new Intl.DateTimeFormat('de-DE', { day: 'numeric', month: 'short' })
  return `${fmt.format(weekStart)} – ${fmt.format(end)}`
}

export interface MonthCell {
  key: string
  day: number
  inMonth: boolean
}

/** Kalenderraster für einen Monat: volle Wochen von Montag bis Sonntag. */
export function monthGrid(year: number, month: number): MonthCell[] {
  const first = new Date(year, month, 1)
  const start = new Date(startOfWeek(first.getTime()))
  const last = new Date(year, month + 1, 0)
  const cells: MonthCell[] = []
  const d = new Date(start)
  while (d <= last || cells.length % 7 !== 0) {
    cells.push({ key: dateKey(d), day: d.getDate(), inMonth: d.getMonth() === month })
    d.setDate(d.getDate() + 1)
  }
  return cells
}

/** Dauer als „58 min“ oder „1 h 05 min“. */
export function formatDuration(ms: number): string {
  const totalMin = Math.max(0, Math.round(ms / 60000))
  const h = Math.floor(totalMin / 60)
  const m = totalMin % 60
  return h > 0 ? `${h} h ${String(m).padStart(2, '0')} min` : `${m} min`
}

/** Laufende Uhr als „0:42:13“. */
export function formatClock(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}
