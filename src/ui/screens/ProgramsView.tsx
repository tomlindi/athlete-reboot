import { useState } from 'react'
import { Check, Feather, Minus, Pencil, Play, Plus } from 'lucide-react'
import {
  createProgram,
  isLighter,
  isRunning,
  mondayKey,
  programStatus,
  programWeek,
  setDay,
  toggleLighter,
  weekDays,
  WEEKDAYS_LONG,
  WEEKDAYS_SHORT,
  type WeekDay,
} from '../../core/program'
import type { Plan, Program } from '../../core/types'
import { Segmented } from '../components/Segmented'
import { Sheet } from '../components/Sheet'
import { useStore } from '../store'

const dateFmt = new Intl.DateTimeFormat('de-DE', { day: 'numeric', month: 'numeric' })

/** Programme im Pläne-Tab: Liste mit der aktuellen Woche, Start der heutigen Einheit, Bearbeiten. */
export function ProgramsView() {
  const { data, saveProgram } = useStore()
  const [editing, setEditing] = useState<string | null>(null)
  const editingProgram = data.programs.find((p) => p.id === editing)

  return (
    <>
      <button
        className="button secondary wide"
        onClick={() => {
          const p = createProgram('Neues Programm')
          saveProgram(p)
          setEditing(p.id)
        }}
      >
        + Neues Programm
      </button>

      {data.programs.length === 0 && (
        <section className="card glass">
          <h2 className="card-title">Noch keine Programme</h2>
          <p className="card-text">
            Ein Programm verteilt deine Pläne auf feste Wochentage, zum Beispiel 8 Wochen lang Mo Sprungkraft, Mi Intervalle, Fr Beine. Ausdauer-Pläne
            steigern sich jede Woche automatisch. Das Gewicht im Gym steigerst du wie gewohnt über „Ziel geschafft“.
          </p>
        </section>
      )}

      {data.programs.map((p) => (
        <ProgramCard key={p.id} program={p} onEdit={() => setEditing(p.id)} />
      ))}

      {editingProgram && <ProgramEditor program={editingProgram} onClose={() => setEditing(null)} />}
    </>
  )
}

function ProgramCard({ program, onEdit }: { program: Program; onEdit: () => void }) {
  const { data, saveProgram, startProgramDay, active } = useStore()
  const week = programWeek(program)
  const running = isRunning(program)
  const days = running ? weekDays(program, week, data.workouts) : []
  const planName = (id: string) => data.plans.find((x) => x.id === id)?.name ?? 'Gelöschter Plan'
  const lighter = running && isLighter(program, week)

  return (
    <section className="card glass program-card">
      <div className="card-head">
        <div>
          <h2 className="card-title">{program.name}</h2>
          <p className="card-sub">{programStatus(program)}</p>
        </div>
        <button className="icon-button" aria-label={`${program.name} bearbeiten`} onClick={onEdit}>
          <Pencil strokeWidth={2} />
        </button>
      </div>

      {running && days.length === 0 && <p className="card-text">Noch keine Trainingstage. Tippe auf den Stift und wähle Pläne für die Wochentage.</p>}

      {days.length > 0 && (
        <ul className="program-days">
          {days.map((d) => (
            <DayRow
              key={d.weekday}
              day={d}
              name={planName(d.planId)}
              disabled={!!active || !data.plans.some((x) => x.id === d.planId)}
              onStart={() => startProgramDay(program.id, week, d.weekday)}
            />
          ))}
        </ul>
      )}

      {running && (
        <button
          className={`chip-toggle ${lighter ? 'on' : ''}`}
          aria-pressed={lighter}
          onClick={() => saveProgram(toggleLighter(program, week))}
        >
          <Feather strokeWidth={2} aria-hidden="true" />
          {lighter ? 'Diese Woche leichter: an' : 'Diese Woche leichter'}
        </button>
      )}
    </section>
  )
}

function DayRow({ day, name, disabled, onStart }: { day: WeekDay; name: string; disabled: boolean; onStart: () => void }) {
  return (
    <li className={`program-day ${day.status}`}>
      <span className="program-weekday">{WEEKDAYS_SHORT[day.weekday]}</span>
      <span className="row-main">
        <span className="row-title">{name}</span>
        <span className="row-sub">
          {day.status === 'done' && 'Erledigt'}
          {day.status === 'today' && 'Heute'}
          {day.status === 'missed' && `Verpasst · ${dateFmt.format(day.date)}`}
          {day.status === 'upcoming' && dateFmt.format(day.date)}
        </span>
      </span>
      {day.status === 'done' && (
        <span className="done-mark" aria-label="Erledigt">
          <Check strokeWidth={3} aria-hidden="true" />
        </span>
      )}
      {day.status === 'today' && (
        <button className="button primary small" disabled={disabled} onClick={onStart} aria-label={`${name} starten`}>
          <Play strokeWidth={2.4} aria-hidden="true" />
          Starten
        </button>
      )}
      {day.status === 'missed' && (
        <button className="button secondary small" disabled={disabled} onClick={onStart} aria-label={`${name} nachholen`}>
          Nachholen
        </button>
      )}
    </li>
  )
}

