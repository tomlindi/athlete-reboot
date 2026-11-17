import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import { mergeDefaultExercises } from '../core/exercises'
import { DEFAULT_SETTINGS, type Backup, type Exercise, type RestDay, type Settings, type Workout } from '../core/types'

// Speicher-Schicht: alle Daten liegen auf dem Gerät in IndexedDB.
// Die App spricht nur über diese Funktionen mit dem Speicher, damit er später austauschbar ist.

interface AthleteDB extends DBSchema {
  exercises: { key: string; value: Exercise }
  workouts: { key: string; value: Workout; indexes: { startedAt: number } }
  restDays: { key: string; value: RestDay }
  settings: { key: string; value: Settings }
}

const DB_NAME = 'athlete-reboot'
const SETTINGS_KEY = 'app'

let dbPromise: Promise<IDBPDatabase<AthleteDB>> | null = null

function db() {
  dbPromise ??= openDB<AthleteDB>(DB_NAME, 1, {
    upgrade(d) {
      d.createObjectStore('exercises', { keyPath: 'id' })
      const w = d.createObjectStore('workouts', { keyPath: 'id' })
      w.createIndex('startedAt', 'startedAt')
      d.createObjectStore('restDays', { keyPath: 'date' })
      d.createObjectStore('settings')
    },
  })
  return dbPromise
}

export interface AppData {
  exercises: Exercise[]
  workouts: Workout[]
  restDays: RestDay[]
  settings: Settings
}

/** Lädt alles beim Start. Fehlende Standard-Übungen werden ergänzt. */
export async function loadAll(): Promise<AppData> {
  const d = await db()
  const [storedExercises, workouts, restDays, settings] = await Promise.all([
    d.getAll('exercises'),
    d.getAll('workouts'),
    d.getAll('restDays'),
    d.get('settings', SETTINGS_KEY),
  ])
  const exercises = mergeDefaultExercises(storedExercises)
  if (exercises.length !== storedExercises.length) {
    const tx = d.transaction('exercises', 'readwrite')
    await Promise.all([...exercises.map((e) => tx.store.put(e)), tx.done])
  }
  return { exercises, workouts, restDays, settings: { ...DEFAULT_SETTINGS, ...settings } }
}

export async function saveWorkout(w: Workout) {
  await (await db()).put('workouts', w)
}

export async function deleteWorkout(id: string) {
  await (await db()).delete('workouts', id)
}

export async function saveExercise(e: Exercise) {
  await (await db()).put('exercises', e)
}

export async function setRestDay(date: string, isRest: boolean) {
  const d = await db()
  if (isRest) await d.put('restDays', { date })
  else await d.delete('restDays', date)
}

export async function saveSettings(s: Settings) {
  await (await db()).put('settings', s, SETTINGS_KEY)
}

/** Ersetzt alle Daten durch ein Backup. Läuft in einer Transaktion: ganz oder gar nicht. */
export async function replaceAll(b: Backup) {
  const d = await db()
  const tx = d.transaction(['exercises', 'workouts', 'restDays', 'settings'], 'readwrite')
  await Promise.all([
    tx.objectStore('exercises').clear(),
    tx.objectStore('workouts').clear(),
    tx.objectStore('restDays').clear(),
  ])
  await Promise.all([
    ...mergeDefaultExercises(b.exercises).map((e) => tx.objectStore('exercises').put(e)),
    ...b.workouts.map((w) => tx.objectStore('workouts').put(w)),
    ...b.restDays.map((r) => tx.objectStore('restDays').put(r)),
    tx.objectStore('settings').put({ ...DEFAULT_SETTINGS, ...b.settings }, SETTINGS_KEY),
  ])
  await tx.done
}

/** Bittet den Browser, die Daten nicht automatisch zu löschen. */
export async function requestPersistence() {
  try {
    if (navigator.storage?.persist && !(await navigator.storage.persisted())) {
      await navigator.storage.persist()
    }
  } catch {
    // Nicht überall verfügbar. Der JSON-Export bleibt die Absicherung.
  }
}
