import { useState } from 'react'
import { ChevronDown, ChevronRight, ChevronUp, Minus, Plus, Trash2 } from 'lucide-react'
import {
  addPlanExercise,
  createPlan,
  DEFAULT_TARGET,
  DEFAULT_TIMED_TARGET,
  formatRest,
  formatTarget,
  maxPerSet,
  movePlanExercise,
  planSetCount,
  removePlanExercise,
  REST_OPTIONS,
  updatePlanExercise,
} from '../../core/plans'
import type { Plan, PlanExercise } from '../../core/types'
import { isTimed } from '../../core/exercises'
import { Sheet } from '../components/Sheet'
import { useStore } from '../store'
import { ExercisePicker } from './ExercisePicker'

/** Liste der eigenen Pläne mit Start-Knopf. Wird im Tab „Pläne“ und in der Trainings-Startansicht genutzt. */
export function PlanList({ onEdit, showEmptyHint = true }: { onEdit?: (id: string) => void; showEmptyHint?: boolean }) {
  const { data, startPlan, active } = useStore()

  if (data.plans.length === 0) {
    return showEmptyHint ? (
      <section className="card glass">
        <h2 className="card-title">Noch keine Pläne</h2>
        <p className="card-text">Lege deinen ersten Plan an, zum Beispiel „Push A“. Pro Übung stellst du Sätze, Wiederholungsbereich und Pause ein.</p>
      </section>
    ) : null
  }

  return (
    <ul className="list glass">
      {data.plans.map((p) => (
        <li key={p.id} className="plan-row">
          <button className="list-row two-line" onClick={() => onEdit?.(p.id)} disabled={!onEdit}>
            <span className="row-main">
              <span className="row-title">{p.name}</span>
              <span className="row-sub">
                {p.exercises.length} {p.exercises.length === 1 ? 'Übung' : 'Übungen'} · {planSetCount(p)} Sätze
              </span>
            </span>
            {onEdit && <ChevronRight className="chevron" strokeWidth={2} aria-hidden="true" />}
          </button>
          <button
            className="button primary small plan-start"
            disabled={!!active || p.exercises.length === 0}
            onClick={() => startPlan(p.id)}
            aria-label={`${p.name} starten`}
          >
            Starten
          </button>
        </li>
      ))}
    </ul>
  )
}

export function PlansTab() {
  const { data, savePlan } = useStore()
  const [editing, setEditing] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)

  return (
    <>
      <button className="button secondary wide" onClick={() => setCreating(true)}>
        + Neuer Plan
      </button>
      <PlanList onEdit={setEditing} />
      {data.plans.length > 0 && <p className="hint">Tippe auf einen Plan, um ihn zu bearbeiten.</p>}

      <NewPlanSheet
        open={creating}
        onClose={() => setCreating(false)}
        onCreate={(name) => {
          const plan = createPlan(name, data.plans.length)
          savePlan(plan)
          setCreating(false)
          setEditing(plan.id)
        }}
      />
      <PlanEditor planId={editing} onClose={() => setEditing(null)} />
    </>
  )
}

function NewPlanSheet({ open, onClose, onCreate }: { open: boolean; onClose: () => void; onCreate: (name: string) => void }) {
  const { data } = useStore()
  const [name, setName] = useState('')
  const trimmed = name.trim()
  const duplicate = data.plans.some((p) => p.name.toLowerCase() === trimmed.toLowerCase())

  function close() {
    setName('')
    onClose()
  }

  return (
    <Sheet open={open} title="Neuer Plan" onClose={close} closeLabel="Abbrechen">
      <form
        className="inline-form"
        onSubmit={(e) => {
          e.preventDefault()
          if (!trimmed || duplicate) return
          onCreate(trimmed)
          setName('')
        }}
      >
        <label className="field">
          <span>Name</span>
          <input id="new-plan-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="z. B. Push A" autoFocus />
        </label>
        {duplicate && <p className="field-error">Einen Plan mit diesem Namen gibt es schon.</p>}
        <button type="submit" className="button primary" disabled={!trimmed || duplicate}>
          Anlegen und Übungen wählen
        </button>
      </form>
    </Sheet>
  )
}

