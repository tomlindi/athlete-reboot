import type { Exercise, Measure, MuscleGroup, Workout } from './types'

// Startliste mit gängigen Übungen. Tom kann eigene hinzufügen und unnötige ausblenden.
// Die IDs sind fest, damit Verlauf und Backups über App-Updates hinweg stimmen.
const LIST: [string, string, MuscleGroup, Measure?][] = [
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

  ['plank', 'Plank', 'Bauch', 'time'],
  ['crunches', 'Crunches', 'Bauch'],
  ['beinheben-haengend', 'Beinheben hängend', 'Bauch'],
  ['kabel-crunches', 'Kabel-Crunches', 'Bauch'],

  // Reha-Übungen nach gängigen Physio-Protokollen (Kreuzband, Sprunggelenk, Schulter, Rücken, Sehnen).
  // Welche davon wann passen, entscheidet die Physiotherapie.
  ['reha-quad-anspannen', 'Quadrizeps anspannen', 'Reha · Knie', 'time'],
  ['reha-ferse-hochlagern', 'Ferse hochlagern (Streckung)', 'Reha · Knie', 'time'],
  ['reha-fersengleiten', 'Fersengleiten', 'Reha · Knie'],
  ['reha-gerades-beinheben', 'Gerades Beinheben', 'Reha · Knie'],
  ['reha-tke', 'Terminal Knee Extension (Band)', 'Reha · Knie'],
  ['reha-mini-kniebeuge', 'Mini-Kniebeuge', 'Reha · Knie'],
  ['reha-wandsitzen', 'Wandsitzen', 'Reha · Knie', 'time'],
  ['reha-spanish-squat', 'Spanish Squat', 'Reha · Knie', 'time'],
  ['reha-step-up', 'Step-up', 'Reha · Knie'],
  ['reha-step-down', 'Step-down', 'Reha · Knie'],
  ['reha-nordic-curl', 'Nordic Hamstring Curl', 'Reha · Knie'],

  ['reha-einbeinstand', 'Einbeinstand', 'Reha · Sprunggelenk & Achilles', 'time'],
  ['reha-einbeinstand-augen-zu', 'Einbeinstand Augen zu', 'Reha · Sprunggelenk & Achilles', 'time'],
  ['reha-einbeinstand-instabil', 'Einbeinstand instabil', 'Reha · Sprunggelenk & Achilles', 'time'],
  ['reha-fussgelenk-band', 'Fußgelenk mit Band (4 Richtungen)', 'Reha · Sprunggelenk & Achilles'],
  ['reha-knie-zur-wand', 'Knie-zur-Wand-Mobilisation', 'Reha · Sprunggelenk & Achilles'],
  ['reha-wadenheben-einbeinig', 'Wadenheben einbeinig', 'Reha · Sprunggelenk & Achilles'],
  ['reha-exz-wade-gestreckt', 'Exzentrisches Wadenheben (Knie gestreckt)', 'Reha · Sprunggelenk & Achilles'],
  ['reha-exz-wade-gebeugt', 'Exzentrisches Wadenheben (Knie gebeugt)', 'Reha · Sprunggelenk & Achilles'],

  ['reha-ar-isometrisch', 'Außenrotation isometrisch', 'Reha · Schulter', 'time'],
  ['reha-ar-band', 'Außenrotation mit Band', 'Reha · Schulter'],
  ['reha-ir-band', 'Innenrotation mit Band', 'Reha · Schulter'],
  ['reha-rudern-band', 'Rudern mit Band', 'Reha · Schulter'],
  ['reha-serratus-punch', 'Serratus Punch', 'Reha · Schulter'],
  ['reha-ytw', 'Y-T-W liegend', 'Reha · Schulter'],
  ['reha-schulterblaetter', 'Schulterblätter zusammenziehen', 'Reha · Schulter'],

  ['reha-clamshell', 'Clamshell', 'Reha · Hüfte & Rumpf'],
  ['reha-glute-bridge', 'Glute Bridge', 'Reha · Hüfte & Rumpf'],
  ['reha-glute-bridge-einbeinig', 'Glute Bridge einbeinig', 'Reha · Hüfte & Rumpf'],
  ['reha-seitliches-beinheben', 'Seitliches Beinheben', 'Reha · Hüfte & Rumpf'],
  ['reha-bird-dog', 'Bird Dog', 'Reha · Hüfte & Rumpf'],
  ['reha-dead-bug', 'Dead Bug', 'Reha · Hüfte & Rumpf'],
  ['reha-mcgill-curl-up', 'McGill Curl-up', 'Reha · Hüfte & Rumpf'],
  ['reha-seitstuetz', 'Seitstütz', 'Reha · Hüfte & Rumpf', 'time'],
  ['reha-copenhagen', 'Copenhagen Plank', 'Reha · Hüfte & Rumpf', 'time'],

  ['reha-tyler-twist', 'Tyler Twist', 'Reha · Ellbogen & Handgelenk'],
  ['reha-exz-handgelenk', 'Exzentrische Handgelenkstreckung', 'Reha · Ellbogen & Handgelenk'],
  ['reha-handgelenkbeugung', 'Handgelenkbeugung', 'Reha · Ellbogen & Handgelenk'],
  ['reha-unterarm-drehen', 'Unterarm drehen mit Hantel', 'Reha · Ellbogen & Handgelenk'],
  ['reha-griffkraft', 'Griffkraft halten', 'Reha · Ellbogen & Handgelenk', 'time'],
]

export const DEFAULT_EXERCISES: Exercise[] = LIST.map(([id, name, group, measure]) => (measure ? { id, name, group, measure } : { id, name, group }))

const DEFAULT_BY_ID = new Map(DEFAULT_EXERCISES.map((e) => [e.id, e]))

export const isTimed = (e: Pick<Exercise, 'measure'> | undefined) => e?.measure === 'time'

/**
 * Ergänzt fehlende Standard-Übungen (z. B. nach einem App-Update), ohne Toms Änderungen zu überschreiben.
 * Die Messart der Standard-Übungen kommt immer aus der App (z. B. Plank wurde zur Zeit-Übung).
 */
export function mergeDefaultExercises(existing: Exercise[]): Exercise[] {
  const known = new Set(existing.map((e) => e.id))
  const updated = existing.map((e) => {
    const d = DEFAULT_BY_ID.get(e.id)
    if (!d || d.measure === e.measure) return e
    const { measure: _old, ...rest } = e
    return d.measure ? { ...rest, measure: d.measure } : rest
  })
  return [...updated, ...DEFAULT_EXERCISES.filter((e) => !known.has(e.id))]
}

/**
 * Markiert Einträge von Zeit-Übungen in gespeicherten Trainings (z. B. alte Plank-Sätze,
 * die vor der Umstellung als Wiederholungen gespeichert wurden). Gibt nur geänderte Trainings zurück.
 */
export function markTimedEntries(workouts: Workout[], exercises: Exercise[]): Workout[] {
  const timed = new Set(exercises.filter(isTimed).map((e) => e.id))
  const changed: Workout[] = []
  for (const w of workouts) {
    if (!w.exercises.some((e) => timed.has(e.exerciseId) && !e.timed)) continue
    changed.push({ ...w, exercises: w.exercises.map((e) => (timed.has(e.exerciseId) && !e.timed ? { ...e, timed: true } : e)) })
  }
  return changed
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
