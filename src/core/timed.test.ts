import { describe, expect, it } from 'vitest'
import { DEFAULT_EXERCISES, markTimedEntries, mergeDefaultExercises } from './exercises'
import { addPlanExercise, createPlan, formatTarget, normalizeTarget, workoutFromPlan } from './plans'
import { exerciseSessions, newBests, strengthIndex, weekComparison } from './progress'
import type { Exercise, Workout } from './types'
import {
  addExercise,
  cancelHold,
  createWorkout,
  finishHold,
  finishWorkout,
  formatSet,
  holdRemaining,
  removeSet,
  startHold,
  summarize,
  updateSet,
} from './workout'

function timedWorkout(start = 0) {
  const w = addExercise(createWorkout(start), 'plank', [], 'time')
  return { w, e: w.exercises[0] }
}

describe('Countdown für Zeit-Übungen', () => {
  it('startet mit der eingetragenen Zeit und beendet eine laufende Pause', () => {
    let { w, e } = timedWorkout()
    w = { ...w, rest: { endsAt: 99_000, total: 90 } }
    w = startHold(w, e.id, e.sets[0].id, 30, 1_000)
    expect(w.rest).toBeUndefined()
    expect(w.hold).toEqual({ entryId: e.id, setId: e.sets[0].id, startedAt: 1_000, endsAt: 31_000, total: 30 })
    expect(w.exercises[0].sets[0].reps).toBe(30)
    expect(holdRemaining(w, 1_000)).toBe(30)
    expect(holdRemaining(w, 30_500)).toBe(1)
  })

  it('hakt am Ende mit der vollen Zeit ab und startet die Pause', () => {
    let { w, e } = timedWorkout()
    w = startHold(w, e.id, e.sets[0].id, 30, 0)
    w = finishHold(w, 60, 30_000)
    expect(w.hold).toBeUndefined()
    expect(w.exercises[0].sets[0]).toMatchObject({ reps: 30, done: true })
    expect(w.rest).toEqual({ endsAt: 90_000, total: 60 })
  })

  it('„Fertig“ vor der Zeit speichert die tatsächlich gehaltene Zeit', () => {
    let { w, e } = timedWorkout()
    w = startHold(w, e.id, e.sets[0].id, 45, 0)
    w = finishHold(w, 60, 20_400)
    expect(w.exercises[0].sets[0]).toMatchObject({ reps: 20, done: true })
  })

  it('„Abbrechen“ lässt den Satz offen', () => {
    let { w, e } = timedWorkout()
    w = cancelHold(startHold(w, e.id, e.sets[0].id, 30, 0))
    expect(w.hold).toBeUndefined()
    expect(w.exercises[0].sets[0].done).toBe(false)
  })

  it('Satz löschen oder Training beenden stoppt den Countdown', () => {
    let { w, e } = timedWorkout()
    w = startHold(w, e.id, e.sets[0].id, 30, 0)
    expect(removeSet(w, e.id, e.sets[0].id).hold).toBeUndefined()
    expect(finishWorkout(w, 'good', 5_000).hold).toBeUndefined()
  })
})

describe('Zeit-Übungen in Plänen und Auswertung', () => {
  it('Plan-Training markiert Zeit-Übungen', () => {
    const plan = addPlanExercise(addPlanExercise(createPlan('Reha'), 'reha-wandsitzen'), 'kniebeuge')
    const w = workoutFromPlan(plan, [], 0, (id) => (id === 'reha-wandsitzen' ? 'time' : 'reps'))
    expect(w.exercises.map((e) => !!e.timed)).toEqual([true, false])
  })

  it('erlaubt im Plan bis 600 Sekunden, Wiederholungen bleiben bei 50', () => {
    const t = { sets: 3, repMin: 90, repMax: 120, restSec: 60 }
    expect(normalizeTarget(t, 'time')).toMatchObject({ repMin: 90, repMax: 120 })
    expect(normalizeTarget(t)).toMatchObject({ repMin: 50, repMax: 50 })
    expect(formatTarget(t, 'time')).toBe('3 × 90–120 s')
  })

  it('zeigt Zeit-Sätze in Sekunden', () => {
    expect(formatSet({ kg: null, reps: 30 }, 'time')).toBe('30 s')
    expect(formatSet({ kg: 10, reps: 30 }, 'time')).toBe('10 × 30 s')
  })

  it('Bestwert ist die längste Zeit, ohne Kraft-Index und Volumen', () => {
    const make = (start: number, sec: number, kg: number | null = null): Workout => {
      let { w, e } = timedWorkout(start)
      w = updateSet(w, e.id, e.sets[0].id, { kg, reps: sec, done: true })
      return { ...w, endedAt: start + 1 }
    }
    const a = make(1_000, 30)
    const b = make(2_000, 45, 10)
    expect(exerciseSessions([a, b], 'plank').map((s) => s.e1rm)).toEqual([30, 45])
    expect(newBests(b, [a, b])).toEqual([{ exerciseId: 'plank', kg: 10, reps: 45, e1rm: 45, measure: 'time' }])
    expect(strengthIndex([a, b])).toEqual([])
    expect(summarize(b).volume).toBe(0)
    expect(weekComparison([b], 2_000).current.volume).toBe(0)
  })
})

