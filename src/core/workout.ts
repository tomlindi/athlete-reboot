import { newId } from './ids'
import { entryFlag, entryMeasure, MEASURE_UNIT } from './measure'
import type { ExerciseEntry, Measure, SetEntry, Workout } from './types'

// Reine Funktionen: Sie verändern nichts, sondern geben immer ein neues Training zurück.

export function createWorkout(now = Date.now(), title = 'Freies Training'): Workout {
  return { id: newId(), type: 'gym', title, startedAt: now, exercises: [] }
}

export function emptySet(prefill?: Pick<SetEntry, 'kg' | 'reps'>): SetEntry {
  return { id: newId(), kg: prefill?.kg ?? null, reps: prefill?.reps ?? null, done: false, failure: false }
}

/**
 * Fügt eine Übung mit einem ersten Satz hinzu, vorbefüllt mit dem ersten Satz vom letzten Mal.
 * `measure`: Bei Zeit- und Strecken-Übungen speichern die Sätze Sekunden bzw. Meter statt Wiederholungen.
 */
export function addExercise(w: Workout, exerciseId: string, previous: SetEntry[] = [], measure: Measure = 'reps'): Workout {
  const first = previous[0]
  const entry: ExerciseEntry = {
    id: newId(),
    exerciseId,
    ...entryFlag(measure),
    sets: [emptySet(first ? { kg: first.kg, reps: first.reps } : undefined)],
  }
  return { ...w, exercises: [...w.exercises, entry] }
}

export function removeExercise(w: Workout, entryId: string): Workout {
  const next = { ...w, exercises: w.exercises.filter((e) => e.id !== entryId) }
  return w.hold?.entryId === entryId ? cancelHold(next) : next
}

function mapEntry(w: Workout, entryId: string, fn: (e: ExerciseEntry) => ExerciseEntry): Workout {
  return { ...w, exercises: w.exercises.map((e) => (e.id === entryId ? fn(e) : e)) }
}

/**
 * Neuer Satz: übernimmt Gewicht und Wiederholungen des vorigen Satzes in diesem Training,
 * sonst den passenden Satz vom letzten Mal.
 */
export function addSet(w: Workout, entryId: string, previous: SetEntry[] = []): Workout {
  return mapEntry(w, entryId, (e) => {
    const last = e.sets[e.sets.length - 1]
    const fromPrevious = previous[e.sets.length]
    const prefill = last ? { kg: last.kg, reps: last.reps } : fromPrevious
    return { ...e, sets: [...e.sets, emptySet(prefill)] }
  })
}

export function updateSet(w: Workout, entryId: string, setId: string, patch: Partial<SetEntry>): Workout {
  return mapEntry(w, entryId, (e) => ({
    ...e,
    sets: e.sets.map((s) => (s.id === setId ? { ...s, ...patch } : s)),
  }))
}

export function removeSet(w: Workout, entryId: string, setId: string): Workout {
  const next = mapEntry(w, entryId, (e) => ({ ...e, sets: e.sets.filter((s) => s.id !== setId) }))
  return w.hold?.setId === setId ? cancelHold(next) : next
}

/** Haken setzen oder entfernen. */
export function toggleDone(w: Workout, entryId: string, setId: string): Workout {
  const set = findSet(w, entryId, setId)
  if (!set) return w
  return updateSet(w, entryId, setId, { done: !set.done, failure: set.done ? false : set.failure })
}

/** Muskelversagen markieren. Ein Satz bis zum Versagen gilt automatisch als erledigt. */
export function toggleFailure(w: Workout, entryId: string, setId: string): Workout {
  const set = findSet(w, entryId, setId)
  if (!set) return w
  return updateSet(w, entryId, setId, { failure: !set.failure, done: set.failure ? set.done : true })
}

function findSet(w: Workout, entryId: string, setId: string): SetEntry | undefined {
  return w.exercises.find((e) => e.id === entryId)?.sets.find((s) => s.id === setId)
}

// ---------- Pausentimer ----------

/** Startet eine Pause von `sec` Sekunden ab jetzt. Eine laufende Pause wird ersetzt. */
export function startRest(w: Workout, sec: number, now = Date.now()): Workout {
  return { ...w, rest: { endsAt: now + sec * 1000, total: sec } }
}

/** Verlängert die laufende Pause, z. B. um 15 Sekunden. */
export function extendRest(w: Workout, sec: number, now = Date.now()): Workout {
  if (!w.rest) return w
  const endsAt = Math.max(w.rest.endsAt, now) + sec * 1000
  return { ...w, rest: { endsAt, total: w.rest.total + sec } }
}

export function stopRest(w: Workout): Workout {
  if (!w.rest) return w
  const { rest: _rest, ...rest } = w
  return rest
}

/** Verbleibende Pause in Sekunden (aufgerundet), 0 wenn vorbei oder keine Pause läuft. */
export function restRemaining(w: Workout, now = Date.now()): number {
  return w.rest ? Math.max(0, Math.ceil((w.rest.endsAt - now) / 1000)) : 0
}

/**
 * Haken setzen. Wird ein Satz dadurch erledigt, startet die Pause:
 * mit der Pausenzeit aus dem Plan, sonst mit der Standard-Pause aus den Einstellungen.
 */
export function completeSet(w: Workout, entryId: string, setId: string, defaultRestSec: number, now = Date.now()): Workout {
  const before = findSet(w, entryId, setId)
  const next = toggleDone(w, entryId, setId)
  if (!before || before.done) return next
  const target = w.exercises.find((e) => e.id === entryId)?.target
  return startRest(next, target?.restSec ?? defaultRestSec, now)
}

