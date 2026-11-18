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
  | 'Plyometrie'
  | 'Rumpf'
  | 'Explosiv & Hybrid'
  | 'Isometrie'
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
  'Plyometrie',
  'Rumpf',
  'Explosiv & Hybrid',
  'Isometrie',
  'Reha · Knie',
  'Reha · Sprunggelenk & Achilles',
  'Reha · Schulter',
  'Reha · Hüfte & Rumpf',
  'Reha · Ellbogen & Handgelenk',
]

/** Wie eine Übung gemessen wird: Wiederholungen, Haltezeit in Sekunden oder Strecke in Metern. */
export type Measure = 'reps' | 'time' | 'distance'

/** Schwierigkeit: 1 Einsteiger, 2 Mittel, 3 Fortgeschritten */
export type Level = 1 | 2 | 3

export const LEVEL_LABEL: Record<Level, string> = { 1: 'Einsteiger', 2: 'Mittel', 3: 'Fortgeschritten' }

export interface Exercise {
  id: string
  name: string
  group: MuscleGroup
  /** Fehlt = Wiederholungen */
  measure?: Measure
  /** Stufe, nur bei Übungen mit Progression (z. B. Plyometrie) */
  level?: Level
  /** Von Tom selbst angelegt */
  custom?: boolean
  /** In der Auswahl ausgeblendet */
  hidden?: boolean
}

export interface SetEntry {
  id: string
  kg: number | null
  /** Wiederholungen, bei Zeit-Übungen (`timed`) Sekunden, bei Strecken-Übungen (`distance`) Meter */
  reps: number | null
  done: boolean
  /** Muskelversagen erreicht */
  failure: boolean
}

/** Vorgabe aus dem Plan, z. B. 3 × 6–8 mit 3:00 Pause. Bei Zeit-/Strecken-Übungen sind repMin/repMax Sekunden bzw. Meter. */
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
  /** Strecken-Übung: `reps` der Sätze sind Meter */
  distance?: boolean
  sets: SetEntry[]
  /** Kopie der Plan-Vorgabe beim Start, damit spätere Planänderungen den Verlauf nicht verändern */
  target?: Target
}

export interface PlanExercise extends Target {
  id: string
  exerciseId: string
}

/** Menge eines Abschnitts: Zeit in Sekunden oder Strecke in Metern */
export interface Amount {
  unit: 'time' | 'distance'
  value: number
}

/**
 * Abschnitt eines Ausdauer-Plans, z. B. „Aufwärmen 10:00“ oder „6 × 400 m schnell, 1:30 Gehpause“.
 * Mit `repeat` > 1 wird Belastung + Pause wiederholt.
 */
export interface CardioBlock {
  id: string
  label: string
  amount: Amount
  repeat?: number
  rest?: Amount
  restLabel?: string
}

/** Gym-Plan (Übungen) oder Ausdauer-Plan (Abschnitte) */
export type PlanKind = 'gym' | 'cardio'

export interface Plan {
  id: string
  name: string
  /** Fehlt = Gym */
  kind?: PlanKind
  /** Ausgeblendet: nicht im Training-Tab, im Pläne-Tab unter „Ausgeblendet“ */
  hidden?: boolean
  /** Nur Ausdauer-Plan */
  sport?: Sport
  /** Nur Ausdauer-Plan */
  blocks?: CardioBlock[]
  exercises: PlanExercise[]
  /** Reihenfolge in der Liste */
  order: number
}

/** Trainingsart: Gym (Sätze) oder Ausdauer (Dauer, Distanz). */
export type WorkoutType = 'gym' | 'cardio'

/** Trainingstag eines Programms: Wochentag (0 = Montag) und Plan */
export interface ProgramDay {
  weekday: number
  planId: string
}

/** Mehrwochen-Programm mit festen Wochentagen und automatischer Steigerung */
export interface Program {
  id: string
  name: string
  /** Montag der ersten Woche, JJJJ-MM-TT */
  startDate: string
  weeks: number
  days: ProgramDay[]
  rules: {
    /** Gym: +1 Satz alle 2 Wochen, höchstens +2 */
    gymExtraSet: boolean
    /** Ausdauer: +1 Intervall bzw. +10 % Umfang pro Woche */
    cardioProgress: boolean
  }
  /** Wochen (1-basiert), die auf Wunsch leichter sind */
  lighterWeeks?: number[]
}

export type Sport = 'laufen' | 'rad' | 'schwimmen'

/** Daten einer Ausdauer-Einheit */
export interface CardioData {
  sport: Sport
  /** Strecke in Metern (auch bei Laufen und Rad, Anzeige dort in km) */
  distanceM?: number
  /** Anstrengung 1–10 (RPE) */
  rpe?: number
  /** Durchschnittspuls in Schlägen pro Minute */
  avgHr?: number
  /** Stoppuhr: Summe aller Pausen in ms */
  pausedMs?: number
  /** Stoppuhr: seit wann gerade pausiert ist */
  pausedAt?: number
  /** Plan-Lauf: aufgelöste Abschnitte (Kopie beim Start) */
  phases?: Phase[]
  /** Plan-Lauf: aktueller Abschnitt; gleich phases.length = Plan geschafft */
  phaseIndex?: number
  /** Plan-Lauf: Bewegungszeit in ms, zu der der aktuelle Abschnitt begann */
  phaseStartMs?: number
}

/** Ein einzelner Abschnitt beim Plan-Lauf, z. B. „schnell, 400 m, Intervall 3 von 6“ */
export interface Phase {
  label: string
  amount: Amount
  rest: boolean
  /** Bei Wiederholungen: Nummer und Anzahl */
  rep?: number
  reps?: number
}

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
  /** Einheit aus einem Programm: welches, welche Woche, welcher Wochentag */
  program?: { programId: string; week: number; weekday: number }
  /** Nur bei type = 'cardio'. Bei beendeten Einheiten ist endedAt − startedAt die Bewegungszeit. Plan-Läufe tragen `planId`. */
  cardio?: CardioData
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
  /** Zuletzt gewählte Seite im Training- und Pläne-Tab */
  trainingView?: PlanKind
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
  /** Ab 0.11. Ältere Backups haben keine Programme. */
  programs?: Program[]
  settings: Settings
}
