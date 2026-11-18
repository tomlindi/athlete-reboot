import { describe, expect, it } from 'vitest'
import { bestSession, e1rm, exerciseSessions, newBests, niceTicks, strengthIndex, trainedExerciseIds, weekComparison } from './progress'
import type { Workout } from './types'

let n = 0
function w(startedAt: number, sets: [string, number, number, boolean?][]): Workout {
  const byEx = new Map<string, Workout['exercises'][number]>()
  for (const [ex, kg, reps, done = true] of sets) {
    const e = byEx.get(ex) ?? { id: `e${n++}`, exerciseId: ex, sets: [] }
    e.sets.push({ id: `s${n++}`, kg, reps, done, failure: false })
    byEx.set(ex, e)
  }
  return { id: `w${n++}`, type: 'gym', title: 'T', startedAt, endedAt: startedAt + 3600_000, exercises: [...byEx.values()] }
}

const DAY = 86400000

describe('Geschätztes Maximum', () => {
  it('nutzt die Epley-Formel', () => {
    expect(e1rm(100, 1)).toBe(100)
    expect(e1rm(100, 10)).toBeCloseTo(133.33, 1)
    expect(e1rm(80, 6)).toBe(96)
  })
})

describe('Bestwerte pro Übung', () => {
  const history = [
    w(1 * DAY, [['bank', 80, 8], ['bank', 85, 5]]),
    w(3 * DAY, [['bank', 85, 6], ['bank', 90, 2, false]]),
    w(5 * DAY, [['knie', 100, 5]]),
  ]

  it('nimmt pro Training den besten Satz und ignoriert nicht erledigte Sätze', () => {
    const s = exerciseSessions(history, 'bank')
    expect(s.map((x) => [x.kg, x.reps])).toEqual([[80, 8], [85, 6]])
    expect(bestSession(s)).toMatchObject({ kg: 85, reps: 6 })
  })

  it('listet trainierte Übungen', () => {
    expect(trainedExerciseIds(history).sort()).toEqual(['bank', 'knie'])
  })

  it('erkennt neue Bestwerte, aber nicht beim ersten Mal', () => {
    const next = w(7 * DAY, [['bank', 90, 6], ['knie', 100, 5], ['rudern', 60, 8]])
    expect(newBests(next, [...history, next])).toEqual([{ exerciseId: 'bank', kg: 90, reps: 6, e1rm: 108, measure: 'reps' }])
  })
})

describe('Kraft-Index', () => {
  it('mittelt die Veränderung je Übung, neue Übungen starten bei 0 %', () => {
    const pts = strengthIndex([
      w(1 * DAY, [['bank', 100, 1]]),
      w(2 * DAY, [['bank', 110, 1]]),
      w(3 * DAY, [['knie', 200, 1]]),
      w(4 * DAY, [['knie', 220, 1]]),
    ])
    expect(pts.map((p) => Math.round(p.value))).toEqual([0, 10, 5, 10])
  })

  it('übergeht Trainings ohne gewertete Sätze', () => {
    expect(strengthIndex([w(DAY, [['bank', 0, 10]])])).toEqual([])
  })
})

describe('Wochenvergleich', () => {
  it('vergleicht diese Woche mit der Vorwoche', () => {
    const now = new Date(2026, 10, 18, 12).getTime() // Mittwoch
    const r = weekComparison(
      [
        w(new Date(2026, 10, 16, 14).getTime(), [['bank', 80, 8], ['bank', 80, 8]]),
        w(new Date(2026, 10, 10, 14).getTime(), [['bank', 80, 8]]),
        w(new Date(2026, 10, 2, 14).getTime(), [['bank', 80, 8]]),
      ],
      now,
    )
    expect(r.current).toEqual({ trainings: 1, sets: 2, volume: 1280 })
    expect(r.previous).toEqual({ trainings: 1, sets: 1, volume: 640 })
  })
})

describe('Achsen', () => {
  it('liefert saubere Werte', () => {
    expect(niceTicks(83, 117)).toEqual([80, 90, 100, 110, 120])
    expect(niceTicks(0, 12.4)).toEqual([0, 5, 10, 15])
    expect(niceTicks(50, 50).length).toBeGreaterThanOrEqual(2)
  })
})