/** Muskelversagen markieren. Wird der Satz dadurch erst erledigt, startet ebenfalls die Pause. */
export function failSet(w: Workout, entryId: string, setId: string, defaultRestSec: number, now = Date.now()): Workout {
  const before = findSet(w, entryId, setId)
  const next = toggleFailure(w, entryId, setId)
  if (!before || before.done || before.failure) return next
  const target = w.exercises.find((e) => e.id === entryId)?.target
  return startRest(next, target?.restSec ?? defaultRestSec, now)
}

// ---------- Countdown für Zeit-Übungen ----------

/**
 * Startet den Countdown für einen Satz einer Zeit-Übung. Die geplante Zeit wird in den Satz
 * geschrieben. Eine laufende Pause oder ein anderer Countdown wird beendet.
 */
export function startHold(w: Workout, entryId: string, setId: string, sec: number, now = Date.now()): Workout {
  const total = Math.max(1, Math.round(sec))
  const next = updateSet(stopRest(w), entryId, setId, { reps: total })
  return { ...next, hold: { entryId, setId, startedAt: now, endsAt: now + total * 1000, total } }
}

export function cancelHold(w: Workout): Workout {
  if (!w.hold) return w
  const { hold: _hold, ...rest } = w
  return rest
}

/** Verbleibende Haltezeit in Sekunden (aufgerundet). */
export function holdRemaining(w: Workout, now = Date.now()): number {
  return w.hold ? Math.max(0, Math.ceil((w.hold.endsAt - now) / 1000)) : 0
}

/**
 * Beendet den Countdown: Der Satz wird abgehakt, mit der tatsächlich gehaltenen Zeit
 * (bei vorzeitigem „Fertig“ weniger als geplant), und die Pause startet.
 */
export function finishHold(w: Workout, defaultRestSec: number, now = Date.now()): Workout {
  const hold = w.hold
  if (!hold) return w
  const held = Math.min(hold.total, Math.max(1, Math.round((Math.min(now, hold.endsAt) - hold.startedAt) / 1000)))
  let next = updateSet(cancelHold(w), hold.entryId, hold.setId, { reps: held })
  const set = findSet(next, hold.entryId, hold.setId)
  if (set && !set.done) next = completeSet(next, hold.entryId, hold.setId, defaultRestSec, now)
  return next
}

/** Erledigte Sätze und Volumen (kg × Wdh) eines Trainings. Zeit- und Strecken-Übungen zählen nicht ins Volumen. */
export function summarize(w: Workout): { sets: number; volume: number; exercises: number } {
  let sets = 0
  let volume = 0
  for (const e of w.exercises) {
    for (const s of e.sets) {
      if (!s.done) continue
      sets++
      if (entryMeasure(e) === 'reps') volume += (s.kg ?? 0) * (s.reps ?? 0)
    }
  }
  return { sets, volume, exercises: w.exercises.filter((e) => e.sets.some((s) => s.done)).length }
}

/** Beim Beenden: nicht abgehakte Sätze und leere Übungen fallen weg. */
export function finishWorkout(w: Workout, rating: Workout['rating'], now = Date.now()): Workout {
  const exercises = w.exercises
    .map((e) => ({ ...e, sets: e.sets.filter((s) => s.done) }))
    .filter((e) => e.sets.length > 0)
  return { ...cancelHold(stopRest(w)), exercises, rating, endedAt: now }
}

/**
 * Die Sätze dieser Übung aus dem letzten beendeten Training.
 * Grundlage für die Spalte „Letztes Mal“ und das Vorbefüllen.
 */
export function previousSets(workouts: Workout[], exerciseId: string, beforeWorkoutId?: string): SetEntry[] {
  const finished = workouts
    .filter((w) => w.endedAt !== undefined && w.id !== beforeWorkoutId)
    .sort((a, b) => b.startedAt - a.startedAt)
  for (const w of finished) {
    const entry = w.exercises.find((e) => e.exerciseId === exerciseId)
    if (entry && entry.sets.length > 0) return entry.sets
  }
  return []
}

/** Liest Eingaben wie „82,5“ oder „82.5“. Leer oder ungültig = null. */
export function parseNumber(input: string): number | null {
  const cleaned = input.trim().replace(',', '.')
  if (cleaned === '') return null
  const n = Number(cleaned)
  return Number.isFinite(n) && n >= 0 ? n : null
}

/** Zahl für die Anzeige im deutschen Format, ohne unnötige Nachkommastellen. */
export function formatNumber(n: number | null): string {
  if (n === null) return ''
  return n.toLocaleString('de-DE', { maximumFractionDigits: 2 })
}

/** „82,5 × 8“, bei Zeit-Übungen „30 s“, bei Strecken „40 m“, mit Zusatzgewicht „24 × 40 m“. */
export function formatSet(s: Pick<SetEntry, 'kg' | 'reps'>, measure: Measure = 'reps'): string {
  if (s.kg === null && s.reps === null) return '–'
  if (measure !== 'reps') {
    const value = `${s.reps ?? 0}${MEASURE_UNIT[measure]}`
    return s.kg ? `${formatNumber(s.kg)} × ${value}` : value
  }
  return `${formatNumber(s.kg ?? 0)} × ${s.reps ?? 0}`
}
