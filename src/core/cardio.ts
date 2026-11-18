import { startOfWeek } from './dates'
import { newId } from './ids'
import { formatNumber } from './workout'
import type { CardioData, Sport, Workout } from './types'

// Ausdauer-Einheiten (Laufen, Rad, Schwimmen): Stoppuhr, nachträgliches Eintragen, Tempo. Reine Funktionen.

export const SPORTS: Sport[] = ['laufen', 'rad', 'schwimmen']
export const SPORT_LABEL: Record<Sport, string> = { laufen: 'Laufen', rad: 'Rad', schwimmen: 'Schwimmen' }

export const isCardio = (w: Workout) => w.type === 'cardio'

/** Startet die Stoppuhr für eine Ausdauer-Einheit. */
export function startCardio(sport: Sport, now = Date.now()): Workout {
  return { id: newId(), type: 'cardio', title: SPORT_LABEL[sport], startedAt: now, exercises: [], cardio: { sport, pausedMs: 0 } }
}

export function setSport(w: Workout, sport: Sport): Workout {
  if (!w.cardio) return w
  // Plan-Läufe behalten den Plannamen als Titel
  return { ...w, title: w.planId ? w.title : SPORT_LABEL[sport], cardio: { ...w.cardio, sport } }
}

export function pauseCardio(w: Workout, now = Date.now()): Workout {
  if (!w.cardio || w.cardio.pausedAt !== undefined) return w
  return { ...w, cardio: { ...w.cardio, pausedAt: now } }
}

export function resumeCardio(w: Workout, now = Date.now()): Workout {
  const c = w.cardio
  if (!c || c.pausedAt === undefined) return w
  const { pausedAt, ...rest } = c
  return { ...w, cardio: { ...rest, pausedMs: (c.pausedMs ?? 0) + Math.max(0, now - pausedAt) } }
}

/** Bewegungszeit der laufenden Stoppuhr in ms (ohne Pausen). */
export function elapsedMs(w: Workout, now = Date.now()): number {
  const c = w.cardio
  const end = c?.pausedAt ?? now
  return Math.max(0, end - w.startedAt - (c?.pausedMs ?? 0))
}

export interface CardioInput {
  sport: Sport
  durationSec: number
  distanceM?: number
  rpe?: number
  avgHr?: number
}

function cardioData(input: CardioInput): CardioData {
  const d: CardioData = { sport: input.sport }
  if (input.distanceM && input.distanceM > 0) d.distanceM = Math.round(input.distanceM)
  if (input.rpe && input.rpe >= 1 && input.rpe <= 10) d.rpe = Math.round(input.rpe)
  if (input.avgHr && input.avgHr > 0) d.avgHr = Math.round(input.avgHr)
  return d
}

/**
 * Beendet die Stoppuhr mit den Werten aus dem Fenster.
 * endedAt = Start + Bewegungszeit, damit die Dauer überall gleich berechnet wird.
 */
export function finishCardio(w: Workout, input: CardioInput): Workout {
  const durationSec = Math.max(1, Math.round(input.durationSec))
  const title = w.planId ? w.title : SPORT_LABEL[input.sport]
  return { ...w, title, endedAt: w.startedAt + durationSec * 1000, cardio: cardioData(input) }
}

/** Nachträglich eingetragene Einheit, die um `startedAt` begonnen hat. */
export function manualCardio(input: CardioInput, startedAt: number): Workout {
  const durationSec = Math.max(1, Math.round(input.durationSec))
  return {
    id: newId(),
    type: 'cardio',
    title: SPORT_LABEL[input.sport],
    startedAt,
    endedAt: startedAt + durationSec * 1000,
    exercises: [],
    cardio: cardioData(input),
  }
}

export const durationSec = (w: Workout) => Math.round(((w.endedAt ?? w.startedAt) - w.startedAt) / 1000)

/** Strecke für die Anzeige: Schwimmen in m, sonst in km. */
export function formatDistance(sport: Sport, m: number): string {
  return sport === 'schwimmen' ? `${formatNumber(Math.round(m))} m` : `${formatNumber(Math.round(m / 10) / 100)} km`
}

const minSec = (sec: number) => `${Math.floor(sec / 60)}:${String(Math.round(sec % 60)).padStart(2, '0')}`

/** Tempo: Laufen min/km, Rad km/h, Schwimmen min/100 m. Ohne Strecke null. Geschützte Leerzeichen, damit nichts umbricht. */
export function formatPace(sport: Sport, durationSec: number, distanceM?: number): string | null {
  if (!distanceM || distanceM <= 0 || durationSec <= 0) return null
  if (sport === 'rad') return `${formatNumber(Math.round((distanceM / 1000 / (durationSec / 3600)) * 10) / 10)} km/h`
  if (sport === 'schwimmen') return `${minSec(Math.round(durationSec / (distanceM / 100)))} /100 m`
  return `${minSec(Math.round(durationSec / (distanceM / 1000)))} /km`
}

/** Kurzfassung für Listen, z. B. „5,2 km · 28:30 · 5:29 /km“. */
export function cardioSummary(w: Workout, formatTime: (ms: number) => string): string {
  const c = w.cardio
  if (!c) return ''
  const sec = durationSec(w)
  const parts = [formatTime(sec * 1000)]
  if (c.distanceM) parts.unshift(formatDistance(c.sport, c.distanceM))
  const pace = formatPace(c.sport, sec, c.distanceM)
  if (pace) parts.push(pace)
  return parts.join(' · ')
}

export interface SportWeek {
  sport: Sport
  sessions: number
  minutes: number
  distanceM: number
}

/** Ausdauer dieser Woche (Montag bis jetzt), pro Sportart. Nur Sportarten mit Einheiten. */
export function cardioWeek(workouts: Workout[], now = Date.now()): SportWeek[] {
  const start = startOfWeek(now)
  const by = new Map<Sport, SportWeek>()
  for (const w of workouts) {
    if (!isCardio(w) || !w.cardio || w.endedAt === undefined || w.startedAt < start) continue
    const s = by.get(w.cardio.sport) ?? { sport: w.cardio.sport, sessions: 0, minutes: 0, distanceM: 0 }
    s.sessions++
    s.minutes += durationSec(w) / 60
    s.distanceM += w.cardio.distanceM ?? 0
    by.set(w.cardio.sport, s)
  }
  return SPORTS.filter((s) => by.has(s)).map((s) => by.get(s)!)
}

/** Zuletzt genutzte Sportart, für den Start der Stoppuhr. */
export function lastSport(workouts: Workout[]): Sport {
  let best: Workout | undefined
  for (const w of workouts) if (isCardio(w) && w.cardio && (!best || w.startedAt > best.startedAt)) best = w
  return best?.cardio?.sport ?? 'laufen'
}
