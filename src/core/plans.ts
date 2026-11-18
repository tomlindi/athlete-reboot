import { newId } from './ids'
import { emptySet, previousSets } from './workout'
import { entryFlag, MEASURE_MAX, MEASURE_UNIT } from './measure'
import { moveItem } from './order'
import type { ExerciseEntry, Measure, Plan, PlanExercise, Rating, Target, Workout } from './types'

// Trainingspläne: reine Funktionen, die immer einen neuen Plan zurückgeben.

export const DEFAULT_TARGET: Target = { sets: 3, repMin: 8, repMax: 10, restSec: 120 }
/** Vorgabe für Zeit-Übungen: 3 × 30–45 s mit 1:00 Pause */
export const DEFAULT_TIMED_TARGET: Target = { sets: 3, repMin: 30, repMax: 45, restSec: 60 }
/** Vorgabe für Strecken-Übungen: 3 × 20–30 m mit 1:30 Pause */
export const DEFAULT_DISTANCE_TARGET: Target = { sets: 3, repMin: 20, repMax: 30, restSec: 90 }

export const defaultTarget = (m: Measure): Target =>
  m === 'time' ? DEFAULT_TIMED_TARGET : m === 'distance' ? DEFAULT_DISTANCE_TARGET : DEFAULT_TARGET

/** Auswahl für die Pausenzeit im Plan. */
export const REST_OPTIONS = [30, 45, 60, 75, 90, 105, 120, 150, 180, 210, 240, 300]

export function createPlan(name: string, order = 0): Plan {
  return { id: newId(), name: name.trim(), exercises: [], order }
}

export function addPlanExercise(plan: Plan, exerciseId: string, target: Target = DEFAULT_TARGET): Plan {
  const pe: PlanExercise = { id: newId(), exerciseId, ...target }
  return { ...plan, exercises: [...plan.exercises, pe] }
}

export function updatePlanExercise(plan: Plan, id: string, patch: Partial<Target>, measure: Measure = 'reps'): Plan {
  return {
    ...plan,
    exercises: plan.exercises.map((e) => (e.id === id ? normalizeTarget({ ...e, ...patch }, measure) : e)),
  }
}

export function removePlanExercise(plan: Plan, id: string): Plan {
  return { ...plan, exercises: plan.exercises.filter((e) => e.id !== id) }
}

/** Verschiebt eine Übung im Plan um eine Position nach oben (-1) oder unten (+1). */
export function movePlanExercise(plan: Plan, id: string, delta: -1 | 1): Plan {
  const i = plan.exercises.findIndex((e) => e.id === id)
  const j = i + delta
  if (i < 0 || j < 0 || j >= plan.exercises.length) return plan
  const list = [...plan.exercises]
  ;[list[i], list[j]] = [list[j], list[i]]
  return { ...plan, exercises: list }
}

/** Verschiebt eine Übung im Plan von Position `from` nach `to` (Ziehen). */
export function movePlanExerciseTo(plan: Plan, from: number, to: number): Plan {
  return { ...plan, exercises: moveItem(plan.exercises, from, to) }
}

/**
 * Neue Reihenfolge nach dem Ziehen innerhalb einer Liste (z. B. nur Ausdauer-Pläne).
 * Die gezogenen Pläne bekommen die Plätze, die diese Gruppe vorher belegt hat; andere Pläne bleiben, wo sie sind.
 * Gibt nur Pläne mit geändertem `order` zurück.
 */
export function reorderPlans(all: Plan[], groupIds: string[], from: number, to: number): Plan[] {
  const sorted = [...all].sort((a, b) => a.order - b.order)
  const slots = sorted.map((p, i) => (groupIds.includes(p.id) ? i : -1)).filter((i) => i >= 0)
  const moved = moveItem(groupIds, from, to)
  const result = [...sorted]
  slots.forEach((slot, k) => {
    result[slot] = sorted.find((p) => p.id === moved[k])!
  })
  return result.flatMap((p, i) => (p.order === i ? [] : [{ ...p, order: i }]))
}

