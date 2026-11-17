import { describe, expect, it } from 'vitest'
import {
  addExercise,
  addSet,
  createWorkout,
  finishWorkout,
  formatSet,
  parseNumber,
  previousSets,
  summarize,
  toggleDone,
  toggleFailure,
  updateSet,
} from './workout'
import type { Workout } from './types'

function workoutWithSets(startedAt: number, sets: [number, number][], exerciseId = 'bankdruecken'): Workout {
  let w = createWorkout(startedAt)
  w = addExercise(w, exerciseId)
  const entryId = w.exercises[0].id
  w = { ...w, exercises: [{ ...w.exercises[0], sets: [] }] }
  for (const [kg, reps] of sets) {
    w = addSet(w, entryId)
    const set = w.exercises[0].sets.at(-1)!
    w = updateSet(w, entryId, set.id, { kg, reps, done: true })
  }
  return finishWorkout(w, 'good', startedAt + 3600_000)
}

describe('parseNumber', () => {
  it('liest Komma und Punkt', () => {
    expect(parseNumber('82,5')).toBe(82.5)
    expect(parseNumber('82.5')).toBe(82.5)
    expect(parseNumber(' 80 ')).toBe(80)
  })
  it('gibt null bei leer oder ungültig zurück', () => {
    expect(parseNumber('')).toBeNull()
    expect(parseNumber('abc')).toBeNull()
    expect(parseNumber('-5')).toBeNull()
  })
})

describe('formatSet', () => {
  it('zeigt Gewicht mal Wiederholungen im deutschen Format', () => {
    expect(formatSet({ kg: 82.5, reps: 6 })).toBe('82,5 × 6')
    expect(formatSet({ kg: null, reps: null })).toBe('–')
  })
})

describe('previousSets', () => {
  it('nimmt das jüngste beendete Training mit dieser Übung', () => {
    const old = workoutWithSets(1_000, [[70, 8]])
    const recent = workoutWithSets(5_000, [[80, 8], [80, 7]])
    const other = workoutWithSets(9_000, [[50, 10]], 'kniebeuge')
    const result = previousSets([old, recent, other], 'bankdruecken')
    expect(result.map((s) => s.kg)).toEqual([80, 80])
  })
  it('ignoriert das laufende Training', () => {
    const running = createWorkout(10_000)
    const withEx = addExercise(running, 'bankdruecken')
    expect(previousSets([withEx], 'bankdruecken')).toEqual([])
  })
})

describe('Sätze', () => {
  it('befüllt neue Übung und neue Sätze vor', () => {
    const prev = workoutWithSets(1_000, [[80, 8], [75, 10]])
    const previous = previousSets([prev], 'bankdruecken')
    let w = addExercise(createWorkout(2_000), 'bankdruecken', previous)
    expect(w.exercises[0].sets[0]).toMatchObject({ kg: 80, reps: 8, done: false })

    const entryId = w.exercises[0].id
    const firstId = w.exercises[0].sets[0].id
    w = updateSet(w, entryId, firstId, { kg: 85 })
    w = addSet(w, entryId, previous)
    // Übernimmt den vorigen Satz aus diesem Training, nicht den vom letzten Mal
    expect(w.exercises[0].sets[1]).toMatchObject({ kg: 85, reps: 8 })
  })

  it('Muskelversagen hakt den Satz automatisch ab, Haken entfernen löscht Versagen', () => {
    let w = addExercise(createWorkout(), 'bankdruecken')
    const e = w.exercises[0].id
    const s = w.exercises[0].sets[0].id
    w = toggleFailure(w, e, s)
    expect(w.exercises[0].sets[0]).toMatchObject({ done: true, failure: true })
    w = toggleDone(w, e, s)
    expect(w.exercises[0].sets[0]).toMatchObject({ done: false, failure: false })
  })
})

describe('finishWorkout und summarize', () => {
  it('verwirft nicht abgehakte Sätze und leere Übungen', () => {
    let w = addExercise(createWorkout(0), 'bankdruecken')
    w = addExercise(w, 'kniebeuge')
    const e = w.exercises[0].id
    const s = w.exercises[0].sets[0].id
    w = updateSet(w, e, s, { kg: 100, reps: 5, done: true })
    w = addSet(w, e)
    const done = finishWorkout(w, 'meh', 60_000)
    expect(done.exercises).toHaveLength(1)
    expect(done.exercises[0].sets).toHaveLength(1)
    expect(done.endedAt).toBe(60_000)
    expect(summarize(done)).toEqual({ sets: 1, volume: 500, exercises: 1 })
  })
})
