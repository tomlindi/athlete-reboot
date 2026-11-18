import { describe, expect, it } from 'vitest'
import { createProgram, isRunning, planForWeek, programStatus, programWeek, setDay, startProgramSession, toggleLighter, weekDays } from './program'
import type { Plan, Program } from './types'

// Mittwoch, 18.11.2026, 12 Uhr
const NOW = new Date(2026, 10, 18, 12).getTime()

const gym: Plan = {
  id: 'g',
  name: 'Beine',
  order: 0,
  exercises: [{ id: 'e', exerciseId: 'kniebeuge', sets: 3, repMin: 6, repMax: 8, restSec: 120 }],
}
const cardio: Plan = {
  id: 'c',
  name: 'Intervalle',
  kind: 'cardio',
  sport: 'laufen',
  order: 1,
  exercises: [],
  blocks: [
    { id: 'w', label: 'Aufwärmen', amount: { unit: 'time', value: 600 } },
    { id: 'i', label: 'Schnell', amount: { unit: 'distance', value: 400 }, repeat: 6, rest: { unit: 'time', value: 90 }, restLabel: 'Gehen' },
  ],
}

function program(): Program {
  let p = createProgram('Dunken', 8, NOW)
  p = setDay(p, 0, 'g')
  p = setDay(p, 2, 'c')
  p = setDay(p, 4, 'g')
  return p
}

describe('Programmwochen', () => {
  it('startet am Montag der aktuellen Woche', () => {
    const p = program()
    expect(p.startDate).toBe('2026-11-16')
    expect(programWeek(p, NOW)).toBe(1)
    expect(programWeek(p, NOW + 7 * 86_400_000)).toBe(2)
    expect(programWeek({ ...p, startDate: '2026-11-23' }, NOW)).toBe(0)
    expect(isRunning({ ...p, startDate: '2026-09-07', weeks: 8 }, NOW)).toBe(false)
    expect(programStatus(p, NOW)).toBe('Woche 1 von 8')
    expect(programStatus({ ...p, startDate: '2026-11-23' }, NOW)).toBe('Startet am 23.11.')
  })

  it('Wochentage: erledigt, heute, verpasst, kommt noch', () => {
    const p = program()
    const done = startProgramSession(p, gym, 1, 0, [], NOW - 2 * 86_400_000)
    const days = weekDays(p, 1, [{ ...done, endedAt: done.startedAt + 1 }], NOW)
    expect(days.map((d) => d.status)).toEqual(['done', 'today', 'upcoming'])
    expect(weekDays(p, 1, [], NOW)[0].status).toBe('missed')
  })
})

describe('Steigerung', () => {
  it('Ausdauer: +1 Intervall und +10 % Umfang pro Woche', () => {
    const p = program()
    const w3 = planForWeek(cardio, p, 3)
    expect(w3.blocks![1].repeat).toBe(8)
    expect(w3.blocks![0].amount.value).toBe(725) // 600 × 1,21 = 726 → auf 5 s gerundet
    expect(planForWeek(cardio, p, 1)).toEqual(cardio)
  })

  it('Gym: ohne Regel unverändert, mit Regel +1 Satz alle 2 Wochen, höchstens +2', () => {
    const p = program()
    expect(planForWeek(gym, p, 5)).toBe(gym)
    const on = { ...p, rules: { ...p.rules, gymExtraSet: true } }
    expect(planForWeek(gym, on, 2).exercises[0].sets).toBe(3)
    expect(planForWeek(gym, on, 3).exercises[0].sets).toBe(4)
    expect(planForWeek(gym, on, 8).exercises[0].sets).toBe(5)
  })

  it('leichtere Woche: weniger Sätze, halb so viele Intervalle, 30 % weniger Umfang', () => {
    const p = toggleLighter(program(), 3)
    expect(planForWeek(gym, p, 3).exercises[0].sets).toBe(2)
    const c = planForWeek(cardio, p, 3)
    expect(c.blocks![1].repeat).toBe(4)
    expect(c.blocks![0].amount.value).toBe(510) // 600 × 1,21 × 0,7 ≈ 508 → 510
    expect(toggleLighter(p, 3).lighterWeeks).toEqual([])
  })

  it('Einheit aus dem Programm trägt Programm, Woche und Tag', () => {
    const w = startProgramSession(program(), cardio, 2, 2, [], NOW)
    expect(w.program).toEqual({ programId: w.program!.programId, week: 2, weekday: 2 })
    expect(w.cardio?.phases?.filter((ph) => !ph.rest && ph.label === 'Schnell')).toHaveLength(7)
  })
})