function ProgramEditor({ program, onClose }: { program: Program; onClose: () => void }) {
  const { data, saveProgram, deleteProgram } = useStore()
  const [confirmDelete, setConfirmDelete] = useState(false)
  const update = (p: Program) => saveProgram(p)
  const plans = data.plans.filter((p) => !p.hidden)
  const gymPlans = plans.filter((p) => p.kind !== 'cardio')
  const cardioPlans = plans.filter((p) => p.kind === 'cardio')
  const thisMonday = mondayKey(Date.now())
  const nextMonday = mondayKey(Date.now() + 7 * 86_400_000)
  const start = program.startDate === thisMonday ? 'this' : program.startDate === nextMonday ? 'next' : 'other'

  return (
    <Sheet open title={program.name || 'Programm'} onClose={onClose}>
      <label className="field">
        <span>Name</span>
        <input
          id="program-name"
          value={program.name}
          placeholder="z. B. Dunken"
          onChange={(e) => update({ ...program, name: e.target.value })}
          onBlur={(e) => !e.target.value.trim() && update({ ...program, name: 'Programm' })}
        />
      </label>

      <div className="field">
        <span>Start</span>
        {start === 'other' ? (
          <p className="card-text">{programStatus(program)}</p>
        ) : (
          <Segmented
            label="Start"
            value={start}
            onChange={(v) => update({ ...program, startDate: v === 'this' ? thisMonday : nextMonday })}
            options={[
              { value: 'this', label: 'Diese Woche' },
              { value: 'next', label: 'Nächste Woche' },
            ]}
          />
        )}
      </div>

      <div className="field">
        <span>Dauer</span>
        <div className="stepper">
          <button aria-label="Eine Woche weniger" disabled={program.weeks <= 1} onClick={() => update({ ...program, weeks: program.weeks - 1 })}>
            <Minus strokeWidth={2.3} />
          </button>
          <span className="stepper-value">{program.weeks} Wochen</span>
          <button aria-label="Eine Woche mehr" disabled={program.weeks >= 16} onClick={() => update({ ...program, weeks: program.weeks + 1 })}>
            <Plus strokeWidth={2.3} />
          </button>
        </div>
      </div>

      <section className="list-section">
        <h3 className="list-heading">Wochenplan</h3>
        <ul className="list inner">
          {WEEKDAYS_LONG.map((label, weekday) => {
            const planId = program.days.find((d) => d.weekday === weekday)?.planId ?? ''
            return (
              <li key={weekday} className="list-row static weekday-row">
                <label htmlFor={`day-${weekday}`} className="row-main">
                  {label}
                </label>
                <select
                  id={`day-${weekday}`}
                  className="rest-select compact weekday-select"
                  value={planId}
                  onChange={(e) => update(setDay(program, weekday, e.target.value || null))}
                >
                  <option value="">Ruhetag</option>
                  <PlanOptions label="Gym" plans={gymPlans} />
                  <PlanOptions label="Ausdauer" plans={cardioPlans} />
                </select>
              </li>
            )
          })}
        </ul>
      </section>

      <section className="list-section">
        <h3 className="list-heading">Steigerung</h3>
        <ul className="list inner">
          <li className="list-row static">
            <label className="toggle-row">
              <input
                type="checkbox"
                checked={program.rules.cardioProgress}
                onChange={(e) => update({ ...program, rules: { ...program.rules, cardioProgress: e.target.checked } })}
              />
              <span className="row-main">
                <span className="row-title">Ausdauer steigern</span>
                <span className="row-sub">Pro Woche +1 Intervall bzw. +10 % Dauer oder Strecke</span>
              </span>
            </label>
          </li>
          <li className="list-row static">
            <label className="toggle-row">
              <input
                type="checkbox"
                checked={program.rules.gymExtraSet}
                onChange={(e) => update({ ...program, rules: { ...program.rules, gymExtraSet: e.target.checked } })}
              />
              <span className="row-main">
                <span className="row-title">Gym: mehr Sätze</span>
                <span className="row-sub">Alle 2 Wochen +1 Satz pro Übung, höchstens +2</span>
              </span>
            </label>
          </li>
        </ul>
      </section>

      {confirmDelete ? (
        <div className="confirm">
          <p>Das Programm „{program.name}“ wird gelöscht. Deine Pläne und bisherigen Trainings bleiben erhalten.</p>
          <div className="form-actions">
            <button className="button secondary" onClick={() => setConfirmDelete(false)}>
              Behalten
            </button>
            <button
              className="button destructive"
              onClick={() => {
                deleteProgram(program.id)
                onClose()
              }}
            >
              Löschen
            </button>
          </div>
        </div>
      ) : (
        <button className="text-button danger wide" onClick={() => setConfirmDelete(true)}>
          Programm löschen
        </button>
      )}
    </Sheet>
  )
}

function PlanOptions({ label, plans }: { label: string; plans: Plan[] }) {
  if (plans.length === 0) return null
  return (
    <optgroup label={label}>
      {plans.map((p) => (
        <option key={p.id} value={p.id}>
          {p.name}
        </option>
      ))}
    </optgroup>
  )
}