describe('Übungsliste', () => {
  it('Standard-IDs sind eindeutig', () => {
    const ids = DEFAULT_EXERCISES.map((e) => e.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('stellt Plank beim Update auf Sekunden um und behält Toms Einstellungen', () => {
    const stored: Exercise[] = [{ id: 'plank', name: 'Plank', group: 'Bauch', hidden: true }]
    const merged = mergeDefaultExercises(stored)
    expect(merged[0]).toEqual({ id: 'plank', name: 'Plank', group: 'Bauch', hidden: true, measure: 'time' })
    expect(merged.some((e) => e.id === 'reha-wandsitzen')).toBe(true)
  })

  it('markiert alte Plank-Einträge im Verlauf als Zeit-Übung', () => {
    const old = addExercise(createWorkout(0), 'plank')
    const other = addExercise(createWorkout(0), 'kniebeuge')
    const changed = markTimedEntries([old, other], mergeDefaultExercises([]))
    expect(changed).toHaveLength(1)
    expect(changed[0].exercises[0].timed).toBe(true)
  })
})

describe('Strecken-Übungen und Stufen', () => {
  it('speichert Meter, zeigt sie mit Einheit und wertet die längste Strecke', () => {
    const make = (start: number, m: number, kg: number | null): Workout => {
      let w = addExercise(createWorkout(start), 'hyb-sled-push', [], 'distance')
      const e = w.exercises[0]
      w = updateSet(w, e.id, e.sets[0].id, { kg, reps: m, done: true })
      return { ...w, endedAt: start + 1 }
    }
    const a = make(1_000, 20, 60)
    const b = make(2_000, 30, 60)
    expect(a.exercises[0].distance).toBe(true)
    expect(formatSet({ kg: 60, reps: 30 }, 'distance')).toBe('60 × 30 m')
    expect(formatSet({ kg: null, reps: 40 }, 'distance')).toBe('40 m')
    expect(exerciseSessions([a, b], 'hyb-sled-push').map((s) => s.e1rm)).toEqual([20, 30])
    expect(newBests(b, [a, b])[0]).toMatchObject({ e1rm: 30, measure: 'distance' })
    expect(strengthIndex([a, b])).toEqual([])
    expect(summarize(b).volume).toBe(0)
  })

  it('Strecken im Plan bis 2000 m', () => {
    expect(normalizeTarget({ sets: 3, repMin: 20, repMax: 3000, restSec: 90 }, 'distance').repMax).toBe(2000)
    expect(formatTarget({ sets: 3, repMin: 20, repMax: 30 }, 'distance')).toBe('3 × 20–30 m')
  })

  it('Athletik-Übungen haben Stufen, das Update ergänzt sie bei vorhandenen Übungen', () => {
    const athletik = DEFAULT_EXERCISES.filter((e) => ['Plyometrie', 'Rumpf', 'Explosiv & Hybrid', 'Isometrie'].includes(e.group))
    expect(athletik).toHaveLength(43)
    expect(athletik.every((e) => e.level)).toBe(true)
    const merged = mergeDefaultExercises([{ id: 'ply-bounds', name: 'Bounds', group: 'Plyometrie', hidden: true }])
    expect(merged[0]).toEqual({ id: 'ply-bounds', name: 'Bounds', group: 'Plyometrie', hidden: true, level: 3 })
    expect(merged.find((e) => e.id === 'rumpf-farmers-walk')?.measure).toBe('distance')
  })

  it('markiert alte Einträge von Strecken-Übungen als Meter', () => {
    const old = addExercise(createWorkout(0), 'hyb-sled-push')
    const changed = markTimedEntries([old], mergeDefaultExercises([]))
    expect(changed[0].exercises[0]).toMatchObject({ distance: true })
    expect(changed[0].exercises[0].timed).toBeUndefined()
  })
})
