import { useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { dateKey, formatDuration, monthGrid, startOfWeek, weekLabel } from '../../core/dates'
import { formatNumber, formatSet, summarize } from '../../core/workout'
import type { Workout } from '../../core/types'
import { Segmented } from '../components/Segmented'
import { Sheet } from '../components/Sheet'
import { useStore } from '../store'
import { Stat } from './WorkoutScreen'

type View = 'list' | 'calendar'

const dayFmt = new Intl.DateTimeFormat('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit' })
const longFmt = new Intl.DateTimeFormat('de-DE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
const monthFmt = new Intl.DateTimeFormat('de-DE', { month: 'long', year: 'numeric' })
const WEEKDAYS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So']

export function HistoryTab() {
  const { data } = useStore()
  const [view, setView] = useState<View>('list')
  const [openId, setOpenId] = useState<string | null>(null)
  const finished = useMemo(
    () => data.workouts.filter((w) => w.endedAt !== undefined).sort((a, b) => b.startedAt - a.startedAt),
    [data.workouts],
  )
  const opened = finished.find((w) => w.id === openId)

  return (
    <>
      <Segmented
        label="Ansicht"
        value={view}
        onChange={setView}
        options={[
          { value: 'list', label: 'Liste' },
          { value: 'calendar', label: 'Kalender' },
        ]}
      />
      {view === 'list' ? (
        <HistoryList workouts={finished} onOpen={setOpenId} />
      ) : (
        <HistoryCalendar workouts={finished} onOpen={setOpenId} />
      )}
      <WorkoutDetail workout={opened} onClose={() => setOpenId(null)} />
    </>
  )
}

function HistoryList({ workouts, onOpen }: { workouts: Workout[]; onOpen: (id: string) => void }) {
  const weeks = useMemo(() => {
    const map = new Map<number, Workout[]>()
    for (const w of workouts) {
      const k = startOfWeek(w.startedAt)
      map.set(k, [...(map.get(k) ?? []), w])
    }
    return [...map.entries()]
  }, [workouts])

  if (workouts.length === 0) {
    return (
      <section className="card glass">
        <h2 className="card-title">Noch keine Trainings</h2>
        <p className="card-text">Sobald du ein Training speicherst, erscheint es hier, nach Wochen sortiert.</p>
      </section>
    )
  }

  return (
    <>
      {weeks.map(([week, list]) => (
        <section key={week} className="list-section">
          <h3 className="list-heading">{weekLabel(week)}</h3>
          <ul className="list glass">
            {list.map((w) => {
              const s = summarize(w)
              return (
                <li key={w.id}>
                  <button className="list-row two-line" onClick={() => onOpen(w.id)}>
                    <span className={`rating-dot ${w.rating ?? ''}`} aria-label={w.rating === 'good' ? 'Gut' : w.rating === 'meh' ? 'Nicht so gut' : undefined} />
                    <span className="row-main">
                      <span className="row-title">{w.title}</span>
                      <span className="row-sub">
                        {formatDuration((w.endedAt ?? w.startedAt) - w.startedAt)} · {s.sets} Sätze
                      </span>
                    </span>
                    <span className="row-meta">{dayFmt.format(w.startedAt)}</span>
                    <ChevronRight className="chevron" strokeWidth={2} aria-hidden="true" />
                  </button>
                </li>
              )
            })}
          </ul>
        </section>
      ))}
    </>
  )
}

function HistoryCalendar({ workouts, onOpen }: { workouts: Workout[]; onOpen: (id: string) => void }) {
  const { data, toggleRestDay } = useStore()
  const today = new Date()
  const [month, setMonth] = useState({ y: today.getFullYear(), m: today.getMonth() })
  const todayKey = dateKey(today)

  const byDay = useMemo(() => {
    const map = new Map<string, Workout[]>()
    for (const w of workouts) {
      const k = dateKey(w.startedAt)
      map.set(k, [...(map.get(k) ?? []), w])
    }
    return map
  }, [workouts])
  const rest = useMemo(() => new Set(data.restDays.map((r) => r.date)), [data.restDays])
  const cells = monthGrid(month.y, month.m)

  function shift(delta: number) {
    const d = new Date(month.y, month.m + delta, 1)
    setMonth({ y: d.getFullYear(), m: d.getMonth() })
  }

  return (
    <section className="card glass calendar">
      <div className="calendar-head">
        <button className="icon-button" aria-label="Voriger Monat" onClick={() => shift(-1)}>
          <ChevronLeft strokeWidth={2} />
        </button>
        <h2 className="calendar-month">{monthFmt.format(new Date(month.y, month.m, 1))}</h2>
        <button className="icon-button" aria-label="Nächster Monat" onClick={() => shift(1)}>
          <ChevronRight strokeWidth={2} />
        </button>
      </div>

      <div className="calendar-grid" role="grid">
        {WEEKDAYS.map((d) => (
          <span key={d} className="calendar-weekday" aria-hidden="true">
            {d}
          </span>
        ))}
        {cells.map((c) => {
          const dayWorkouts = byDay.get(c.key) ?? []
          const isRest = rest.has(c.key)
          const isFuture = c.key > todayKey
          // Gut gewinnt, sobald ein Training an dem Tag gut war
          const status = dayWorkouts.length
            ? dayWorkouts.some((w) => w.rating === 'good')
              ? 'good'
              : dayWorkouts.some((w) => w.rating === 'meh')
                ? 'meh'
                : 'done'
            : isRest
              ? 'rest'
              : ''
          const label =
            status === 'good'
              ? 'gutes Training'
              : status === 'meh'
                ? 'nicht so gutes Training'
                : status === 'done'
                  ? 'Training ohne Bewertung'
                  : status === 'rest'
                  ? 'Rest Day'
                  : isFuture
                    ? ''
                    : 'als Rest Day markieren'
          return (
            <button
              key={c.key}
              className={`calendar-day ${status} ${c.inMonth ? '' : 'outside'} ${c.key === todayKey ? 'today' : ''}`}
              disabled={isFuture && !dayWorkouts.length}
              aria-label={`${c.day}. ${label}`}
              onClick={() => (dayWorkouts.length ? onOpen(dayWorkouts[0].id) : toggleRestDay(c.key))}
            >
              {c.day}
            </button>
          )
        })}
      </div>

      <ul className="legend">
        <li><span className="legend-dot good" />Gut</li>
        <li><span className="legend-dot meh" />Nicht so gut</li>
        <li><span className="legend-dot rest" />Rest Day</li>
      </ul>
      <p className="hint">Tippe auf einen freien Tag, um ihn als Rest Day zu markieren.</p>
    </section>
  )
}

function WorkoutDetail({ workout, onClose }: { workout: Workout | undefined; onClose: () => void }) {
  const { exerciseById, deleteWorkout } = useStore()
  const [confirm, setConfirm] = useState(false)

  function close() {
    setConfirm(false)
    onClose()
  }

  if (!workout) return <Sheet open={false} title="" onClose={close}>{null}</Sheet>
  const s = summarize(workout)

  return (
    <Sheet open title={workout.title} onClose={close}>
      <p className="sheet-sub">{longFmt.format(workout.startedAt)}</p>
      <div className="stat-row">
        <Stat value={formatDuration((workout.endedAt ?? workout.startedAt) - workout.startedAt)} label="Dauer" />
        <Stat value={String(s.sets)} label="Sätze" />
        <Stat value={`${formatNumber(Math.round(s.volume))} kg`} label="Volumen" />
      </div>
      {workout.rating && (
        <p className={`rating-badge ${workout.rating}`}>{workout.rating === 'good' ? 'Gutes Training' : 'Nicht so gutes Training'}</p>
      )}

      {workout.exercises.map((e) => (
        <section key={e.id} className="list-section">
          <h3 className="list-heading">{exerciseById.get(e.exerciseId)?.name ?? 'Unbekannte Übung'}</h3>
          <ul className="list inner">
            {e.sets.map((set, i) => (
              <li key={set.id} className={`list-row static ${set.failure ? 'is-failure' : ''}`}>
                <span className="row-meta">Satz {i + 1}</span>
                <span className="row-main">{formatSet(set)}</span>
                {set.failure && <span className="failure-tag">Muskelversagen</span>}
              </li>
            ))}
          </ul>
        </section>
      ))}

      {confirm ? (
        <div className="confirm">
          <p>Dieses Training wird endgültig gelöscht.</p>
          <div className="form-actions">
            <button className="button secondary" onClick={() => setConfirm(false)}>
              Behalten
            </button>
            <button
              className="button destructive"
              onClick={() => {
                deleteWorkout(workout.id)
                close()
              }}
            >
              Löschen
            </button>
          </div>
        </div>
      ) : (
        <button className="text-button danger wide" onClick={() => setConfirm(true)}>
          Training löschen
        </button>
      )}
    </Sheet>
  )
}
