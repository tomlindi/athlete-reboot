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
  | 'Reha · Knie'
  | 'Reha · Sprunggelenk & Achilles'
  | 'Reha · Schulter'
  | 'Reha · Hüfte & Rumpf'
  | 'Reha · Ellbogen & Handgelenk'

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
  'Reha · Knie',
  'Reha · Sprunggelenk & Achilles',
  'Reha · Schulter',
  'Reha · Hüfte & Rumpf',
  'Reha · Ellbogen & Handgelenk',
]

/** Wie eine Übung gemessen wird: Wiederholungen oder Haltezeit in Sekunden. */
export type Measure = 'reps' | 'time'

export interface Exercise {
  id: string
  name: string
  group: MuscleGroup
  /** Fehlt = Wiederholungen */
  measure?: Measure
  /** Von Tom selbst angelegt */
  custom?: boolean
  /** In der Auswahl ausgeblendet */
  hidden?: boolean
}

export interface SetEntry {
  id: string
  kg: number | null
  /** Wiederholungen, bei Zeit-Übungen (Eintrag mit `timed`) die Haltezeit in Sekunden */
  reps: number | null
  done: boolean
  /** Muskelversagen erreicht */
  failure: boolean
}

/** Vorgabe aus dem Plan, z. B. 3 × 6–8 mit 3:00 Pause. Bei Zeit-Übungen sind repMin/repMax Sekunden. */
export interface Target {
  sets: number
  repMin: number
  repMax: number
  restSec: number
}

export interface ExerciseEntry {
  id: string
  exerciseId: string
  /** Zeit-Übung: `reps` der Sätze sind Sekunden. Beim Hinzufügen festgehalten, damit der Verlauf eindeutig bleibt. */
  timed?: boolean
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
  /** Laufende Pause. Gespeichert als Endzeitpunkt, damit sie App-Wechsel und Neustart übersteht. */
  rest?: RestTimer
  /** Laufender Countdown einer Zeit-Übung */
  hold?: HoldTimer
}

export interface RestTimer {
  endsAt: number
  /** Gesamtlänge in Sekunden, für den Fortschrittsbalken */
  total: number
}

export interface HoldTimer {
  entryId: string
  setId: string
  startedAt: number
  endsAt: number
  /** Geplante Haltezeit in Sekunden */
  total: number
}

export interface RestDay {
  /** Lokales Datum im Format JJJJ-MM-TT */
  date: string
}

export type Background = 'ruhig' | 'blau-lila' | 'logo' | 'hauch'

export interface Settings {
  background: Background
  /** Pause nach einem Satz, wenn die Übung keine Plan-Vorgabe hat */
  defaultRestSec: number
  /** Kurzer Ton, wenn die Pause vorbei ist */
  restSound: boolean
}

export const DEFAULT_SETTINGS: Settings = { background: 'ruhig', defaultRestSec: 120, restSound: true }

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