/** Hält die Werte in sinnvollen Grenzen: 1–10 Sätze, 1–50 Wdh (bzw. 1–600 s, 1–2000 m), Minimum nie über Maximum. */
export function normalizeTarget<T extends Target>(t: T, measure: Measure = 'reps'): T {
  const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, Math.round(n) || lo))
  const top = MEASURE_MAX[measure]
  const sets = clamp(t.sets, 1, 10)
  const repMin = clamp(t.repMin, 1, top)
  const repMax = Math.max(repMin, clamp(t.repMax, 1, top))
  return { ...t, sets, repMin, repMax, restSec: clamp(t.restSec, 15, 600) }
}

export function planSetCount(plan: Plan): number {
  return plan.exercises.reduce((n, e) => n + e.sets, 0)
}

/**
 * Startet ein Training aus einem Plan. Jede Übung bekommt so viele Sätze wie geplant,
 * vorbefüllt mit den Werten vom letzten Mal (Satz für Satz, sonst der letzte bekannte Satz).
 */
export function workoutFromPlan(
  plan: Plan,
  history: Workout[],
  now = Date.now(),
  measureOf: (exerciseId: string) => Measure = () => 'reps',
): Workout {
  const exercises: ExerciseEntry[] = plan.exercises.map((pe) => {
    const prev = previousSets(history, pe.exerciseId)
    const target: Target = { sets: pe.sets, repMin: pe.repMin, repMax: pe.repMax, restSec: pe.restSec }
    return {
      id: newId(),
      exerciseId: pe.exerciseId,
      ...entryFlag(measureOf(pe.exerciseId)),
      target,
      sets: Array.from({ length: pe.sets }, (_, i) => {
        const p = prev[i] ?? prev[prev.length - 1]
        return emptySet(p ? { kg: p.kg, reps: p.reps } : undefined)
      }),
    }
  })
  return { id: newId(), type: 'gym', title: plan.name, startedAt: now, exercises, planId: plan.id }
}

export type GoalState = 'reached' | 'in-range' | 'open'

/**
 * Stand einer Übung gegenüber der Plan-Vorgabe:
 *   reached  = alle geplanten Sätze erledigt und überall das obere Ende geschafft (nächstes Mal mehr Gewicht)
 *   in-range = alle geplanten Sätze erledigt und überall mindestens das untere Ende
 *   open     = noch nicht so weit
 */
export function goalState(entry: ExerciseEntry): GoalState | null {
  const t = entry.target
  if (!t) return null
  const done = entry.sets.filter((s) => s.done)
  if (done.length < t.sets) return 'open'
  const counted = done.slice(0, t.sets)
  if (counted.every((s) => (s.reps ?? 0) >= t.repMax)) return 'reached'
  if (counted.every((s) => (s.reps ?? 0) >= t.repMin)) return 'in-range'
  return 'open'
}

/**
 * Vorschlag für die Bewertung beim Beenden: „gut“, wenn mindestens die Hälfte der geplanten
 * Übungen im Zielbereich lag. Ohne Plan-Vorgaben gibt es keinen Vorschlag.
 */
export function suggestRating(w: Workout): { rating: Rating; hit: number; total: number } | null {
  const planned = w.exercises.filter((e) => e.target)
  if (planned.length === 0) return null
  const hit = planned.filter((e) => goalState(e) !== 'open').length
  return { rating: hit * 2 >= planned.length ? 'good' : 'meh', hit, total: planned.length }
}

export function formatTarget(t: Pick<Target, 'sets' | 'repMin' | 'repMax'>, measure: Measure = 'reps'): string {
  const reps = t.repMin === t.repMax ? `${t.repMin}` : `${t.repMin}–${t.repMax}`
  return `${t.sets} × ${reps}${MEASURE_UNIT[measure]}`
}

export function formatRest(sec: number): string {
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`
}

/** Liest Wiederholungsbereiche wie „6-8“, „6–8“, „8“ oder „10+“. */
export function parseRepRange(text: string | undefined): { repMin: number; repMax: number } | null {
  if (!text) return null
  const nums = text.match(/\d+/g)?.map(Number) ?? []
  if (nums.length === 0) return null
  const repMin = nums[0]
  const repMax = nums.length > 1 ? nums[1] : repMin
  return { repMin: Math.min(repMin, repMax), repMax: Math.max(repMin, repMax) }
}
