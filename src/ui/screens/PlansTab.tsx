import { useState, type ReactNode } from 'react'
import { ChevronDown, ChevronRight, Eye, EyeOff, Minus, Plus, Trash2 } from 'lucide-react'
import { DragHandle, Sortable } from '../components/Sortable'
import {
  addPlanExercise,
  createPlan,
  defaultTarget,
  formatRest,
  formatTarget,
  movePlanExerciseTo,
  planSetCount,
  removePlanExercise,
  REST_OPTIONS,
  updatePlanExercise,
} from '../../core/plans'
import type { Measure, Plan, PlanExercise, PlanKind } from '../../core/types'
import { cardioPlanSummary, createCardioPlan } from '../../core/cardioPlan'
import { lastSport } from '../../core/cardio'
import { Segmented } from '../components/Segmented'
import { CardioPlanEditor } from './CardioPlanEditor'
import { ProgramsView } from './ProgramsView'
import { MEASURE_LONG, MEASURE_MAX, MEASURE_SHORT, measureOf } from '../../core/measure'
import { Sheet } from '../components/Sheet'
import { useStore } from '../store'
import { ExercisePicker } from './ExercisePicker'

/** Liste der eigenen Pläne mit Start-Knopf. Wird im Tab „Pläne“ und in der Trainings-Startansicht genutzt. */
/** Umschalter „Gym | Ausdauer“ für Training- und Pläne-Tab. Die Wahl wird gespeichert. */
export function useTrainingView(): [PlanKind, (v: PlanKind) => void] {
  const { data, updateSettings } = useStore()
  return [data.settings.trainingView ?? 'gym', (v) => updateSettings({ trainingView: v })]
}

export function TrainingViewSwitch() {
  const [view, setView] = useTrainingView()
  return (
    <Segmented
      label="Trainingsart"
      value={view}
      onChange={setView}
      options={[
        { value: 'gym', label: 'Gym' },
        { value: 'cardio', label: 'Ausdauer' },
      ]}
    />
  )
}

/** Sichtbare Pläne einer Art. Mit `hidden = true` nur die ausgeblendeten. */
export const plansOfKind = (plans: Plan[], kind: PlanKind, hidden = false) =>
  plans.filter((p) => (p.kind ?? 'gym') === kind && !!p.hidden === hidden)

export function PlanList({ kind, onEdit, showEmptyHint = true }: { kind: PlanKind; onEdit?: (id: string) => void; showEmptyHint?: boolean }) {
  const { data, startPlan, active, reorderPlans } = useStore()
  const plans = plansOfKind(data.plans, kind)
  // Ziehen nur im Pläne-Tab (dort, wo bearbeitet wird)
  const sortable = !!onEdit

  if (plans.length === 0) {
    return showEmptyHint ? (
      <section className="card glass">
        <h2 className="card-title">Noch keine Pläne</h2>
        <p className="card-text">
          {kind === 'cardio'
            ? 'Lege deinen ersten Ausdauer-Plan an, zum Beispiel „6 × 400 m“: Aufwärmen, Intervalle mit Pausen, Auslaufen.'
            : 'Lege deinen ersten Plan an, zum Beispiel „Push A“. Pro Übung stellst du Sätze, Wiederholungsbereich und Pause ein.'}
        </p>
      </section>
    ) : null
  }

  return (
    <Sortable
      items={plans}
      as="ul"
      itemAs="li"
      className="list glass"
      itemClassName="plan-row"
      label={(p) => p.name}
      onMove={(from, to) => reorderPlans(plans.map((p) => p.id), from, to)}
    >
      {(p, _i, handle) => (
        <>
          {sortable && <DragHandle {...handle} />}
          <button className="list-row two-line" onClick={() => onEdit?.(p.id)} disabled={!onEdit}>
            <span className="row-main">
              <span className="row-title">{p.name}</span>
              <span className="row-sub">
                {p.kind === 'cardio'
                  ? cardioPlanSummary(p)
                  : `${p.exercises.length} ${p.exercises.length === 1 ? 'Übung' : 'Übungen'} · ${planSetCount(p)} Sätze`}
              </span>
            </span>
            {onEdit && <ChevronRight className="chevron" strokeWidth={2} aria-hidden="true" />}
          </button>
          <button
            className="button primary small plan-start"
            disabled={!!active || (p.kind === 'cardio' ? !p.blocks?.length : p.exercises.length === 0)}
            onClick={() => startPlan(p.id)}
            aria-label={`${p.name} starten`}
          >
            Starten
          </button>
        </>
      )}
    </Sortable>
  )
}

