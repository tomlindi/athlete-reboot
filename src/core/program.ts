import { startCardioPlan } from './cardioPlan'
import { dateKey, startOfWeek } from './dates'
import { newId } from './ids'
import { workoutFromPlan } from './plans'
import type { CardioBlock, Measure, Plan, Program, Workout } from './types'

// Mehrwochen-Programme: feste Wochentage, automatische Steigerung, Wochen auf Wunsch leichter.
// Steigerung (siehe Plan, Recherche 2026-11-18):
//   Gym: Gewicht über „Ziel geschafft“; optional +1 Satz alle 2 Wochen, höchstens +2.
//   Ausdauer: pro Woche +1 Intervall bzw. +10 % Umfang (vorsichtig, klar unter +30 %).
//   Leichtere Woche nur auf Knopfdruck: weniger Sätze, halb so viele Intervalle, 30 % weniger Umfang.

export const WEEKDAYS_LONG = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag']
export const WEEKDAYS_SHORT = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So']

const DAY = 86_400_000

/** Montag der Woche als JJJJ-MM-TT */
export const mondayKey = (t: number) => dateKey(startOfWeek(t))

function parseKey(key: string): number {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, m - 1, d).getTime()
}

export function createProgram(name: string, weeks = 8, now = Date.now()): Program {
  return {
    id: newId(),
    name: name.trim(),
    startDate: mondayKey(now),
    weeks,
    days: [],
    rules: { gymExtraSet: false, cardioProgress: true },
    lighterWeeks: [],
  }
}

/** Woche des Programms (1 = erste Woche). 0 = noch nicht gestartet, > weeks = vorbei. */
export function programWeek(p: Program, now = Date.now()): number {
  const start = parseKey(p.startDate)
  const thisMonday = startOfWeek(now)
  // Runden gleicht Zeitumstellungen aus
  return Math.floor(Math.round((thisMonday - start) / DAY) / 7) + 1
}

export const isRunning = (p: Program, now = Date.now()) => {
  const w = programWeek(p, now)
  return w >= 1 && w <= p.weeks
}

/** Montag 0:00 einer Programmwoche */
export function weekStart(p: Program, week: number): number {
  const d = new Date(parseKey(p.startDate))
  d.setDate(d.getDate() + (week - 1) * 7)
  return d.getTime()
}

export const isLighter = (p: Program, week: number) => (p.lighterWeeks ?? []).includes(week)

export function toggleLighter(p: Program, week: number): Program {
  const set = new Set(p.lighterWeeks ?? [])
  if (set.has(week)) set.delete(week)
  else set.add(week)
  return { ...p, lighterWeeks: [...set].sort((a, b) => a - b) }
}

/** Plan für einen Wochentag setzen (`null` = Ruhetag). */
export function setDay(p: Program, weekday: number, planId: string | null): Program {
  const days = p.days.filter((d) => d.weekday !== weekday)
  if (planId) days.push({ weekday, planId })
  return { ...p, days: days.sort((a, b) => a.weekday - b.weekday) }
}

const roundTo = (n: number, step: number) => Math.max(step, Math.round(n / step) * step)

function adjustBlock(b: CardioBlock, week: number, progress: boolean, lighter: boolean): CardioBlock {
  const reps = b.repeat ?? 1
  if (reps > 1) {
    let r = progress ? reps + (week - 1) : reps
    if (lighter) r = Math.ceil(r / 2)
    return { ...b, repeat: Math.min(30, Math.max(1, r)) }
  }
  let factor = progress ? 1.1 ** (week - 1) : 1
  if (lighter) factor *= 0.7
  if (factor === 1) return b
  const step = b.amount.unit === 'time' ? 5 : 10
  return { ...b, amount: { ...b.amount, value: roundTo(b.amount.value * factor, step) } }
}

/**
 * Der Plan, wie er in dieser Programmwoche gilt. Der gespeicherte Plan bleibt unverändert.
 * Gym: optional +1 Satz alle 2 Wochen (höchstens +2); leichtere Woche: ein Drittel weniger Sätze.
 * Ausdauer: +1 Intervall bzw. +10 % Umfang pro Woche; leichtere Woche: halb so viele Intervalle, 30 % weniger.
 */
export function planForWeek(plan: Plan, p: Program, week: number): Plan {
  const lighter = isLighter(p, week)
  if (plan.kind === 'cardio') {
    if (!p.rules.cardioProgress && !lighter) return plan
    return { ...plan, blocks: (plan.blocks ?? []).map((b) => adjustBlock(b, week, p.rules.cardioProgress, lighter)) }
  }
  const extra = p.rules.gymExtraSet ? Math.min(2, Math.floor((week - 1) / 2)) : 0
  if (extra === 0 && !lighter) return plan
  return {
    ...plan,
    exercises: plan.exercises.map((e) => {
      let sets = e.sets + extra
      if (lighter) sets = Math.max(1, Math.round((sets * 2) / 3))
      return { ...e, sets: Math.min(10, sets) }
    }),
  }
}

export type DayStatus = 'done' | 'today' | 'missed' | 'upcoming'

export interface WeekDay {
  weekday: number
  date: number
  planId: string
  status: DayStatus
}

const sessionDone = (workouts: Workout[], programId: string, week: number, weekday: number) =>
  workouts.some((w) => w.endedAt !== undefined && w.program?.programId === programId && w.program.week === week && w.program.weekday === weekday)

/** Die Trainingstage einer Programmwoche mit Stand: erledigt, heute, verpasst, kommt noch. */
export function weekDays(p: Program, week: number, workouts: Workout[], now = Date.now()): WeekDay[] {
  const start = weekStart(p, week)
  const today = dateKey(now)
  return p.days.map((d) => {
    const date = new Date(start)
    date.setDate(date.getDate() + d.weekday)
    const key = dateKey(date)
    const status: DayStatus = sessionDone(workouts, p.id, week, d.weekday)
      ? 'done'
      : key === today
        ? 'today'
        : key < today
          ? 'missed'
          : 'upcoming'
    return { weekday: d.weekday, date: date.getTime(), planId: d.planId, status }
  })
}

/** Startet die Einheit eines Programmtags mit dem angepassten Plan. */
export function startProgramSession(
  p: Program,
  plan: Plan,
  week: number,
  weekday: number,
  history: Workout[],
  now = Date.now(),
  measureOf: (exerciseId: string) => Measure = () => 'reps',
): Workout {
  const adjusted = planForWeek(plan, p, week)
  const w = plan.kind === 'cardio' ? startCardioPlan(adjusted, now) : workoutFromPlan(adjusted, history, now, measureOf)
  return { ...w, program: { programId: p.id, week, weekday } }
}

/** Kurztext, z. B. „Woche 3 von 8“, „Startet am 23.11.“ oder „Abgeschlossen“. */
export function programStatus(p: Program, now = Date.now()): string {
  const w = programWeek(p, now)
  if (w < 1) return `Startet am ${new Intl.DateTimeFormat('de-DE', { day: 'numeric', month: 'numeric' }).format(parseKey(p.startDate))}`
  if (w > p.weeks) return 'Abgeschlossen'
  return `Woche ${w} von ${p.weeks}${isLighter(p, w) ? ' · leichter' : ''}`
}
