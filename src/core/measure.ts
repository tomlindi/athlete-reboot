import type { Exercise, ExerciseEntry, Measure } from './types'

// Messarten einer Übung: Wiederholungen, Haltezeit in Sekunden oder Strecke in Metern.
// Der Wert steht bei allen dreien im Feld `reps` eines Satzes.

export const measureOf = (e: Pick<Exercise, 'measure'> | undefined): Measure => e?.measure ?? 'reps'

/** Messart eines Eintrags im Training. Wird beim Hinzufügen festgehalten, damit der Verlauf eindeutig bleibt. */
export function entryMeasure(e: Pick<ExerciseEntry, 'timed' | 'distance'>): Measure {
  return e.timed ? 'time' : e.distance ? 'distance' : 'reps'
}

/** Markierung für einen neuen Eintrag, z. B. `{ timed: true }`. */
export function entryFlag(m: Measure): Pick<ExerciseEntry, 'timed' | 'distance'> {
  return m === 'time' ? { timed: true } : m === 'distance' ? { distance: true } : {}
}

/** Kurze Spaltenüberschrift */
export const MEASURE_SHORT: Record<Measure, string> = { reps: 'Wdh', time: 'Sek', distance: 'm' }
/** Ausgeschrieben, z. B. für Bildschirmleser */
export const MEASURE_LONG: Record<Measure, string> = { reps: 'Wiederholungen', time: 'Sekunden', distance: 'Meter' }
/** Einheit hinter einer Zahl */
export const MEASURE_UNIT: Record<Measure, string> = { reps: '', time: ' s', distance: ' m' }

/** Obergrenze pro Satz im Plan */
export const MEASURE_MAX: Record<Measure, number> = { reps: 50, time: 600, distance: 2000 }