/** Zugeklappter Bereich mit ausgeblendeten Plänen, zum Wieder-Einblenden. */
function HiddenPlans({ kind, onEdit }: { kind: PlanKind; onEdit: (id: string) => void }) {
  const { data, savePlan } = useStore()
  const [open, setOpen] = useState(false)
  const hidden = plansOfKind(data.plans, kind, true)
  if (hidden.length === 0) return null

  return (
    <section className="list-section">
      <button className="text-button hidden-toggle" aria-expanded={open} onClick={() => setOpen(!open)}>
        {open ? <ChevronDown strokeWidth={2} aria-hidden="true" /> : <ChevronRight strokeWidth={2} aria-hidden="true" />}
        Ausgeblendet ({hidden.length})
      </button>
      {open && (
        <ul className="list glass">
          {hidden.map((p) => (
            <li key={p.id} className="plan-row">
              <button className="list-row" onClick={() => onEdit(p.id)}>
                <span className="row-main muted">{p.name}</span>
              </button>
              <button className="button secondary small plan-start" onClick={() => savePlan({ ...p, hidden: false })} aria-label={`${p.name} einblenden`}>
                Einblenden
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

/** Knopf im Plan-Editor: ausblenden oder wieder einblenden. */
export function HidePlanButton({ plan, onHidden }: { plan: Plan; onHidden: () => void }) {
  const { savePlan } = useStore()
  return plan.hidden ? (
    <button className="text-button wide" onClick={() => savePlan({ ...plan, hidden: false })}>
      <Eye strokeWidth={2} aria-hidden="true" /> Plan wieder einblenden
    </button>
  ) : (
    <button
      className="text-button wide"
      onClick={() => {
        savePlan({ ...plan, hidden: true })
        onHidden()
      }}
    >
      <EyeOff strokeWidth={2} aria-hidden="true" /> Plan ausblenden
    </button>
  )
}

export function PlansTab() {
  const { data, savePlan } = useStore()
  const [editing, setEditing] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [view, setView] = useTrainingView()
  const [showPrograms, setShowPrograms] = useState(false)
  const editingPlan = data.plans.find((p) => p.id === editing)

  const switcher = (
    <Segmented
      label="Planart"
      value={showPrograms ? 'program' : view}
      onChange={(v) => {
        setShowPrograms(v === 'program')
        if (v !== 'program') setView(v)
      }}
      options={[
        { value: 'gym', label: 'Gym' },
        { value: 'cardio', label: 'Ausdauer' },
        { value: 'program', label: 'Programme' },
      ]}
    />
  )

  if (showPrograms) {
    return (
      <>
        {switcher}
        <ProgramsView />
      </>
    )
  }

  return (
    <>
      {switcher}
      <button className="button secondary wide" onClick={() => setCreating(true)}>
        {view === 'cardio' ? '+ Neuer Ausdauer-Plan' : '+ Neuer Plan'}
      </button>
      <PlanList kind={view} onEdit={setEditing} />
      <HiddenPlans kind={view} onEdit={setEditing} />

      <NewPlanSheet
        open={creating}
        kind={view}
        onClose={() => setCreating(false)}
        onCreate={(name) => {
          const plan = view === 'cardio' ? createCardioPlan(name, lastSport(data.workouts), data.plans.length) : createPlan(name, data.plans.length)
          savePlan(plan)
          setCreating(false)
          setEditing(plan.id)
        }}
      />
      {editingPlan?.kind === 'cardio' ? (
        <CardioPlanEditor plan={editingPlan} onClose={() => setEditing(null)} />
      ) : (
        <PlanEditor planId={editing} onClose={() => setEditing(null)} />
      )}
    </>
  )
}

function NewPlanSheet({ open, kind, onClose, onCreate }: { open: boolean; kind: PlanKind; onClose: () => void; onCreate: (name: string) => void }) {
  const { data } = useStore()
  const [name, setName] = useState('')
  const trimmed = name.trim()
  const duplicate = data.plans.some((p) => p.name.toLowerCase() === trimmed.toLowerCase())

  function close() {
    setName('')
    onClose()
  }

  return (
    <Sheet open={open} title={kind === 'cardio' ? 'Neuer Ausdauer-Plan' : 'Neuer Plan'} onClose={close} closeLabel="Abbrechen">
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
          <input id="new-plan-name" value={name} onChange={(e) => setName(e.target.value)} placeholder={kind === 'cardio' ? 'z. B. 6 × 400 m' : 'z. B. Push A'} autoFocus />
        </label>
        {duplicate && <p className="field-error">Einen Plan mit diesem Namen gibt es schon.</p>}
        <button type="submit" className="button primary" disabled={!trimmed || duplicate}>
          {kind === 'cardio' ? 'Anlegen und Abschnitte einstellen' : 'Anlegen und Übungen wählen'}
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

        <Sortable
          items={plan.exercises}
          className="plan-exercises"
          label={(pe) => exerciseById.get(pe.exerciseId)?.name ?? 'Übung'}
          onMove={(from, to) => update(movePlanExerciseTo(plan, from, to))}
        >
          {(pe, _i, handle) => (
            <PlanExerciseRow
              pe={pe}
              name={exerciseById.get(pe.exerciseId)?.name ?? 'Unbekannte Übung'}
              measure={measureOf(exerciseById.get(pe.exerciseId))}
              handle={<DragHandle {...handle} />}
              onChange={(patch) => update(updatePlanExercise(plan, pe.id, patch, measureOf(exerciseById.get(pe.exerciseId))))}
              onRemove={() => update(removePlanExercise(plan, pe.id))}
            />
          )}
        </Sortable>

        <button className="button secondary wide" onClick={() => setPicking(true)}>
          + Übung hinzufügen
        </button>


        <HidePlanButton plan={plan} onHidden={close} />

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
        onPick={(id) => update(addPlanExercise(plan, id, defaultTarget(measureOf(exerciseById.get(id)))))}
      />
    </>
  )
}

function PlanExerciseRow({
  pe,
  name,
  measure,
  handle,
  onChange,
  onRemove,
}: {
  pe: PlanExercise
  name: string
  measure: Measure
  handle: ReactNode
  onChange: (patch: Partial<PlanExercise>) => void
  onRemove: () => void
}) {
  return (
    <section className="plan-exercise">
      <div className="plan-exercise-head">
        {handle}
        <div className="row-main">
          <span className="row-title">{name}</span>
          <span className="row-sub">
            {formatTarget(pe, measure)} · Pause {formatRest(pe.restSec)}
          </span>
        </div>
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
          <span className="plan-label">{MEASURE_SHORT[measure]}</span>
          <div className="range-inputs">
            <RepInput id={`min-${pe.id}`} label={`${name}, ${MEASURE_LONG[measure]} von`} max={MEASURE_MAX[measure]} value={pe.repMin} onCommit={(repMin) => onChange({ repMin, repMax: Math.max(repMin, pe.repMax) })} />
            <span aria-hidden="true">–</span>
            <RepInput id={`max-${pe.id}`} label={`${name}, ${MEASURE_LONG[measure]} bis`} max={MEASURE_MAX[measure]} value={pe.repMax} onCommit={(repMax) => onChange({ repMax })} />
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
