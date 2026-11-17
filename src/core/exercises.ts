import type { Exercise, MuscleGroup } from './types'

// Startliste mit gängigen Übungen. Tom kann eigene hinzufügen und unnötige ausblenden.
// Die IDs sind fest, damit Verlauf und Backups über App-Updates hinweg stimmen.
const LIST: [string, string, MuscleGroup][] = [
  ['bankdruecken', 'Bankdrücken', 'Brust'],
  ['schraegbank-lh', 'Schrägbankdrücken Langhantel', 'Brust'],
  ['schraegbank-kh', 'Schrägbankdrücken Kurzhantel', 'Brust'],
  ['kh-bankdruecken', 'Bankdrücken Kurzhantel', 'Brust'],
  ['butterfly', 'Butterfly', 'Brust'],
  ['kabelzug-flys', 'Kabelzug-Flys', 'Brust'],
  ['dips', 'Dips', 'Brust'],
  ['liegestuetze', 'Liegestütze', 'Brust'],

  ['klimmzuege', 'Klimmzüge', 'Rücken'],
  ['latzug', 'Latzug', 'Rücken'],
  ['rudern-lh', 'Rudern Langhantel', 'Rücken'],
  ['rudern-kh', 'Rudern Kurzhantel', 'Rücken'],
  ['rudern-kabel', 'Rudern am Kabel', 'Rücken'],
  ['t-bar-rudern', 'T-Bar-Rudern', 'Rücken'],
  ['kreuzheben', 'Kreuzheben', 'Rücken'],
  ['hyperextensions', 'Hyperextensions', 'Rücken'],

  ['schulterdruecken-lh', 'Schulterdrücken Langhantel', 'Schultern'],
  ['schulterdruecken-kh', 'Schulterdrücken Kurzhantel', 'Schultern'],
  ['seitheben', 'Seitheben', 'Schultern'],
  ['face-pulls', 'Face Pulls', 'Schultern'],
  ['reverse-butterfly', 'Reverse Butterfly', 'Schultern'],

  ['curls-lh', 'Bizepscurls Langhantel', 'Bizeps'],
  ['curls-kh', 'Bizepscurls Kurzhantel', 'Bizeps'],
  ['hammercurls', 'Hammercurls', 'Bizeps'],
  ['scottcurls', 'Scottcurls', 'Bizeps'],

  ['trizeps-seil', 'Trizepsdrücken am Seil', 'Trizeps'],
  ['french-press', 'French Press', 'Trizeps'],
  ['trizeps-ueberkopf', 'Trizeps Überkopf', 'Trizeps'],

  ['kniebeuge', 'Kniebeuge', 'Beine'],
  ['beinpresse', 'Beinpresse', 'Beine'],
  ['beinstrecker', 'Beinstrecker', 'Beine'],
  ['beinbeuger', 'Beinbeuger', 'Beine'],
  ['rum-kreuzheben', 'Rumänisches Kreuzheben', 'Beine'],
  ['ausfallschritte', 'Ausfallschritte', 'Beine'],
  ['bulgarian-split-squat', 'Bulgarian Split Squat', 'Beine'],

  ['hip-thrust', 'Hip Thrust', 'Po'],
  ['abduktoren', 'Abduktoren-Maschine', 'Po'],

  ['wadenheben-stehend', 'Wadenheben stehend', 'Waden'],
  ['wadenheben-sitzend', 'Wadenheben sitzend', 'Waden'],

  ['plank', 'Plank', 'Bauch'],
  ['crunches', 'Crunches', 'Bauch'],
  ['beinheben-haengend', 'Beinheben hängend', 'Bauch'],
  ['kabel-crunches', 'Kabel-Crunches', 'Bauch'],
]

export const DEFAULT_EXERCISES: Exercise[] = LIST.map(([id, name, group]) => ({ id, name, group }))

/** Ergänzt fehlende Standard-Übungen (z. B. nach einem App-Update), ohne Toms Änderungen zu überschreiben. */
export function mergeDefaultExercises(existing: Exercise[]): Exercise[] {
  const known = new Set(existing.map((e) => e.id))
  return [...existing, ...DEFAULT_EXERCISES.filter((e) => !known.has(e.id))]
}

/** Sucht ohne Rücksicht auf Groß-/Kleinschreibung und Umlaute-Schreibweise (ue = ü). */
export function matchesSearch(exercise: Exercise, query: string): boolean {
  const norm = (s: string) =>
    s
      .toLowerCase()
      .replace(/ä/g, 'ae')
      .replace(/ö/g, 'oe')
      .replace(/ü/g, 'ue')
      .replace(/ß/g, 'ss')
  const q = norm(query.trim())
  if (!q) return true
  return norm(exercise.name).includes(q) || norm(exercise.group).includes(q)
}
