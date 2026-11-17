import { describe, expect, it } from 'vitest'
import {
  addPlanExercise,
  createPlan,
  formatRest,
  formatTarget,
  goalState,
  movePlanExercise,
  parseRepRange,
  suggestRating,
  updatePlanExercise,
  workoutFromPlan,
} from './plans'
import { addSet, createWorkout, finishWorkout, toggleDone, updateSet } from './workout'
import type { Workout } from './types'
import { mergeLifeDashboard, parseLifeDashboardExport, LifeDashboardImportError } from './lifeDashboard'
import { DEFAULT_EXERCISES } from './exercises'

function push(): ReturnType<typeof createPlan> {
  let p = createPlan('Push A')
  p = addPlanExercise(p, 'bankdruecken', { sets: 3, repMin: 6, repMax: 8, restSec: 180 })
  p = addPlanExercise(p, 'seitheben', { sets: 2, repMin: 12, repMax: 15, restSec: 90 })
  return p
}

function doAll(w: Workout, reps: number): Workout {
  for (const e of w.exercises) {
    for (const s of e.sets) {
      w = updateSet(w, e.id, s.id, { kg: 50, reps })
      w = toggleDone(w, e.id, s.id)
    }
  }
  return w
}

describe('Pläne bearbeiten', () => {
  it('hält Werte in sinnvollen Grenzen', () => {
    let p = push()
    const id = p.exercises[0].id
    p = updatePlanExercise(p, id, { repMin: 12, repMax: 8, sets: 0 })
    expect(p.exercises[0]).toMatchObject({ sets: 1, repMin: 12, repMax: 12 })
  })

  it('verschiebt Übungen', () => {
    let p = push()
    p = movePlanExercise(p, p.exercises[1].id, -1)
    expect(p.exercises.map((e) => e.exerciseId)).toEqual(['seitheben', 'bankdruecken'])
    expect(movePlanExercise(p, p.exercises[0].id, -1)).toBe(p)
  })

  it('formatiert Vorgaben', () => {
    expect(formatTarget({ sets: 3, repMin: 6, repMax: 8 })).toBe('3 × 6–8')
    expect(formatTarget({ sets: 4, repMin: 5, repMax: 5 })).toBe('4 × 5')
    expect(formatRest(180)).toBe('3:00')
    expect(formatRest(90)).toBe('1:30')
  })

  it('liest Wiederholungsbereiche', () => {
    expect(parseRepRange('6-8')).toEqual({ repMin: 6, repMax: 8 })
    expect(parseRepRange('8–10')).toEqual({ repMin: 8, repMax: 10 })
    expect(parseRepRange('12')).toEqual({ repMin: 12, repMax: 12 })
    expect(parseRepRange('')).toBeNull()
  })
})

describe('Training aus Plan', () => {
  it('legt die geplanten Sätze an und befüllt sie mit dem letzten Mal', () => {
    let last = createWorkout(1000)
    last = { ...last, exercises: [{ id: 'x', exerciseId: 'bankdruecken', sets: [] }] }
    last = addSet(last, 'x')
    last = updateSet(last, 'x', last.exercises[0].sets[0].id, { kg: 80, reps: 8, done: true })
    last = addSet(last, 'x')
    last = updateSet(last, 'x', last.exercises[0].sets[1].id, { kg: 75, reps: 8, done: true })
    last = finishWorkout(last, 'good', 2000)

    const w = workoutFromPlan(push(), [last], 5000)
    expect(w.title).toBe('Push A')
    expect(w.exercises[0].sets.map((s) => s.kg)).toEqual([80, 75, 75])
    expect(w.exercises[0].target).toEqual({ sets: 3, repMin: 6, repMax: 8, restSec: 180 })
    expect(w.exercises[1].sets).toHaveLength(2)
    expect(w.exercises[1].sets[0].kg).toBeNull()
  })

  it('erkennt Ziel geschafft und Zielbereich', () => {
    const w = workoutFromPlan(push(), [])
    expect(goalState(w.exercises[0])).toBe('open')
    expect(goalState(doAll(w, 8).exercises[0])).toBe('reached')
    expect(goalState(doAll(w, 6).exercises[0])).toBe('in-range')
    expect(goalState(doAll(w, 5).exercises[0])).toBe('open')
  })

  it('schlägt eine Bewertung vor', () => {
    const w = workoutFromPlan(push(), [])
    expect(suggestRating(doAll(w, 15))).toEqual({ rating: 'good', hit: 2, total: 2 })
    expect(suggestRating(doAll(w, 7))).toEqual({ rating: 'good', hit: 1, total: 2 })
    expect(suggestRating(doAll(w, 4))).toEqual({ rating: 'meh', hit: 0, total: 2 })
    expect(suggestRating(createWorkout())).toBeNull()
  })
})

describe('Import aus dem Life Dashboard', () => {
  const ld = JSON.stringify({
    app: 'life-dashboard',
    typ: 'gym-export',
    plaene: [{ name: 'Push A', uebungen: [{ uebung: 'Bankdrücken', saetze: 4, wdh: '6-8', pauseSek: 150 }, { uebung: 'Schulterdrücken', saetze: 3, wdh: '8-10', pauseSek: 120 }] }],
    trainings: [
      {
        name: 'Push A',
        start: '2026-10-05T12:00:00.000Z',
        ende: '2026-10-05T13:05:00.000Z',
        uebungen: [
          { uebung: 'Kniebeugen', pauseSek: 180, saetze: [{ kg: 40, wdh: 10, typ: 'aufwaermen' }, { kg: 80, wdh: 6, typ: 'normal' }, { kg: 80, wdh: 5, typ: 'versagen' }] },
        ],
      },
    ],
  })

  it('übernimmt Pläne und Trainings ohne Aufwärmsätze', () => {
    const r = mergeLifeDashboard(parseLifeDashboardExport(ld), { exercises: DEFAULT_EXERCISES, plans: [], workouts: [] })
    expect(r.newPlans).toBe(1)
    expect(r.plans[0].exercises[0]).toMatchObject({ exerciseId: 'bankdruecken', sets: 4, repMin: 6, repMax: 8, restSec: 150 })
    // Unbekannter Name wird als eigene Übung angelegt
    expect(r.newExercises).toBe(1)
    expect(r.exercises.find((e) => e.name === 'Schulterdrücken')?.custom).toBe(true)
    // Alias: Kniebeugen = Kniebeuge
    expect(r.workouts[0].exercises[0].exerciseId).toBe('kniebeuge')
    expect(r.workouts[0].exercises[0].sets).toHaveLength(2)
    expect(r.workouts[0].exercises[0].sets[1].failure).toBe(true)
    expect(r.skippedWarmups).toBe(1)
    expect(r.workouts[0].endedAt! - r.workouts[0].startedAt).toBe(65 * 60000)
  })

  it('legt nichts doppelt an', () => {
    const first = mergeLifeDashboard(parseLifeDashboardExport(ld), { exercises: DEFAULT_EXERCISES, plans: [], workouts: [] })
    const second = mergeLifeDashboard(parseLifeDashboardExport(ld), first)
    expect(second.newWorkouts).toBe(0)
    expect(second.skippedWorkouts).toBe(1)
    expect(second.newPlans).toBe(0)
    expect(second.plans).toHaveLength(1)
    expect(second.newExercises).toBe(0)
  })

  it('lehnt andere Dateien ab', () => {
    expect(() => parseLifeDashboardExport('{"app":"athlete-reboot"}')).toThrow(LifeDashboardImportError)
    expect(() => parseLifeDashboardExport('quatsch')).toThrow(LifeDashboardImportError)
  })
})
