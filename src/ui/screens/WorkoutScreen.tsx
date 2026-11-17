import { useEffect, useState } from 'react'
import { MoreHorizontal } from 'lucide-react'
import { formatClock, formatDuration } from '../../core/dates'
import { formatRest, formatTarget, goalState, suggestRating } from '../../core/plans'
import { newBests } from '../../core/progress'
import {
  addExercise,
  addSet,
  completeSet,
  extendRest,
  failSet,
  restRemaining,
  stopRest,
  formatNumber,
  formatSet,
  parseNumber,
  previousSets,
  removeExercise,
  removeSet,
  summarize,
  updateSet,
} from '../../core/workout'
import type { ExerciseEntry, Rating, SetEntry, Workout } from '../../core/types'
import { Sheet } from '../components/Sheet'
import { SwipeRow } from '../components/SwipeRow'
import { useStore } from '../store'
import { unlockSound } from '../sound'
import { ExercisePicker } from './ExercisePicker'

function useNow(intervalMs = 1000) {
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs)
    return () => clearInterval(id)
  }, [intervalMs])
  return now
}

export function WorkoutScreen({ workout }: { workout: Workout }) {
  const { updateActive, data } = useStore()
  const [picking, setPicking] = useState(false)
  const [finishing, setFinishing] = useState(false)
  // Während einer Pause öfter aktualisieren, damit der Balken flüssig läuft
  const now = useNow(workout.rest ? 250 : 1000)

  return (
    <>
      <header className="workout-head glass">
        <div className="workout-head-text">
          <h1 className="workout-title">{workout.title}</h1>
          <p className="workout-clock">{formatClock(now - workout.startedAt)}</p>
        </div>
        <button className="button primary small" onClick={() => setFinishing(true)}>
          Beenden
        </button>
        <RestBar workout={workout} now={now} />
      </header>

      <main className="screen workout-body">
        {workout.exercises.length === 0 && (
          <section className="card glass">
            <h2 className="card-title">Los geht’s</h2>
            <p className="card-text">Füge deine erste Übung hinzu. Gewicht und Wiederholungen vom letzten Mal werden vorausgefüllt.</p>
          </section>
        )}

        {workout.exercises.map((entry) => (
          <ExerciseCard
            key={entry.id}
            entry={entry}
            previous={previousSets(data.workouts, entry.exerciseId, workout.id)}
          />
        ))}

        <button className="button secondary wide" onClick={() => setPicking(true)}>
          + Übung hinzufügen
        </button>

        {workout.exercises.length > 0 && (
          <p className="hint">Satz nach rechts wischen: Muskelversagen. Nach links wischen: löschen.</p>
        )}
      </main>

      <ExercisePicker
        open={picking}
        onClose={() => setPicking(false)}
        onPick={(id) => updateActive((w) => addExercise(w, id, previousSets(data.workouts, id, w.id)))}
      />

      <FinishSheet open={finishing} workout={workout} onClose={() => setFinishing(false)} />
    </>
  )
}

function ExerciseCard({ entry, previous }: { entry: ExerciseEntry; previous: SetEntry[] }) {
  const { updateActive, exerciseById } = useStore()
  const [menu, setMenu] = useState(false)
  const name = exerciseById.get(entry.exerciseId)?.name ?? 'Unbekannte Übung'
  const goal = goalState(entry)

  return (
    <section className="card glass exercise-card">
      <div className="exercise-head">
        <div className="exercise-title">
          <h2 className="card-title">{name}</h2>
          {entry.target && (
            <p className="exercise-target">
              Ziel {formatTarget(entry.target)} · Pause {formatRest(entry.target.restSec)}
            </p>
          )}
        </div>
        {goal === 'reached' && <span className="goal-chip">Ziel geschafft</span>}
        <button className="icon-button" aria-label={`Optionen für ${name}`} aria-expanded={menu} onClick={() => setMenu(!menu)}>
          <MoreHorizontal strokeWidth={2} />
        </button>
      </div>

      {menu && (
        <div className="exercise-menu">
          <button
            className="button destructive small"
            onClick={() => updateActive((w) => removeExercise(w, entry.id))}
          >
            Übung entfernen
          </button>
        </div>
      )}

      <div className="set-grid set-head" aria-hidden="true">
        <span>Satz</span>
        <span>Letztes</span>
        <span>kg</span>
        <span>Wdh</span>
        <span className="center">✓</span>
      </div>

      {entry.sets.map((set, i) => (
        <SetRow
          key={set.id}
          entryId={entry.id}
          set={set}
          index={i}
          previous={previous[i]}
          exerciseName={name}
          topReached={!!entry.target && set.done && (set.reps ?? 0) >= entry.target.repMax}
        />
      ))}

      <button className="text-button add-set" onClick={() => updateActive((w) => addSet(w, entry.id, previous))}>
        + Satz
      </button>
    </section>
  )
}

