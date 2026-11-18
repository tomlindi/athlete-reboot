import { cardioWeek, durationSec, formatDistance, formatPace, SPORT_LABEL } from './cardio'
import { cardioPlanSummary, formatBlock } from './cardioPlan'
import { entryMeasure, MEASURE_LONG, MEASURE_UNIT } from './measure'
import { formatRest, formatTarget } from './plans'
import { bestSession, exerciseSessions, strengthIndex, trainedExerciseIds, weekComparison } from './progress'
import { programStatus, WEEKDAYS_LONG } from './program'
import { formatNumber, formatSet } from './workout'
import type { Exercise, Plan, Program, Workout } from './types'

// Auswertungsdatei für Claude: alles lesbar (Namen statt IDs, Datum, „80 kg × 8“), damit Claude
// ohne Umrechnen analysieren kann. Ersetzt nicht das Backup; zurückspielen geht nur mit dem Backup.

const dayFmt = new Intl.DateTimeFormat('de-DE', { weekday: 'long' })
const pad = (n: number) => String(n).padStart(2, '0')
const isoDate = (t: number) => {
  const d = new Date(t)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}
const minutes = (w: Workout) => Math.round(((w.endedAt ?? w.startedAt) - w.startedAt) / 60_000)

export function analysisFileName(now = new Date()): string {
  return `athlete-reboot-fuer-claude-${isoDate(now.getTime())}.json`
}

