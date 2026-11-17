import { newId } from './ids'
import { DEFAULT_TARGET, normalizeTarget, parseRepRange } from './plans'
import { MUSCLE_GROUPS, type Exercise, type MuscleGroup, type Plan, type SetEntry, type Workout } from './types'

// Import aus Toms Life Dashboard (Fitness → Gym → Export → JSON-Datei, Format „gym-export“).
// Übernimmt Pläne und abgeschlossene Trainings. Bestehende Daten bleiben erhalten.

interface LdSet {
  kg?: number
  wdh?: number
  typ?: string
}
interface LdTrainingExercise {
  uebung?: string
  pauseSek?: number
  saetze?: LdSet[]
}
interface LdTraining {
  name?: string
  start?: string
  ende?: string
  uebungen?: LdTrainingExercise[]
}
interface LdPlanExercise {
  uebung?: string
  saetze?: number
  wdh?: string
  pauseSek?: number
}
interface LdPlan {
  name?: string
  uebungen?: LdPlanExercise[]
}
interface LdExport {
  app?: string
  typ?: string
  plaene?: LdPlan[]
  trainings?: LdTraining[]
}

export class LifeDashboardImportError extends Error {}

/** Namen, die im Life Dashboard anders heißen, aber eindeutig dieselbe Übung sind. */
const ALIASES: Record<string, string> = {
  kniebeugen: 'kniebeuge',
  'rudern (lh)': 'rudern-lh',
  'schrägbankdrücken (kh)': 'schraegbank-kh',
  kabelrudern: 'rudern-kabel',
  'hammer curls': 'hammercurls',
}

const norm = (s: string) => s.trim().toLowerCase()

export interface ImportResult {
  exercises: Exercise[]
  plans: Plan[]
  workouts: Workout[]
  newExercises: number
  newPlans: number
  newWorkouts: number
  skippedWorkouts: number
  skippedWarmups: number
}

export function parseLifeDashboardExport(text: string): LdExport {
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    throw new LifeDashboardImportError('Die Datei ist kein gültiger Export. Exportiere im Life Dashboard unter Fitness → Gym die „JSON-Datei“.')
  }
  const d = data as LdExport
  if (!d || d.app !== 'life-dashboard' || d.typ !== 'gym-export') {
    throw new LifeDashboardImportError('Das ist kein Gym-Export aus dem Life Dashboard. Wähle die Datei „gym-export-….json“.')
  }
  return d
}

/**
 * Führt einen Life-Dashboard-Export mit den vorhandenen Daten zusammen.
 * Trainings mit gleicher Startzeit werden nicht doppelt angelegt, Pläne mit gleichem Namen ersetzt.
 */
export function mergeLifeDashboard(
  ld: LdExport,
  current: { exercises: Exercise[]; plans: Plan[]; workouts: Workout[] },
): ImportResult {
  const exercises = [...current.exercises]
  const byName = new Map(exercises.map((e) => [norm(e.name), e]))
  let newExercises = 0

  function exerciseId(name: string | undefined, group?: string): string {
    const n = norm(name || 'Unbekannte Übung')
    const alias = ALIASES[n]
    if (alias && exercises.some((e) => e.id === alias)) return alias
    const existing = byName.get(n)
    if (existing) return existing.id
    const g: MuscleGroup = MUSCLE_GROUPS.includes(group as MuscleGroup) ? (group as MuscleGroup) : 'Sonstiges'
    const e: Exercise = { id: `eigen-${newId()}`, name: (name || 'Unbekannte Übung').trim(), group: g, custom: true }
    exercises.push(e)
    byName.set(n, e)
    newExercises++
    return e.id
  }

  // Pläne
  const plans = [...current.plans]
  let newPlans = 0
  for (const p of ld.plaene ?? []) {
    if (!p.name) continue
    const plan: Plan = {
      id: newId(),
      name: p.name.trim(),
      order: plans.length,
      exercises: (p.uebungen ?? []).map((u) => {
        const range = parseRepRange(u.wdh) ?? { repMin: DEFAULT_TARGET.repMin, repMax: DEFAULT_TARGET.repMax }
        return normalizeTarget({
          id: newId(),
          exerciseId: exerciseId(u.uebung),
          sets: u.saetze ?? DEFAULT_TARGET.sets,
          ...range,
          restSec: u.pauseSek ?? DEFAULT_TARGET.restSec,
        })
      }),
    }
    const same = plans.findIndex((x) => norm(x.name) === norm(plan.name))
    if (same >= 0) plans[same] = { ...plan, id: plans[same].id, order: plans[same].order }
    else {
      plans.push(plan)
      newPlans++
    }
  }

  // Trainings
  const workouts = [...current.workouts]
  const starts = new Set(workouts.map((w) => w.startedAt))
  let newWorkouts = 0
  let skippedWorkouts = 0
  let skippedWarmups = 0
  for (const t of ld.trainings ?? []) {
    const startedAt = t.start ? Date.parse(t.start) : NaN
    if (!Number.isFinite(startedAt)) continue
    if (starts.has(startedAt)) {
      skippedWorkouts++
      continue
    }
    const endedAt = t.ende && Number.isFinite(Date.parse(t.ende)) ? Date.parse(t.ende) : startedAt
    const entries = (t.uebungen ?? [])
      .map((u) => {
        const sets: SetEntry[] = []
        for (const s of u.saetze ?? []) {
          // Aufwärmsätze zählen in Athlete Reboot nicht, sonst stimmen „Letztes Mal“ und Bestwerte nicht
          if (s.typ === 'aufwaermen') {
            skippedWarmups++
            continue
          }
          sets.push({
            id: newId(),
            kg: typeof s.kg === 'number' ? s.kg : null,
            reps: typeof s.wdh === 'number' ? s.wdh : null,
            done: true,
            failure: s.typ === 'versagen',
          })
        }
        return { id: newId(), exerciseId: exerciseId(u.uebung), sets }
      })
      .filter((e) => e.sets.length > 0)
    if (entries.length === 0) continue
    workouts.push({
      id: newId(),
      type: 'gym',
      title: t.name?.trim() || 'Training',
      startedAt,
      endedAt: Math.max(endedAt, startedAt),
      exercises: entries,
    })
    starts.add(startedAt)
    newWorkouts++
  }

  return { exercises, plans, workouts, newExercises, newPlans, newWorkouts, skippedWorkouts, skippedWarmups }
}