function SetRow({
  entryId,
  set,
  index,
  previous,
  exerciseName,
  topReached,
}: {
  entryId: string
  set: SetEntry
  index: number
  previous?: SetEntry
  exerciseName: string
  /** Oberes Ende des Wiederholungsbereichs geschafft */
  topReached: boolean
}) {
  const { updateActive, data } = useStore()
  const label = `${exerciseName}, Satz ${index + 1}`
  const restSec = data.settings.defaultRestSec

  return (
    <SwipeRow
      className={set.failure ? 'is-failure' : ''}
      swipeRightLabel={set.failure ? 'Kein Versagen' : 'Muskelversagen'}
      onSwipeRight={() => {
        unlockSound()
        updateActive((w) => failSet(w, entryId, set.id, restSec))
      }}
      onDelete={() => updateActive((w) => removeSet(w, entryId, set.id))}
    >
      <div className="set-grid set-row">
        <span className="set-index">{index + 1}</span>
        <span className="set-prev">{previous ? formatSet(previous) : '–'}</span>
        <NumberInput
          id={`kg-${set.id}`}
          label={`${label}, Kilogramm`}
          value={set.kg}
          decimal
          onChange={(kg) => updateActive((w) => updateSet(w, entryId, set.id, { kg }))}
        />
        <NumberInput
          id={`reps-${set.id}`}
          className={topReached ? 'top' : ''}
          label={`${label}, Wiederholungen`}
          value={set.reps}
          onChange={(reps) => updateActive((w) => updateSet(w, entryId, set.id, { reps }))}
        />
        <button
          className={`check ${set.done ? 'on' : ''}`}
          role="checkbox"
          aria-checked={set.done}
          aria-label={`${label} erledigt`}
          onClick={() => {
            unlockSound()
            updateActive((w) => completeSet(w, entryId, set.id, restSec))
          }}
        />
      </div>
    </SwipeRow>
  )
}

/** Zahlenfeld, das Zwischenstände wie „82,“ beim Tippen erlaubt. */
function NumberInput({
  id,
  label,
  value,
  decimal,
  className = '',
  onChange,
}: {
  id: string
  className?: string
  label: string
  value: number | null
  decimal?: boolean
  onChange: (v: number | null) => void
}) {
  const [text, setText] = useState(formatNumber(value))
  const [focused, setFocused] = useState(false)

  // Von außen geänderte Werte übernehmen, solange nicht getippt wird
  useEffect(() => {
    if (!focused) setText(formatNumber(value))
  }, [value, focused])

  return (
    <input
      id={id}
      className={`set-input ${className}`}
      aria-label={label}
      inputMode={decimal ? 'decimal' : 'numeric'}
      enterKeyHint="next"
      autoComplete="off"
      value={text}
      onFocus={(e) => {
        setFocused(true)
        e.currentTarget.select()
      }}
      onBlur={() => {
        setFocused(false)
        setText(formatNumber(value))
      }}
      onChange={(e) => {
        const raw = decimal ? e.target.value.replace(/[^0-9,.]/g, '') : e.target.value.replace(/[^0-9]/g, '')
        setText(raw)
        onChange(parseNumber(raw))
      }}
    />
  )
}

