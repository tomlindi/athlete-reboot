import { ChevronRight } from 'lucide-react'
import { formatDuration } from '../../core/dates'
import { summarize } from '../../core/workout'
import { useStore } from '../store'

const dayFmt = new Intl.DateTimeFormat('de-DE', { weekday: 'long', day: 'numeric', month: 'long' })

/** Startansicht, wenn kein Training läuft. */
export function TrainingStart({ onOpenHistory }: { onOpenHistory: () => void }) {
  const { data, startWorkout } = useStore()
  const last = data.workouts
    .filter((w) => w.endedAt !== undefined)
    .sort((a, b) => b.startedAt - a.startedAt)[0]

  return (
    <>
      <button className="button primary wide large" onClick={startWorkout}>
        Training starten
      </button>

      {last && (
        <section className="list-section">
          <h3 className="list-heading">Letztes Training</h3>
          <ul className="list glass">
            <li>
              <button className="list-row two-line" onClick={onOpenHistory}>
                <span className={`rating-dot ${last.rating ?? ''}`} aria-hidden="true" />
                <span className="row-main">
                  <span className="row-title">{last.title}</span>
                  <span className="row-sub">
                    {dayFmt.format(last.startedAt)} · {formatDuration((last.endedAt ?? last.startedAt) - last.startedAt)} ·{' '}
                    {summarize(last).sets} Sätze
                  </span>
                </span>
                <ChevronRight className="chevron" strokeWidth={2} aria-hidden="true" />
              </button>
            </li>
          </ul>
        </section>
      )}

      <section className="list-section">
        <h3 className="list-heading">Meine Pläne</h3>
        <section className="card glass">
          <p className="card-text">Eigene Trainingspläne mit Sätzen, Wiederholungen und Pausenzeit kommen in Schritt 7. Bis dahin startest du ein freies Training.</p>
        </section>
      </section>
    </>
  )
}
