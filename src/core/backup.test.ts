import { describe, expect, it } from 'vitest'
import { BackupError, createBackup, parseBackup } from './backup'
import { DEFAULT_EXERCISES, matchesSearch, mergeDefaultExercises } from './exercises'

describe('Backup', () => {
  it('Export und Import ergeben dieselben Daten', () => {
    const backup = createBackup({
      exercises: DEFAULT_EXERCISES.slice(0, 2),
      workouts: [],
      restDays: [{ date: '2026-11-17' }],
      settings: { background: 'logo' },
    })
    const restored = parseBackup(JSON.stringify(backup))
    expect(restored.exercises).toHaveLength(2)
    expect(restored.restDays).toEqual([{ date: '2026-11-17' }])
    expect(restored.settings.background).toBe('logo')
  })

  it('lehnt fremde und kaputte Dateien ab', () => {
    expect(() => parseBackup('kein json')).toThrow(BackupError)
    expect(() => parseBackup('{"app":"andere-app","version":1}')).toThrow(/nicht von Athlete Reboot/)
    expect(() => parseBackup('{"app":"athlete-reboot","version":2}')).toThrow(/neueren App-Version/)
    expect(() => parseBackup('{"app":"athlete-reboot","version":1}')).toThrow(/unvollständig/)
  })
})

describe('Übungen', () => {
  it('Startliste hat eindeutige IDs', () => {
    const ids = DEFAULT_EXERCISES.map((e) => e.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(ids.length).toBeGreaterThanOrEqual(40)
  })

  it('ergänzt neue Standard-Übungen, ohne ausgeblendete zurückzuholen', () => {
    const existing = [{ ...DEFAULT_EXERCISES[0], hidden: true }]
    const merged = mergeDefaultExercises(existing)
    expect(merged).toHaveLength(DEFAULT_EXERCISES.length)
    expect(merged[0].hidden).toBe(true)
  })

  it('Suche findet mit und ohne Umlaute', () => {
    const bank = DEFAULT_EXERCISES.find((e) => e.id === 'bankdruecken')!
    expect(matchesSearch(bank, 'bankdrü')).toBe(true)
    expect(matchesSearch(bank, 'bankdrue')).toBe(true)
    expect(matchesSearch(bank, 'brust')).toBe(true)
    expect(matchesSearch(bank, 'knie')).toBe(false)
  })
})
