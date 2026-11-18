import { normalizeBlock } from './cardioPlan'
import { newId } from './ids'
import { MEASURE_LONG, measureOf } from './measure'
import { normalizeTarget, parseRepRange } from './plans'
import { mondayKey } from './program'
import type { Amount, CardioBlock, Exercise, Measure, Plan, PlanExercise, Program, Sport } from './types'

// Pläne und Programme aus einer JSON-Datei oder eingefügtem Text übernehmen, z. B. von Claude geschrieben.
// Nichts wird überschrieben: Alles kommt als neue Pläne und Programme dazu.
// Format: docs/plan-import.md und claudeInstructions() unten.

export class PlanImportError extends Error {}

export interface ImportPreview {
  plans: Plan[]
  programs: Program[]
  newExercises: Exercise[]
  warnings: string[]
}

type Json = Record<string, unknown>

const isObj = (v: unknown): v is Json => typeof v === 'object' && v !== null && !Array.isArray(v)
const str = (v: unknown) => (typeof v === 'string' ? v.trim() : typeof v === 'number' ? String(v) : '')
const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : typeof v === 'string' && v.trim() !== '' ? Number(v.replace(',', '.')) : NaN)

/** Vergleichsform für Namen: klein, Umlaute ausgeschrieben, nur Buchstaben und Ziffern. */
export function nameKey(s: string): string {
  return s
    .toLowerCase()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]/g, '')
}

/** Holt das JSON aus dem Text, auch wenn Claude ```json-Zäune oder Sätze drumherum geschrieben hat. */
function extractJson(text: string): unknown {
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start < 0 || end <= start) throw new PlanImportError('Im Text wurde kein Plan gefunden. Er muss mit { beginnen und mit } enden.')
  try {
    return JSON.parse(text.slice(start, end + 1))
  } catch {
    throw new PlanImportError('Der Text ist kein gültiges JSON. Bitte Claude, den Plan noch einmal als einen JSON-Block auszugeben.')
  }
}

const WEEKDAY_KEYS: Record<string, number> = {
  mo: 0, montag: 0, di: 1, dienstag: 1, mi: 2, mittwoch: 2, do: 3, donnerstag: 3, fr: 4, freitag: 4, sa: 5, samstag: 5, so: 6, sonntag: 6,
}

const SPORT_KEYS: Record<string, Sport> = { laufen: 'laufen', run: 'laufen', rad: 'rad', radfahren: 'rad', bike: 'rad', schwimmen: 'schwimmen', swim: 'schwimmen' }

/** Menge aus { minutes | seconds | meters | km } */
function readAmount(o: Json): Amount | null {
  if (o.minutes !== undefined) return { unit: 'time', value: num(o.minutes) * 60 }
  if (o.seconds !== undefined) return { unit: 'time', value: num(o.seconds) }
  if (o.km !== undefined) return { unit: 'distance', value: num(o.km) * 1000 }
  if (o.meters !== undefined) return { unit: 'distance', value: num(o.meters) }
  return null
}

