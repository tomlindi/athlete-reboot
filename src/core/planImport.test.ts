import { describe, expect, it } from 'vitest'
import { DEFAULT_EXERCISES } from './exercises'
import { claudeInstructions, parsePlanImport, PlanImportError } from './planImport'
import type { Plan } from './types'

const NOW = new Date(2026, 10, 18, 12).getTime()
const existing: Plan = { id: 'x', name: 'Beine A', order: 4, exercises: [] }
const current = { exercises: DEFAULT_EXERCISES, plans: [existing], programs: [] }

const sample = `Hier ist dein Plan:
\`\`\`json
{
  "plans": [
    { "id": "beine-a", "name": "Beine A", "type": "gym", "exercises": [
      { "name": "kniebeuge", "sets": 4, "reps": "6-8", "rest": 150 },
      { "name": "Wandsitzen", "sets": 3, "seconds": "30-45", "rest": 60 },
      { "name": "Sprungseil", "sets": 3, "seconds": 60 }
    ] },
    { "id": "intervalle", "name": "6 × 400 m", "type": "cardio", "sport": "laufen", "blocks": [
      { "label": "Aufwärmen", "minutes": 10 },
      { "label": "Schnell", "meters": 400, "repeat": 6, "rest": { "seconds": 90 }, "restLabel": "Gehpause" },
      { "label": "Kaputt" }
    ] }
  ],
  "programs": [
    { "name": "Dunken", "weeks": 8, "start": "naechste-woche", "days": { "mo": "beine-a", "mi": "intervalle", "xx": "beine-a", "fr": "gibtsnicht" } }
  ]
}
\`\`\`
Viel Erfolg!`

describe('Plan-Import', () => {
  const r = parsePlanImport(sample, current, NOW)

  it('liest Gym-Pläne, ordnet Übungen per Name zu und legt unbekannte an', () => {
    const gym = r.plans[0]
    expect(gym.name).toBe('Beine A 2') // Name gab es schon
    expect(gym.order).toBe(5)
    expect(gym.exercises.map((e) => e.exerciseId)).toEqual(['kniebeuge', 'reha-wandsitzen', r.newExercises[0].id])
    expect(gym.exercises[0]).toMatchObject({ sets: 4, repMin: 6, repMax: 8, restSec: 150 })
    expect(gym.exercises[1]).toMatchObject({ repMin: 30, repMax: 45, restSec: 60 })
    expect(r.newExercises).toEqual([expect.objectContaining({ name: 'Sprungseil', measure: 'time', custom: true, group: 'Sonstiges' })])
  })

  it('liest Ausdauer-Pläne mit Intervallen und überspringt kaputte Abschnitte', () => {
    const c = r.plans[1]
    expect(c).toMatchObject({ kind: 'cardio', sport: 'laufen' })
    expect(c.blocks).toHaveLength(2)
    expect(c.blocks![0].amount).toEqual({ unit: 'time', value: 600 })
    expect(c.blocks![1]).toMatchObject({ repeat: 6, rest: { unit: 'time', value: 90 }, restLabel: 'Gehpause' })
    expect(r.warnings.some((w) => w.includes('Kaputt'))).toBe(true)
  })

  it('Programm: Wochentage über die Plan-ID, Start nächste Woche, Warnungen für Unbekanntes', () => {
    const p = r.programs[0]
    expect(p).toMatchObject({ name: 'Dunken', weeks: 8, startDate: '2026-11-23', rules: { cardioProgress: true, gymExtraSet: false } })
    expect(p.days).toEqual([
      { weekday: 0, planId: r.plans[0].id },
      { weekday: 2, planId: r.plans[1].id },
    ])
    expect(r.warnings.some((w) => w.includes('„xx“'))).toBe(true)
    expect(r.warnings.some((w) => w.includes('gibtsnicht'))).toBe(true)
  })

  it('Programme dürfen bestehende Pläne über ihren Namen nutzen', () => {
    const only = parsePlanImport('{"programs":[{"name":"P","days":{"di":"Beine A"}}]}', current, NOW)
    expect(only.programs[0].days).toEqual([{ weekday: 1, planId: 'x' }])
    expect(only.programs[0].startDate).toBe('2026-11-16')
  })

  it('klare Fehler bei kaputtem oder leerem Text', () => {
    expect(() => parsePlanImport('hallo', current)).toThrow(PlanImportError)
    expect(() => parsePlanImport('{ kaputt', current)).toThrow(PlanImportError)
    expect(() => parsePlanImport('{"foo": 1}', current)).toThrow(/Keine Pläne/)
  })

  it('Anleitung für Claude enthält Format und Übungsliste', () => {
    const t = claudeInstructions(DEFAULT_EXERCISES)
    expect(t).toContain('"programs"')
    expect(t).toContain('- Wandsitzen [Sekunden]')
    expect(t).toContain("- Farmer's Walk [Meter]")
  })
})
