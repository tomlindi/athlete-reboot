import { describe, expect, it } from 'vitest'
import { analysisFileName, createAnalysisExport } from './analysisExport'
import { manualCardio } from './cardio'
import { DEFAULT_EXERCISES } from './exercises'
import { createProgram, setDay } from './program'
import { addExercise, createWorkout, updateSet } from './workout'
import type { Plan, Workout } from './types'

const NOW = new Date(2026, 10, 18, 18).getTime()
const DAY = 86_400_000

function gym(start: number, kg: number, reps: number): Workout {
  let w = addExercise(createWorkout(start, 'Beine'), 'kniebeuge')
  const e = w.exercises[0]
  w = updateSet(w, e.id, e.sets[0].id, { kg, reps, done: true })
  return { ...w, endedAt: start + 3_600_000, rating: 'good' }
}

describe('Auswertungsdatei für Claude', () => {
  const plan: Plan = { id: 'p', name: 'Beine A', order: 0, exercises: [{ id: 'x', exerciseId: 'kniebeuge', sets: 3, repMin: 6, repMax: 8, restSec: 150 }] }
  const program = setDay(createProgram('Dunken', 8, NOW), 0, 'p')
  const workouts = [
    gym(NOW - 7 * DAY, 80, 8),
    gym(NOW - DAY, 85, 8),
    manualCardio({ sport: 'laufen', durationSec: 1710, distanceM: 5200, rpe: 7, avgHr: 152 }, NOW - 2 * DAY),
    createWorkout(NOW), // läuft noch: nicht in der Datei
  ]
  const out = createAnalysisExport({ exercises: DEFAULT_EXERCISES, workouts, plans: [plan], programs: [program] }, '0.13.0', NOW)

  it('enthält nur beendete Trainings, lesbar mit Namen und Sätzen', () => {
    expect(out.trainings).toHaveLength(3)
    expect(out.trainings[0]).toMatchObject({ art: 'Gym', titel: 'Beine', bewertung: 'gut', uebungen: [{ name: 'Kniebeuge', saetze: ['80 kg × 8'] }] })
    expect(out.trainings[1]).toMatchObject({ art: 'Ausdauer', sportart: 'Laufen', distanz: '5,2 km', tempo: '5:29 /km', anstrengung: '7/10', pulsDurchschnitt: 152 })
  })

  it('Bestwerte, Kraft-Index und Überblick', () => {
    expect(out.bestwerte).toEqual([expect.objectContaining({ uebung: 'Kniebeuge', bestwert: '85 kg × 8', anzahlTrainings: 2 })])
    expect(out.ueberblick.trainingsGesamt).toBe(3)
    expect(out.ueberblick.kraftIndexProzent).toBeCloseTo(6.25, 0) // (85 − 80) / 80 = 6,25 %
  })

  it('Pläne und Programme mit Namen statt IDs', () => {
    expect(out.plaene).toEqual([{ name: 'Beine A', art: 'Gym', uebungen: ['Kniebeuge: 3 × 6–8, Pause 2:30'] }])
    expect(out.programme[0]).toMatchObject({ name: 'Dunken', wochen: 8, wochenplan: { Montag: 'Beine A' } })
    expect(JSON.stringify(out)).not.toContain(' ')
  })

  it('Dateiname mit Datum', () => {
    expect(analysisFileName(new Date(2026, 10, 18))).toBe('athlete-reboot-fuer-claude-2026-11-18.json')
  })
})