export function parsePlanImport(
  text: string,
  current: { exercises: Exercise[]; plans: Plan[]; programs: Program[] },
  now = Date.now(),
): ImportPreview {
  const data = extractJson(text)
  if (!isObj(data)) throw new PlanImportError('Der Plan muss ein JSON-Objekt sein.')
  const rawPlans = Array.isArray(data.plans) ? data.plans : []
  const rawPrograms = Array.isArray(data.programs) ? data.programs : []
  if (rawPlans.length === 0 && rawPrograms.length === 0) {
    throw new PlanImportError('Keine Pläne oder Programme gefunden. Erwartet wird "plans" und/oder "programs".')
  }

  const warnings: string[] = []
  const newExercises: Exercise[] = []
  const byKey = new Map<string, Exercise>()
  for (const e of current.exercises) {
    byKey.set(nameKey(e.id), e)
    byKey.set(nameKey(e.name), e)
  }

  function findExercise(name: string, wanted: Measure): Exercise {
    const hit = byKey.get(nameKey(name))
    if (hit) {
      if (measureOf(hit) !== wanted) {
        warnings.push(`„${hit.name}“ wird in der App in ${MEASURE_LONG[measureOf(hit)]} gemessen. Die Zahlen wurden so übernommen.`)
      }
      return hit
    }
    const e: Exercise = { id: `eigen-${newId()}`, name: name.trim(), group: 'Sonstiges', custom: true, ...(wanted !== 'reps' ? { measure: wanted } : {}) }
    newExercises.push(e)
    byKey.set(nameKey(e.name), e)
    return e
  }

  // Doppelte Plannamen bekommen eine Nummer, damit nichts verwechselt wird
  const taken = new Set(current.plans.map((p) => nameKey(p.name)))
  const uniqueName = (name: string) => {
    let n = name
    for (let i = 2; taken.has(nameKey(n)); i++) n = `${name} ${i}`
    taken.add(nameKey(n))
    return n
  }

  let order = current.plans.reduce((m, p) => Math.max(m, p.order + 1), 0)
  const refs = new Map<string, string>()
  const plans: Plan[] = []

  rawPlans.forEach((raw, i) => {
    if (!isObj(raw)) return warnings.push(`Plan ${i + 1} wurde übersprungen (kein Objekt).`)
    const name = str(raw.name) || `Importierter Plan ${i + 1}`
    const kind = str(raw.type) === 'cardio' || Array.isArray(raw.blocks) ? 'cardio' : 'gym'
    const plan: Plan = { id: newId(), name: uniqueName(name), order: order++, exercises: [], ...(kind === 'cardio' ? { kind } : {}) }

    if (kind === 'cardio') {
      const sport = SPORT_KEYS[nameKey(str(raw.sport))] ?? 'laufen'
      if (raw.sport !== undefined && !SPORT_KEYS[nameKey(str(raw.sport))]) warnings.push(`„${name}“: Sportart „${str(raw.sport)}“ unbekannt, Laufen genommen.`)
      plan.sport = sport
      const blocks: CardioBlock[] = []
      for (const b of Array.isArray(raw.blocks) ? raw.blocks : []) {
        if (!isObj(b)) continue
        const amount = readAmount(b)
        if (!amount || !Number.isFinite(amount.value) || amount.value <= 0) {
          warnings.push(`„${name}“: Abschnitt „${str(b.label) || '?'}“ ohne gültige Dauer oder Strecke übersprungen.`)
          continue
        }
        const repeat = Number.isFinite(num(b.repeat)) ? num(b.repeat) : 1
        const rest = isObj(b.rest) ? readAmount(b.rest) : null
        blocks.push(
          normalizeBlock({
            id: newId(),
            label: str(b.label) || 'Abschnitt',
            amount,
            ...(repeat > 1 ? { repeat, rest: rest ?? { unit: 'time', value: 60 }, restLabel: str(b.restLabel) || 'Pause' } : {}),
          }),
        )
      }
      plan.blocks = blocks
      if (blocks.length === 0) warnings.push(`„${name}“ hat keine Abschnitte.`)
    } else {
      for (const x of Array.isArray(raw.exercises) ? raw.exercises : []) {
        if (!isObj(x) || !str(x.name)) continue
        const measure: Measure = x.seconds !== undefined ? 'time' : x.meters !== undefined ? 'distance' : 'reps'
        const ex = findExercise(str(x.name), measure)
        const range = parseRepRange(str(x.reps ?? x.seconds ?? x.meters)) ?? (measure === 'time' ? { repMin: 30, repMax: 45 } : measure === 'distance' ? { repMin: 20, repMax: 30 } : { repMin: 8, repMax: 10 })
        const rest = num(x.rest)
        const pe: PlanExercise = normalizeTarget(
          { id: newId(), exerciseId: ex.id, sets: Number.isFinite(num(x.sets)) ? num(x.sets) : 3, ...range, restSec: Number.isFinite(rest) ? rest : 120 },
          measureOf(ex),
        )
        plan.exercises.push(pe)
      }
      if (plan.exercises.length === 0) warnings.push(`„${name}“ hat keine Übungen.`)
    }

    plans.push(plan)
    refs.set(nameKey(str(raw.id) || name), plan.id)
    refs.set(nameKey(name), plan.id)
  })

  // Bestehende Pläne dürfen in Programmen über ihren Namen verwendet werden
  for (const p of current.plans) if (!refs.has(nameKey(p.name))) refs.set(nameKey(p.name), p.id)

  const programs: Program[] = []
  rawPrograms.forEach((raw, i) => {
    if (!isObj(raw)) return warnings.push(`Programm ${i + 1} wurde übersprungen (kein Objekt).`)
    const name = str(raw.name) || `Importiertes Programm ${i + 1}`
    const weeks = Math.min(16, Math.max(1, Math.round(num(raw.weeks)) || 8))
    const startRaw = nameKey(str(raw.start))
    const start =
      /^\d{4}-\d{2}-\d{2}$/.test(str(raw.start))
        ? mondayKey(new Date(str(raw.start) + 'T12:00:00').getTime())
        : startRaw === 'naechstewoche' || startRaw === 'next'
          ? mondayKey(now + 7 * 86_400_000)
          : mondayKey(now)
    const days: Program['days'] = []
    if (isObj(raw.days)) {
      for (const [k, v] of Object.entries(raw.days)) {
        const weekday = WEEKDAY_KEYS[nameKey(k)]
        const planId = refs.get(nameKey(str(v)))
        if (weekday === undefined) warnings.push(`„${name}“: Wochentag „${k}“ unbekannt.`)
        else if (!planId) warnings.push(`„${name}“: Plan „${str(v)}“ für ${k} nicht gefunden, Tag bleibt Ruhetag.`)
        else days.push({ weekday, planId })
      }
    }
    programs.push({
      id: newId(),
      name,
      startDate: start,
      weeks,
      days: days.sort((a, b) => a.weekday - b.weekday),
      rules: { cardioProgress: raw.progressCardio !== false, gymExtraSet: raw.extraSets === true },
      lighterWeeks: [],
    })
  })

  return { plans, programs, newExercises, warnings }
}

