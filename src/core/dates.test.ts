import { describe, expect, it } from 'vitest'
import { dateKey, formatClock, formatDuration, monthGrid, startOfWeek, weekLabel } from './dates'

describe('Datum', () => {
  it('dateKey nutzt lokale Zeit', () => {
    expect(dateKey(new Date(2026, 10, 17, 23, 30))).toBe('2026-11-17')
  })

  it('Woche beginnt am Montag', () => {
    const tuesday = new Date(2026, 10, 17, 18, 0).getTime()
    expect(dateKey(startOfWeek(tuesday))).toBe('2026-11-16')
    const sunday = new Date(2026, 10, 22, 12, 0).getTime()
    expect(dateKey(startOfWeek(sunday))).toBe('2026-11-16')
  })

  it('benennt diese und letzte Woche', () => {
    const now = new Date(2026, 10, 17).getTime()
    expect(weekLabel(startOfWeek(now), now)).toBe('Diese Woche')
    expect(weekLabel(startOfWeek(new Date(2026, 10, 10).getTime()), now)).toBe('Letzte Woche')
  })

  it('Monatsraster besteht aus vollen Wochen ab Montag', () => {
    // November 2026: der 1. ist ein Sonntag, der 30. ein Montag
    const cells = monthGrid(2026, 10)
    expect(cells.length % 7).toBe(0)
    expect(cells[0].key).toBe('2026-10-26')
    expect(cells.filter((c) => c.inMonth)).toHaveLength(30)
    expect(cells.at(-1)!.key).toBe('2026-12-06')
  })

  it('formatiert Dauer und Uhr', () => {
    expect(formatDuration(58 * 60000)).toBe('58 min')
    expect(formatDuration(65 * 60000)).toBe('1 h 05 min')
    expect(formatClock((42 * 60 + 13) * 1000)).toBe('0:42:13')
  })
})
