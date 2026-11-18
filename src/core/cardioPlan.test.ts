import { describe, expect, it } from 'vitest'
import { finishCardio, pauseCardio, resumeCardio, setSport } from './cardio'
import {
  advanceTimedPhases,
  cardioPlanSummary,
  completedDistanceM,
  createCardioPlan,
  currentPhase,
  expandBlocks,
  formatAmount,
  formatBlock,
  nextPhase,
  normalizeBlock,
  phaseElapsedMs,
  planDone,
  startCardioPlan,
} from './cardioPlan'
import type { CardioBlock, Plan } from './types'

const blocks: CardioBlock[] = [
  { id: 'a', label: 'Aufwärmen', amount: { unit: 'time', value: 60 } },
  { id: 'b', label: 'Schnell', amount: { unit: 'distance', value: 400 }, repeat: 3, rest: { unit: 'time', value: 30 }, restLabel: 'Gehen' },
  { id: 'c', label: 'Auslaufen', amount: { unit: 'time', value: 60 } },
]
const plan: Plan = { id: 'p', name: '3 × 400 m', kind: 'cardio', sport: 'laufen', order: 0, exercises: [], blocks }

describe('Ausdauer-Plan', () => {
  it('löst Wiederholungen ohne Pause nach der letzten Belastung auf', () => {
    const phases = expandBlocks(blocks)
    expect(phases.map((p) => p.label)).toEqual(['Aufwärmen', 'Schnell', 'Gehen', 'Schnell', 'Gehen', 'Schnell', 'Auslaufen'])
    expect(phases[3]).toMatchObject({ rep: 2, reps: 3, rest: false })
  })

  it('neuer Plan hat Aufwärmen, Intervalle und Auslaufen', () => {
    const p = createCardioPlan('Intervalle', 'rad')
    expect(p.kind).toBe('cardio')
    expect(p.blocks).toHaveLength(3)
  })

  it('begrenzt Werte und entfernt die Pause bei nur einer Wiederholung', () => {
    expect(normalizeBlock({ id: 'x', label: 'L', amount: { unit: 'time', value: 1 }, repeat: 99 })).toMatchObject({
      amount: { value: 5 },
      repeat: 30,
      rest: { unit: 'time', value: 60 },
    })
    expect(normalizeBlock({ ...blocks[1], repeat: 1 })).toEqual({ id: 'b', label: 'Schnell', amount: { unit: 'distance', value: 400 } })
  })

  it('Anzeige', () => {
    expect(formatAmount({ unit: 'time', value: 600 })).toBe('10:00')
    expect(formatAmount({ unit: 'distance', value: 400 })).toBe('400 m')
    expect(formatAmount({ unit: 'distance', value: 5000 })).toBe('5 km')
    expect(formatBlock(blocks[1])).toBe('3 × 400 m Schnell · 0:30 Gehen')
    expect(cardioPlanSummary(plan)).toBe('Laufen · 3 Abschnitte · ca. 3 min + 1,2 km')
  })
})

describe('Plan-Lauf', () => {
  it('Zeit-Abschnitte wechseln automatisch, Strecken warten auf „Weiter“', () => {
    let w = startCardioPlan(plan, 0)
    expect(currentPhase(w)?.label).toBe('Aufwärmen')
    let r = advanceTimedPhases(w, 59_000)
    expect(r.changes).toBe(0)
    r = advanceTimedPhases(w, 61_000)
    expect(r.changes).toBe(1)
    w = r.workout
    expect(currentPhase(w)?.label).toBe('Schnell')
    expect(phaseElapsedMs(w, 61_000)).toBe(1_000)
    // Strecke: bleibt stehen, egal wie lange
    expect(advanceTimedPhases(w, 999_000).changes).toBe(0)
    w = nextPhase(w, 150_000)
    expect(currentPhase(w)?.label).toBe('Gehen')
    expect(completedDistanceM(w)).toBe(400)
  })

  it('holt nach dem Öffnen mehrere abgelaufene Abschnitte nach', () => {
    const only: Plan = { ...plan, blocks: [blocks[0], blocks[2]] }
    const r = advanceTimedPhases(startCardioPlan(only, 0), 500_000)
    expect(r.changes).toBe(2)
    expect(planDone(r.workout)).toBe(true)
  })

  it('Plan-Läufe behalten den Plannamen, kurze Pläne zeigen Sekunden', () => {
    const w = finishCardio(setSport(startCardioPlan(plan, 0), 'rad'), { sport: 'rad', durationSec: 60 })
    expect(w.title).toBe('3 × 400 m')
    expect(cardioPlanSummary({ ...plan, blocks: [blocks[0]].map((b) => ({ ...b, amount: { unit: 'time' as const, value: 45 } })) })).toBe(
      'Laufen · 1 Abschnitt · 45 s',
    )
  })

  it('Pausen der Stoppuhr zählen nicht zum Abschnitt', () => {
    let w = startCardioPlan(plan, 0)
    w = pauseCardio(w, 30_000)
    w = resumeCardio(w, 90_000)
    // 30 s vor der Pause + 30 s danach = 60 s Bewegung bei 120 s Uhrzeit
    expect(advanceTimedPhases(w, 119_000).changes).toBe(0)
    expect(advanceTimedPhases(w, 121_000).changes).toBe(1)
  })
})