function PlanEditor({ planId, onClose }: { planId: string | null; onClose: () => void }) {
  const { data, savePlan, deletePlan, exerciseById } = useStore()
  const [picking, setPicking] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const plan = data.plans.find((p) => p.id === planId)

  function close() {
    setConfirmDelete(false)
    onClose()
  }

  if (!plan) return null
  const update = (next: Plan) => savePlan(next)

  return (
    <>
      <Sheet open={!picking} title={plan.name} onClose={close}>
        <label className="field">
          <span>Name</span>
          <input
            id="plan-name"
            value={plan.name}
            onChange={(e) => update({ ...plan, name: e.target.value })}
            onBlur={(e) => !e.target.value.trim() && update({ ...plan, name: 'Plan' })}
          />
        </label>

        {plan.exercises.length === 0 && <p className="empty-text">Noch keine Übungen. Füge die erste hinzu.</p>}

        {plan.exercises.map((pe, i) => (
          <PlanExerciseRow
            key={pe.id}
            pe={pe}
            name={exerciseById.get(pe.exerciseId)?.name ?? 'Unbekannte Übung'}
            timed={isTimed(exerciseById.get(pe.exerciseId))}
            first={i === 0}
            last={i === plan.exercises.length - 1}
            onChange={(patch) => update(updatePlanExercise(plan, pe.id, patch, isTimed(exerciseById.get(pe.exerciseId))))}
            onMove={(d) => update(movePlanExercise(plan, pe.id, d))}
            onRemove={() => update(removePlanExercise(plan, pe.id))}
          />
        ))}

        <button className="button secondary wide" onClick={() => setPicking(true)}>
          + Übung hinzufügen
        </button>

        {plan.exercises.length > 0 && (
          <p className="hint">
            {plan.exercises.length} Übungen · {planSetCount(plan)} Sätze. Schaffst du in allen Sätzen das obere Ende, zeigt das Training „Ziel geschafft“: Zeit für mehr Gewicht.
          </p>
        )}

        {confirmDelete ? (
          <div className="confirm">
            <p>Der Plan „{plan.name}“ wird gelöscht. Deine bisherigen Trainings bleiben erhalten.</p>
            <div className="form-actions">
              <button className="button secondary" onClick={() => setConfirmDelete(false)}>
                Behalten
              </button>
              <button
                className="button destructive"
                onClick={() => {
                  deletePlan(plan.id)
                  close()
                }}
              >
                Löschen
              </button>
            </div>
          </div>
        ) : (
          <button className="text-button danger wide" onClick={() => setConfirmDelete(true)}>
            Plan löschen
          </button>
        )}
      </Sheet>

      <ExercisePicker
        open={picking}
        onClose={() => setPicking(false)}
        onPick={(id) => update(addPlanExercise(plan, id, isTimed(exerciseById.get(id)) ? DEFAULT_TIMED_TARGET : DEFAULT_TARGET))}
      />
    </>
  )
}

function PlanExerciseRow({
  pe,
  name,
  timed,
  first,
  last,
  onChange,
  onMove,
  onRemove,
}: {
  pe: PlanExercise
  name: string
  timed: boolean
  first: boolean
  last: boolean
  onChange: (patch: Partial<PlanExercise>) => void
  onMove: (delta: -1 | 1) => void
  onRemove: () => void
}) {
  return (
    <section className="plan-exercise">
      <div className="plan-exercise-head">
        <div className="row-main">
          <span className="row-title">{name}</span>
          <span className="row-sub">
            {formatTarget(pe, timed)} · Pause {formatRest(pe.restSec)}
          </span>
        </div>
        <button className="icon-button small" aria-label={`${name} nach oben`} disabled={first} onClick={() => onMove(-1)}>
          <ChevronUp strokeWidth={2} />
        </button>
        <button className="icon-button small" aria-label={`${name} nach unten`} disabled={last} onClick={() => onMove(1)}>
          <ChevronDown strokeWidth={2} />
        </button>
        <button className="icon-button small danger" aria-label={`${name} aus dem Plan entfernen`} onClick={onRemove}>
          <Trash2 strokeWidth={2} />
        </button>
      </div>

      <div className="plan-fields">
        <div className="plan-field">
          <span className="plan-label">Sätze</span>
          <div className="stepper">
            <button aria-label="Ein Satz weniger" disabled={pe.sets <= 1} onClick={() => onChange({ sets: pe.sets - 1 })}>
              <Minus strokeWidth={2.3} />
            </button>
            <span className="stepper-value">{pe.sets}</span>
            <button aria-label="Ein Satz mehr" disabled={pe.sets >= 10} onClick={() => onChange({ sets: pe.sets + 1 })}>
              <Plus strokeWidth={2.3} />
            </button>
          </div>
        </div>

        <div className="plan-field">
          <span className="plan-label">{timed ? 'Sek' : 'Wdh'}</span>
          <div className="range-inputs">
            <RepInput id={`min-${pe.id}`} label={`${name}, ${timed ? 'Sekunden' : 'Wiederholungen'} von`} max={maxPerSet(timed)} value={pe.repMin} onCommit={(repMin) => onChange({ repMin, repMax: Math.max(repMin, pe.repMax) })} />
            <span aria-hidden="true">–</span>
            <RepInput id={`max-${pe.id}`} label={`${name}, ${timed ? 'Sekunden' : 'Wiederholungen'} bis`} max={maxPerSet(timed)} value={pe.repMax} onCommit={(repMax) => onChange({ repMax })} />
          </div>
        </div>

        <label className="plan-field">
          <span className="plan-label">Pause</span>
          <select id={`rest-${pe.id}`} className="rest-select" value={pe.restSec} onChange={(e) => onChange({ restSec: Number(e.target.value) })}>
            {[...new Set([...REST_OPTIONS, pe.restSec])].sort((a, b) => a - b).map((s) => (
              <option key={s} value={s}>
                {formatRest(s)}
              </option>
            ))}
          </select>
        </label>
      </div>
    </section>
  )
}

/** Wiederholungsfeld, das erst beim Verlassen übernimmt, damit „12“ nicht als „1“ hängen bleibt. */
function RepInput({ id, label, value, max, onCommit }: { id: string; label: string; value: number; max: number; onCommit: (v: number) => void }) {
  const [text, setText] = useState<string | null>(null)
  return (
    <input
      id={id}
      className="rep-input"
      aria-label={label}
      inputMode="numeric"
      value={text ?? String(value)}
      onFocus={(e) => {
        setText(String(value))
        e.currentTarget.select()
      }}
      onChange={(e) => setText(e.target.value.replace(/[^0-9]/g, '').slice(0, String(max).length))}
      onBlur={() => {
        const n = Number(text)
        if (text && n > 0) onCommit(n)
        setText(null)
      }}
    />
  )
}