/** Text zum Kopieren für Claude: beschreibt das Format und listet die Übungen der App. */
export function claudeInstructions(exercises: Exercise[]): string {
  const visible = exercises.filter((e) => !e.hidden)
  const unit = (e: Exercise) => (measureOf(e) === 'time' ? ' [Sekunden]' : measureOf(e) === 'distance' ? ' [Meter]' : '')
  const list = visible.map((e) => `- ${e.name}${unit(e)}`).join('\n')
  return `Erstelle Trainingspläne für meine App „Athlete Reboot“. Gib das Ergebnis als EINEN JSON-Block in genau diesem Format aus:

{
  "plans": [
    {
      "id": "beine-a",
      "name": "Beine A",
      "type": "gym",
      "exercises": [
        { "name": "Kniebeuge", "sets": 3, "reps": "6-8", "rest": 150 },
        { "name": "Wandsitzen", "sets": 3, "seconds": "30-45", "rest": 60 },
        { "name": "Farmer's Walk", "sets": 3, "meters": "20-30", "rest": 90 }
      ]
    },
    {
      "id": "intervalle",
      "name": "6 × 400 m",
      "type": "cardio",
      "sport": "laufen",
      "blocks": [
        { "label": "Aufwärmen", "minutes": 10 },
        { "label": "Schnell", "meters": 400, "repeat": 6, "rest": { "seconds": 90 }, "restLabel": "Gehpause" },
        { "label": "Auslaufen", "minutes": 5 }
      ]
    }
  ],
  "programs": [
    {
      "name": "Dunken",
      "weeks": 8,
      "start": "naechste-woche",
      "days": { "mo": "beine-a", "mi": "intervalle", "fr": "beine-a" },
      "progressCardio": true,
      "extraSets": false
    }
  ]
}

Regeln:
- Gym-Übungen: "reps" für Wiederholungen, "seconds" für Halteübungen, "meters" für Strecken. Bereich als "6-8" oder Zahl. "rest" = Pause in Sekunden.
- Ausdauer: "sport" ist "laufen", "rad" oder "schwimmen". Jeder Abschnitt hat "minutes", "seconds", "meters" oder "km". "repeat" > 1 heißt Intervalle mit "rest" dazwischen.
- Programme: "weeks" 1–16, "start" = "diese-woche", "naechste-woche" oder Datum JJJJ-MM-TT, "days" ordnet Wochentage (mo, di, mi, do, fr, sa, so) Plänen über ihre "id" zu. Die App steigert Ausdauer automatisch (+1 Intervall bzw. +10 % pro Woche); "extraSets": true gibt im Gym alle 2 Wochen +1 Satz.
- Nimm möglichst Übungsnamen aus meiner Liste unten (genau so geschrieben). Unbekannte Namen legt die App als eigene Übung an.
- Ich hatte eine Kreuzband-OP mit Patellasehnen-Transplantat: Knie-Übungen und Sprünge nur so, wie es zu meiner Reha-Phase passt; frag nach, wenn du es nicht weißt.

Meine Übungen:
${list}
`
}
