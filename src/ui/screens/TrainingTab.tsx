import { ChevronRight } from 'lucide-react'
import { formatDuration } from '../../core/dates'
import { summarize } from '../../core/workout'
import { useStore } from '../store'
import { PlanList, plansOfKind, TrainingViewSwitch, useTrainingView } from './PlansTab'
import { CardioCard } from './CardioScreen'
import { cardioSummary } from '../../core/cardio'

const dayFmt = new Intl.DateTimeFormat('de-DE', { weekday: 'long', day: 'numeric', month: 'long' })

/** Startansicht, wenn kein Training läuft. */
export function TrainingStart({ onOpenHistory, onOpenPlans }: { onOpenHistory: () => void; onOpenPlans: () => void }) {
  const { data, startWorkout } = useStore()
  const [view] = useTrainingView()
  const last = data.workouts
    .filter((w) => w.endedAt !== undefined && (w.type === 'cardio') === (view === 'cardio'))
    .sort((a, b) => b.startedAt - a.startedAt)[0]

  return (
    <>
      <TrainingViewSwitch />
      <section className="list-section">
        <h3 className="list-heading">Meine Pläne</h3>
        {plansOfKind(data.plans, view).length > 0 ? (
          <PlanList kind={view} showEmptyHint={false} />
        ) : (
          <section className="card glass">
            <p className="card-text">Noch keine Pläne. Lege im Tab „Pläne“ deinen ersten an, dann startest du ihn hier mit einem Tipp.</p>
            <button className="text-button strong" onClick={onOpenPlans}>
              Zu den Plänen
            </button>
          </section>
        )}
      </section>

      {view === 'gym' ? (
        <button className="button secondary wide" onClick={startWorkout}>
          Freies Training starten
        </button>
      ) : (
        <CardioCard />
      )}

      {last && (
        <section className="list-section">
          <h3 className="list-heading">{view === 'cardio' ? 'Letzte Einheit' : 'Letztes Training'}</h3>
          <ul className="list glass">
            <li>
              <button className="list-row two-line" onClick={onOpenHistory}>
                <span className={`rating-dot ${last.type === 'cardio' ? 'cardio' : (last.rating ?? '')}`} aria-hidden="true" />
                <span className="row-main">
                  <span className="row-title">{last.title}</span>
                  <span className="row-sub">
                    {dayFmt.format(last.startedAt)} ·{' '}
                    {last.type === 'cardio'
                      ? cardioSummary(last, formatDuration)
                      : `${formatDuration((last.endedAt ?? last.startedAt) - last.startedAt)} · ${summarize(last).sets} Sätze`}
                  </span>
                </span>
                <ChevronRight className="chevron" strokeWidth={2} aria-hidden="true" />
              </button>
            </li>
          </ul>
        </section>
      )}
    </>
  )
}
