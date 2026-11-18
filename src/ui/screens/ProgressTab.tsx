import { useMemo, useState } from 'react'
import { ChevronRight } from 'lucide-react'
import {
  bestSession,
  exerciseSessions,
  rangeStart,
  strengthIndex,
  trainedExerciseIds,
  weekComparison,
  type Range,
  type SessionBest,
  type WeekStats,
} from '../../core/progress'
import { formatNumber, formatSet } from '../../core/workout'
import type { Measure } from '../../core/types'
import { cardioWeek, formatDistance, SPORT_LABEL } from '../../core/cardio'
import { LineChart } from '../components/LineChart'
import { Segmented } from '../components/Segmented'
import { Sheet } from '../components/Sheet'
import { useStore } from '../store'

const shortDate = new Intl.DateTimeFormat('de-DE', { day: 'numeric', month: 'numeric' })
const monthOnly = new Intl.DateTimeFormat('de-DE', { month: 'short' })

const axisDate = (range: Range) => (t: number) => (range === 'J' ? monthOnly.format(t) : shortDate.format(t))
const kg = (v: number) => `${formatNumber(Math.round(v * 10) / 10)} kg`
const pct = (v: number) => `${v > 0 ? '+' : v < 0 ? '−' : ''}${formatNumber(Math.abs(Math.round(v * 10) / 10))} %`
const setText = (s: Pick<SessionBest, 'kg' | 'reps' | 'measure'>) =>
  s.measure !== 'reps' ? formatSet(s, s.measure) : `${formatNumber(s.kg)} kg × ${s.reps}`
const seconds = (v: number) => `${formatNumber(Math.round(v))} s`
const meters = (v: number) => `${formatNumber(Math.round(v))} m`

/** Wie der Bestwert einer Übung angezeigt wird: geschätztes Maximum, längste Zeit oder längste Strecke. */
const BEST: Record<Measure, { label: string; format: (v: number) => string; chart: string; unit: string }> = {
  reps: { label: 'Geschätztes Max.', format: kg, chart: 'Geschätztes Maximum für eine Wiederholung, bester Satz pro Training', unit: 'geschätztes Maximum in Kilogramm' },
  time: { label: 'Längste Zeit', format: seconds, chart: 'Längste Zeit pro Training', unit: 'längste Zeit in Sekunden' },
  distance: { label: 'Längste Strecke', format: meters, chart: 'Längste Strecke pro Training', unit: 'längste Strecke in Metern' },
}

export function ProgressTab() {
  const [openId, setOpenId] = useState<string | null>(null)

  return (
    <>
      <WeekCard />
      <CardioWeekCard />
      <StrengthCard />
      <ExerciseList onOpen={setOpenId} />
      <ExerciseProgress exerciseId={openId} onClose={() => setOpenId(null)} />
    </>
  )
}

function WeekCard() {
  const { data } = useStore()
  const { current, previous } = useMemo(() => weekComparison(data.workouts), [data.workouts])

  return (
    <section className="card glass">
      <h2 className="card-title">Diese Woche</h2>
      <div className="week-stats">
        <WeekStat label={current.trainings === 1 ? 'Training' : 'Trainings'} value={String(current.trainings)} diff={current.trainings - previous.trainings} unit="" />
        <WeekStat label={current.sets === 1 ? 'Satz' : 'Sätze'} value={String(current.sets)} diff={current.sets - previous.sets} unit="" />
        <WeekStat
          label="Volumen"
          value={`${formatNumber(Math.round(current.volume / 100) / 10)} t`}
          diff={percentChange(current, previous)}
          unit="%"
        />
      </div>
      <p className="hint">Verglichen mit der ganzen Vorwoche.</p>
    </section>
  )
}

