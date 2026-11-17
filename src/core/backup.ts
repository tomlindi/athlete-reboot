import { DEFAULT_SETTINGS, type Backup, type Exercise, type Plan, type RestDay, type Settings, type Workout } from './types'

export function createBackup(data: {
  exercises: Exercise[]
  workouts: Workout[]
  restDays: RestDay[]
  plans: Plan[]
  settings: Settings
}, now = new Date()): Backup {
  return {
    app: 'athlete-reboot',
    version: 1,
    exportedAt: now.toISOString(),
    exercises: data.exercises,
    workouts: data.workouts,
    restDays: data.restDays,
    plans: data.plans,
    settings: data.settings,
  }
}

export class BackupError extends Error {}

/** Prüft eine Backup-Datei, bevor sie die Daten auf dem Gerät ersetzt. */
export function parseBackup(text: string): Backup {
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    throw new BackupError('Die Datei ist kein gültiges Backup. Wähle eine .json-Datei, die Athlete Reboot exportiert hat.')
  }
  const b = data as Partial<Backup>
  if (!b || b.app !== 'athlete-reboot') {
    throw new BackupError('Diese Datei stammt nicht von Athlete Reboot.')
  }
  if (b.version !== 1) {
    throw new BackupError('Dieses Backup stammt aus einer neueren App-Version. Aktualisiere die App und versuche es erneut.')
  }
  if (!Array.isArray(b.exercises) || !Array.isArray(b.workouts) || !Array.isArray(b.restDays)) {
    throw new BackupError('Das Backup ist unvollständig. Es fehlen Übungen, Trainings oder Ruhetage.')
  }
  return {
    app: 'athlete-reboot',
    version: 1,
    exportedAt: String(b.exportedAt ?? ''),
    exercises: b.exercises,
    workouts: b.workouts,
    restDays: b.restDays,
    plans: Array.isArray(b.plans) ? b.plans : [],
    settings: { ...DEFAULT_SETTINGS, ...(b.settings ?? {}) },
  }
}

export function backupFileName(now = new Date()): string {
  const d = now.toISOString().slice(0, 10)
  return `athlete-reboot-backup-${d}.json`
}