function FinishSheet({ open, workout, onClose }: { open: boolean; workout: Workout; onClose: () => void }) {
  const { finishActive, discardActive, data, exerciseById } = useStore()
  const suggestion = open ? suggestRating(workout) : null
  const bests = open ? newBests(workout, data.workouts) : []
  const [chosen, setRating] = useState<Rating | null>(null)
  const [confirmDiscard, setConfirmDiscard] = useState(false)
  const summary = summarize(workout)
  // Ohne eigene Wahl gilt der Vorschlag aus den Planzielen
  const rating = chosen ?? suggestion?.rating ?? null
  const canSave = summary.sets > 0 && rating !== null

  function close() {
    setConfirmDiscard(false)
    setRating(null)
    onClose()
  }

  return (
    <Sheet open={open} title="Training beenden" onClose={close} closeLabel="Zurück">
      <div className="stat-row">
        <Stat value={formatDuration(Date.now() - workout.startedAt)} label="Dauer" />
        <Stat value={String(summary.sets)} label="Sätze erledigt" />
        <Stat value={`${formatNumber(Math.round(summary.volume))} kg`} label="Volumen" />
      </div>

      {summary.sets === 0 ? (
        <p className="empty-text">Hake mindestens einen Satz ab, um das Training zu speichern. Nicht abgehakte Sätze werden nicht gespeichert.</p>
      ) : (
        <>
          <h3 className="list-heading">Wie war’s?</h3>
          <div className="rating-choice" role="radiogroup" aria-label="Bewertung">
            <button
              role="radio"
              aria-checked={rating === 'good'}
              className={`rating good ${rating === 'good' ? 'on' : ''}`}
              onClick={() => setRating('good')}
            >
              Gut
            </button>
            <button
              role="radio"
              aria-checked={rating === 'meh'}
              className={`rating meh ${rating === 'meh' ? 'on' : ''}`}
              onClick={() => setRating('meh')}
            >
              Nicht so gut
            </button>
          </div>
          {bests.length > 0 && (
            <section className="list-section">
              <h3 className="list-heading">Neue Bestwerte</h3>
              <ul className="list inner">
                {bests.map((b) => (
                  <li key={b.exerciseId} className="list-row static">
                    <span className="row-main">{exerciseById.get(b.exerciseId)?.name ?? 'Übung'}</span>
                    <span className="best-value">
                      <span className="is-new">
                        {formatNumber(b.kg)} kg × {b.reps}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}
          {suggestion && (
            <p className="hint">
              Vorschlag nach deinen Planzielen: {suggestion.hit} von {suggestion.total} Übungen im Zielbereich. Du kannst die Bewertung ändern.
            </p>
          )}
          <p className="hint">Nicht abgehakte Sätze werden beim Speichern entfernt.</p>
        </>
      )}

      <button
        className="button primary wide"
        disabled={!canSave}
        onClick={() => {
          if (!rating) return
          finishActive(rating)
          close()
        }}
      >
        Training speichern
      </button>

      {confirmDiscard ? (
        <div className="confirm">
          <p>Das ganze Training wird gelöscht. Das lässt sich nicht rückgängig machen.</p>
          <div className="form-actions">
            <button className="button secondary" onClick={() => setConfirmDiscard(false)}>
              Behalten
            </button>
            <button
              className="button destructive"
              onClick={() => {
                discardActive()
                close()
              }}
            >
              Verwerfen
            </button>
          </div>
        </div>
      ) : (
        <button className="text-button danger wide" onClick={() => setConfirmDiscard(true)}>
          Training verwerfen
        </button>
      )}
    </Sheet>
  )
}

/** Orange Pausenleiste direkt unter dem Kopfbereich. Nur sichtbar, solange eine Pause läuft. */
function RestBar({ workout, now }: { workout: Workout; now: number }) {
  const { updateActive } = useStore()
  const rest = workout.rest
  const left = restRemaining(workout, now)
  if (!rest || left <= 0) return null
  const progress = Math.min(1, Math.max(0, 1 - (rest.endsAt - now) / (rest.total * 1000)))

  return (
    <div className="rest-bar" role="timer" aria-live="off" aria-label={`Pause, noch ${formatRest(left)}`}>
      <div className="rest-progress" style={{ transform: `scaleX(${progress})` }} aria-hidden="true" />
      <span className="rest-label">Pause</span>
      <span className="rest-time">{formatRest(left)}</span>
      <button className="rest-button" onClick={() => updateActive((w) => extendRest(w, 15))}>
        +15 s
      </button>
      <button className="rest-button" onClick={() => updateActive(stopRest)}>
        Überspringen
      </button>
    </div>
  )
}

export function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="stat">
      <span className="stat-value">{value}</span>
      <span className="stat-label">{label}</span>
    </div>
  )
}