/** Ausdauer dieser Woche pro Sportart. Erscheint erst, wenn es Einheiten gibt. */
function CardioWeekCard() {
  const { data } = useStore()
  const rows = useMemo(() => cardioWeek(data.workouts), [data.workouts])
  if (rows.length === 0) return null

  return (
    <section className="list-section">
      <h3 className="list-heading">Ausdauer diese Woche</h3>
      <ul className="list glass">
        {rows.map((r) => (
          <li key={r.sport} className="list-row static two-line">
            <span className="rating-dot cardio" aria-hidden="true" />
            <span className="row-main">
              <span className="row-title">{SPORT_LABEL[r.sport]}</span>
              <span className="row-sub">
                {r.sessions} {r.sessions === 1 ? 'Einheit' : 'Einheiten'} · {Math.round(r.minutes)} min
              </span>
            </span>
            <span className="best-value">{r.distanceM > 0 ? formatDistance(r.sport, r.distanceM) : '–'}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}

function percentChange(current: WeekStats, previous: WeekStats): number | null {
  if (previous.volume === 0) return null
  return Math.round(((current.volume - previous.volume) / previous.volume) * 100)
}

function WeekStat({ label, value, diff, unit }: { label: string; value: string; diff: number | null; unit: string }) {
  const sign = diff === null ? '' : diff > 0 ? '+' : diff < 0 ? '−' : '±'
  return (
    <div className="week-stat">
      <span className="week-value">{value}</span>
      <span className="week-label">{label}</span>
      <span className={`week-diff ${diff !== null && diff > 0 ? 'up' : ''}`}>
        {diff === null ? 'neu' : `${sign}${Math.abs(diff)}${unit ? ` ${unit}` : ''}`}
      </span>
    </div>
  )
}

function StrengthCard() {
  const { data } = useStore()
  const [range, setRange] = useState<Range>('M')
  const all = useMemo(() => strengthIndex(data.workouts), [data.workouts])
  const now = Date.now()
  const from = rangeStart(range, now)
  const points = all.filter((p) => p.t >= from).map((p) => ({ t: p.t, v: p.value }))

  return (
    <section className="card glass">
      <div className="card-head">
        <div>
          <h2 className="card-title">Gesamtkraft</h2>
          <p className="card-sub">Kraft-Index: Ø aller Übungen seit dem ersten Training</p>
        </div>
      </div>
      <Segmented
        label="Zeitraum"
        value={range}
        onChange={setRange}
        options={[
          { value: 'M', label: '30 Tage' },
          { value: 'J', label: 'Jahr' },
        ]}
      />
      {all.length < 2 ? (
        <p className="empty-text">Sobald du Übungen mindestens zweimal trainiert hast, siehst du hier, wie viel stärker du geworden bist.</p>
      ) : points.length === 0 ? (
        <p className="empty-text">In diesem Zeitraum gibt es keine Trainings. Wähle einen längeren Zeitraum.</p>
      ) : (
        <LineChart
          points={points}
          from={from}
          to={now}
          includeZero
          label="Kraft-Index in Prozent"
          formatValue={pct}
          formatTick={(v) => `${formatNumber(v)} %`}
          formatDate={axisDate(range)}
          listLabel="Alle Werte als Liste"
        />
      )}
    </section>
  )
}

function ExerciseList({ onOpen }: { onOpen: (id: string) => void }) {
  const { data, exerciseById } = useStore()
  const rows = useMemo(() => {
    return trainedExerciseIds(data.workouts)
      .map((id) => {
        const sessions = exerciseSessions(data.workouts, id)
        const best = bestSession(sessions)!
        const latest = sessions[sessions.length - 1]
        return { id, best, latest, isNew: sessions.length > 1 && best.workoutId === latest.workoutId }
      })
      .sort((a, b) => b.latest.t - a.latest.t)
  }, [data.workouts])

  if (rows.length === 0) {
    return (
      <section className="card glass">
        <h2 className="card-title">Übungen</h2>
        <p className="card-text">Nach deinem ersten Training mit Gewicht siehst du hier deine Bestwerte pro Übung.</p>
      </section>
    )
  }

  return (
    <section className="list-section">
      <h3 className="list-heading">Bestwerte</h3>
      <ul className="list glass">
        {rows.map((r) => (
          <li key={r.id}>
            <button className="list-row two-line" onClick={() => onOpen(r.id)}>
              <span className="row-main">
                <span className="row-title">{exerciseById.get(r.id)?.name ?? 'Unbekannte Übung'}</span>
                <span className="row-sub">{r.best.measure === 'reps' ? `Geschätztes Maximum ${kg(r.best.e1rm)}` : BEST[r.best.measure].label}</span>
              </span>
              <span className="best-value">
                <span className={r.isNew ? 'is-new' : ''}>{setText(r.best)}</span>
                {r.isNew && <span className="new-chip">Neuer Bestwert</span>}
              </span>
              <ChevronRight className="chevron" strokeWidth={2} aria-hidden="true" />
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}

function ExerciseProgress({ exerciseId, onClose }: { exerciseId: string | null; onClose: () => void }) {
  const { data, exerciseById } = useStore()
  const [range, setRange] = useState<Range>('M')
  const sessions = useMemo(() => (exerciseId ? exerciseSessions(data.workouts, exerciseId) : []), [data.workouts, exerciseId])
  if (!exerciseId) return null
  const name = exerciseById.get(exerciseId)?.name ?? 'Unbekannte Übung'
  const best = bestSession(sessions)
  const latest = sessions[sessions.length - 1]
  const now = Date.now()
  const from = rangeStart(range, now)
  const points = sessions.filter((s) => s.t >= from).map((s) => ({ t: s.t, v: s.e1rm }))
  const show = BEST[best?.measure ?? 'reps']

  return (
    <Sheet open title={name} onClose={onClose}>
      <div className="stat-row compact">
        <div className="stat">
          <span className="stat-value">{best ? setText(best) : '–'}</span>
          <span className="stat-label">Bestwert</span>
        </div>
        <div className="stat">
          <span className="stat-value">{best ? show.format(best.e1rm) : '–'}</span>
          <span className="stat-label">{show.label}</span>
        </div>
        <div className="stat">
          <span className="stat-value">{latest ? setText(latest) : '–'}</span>
          <span className="stat-label">Letztes Mal</span>
        </div>
      </div>

      <Segmented
        label="Zeitraum"
        value={range}
        onChange={setRange}
        options={[
          { value: 'W', label: 'Woche' },
          { value: 'M', label: '30 Tage' },
          { value: 'J', label: 'Jahr' },
        ]}
      />
      <p className="card-sub">{show.chart}</p>
      {points.length === 0 ? (
        <p className="empty-text">In diesem Zeitraum hast du {name} nicht trainiert.</p>
      ) : (
        <LineChart
          points={points}
          from={from}
          to={now}
          label={`${name}, ${show.unit}`}
          formatValue={show.format}
          formatTick={(v) => formatNumber(v)}
          formatDate={(t) => (range === 'J' ? monthOnly.format(t) : shortDate.format(t))}
          listLabel="Alle Trainings als Liste"
        />
      )}
    </Sheet>
  )
}
