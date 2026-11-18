import { describe, expect, it } from 'vitest'
import { dropIndex, moveItem } from './order'
import { addPlanExercise, createPlan, movePlanExerciseTo, reorderPlans } from './plans'
import { addExercise, createWorkout, moveExercise, replaceExercise, startHold, updateSet } from './workout'
import type { Plan } from './types'

describe('Reihenfolge', () => {
  it('verschiebt nach vorne und hinten', () => {
    expect(moveItem(['a', 'b', 'c', 'd'], 0, 2)).toEqual(['b', 'c', 'a', 'd'])
    expect(moveItem(['a', 'b', 'c', 'd'], 3, 1)).toEqual(['a', 'd', 'b', 'c'])
    expect(moveItem(['a', 'b'], 0, 5)).toEqual(['a', 'b'])
  })

  it('Zielposition beim Ziehen über die Mitte der Nachbarn', () => {
    const tops = [0, 60, 120, 180]
    const heights = [50, 50, 50, 50]
    expect(dropIndex(tops, heights, 0, 10)).toBe(0)
    expect(dropIndex(tops, heights, 0, 70)).toBe(1)
    expect(dropIndex(tops, heights, 0, 140)).toBe(2)
    expect(dropIndex(tops, heights, 3, -150)).toBe(1)
    expect(dropIndex(tops, heights, 3, -190)).toBe(0)
  })

  it('Pläne: nur die gezogene Gruppe tauscht Plätze, andere bleiben', () => {
    const p = (id: string, order: number, kind?: 'cardio'): Plan => ({ id, name: id, order, exercises: [], ...(kind ? { kind } : {}) })
    const all = [p('g1', 0), p('c1', 1, 'cardio'), p('g2', 2), p('c2', 3, 'cardio')]
    const changed = reorderPlans(all, ['g1', 'g2'], 1, 0)
    const merged = all.map((x) => changed.find((c) => c.id === x.id) ?? x).sort((a, b) => a.order - b.order)
    expect(merged.map((x) => x.id)).toEqual(['g2', 'c1', 'g1', 'c2'])
    expect(changed.map((x) => x.id).sort()).toEqual(['g1', 'g2'])
  })

  it('Übungen im Plan per Ziehen', () => {
    const plan = addPlanExercise(addPlanExercise(addPlanExercise(createPlan('P'), 'a'), 'b'), 'c')
    expect(movePlanExerciseTo(plan, 2, 0).exercises.map((e) => e.exerciseId)).toEqual(['c', 'a', 'b'])
  })
})

describe('Training nach Plan ändern', () => {
  it('Übungen verschieben', () => {
    const w = addExercise(addExercise(createWorkout(0), 'a'), 'b')
    expect(moveExercise(w, 1, 0).exercises.map((e) => e.exerciseId)).toEqual(['b', 'a'])
  })

  it('Übung tauschen: gleiche Satzzahl, neue Vorbelegung, Vorgabe bleibt bei gleicher Messart', () => {
    let w = addExercise(createWorkout(0), 'bankdruecken')
    const e = w.exercises[0]
    w = { ...w, exercises: [{ ...e, target: { sets: 2, repMin: 6, repMax: 8, restSec: 120 }, sets: [...e.sets, { ...e.sets[0], id: 'x' }] }] }
    w = updateSet(w, e.id, e.sets[0].id, { done: true, kg: 80, reps: 8 })
    const r = replaceExercise(w, e.id, 'kh-bankdruecken', [{ id: 'p', kg: 30, reps: 10, done: true, failure: false }])
    expect(r.exercises[0].exerciseId).toBe('kh-bankdruecken')
    expect(r.exercises[0].sets).toHaveLength(2)
    expect(r.exercises[0].sets.every((s) => !s.done && s.kg === 30 && s.reps === 10)).toBe(true)
    expect(r.exercises[0].target?.repMax).toBe(8)
    expect(r.exercises[0].id).toBe(e.id)
  })

  it('Tausch gegen Zeit-Übung: Vorgabe fällt weg, Countdown stoppt', () => {
    let w = addExercise(createWorkout(0), 'reha-wandsitzen', [], 'time')
    const e = w.exercises[0]
    w = { ...startHold(w, e.id, e.sets[0].id, 30, 0), exercises: w.exercises.map((x) => ({ ...x, target: { sets: 1, repMin: 30, repMax: 30, restSec: 60 } })) }
    w = { ...w, hold: { entryId: e.id, setId: e.sets[0].id, startedAt: 0, endsAt: 30_000, total: 30 } }
    const r = replaceExercise(w, e.id, 'kniebeuge', [], 'reps')
    expect(r.hold).toBeUndefined()
    expect(r.exercises[0].timed).toBeUndefined()
    expect(r.exercises[0].target).toBeUndefined()
  })
})
