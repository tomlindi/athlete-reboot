import { describe, expect, it } from 'vitest'
import { workoutFromPlan, addPlanExercise, createPlan } from './plans'
import { addExercise, completeSet, createWorkout, extendRest, failSet, finishWorkout, restRemaining, stopRest } from './workout'

describe('Pausentimer', () => {
  it('startet nach dem Abhaken mit der Pause aus dem Plan', () => {
    const plan = addPlanExercise(createPlan('Push A'), 'bankdruecken', { sets: 2, repMin: 6, repMax: 8, restSec: 180 })
    let w = workoutFromPlan(plan, [], 0)
    const e = w.exercises[0]
    w = completeSet(w, e.id, e.sets[0].id, 120, 10_000)
    expect(w.rest).toEqual({ endsAt: 190_000, total: 180 })
    expect(restRemaining(w, 10_000)).toBe(180)
    expect(restRemaining(w, 189_500)).toBe(1)
    expect(restRemaining(w, 200_000)).toBe(0)
  })

  it('nutzt ohne Plan die Standard-Pause', () => {
    let w = addExercise(createWorkout(0), 'bankdruecken')
    const e = w.exercises[0]
    w = completeSet(w, e.id, e.sets[0].id, 90, 0)
    expect(w.rest?.total).toBe(90)
  })

  it('Haken entfernen startet keine neue Pause', () => {
    let w = addExercise(createWorkout(0), 'bankdruecken')
    const e = w.exercises[0]
    w = completeSet(w, e.id, e.sets[0].id, 90, 0)
    w = stopRest(w)
    w = completeSet(w, e.id, e.sets[0].id, 90, 5_000)
    expect(w.exercises[0].sets[0].done).toBe(false)
    expect(w.rest).toBeUndefined()
  })

  it('Muskelversagen startet die Pause nur, wenn der Satz neu erledigt wird', () => {
    let w = addExercise(createWorkout(0), 'bankdruecken')
    const e = w.exercises[0]
    w = failSet(w, e.id, e.sets[0].id, 90, 0)
    expect(w.rest?.total).toBe(90)
    w = stopRest(w)
    w = failSet(w, e.id, e.sets[0].id, 90, 1_000)
    expect(w.rest).toBeUndefined()
  })

  it('+15 s verlängert, auch wenn die Pause schon abgelaufen ist', () => {
    let w = addExercise(createWorkout(0), 'bankdruecken')
    const e = w.exercises[0]
    w = completeSet(w, e.id, e.sets[0].id, 60, 0)
    w = extendRest(w, 15, 30_000)
    expect(restRemaining(w, 30_000)).toBe(45)
    expect(w.rest?.total).toBe(75)
    const late = extendRest(w, 15, 100_000)
    expect(restRemaining(late, 100_000)).toBe(15)
  })

  it('Beenden entfernt die Pause', () => {
    let w = addExercise(createWorkout(0), 'bankdruecken')
    const e = w.exercises[0]
    w = completeSet(w, e.id, e.sets[0].id, 60, 0)
    expect(finishWorkout(w, 'good', 1_000).rest).toBeUndefined()
  })
})
