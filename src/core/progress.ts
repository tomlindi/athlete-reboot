import { startOfWeek } from './dates'
import type { SetEntry, Workout } from './types'

// Fortschritt: Bestwerte, geschätztes Maximum, Kraft-Index und Wochenvergleich. Reine Funktionen.

/** Geschätztes Maximalgewicht für 1 Wiederholung (Epley-Formel): kg × (1 + Wdh / 30). */
export function e1rm(kg: number, reps: number): number {
  return reps <= 1 ? kg : kg * (1 + reps / 30)
}

/** Ein Satz zählt für Bestwerte, wenn er erledigt ist und Gewicht und Wiederholungen hat. */
function counts(s: SetEntry): s is SetEntry & { kg: number; reps: number } {
  return s.done && s.kg !== null && s.kg > 0 && s.reps !== null && s.reps > 0
}

const finished = (workouts: Workout[]) =>
  workouts.filter((w) => w.endedAt !== undefined).sort((a, b) => a.startedAt - b.startedAt)

export interface SessionBest {
  t: number
  workoutId: string
  kg: number
  reps: number
  e1rm: number
}

/** Pro Training der beste Satz einer Übung (nach geschätztem Maximum), ältester zuerst. */
export function exerciseSessions(workouts: Workout[], exerciseId: string): SessionBest[] {
  const out: SessionBest[] = []
  for (const w of finished(workouts)) {
    let best: SessionBest | null = null
    for (const e of w.exercises) {
      if (e.exerciseId !== exerciseId) continue
      for (const s of e.sets) {
        if (!counts(s)) continue
        const v = e1rm(s.kg, s.reps)
        if (!best || v > best.e1rm || (v === best.e1rm && s.kg > best.kg)) {
          best = { t: w.startedAt, workoutId: w.id, kg: s.kg, reps: s.reps, e1rm: v }
        }
      }
    }
    if (best) out.push(best)
  }
  return out
}

export function bestSession(sessions: SessionBest[]): SessionBest | null {
  return sessions.reduce<SessionBest | null>((b, s) => (!b || s.e1rm > b.e1rm ? s : b), null)
}

/** Alle Übungen mit mindestens einem gewerteten Satz. */
export function trainedExerciseIds(workouts: Workout[]): string[] {
  const ids = new Set<string>()
  for (const w of finished(workouts)) for (const e of w.exercises) if (e.sets.some(counts)) ids.add(e.exerciseId)
  return [...ids]
}

export interface IndexPoint {
  t: number
  /** Veränderung in Prozent gegenüber dem Start, Durchschnitt über alle Übungen */
  value: number
}

/**
 * Kraft-Index: Für jede Übung zählt der beste Satz des letzten Trainings mit dieser Übung,
 * verglichen mit ihrem allerersten Training. Der Index ist der Durchschnitt dieser Prozentwerte.
 * Neue Übungen starten bei 0 % und verfälschen die Kurve deshalb nicht.
 */
export function strengthIndex(workouts: Workout[]): IndexPoint[] {
  const baseline = new Map<string, number>()
  const latest = new Map<string, number>()
  const points: IndexPoint[] = []
  for (const w of finished(workouts)) {
    let changed = false
    const bestHere = new Map<string, number>()
    for (const e of w.exercises) {
      for (const s of e.sets) {
        if (!counts(s)) continue
        const v = e1rm(s.kg, s.reps)
        if (v > (bestHere.get(e.exerciseId) ?? 0)) bestHere.set(e.exerciseId, v)
      }
    }
    for (const [id, v] of bestHere) {
      if (!baseline.has(id)) baseline.set(id, v)
      latest.set(id, v)
      changed = true
    }
    if (!changed) continue
    let sum = 0
    for (const [id, base] of baseline) sum += ((latest.get(id)! - base) / base) * 100
    points.push({ t: w.startedAt, value: sum / baseline.size })
  }
  return points
}

export interface WeekStats {
  trainings: number
  sets: number
  volume: number
}

function statsBetween(workouts: Workout[], from: number, to: number): WeekStats {
  const s: WeekStats = { trainings: 0, sets: 0, volume: 0 }
  for (const w of workouts) {
    if (w.endedAt === undefined || w.startedAt < from || w.startedAt >= to) continue
    s.trainings++
    for (const e of w.exercises)
      for (const set of e.sets) {
        if (!set.done) continue
        s.sets++
        s.volume += (set.kg ?? 0) * (set.reps ?? 0)
      }
  }
  return s
}

/** Diese Woche (Montag bis jetzt) und die ganze Vorwoche. */
export function weekComparison(workouts: Workout[], now = Date.now()): { current: WeekStats; previous: WeekStats } {
  const start = startOfWeek(now)
  const prevStartDate = new Date(start)
  prevStartDate.setDate(prevStartDate.getDate() - 7)
  return {
    current: statsBetween(workouts, start, Number.POSITIVE_INFINITY),
    previous: statsBetween(workouts, prevStartDate.getTime(), start),
  }
}

export interface NewBest {
  exerciseId: string
  kg: number
  reps: number
  e1rm: number
}

/**
 * Neue Bestwerte in einem Training: der beste Satz einer Übung liegt über allem, was es
 * vorher gab. Beim allerersten Training einer Übung gibt es noch keinen Vergleich, also keinen Bestwert.
 */
export function newBests(workout: Workout, history: Workout[]): NewBest[] {
  const before = history.filter((w) => w.id !== workout.id && w.endedAt !== undefined && w.startedAt < workout.startedAt)
  const out: NewBest[] = []
  const seen = new Set<string>()
  for (const e of workout.exercises) {
    if (seen.has(e.exerciseId)) continue
    seen.add(e.exerciseId)
    const prev = bestSession(exerciseSessions(before, e.exerciseId))
    if (!prev) continue
    let best: NewBest | null = null
    for (const x of workout.exercises.filter((y) => y.exerciseId === e.exerciseId))
      for (const s of x.sets) {
        if (!counts(s)) continue
        const v = e1rm(s.kg, s.reps)
        if (v > prev.e1rm + 1e-9 && (!best || v > best.e1rm)) best = { exerciseId: e.exerciseId, kg: s.kg, reps: s.reps, e1rm: v }
      }
    if (best) out.push(best)
  }
  return out
}

export type Range = 'W' | 'M' | 'J'

/** Beginn des Zeitraums: letzte 7 Tage, letzte 30 Tage oder letztes Jahr. */
export function rangeStart(range: Range, now = Date.now()): number {
  const days = range === 'W' ? 7 : range === 'M' ? 30 : 365
  return now - days * 86400000
}

/** Saubere Achsenwerte (1, 2, 2,5 oder 5 mal Zehnerpotenz). */
export function niceTicks(min: number, max: number, count = 4): number[] {
  if (min === max) {
    const pad = Math.abs(min) * 0.05 || 1
    min -= pad
    max += pad
  }
  const raw = (max - min) / count
  const mag = 10 ** Math.floor(Math.log10(raw))
  const step = [1, 2, 2.5, 5, 10].map((f) => f * mag).find((s) => s >= raw)!
  const lo = Math.floor(min / step) * step
  const hi = Math.ceil(max / step) * step
  const ticks: number[] = []
  for (let v = lo; v <= hi + step / 2; v += step) ticks.push(Math.round(v * 1e6) / 1e6)
  return ticks
}