export function createAnalysisExport(
  data: { exercises: Exercise[]; workouts: Workout[]; plans: Plan[]; programs: Program[] },
  version: string,
  now = Date.now(),
) {
  const byId = new Map(data.exercises.map((e) => [e.id, e]))
  const exName = (id: string) => byId.get(id)?.name ?? 'Unbekannte Übung'
  const planName = (id?: string) => (id ? data.plans.find((p) => p.id === id)?.name : undefined)
  const programName = (id: string) => data.programs.find((p) => p.id === id)?.name ?? 'Gelöschtes Programm'
  const finished = data.workouts.filter((w) => w.endedAt !== undefined).sort((a, b) => a.startedAt - b.startedAt)

  const trainings = finished.map((w) => {
    const base = {
      datum: isoDate(w.startedAt),
      wochentag: dayFmt.format(w.startedAt),
      art: w.type === 'cardio' ? 'Ausdauer' : 'Gym',
      titel: w.title,
      dauerMinuten: minutes(w),
      ...(w.rating ? { bewertung: w.rating === 'good' ? 'gut' : 'nicht so gut' } : {}),
      ...(planName(w.planId) ? { plan: planName(w.planId) } : {}),
      ...(w.program ? { programm: `${programName(w.program.programId)} · Woche ${w.program.week}` } : {}),
    }
    if (w.type === 'cardio' && w.cardio) {
      const c = w.cardio
      const sec = durationSec(w)
      return {
        ...base,
        sportart: SPORT_LABEL[c.sport],
        ...(c.distanceM ? { distanz: formatDistance(c.sport, c.distanceM).replace(/ /g, ' ') } : {}),
        ...(formatPace(c.sport, sec, c.distanceM) ? { tempo: formatPace(c.sport, sec, c.distanceM)!.replace(/ /g, ' ') } : {}),
        ...(c.rpe ? { anstrengung: `${c.rpe}/10` } : {}),
        ...(c.avgHr ? { pulsDurchschnitt: c.avgHr } : {}),
      }
    }
    return {
      ...base,
      uebungen: w.exercises.map((e) => {
        const m = entryMeasure(e)
        return {
          name: exName(e.exerciseId),
          gruppe: byId.get(e.exerciseId)?.group ?? 'Sonstiges',
          gemessenIn: MEASURE_LONG[m],
          ...(e.target ? { ziel: `${formatTarget(e.target, m)}, Pause ${formatRest(e.target.restSec)}`.replace(/ /g, ' ') } : {}),
          saetze: e.sets.map((s) => {
            const t = s.kg ? formatSet(s, m) : `${s.reps ?? 0}${MEASURE_UNIT[m] || ' Wdh'}`
            return `${m === 'reps' && s.kg ? `${formatNumber(s.kg)} kg × ${s.reps ?? 0}` : t}${s.failure ? ' (Muskelversagen)' : ''}`
          }),
        }
      }),
    }
  })

  const bestwerte = trainedExerciseIds(finished).map((id) => {
    const sessions = exerciseSessions(finished, id)
    const best = bestSession(sessions)!
    const m = best.measure
    return {
      uebung: exName(id),
      bestwert: m === 'reps' ? `${formatNumber(best.kg)} kg × ${best.reps}` : formatSet(best, m),
      ...(m === 'reps' ? { geschaetztesMaximumKg: Math.round(best.e1rm * 10) / 10 } : {}),
      datum: isoDate(best.t),
      anzahlTrainings: sessions.length,
    }
  })

  const index = strengthIndex(finished)
  const week = weekComparison(finished, now)

  return {
    app: 'Athlete Reboot',
    appVersion: version,
    exportiertAm: new Date(now).toISOString(),
    hinweis:
      'Auswertungsdatei für Claude. Sätze: „kg × Wiederholungen“, Zeit-Übungen in Sekunden, Strecken in Metern. Kraft-Index = durchschnittliche Veränderung des geschätzten Maximums (Epley) je Übung seit dem ersten Training, in Prozent. Zum Wiederherstellen dient nur das normale Backup.',
    ueberblick: {
      trainingsGesamt: finished.length,
      ...(finished.length ? { zeitraum: `${isoDate(finished[0].startedAt)} bis ${isoDate(finished[finished.length - 1].startedAt)}` } : {}),
      dieseWoche: { trainings: week.current.trainings, saetze: week.current.sets, volumenKg: Math.round(week.current.volume) },
      vorwoche: { trainings: week.previous.trainings, saetze: week.previous.sets, volumenKg: Math.round(week.previous.volume) },
      ...(index.length ? { kraftIndexProzent: Math.round(index[index.length - 1].value * 10) / 10 } : {}),
      ausdauerDieseWoche: cardioWeek(finished, now).map((s) => ({
        sportart: SPORT_LABEL[s.sport],
        einheiten: s.sessions,
        minuten: Math.round(s.minutes),
        ...(s.distanceM ? { distanz: formatDistance(s.sport, s.distanceM).replace(/ /g, ' ') } : {}),
      })),
    },
    bestwerte,
    trainings,
    plaene: data.plans
      .filter((p) => !p.hidden)
      .map((p) =>
        p.kind === 'cardio'
          ? { name: p.name, art: 'Ausdauer', ueberblick: cardioPlanSummary(p).replace(/ /g, ' '), abschnitte: (p.blocks ?? []).map((b) => formatBlock(b).replace(/ /g, ' ')) }
          : {
              name: p.name,
              art: 'Gym',
              uebungen: p.exercises.map((e) => `${exName(e.exerciseId)}: ${formatTarget(e, byId.get(e.exerciseId)?.measure ?? 'reps')}, Pause ${formatRest(e.restSec)}`.replace(/ /g, ' ')),
            },
      ),
    programme: data.programs.map((p) => ({
      name: p.name,
      stand: programStatus(p, now),
      start: p.startDate,
      wochen: p.weeks,
      wochenplan: Object.fromEntries(p.days.map((d) => [WEEKDAYS_LONG[d.weekday], planName(d.planId) ?? 'Gelöschter Plan'])),
      steigerung: [p.rules.cardioProgress ? 'Ausdauer +1 Intervall bzw. +10 % pro Woche' : '', p.rules.gymExtraSet ? 'Gym +1 Satz alle 2 Wochen (max. +2)' : ''].filter(Boolean),
      ...(p.lighterWeeks?.length ? { leichtereWochen: p.lighterWeeks } : {}),
    })),
  }
}
