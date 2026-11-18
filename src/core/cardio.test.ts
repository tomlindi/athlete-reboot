import { describe, expect, it } from 'vitest'
import {
  cardioSummary,
  cardioWeek,
  elapsedMs,
  finishCardio,
  formatDistance,
  formatPace,
  lastSport,
  manualCardio,
  pauseCardio,
  resumeCardio,
  setSport,
  startCardio,
} from './cardio'
import { formatDuration } from './dates'
import { summarize } from './workout'

describe('Stoppuhr', () => {
  it('zählt ohne Pausen', () => {
    let w = startCardio('laufen', 0)
    expect(elapsedMs(w, 60_000)).toBe(60_000)
    w = pauseCardio(w, 60_000)
    expect(elapsedMs(w, 90_000)).toBe(60_000)
    w = resumeCardio(w, 90_000)
    expect(elapsedMs(w, 120_000)).toBe(90_000)
    expect(w.cardio?.pausedAt).toBeUndefined()
  })

  it('Sportart lässt sich während der Einheit wechseln', () => {
    const w = setSport(startCardio('laufen', 0), 'rad')
    expect(w.title).toBe('Rad')
    expect(w.cardio?.sport).toBe('rad')
  })

  it('Beenden speichert Bewegungszeit und nur gültige Werte', () => {
    const w = finishCardio(startCardio('laufen', 1_000), { sport: 'laufen', durationSec: 1710, distanceM: 5200, rpe: 7, avgHr: 0 })
    expect(w.endedAt).toBe(1_000 + 1_710_000)
    expect(w.cardio).toEqual({ sport: 'laufen', distanceM: 5200, rpe: 7 })
  })
})

describe('Anzeige', () => {
  it('Tempo je Sportart', () => {
    expect(formatPace('laufen', 1710, 5200)).toBe('5:29 /km')
    expect(formatPace('rad', 3600, 24_300)).toBe('24,3 km/h')
    expect(formatPace('schwimmen', 1500, 1200)).toBe('2:05 /100 m')
    expect(formatPace('laufen', 1710)).toBeNull()
  })

  it('Strecke: Schwimmen in Metern, sonst in Kilometern', () => {
    expect(formatDistance('laufen', 5200)).toBe('5,2 km')
    expect(formatDistance('schwimmen', 1500)).toBe('1.500 m')
  })

  it('Kurzfassung für den Verlauf', () => {
    const w = manualCardio({ sport: 'laufen', durationSec: 1710, distanceM: 5200 }, 0)
    expect(cardioSummary(w, formatDuration)).toBe(`5,2 km · ${formatDuration(1_710_000)} · 5:29 /km`)
    expect(summarize(w)).toEqual({ sets: 0, volume: 0, exercises: 0 })
  })
})

describe('Woche', () => {
  it('summiert pro Sportart ab Montag', () => {
    const monday = new Date(2026, 10, 16, 10).getTime()
    const now = new Date(2026, 10, 18, 12).getTime()
    const list = [
      manualCardio({ sport: 'laufen', durationSec: 1800, distanceM: 5000 }, monday),
      manualCardio({ sport: 'laufen', durationSec: 1200, distanceM: 3000 }, monday + 86400000),
      manualCardio({ sport: 'schwimmen', durationSec: 1500, distanceM: 1000 }, monday),
      manualCardio({ sport: 'rad', durationSec: 3600, distanceM: 30000 }, monday - 3 * 86400000),
    ]
    expect(cardioWeek(list, now)).toEqual([
      { sport: 'laufen', sessions: 2, minutes: 50, distanceM: 8000 },
      { sport: 'schwimmen', sessions: 1, minutes: 25, distanceM: 1000 },
    ])
    expect(lastSport(list)).toBe('laufen')
  })
})
