// Datenmodell von Athlete Reboot. Reiner TypeScript-Code ohne UI, damit er
// bei einem späteren Umstieg auf React Native wiederverwendbar bleibt.

export type MuscleGroup =
  | 'Brust'
  | 'Rücken'
  | 'Schultern'
  | 'Bizeps'
  | 'Trizeps'
  | 'Beine'
  | 'Po'
  | 'Waden'
  | 'Bauch'
  | 'Sonstiges'

export const MUSCLE_GROUPS: MuscleGroup[] = [
  'Brust',
  'Rücken',
  'Schultern',
  'Bizeps',
  'Trizeps',
  'Beine',
  'Po',
  'Waden',
  'Bauch',
  'Sonstiges',
]

export interface Exercise {
  id: string
  name: string
  group: MuscleGroup
  /** Von Tom selbst angelegt */
  custom?: boolean
  /** In der Auswahl ausgeblendet */
  hidden?: boolean
}

export interface SetEntry {
  id: string
  kg: number | null
  reps: number | null
  done: boolean
  /** Muskelversagen erreicht */
  failure: boolean
}

/** Vorgabe aus dem Plan, z. B. 3 × 6–8 mit 3:00 Pause */
export interface Target {
  sets: number
  repMin: number
  repMax: number
  restSec: number
}

export interface ExerciseEntry {
  id: string
  exerciseId: string
  sets: SetEntry[]
  /** Kopie der Plan-Vorgabe beim Start, damit spätere Planänderungen den Verlauf nicht verändern */
  target?: Target
}

export interface PlanExercise extends Target {
  id: string
  exerciseId: string
}

export interface Plan {
  id: string
  name: string
  exercises: PlanExercise[]
  /** Reihenfolge in der Liste */
  order: number
}

/** Trainingsart. Später kommen Ausdauer-Einheiten (Laufen, Rad, Handball) dazu. */
export type WorkoutType = 'gym'

export type Rating = 'good' | 'meh'

export interface Workout {
  id: string
  type: WorkoutType
  title: string
  startedAt: number
  /** Fehlt, solange das Training läuft */
  endedAt?: number
  rating?: Rating
  exercises: ExerciseEntry[]
  planId?: string
}

export interface RestDay {
  /** Lokales Datum im Format JJJJ-MM-TT */
  date: string
}

export type Background = 'ruhig' | 'blau-lila' | 'logo' | 'hauch'

export interface Settings {
  background: Background
}

export const DEFAULT_SETTINGS: Settings = { background: 'ruhig' }

export interface Backup {
  app: 'athlete-reboot'
  version: 1
  exportedAt: string
  exercises: Exercise[]
  workouts: Workout[]
  restDays: RestDay[]
  /** Ab Schritt 7. Ältere Backups haben keine Pläne. */
  plans: Plan[]
  settings: Settings
}
