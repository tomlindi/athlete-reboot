import { useState, type ReactNode } from 'react'
import { Minus, Plus, Trash2 } from 'lucide-react'
import { DragHandle, Sortable } from '../components/Sortable'
import { HidePlanButton } from './PlansTab'
import { SPORT_LABEL, SPORTS } from '../../core/cardio'
import { addBlock, formatBlock, moveBlockTo, removeBlock, updateBlock } from '../../core/cardioPlan'
import { formatNumber, parseNumber } from '../../core/workout'
import type { Amount, CardioBlock, Plan } from '../../core/types'
import { Segmented } from '../components/Segmented'
import { Sheet } from '../components/Sheet'
import { useStore } from '../store'

type Unit = 'min' | 's' | 'm' | 'km'

/** Passende Anzeige-Einheit: volle Minuten in min, glatte Kilometer in km */
function displayUnit(a: Amount): Unit {
  if (a.unit === 'time') return a.value >= 60 && a.value % 60 === 0 ? 'min' : 's'
  return a.value >= 1000 && a.value % 100 === 0 ? 'km' : 'm'
}

const FACTOR: Record<Unit, number> = { min: 60, s: 1, m: 1, km: 1000 }
const toAmount = (value: number, unit: Unit): Amount => ({ unit: unit === 'min' || unit === 's' ? 'time' : 'distance', value: value * FACTOR[unit] })

/** Bearbeiten eines Ausdauer-Plans: Name, Sportart, Abschnitte mit Wiederholungen und Pausen. */
export function CardioPlanEditor({ plan, onClose }: { plan: Plan; onClose: () => void }) {
  const { savePlan, deletePlan } = useStore()
  const [confirmDelete, setConfirmDelete] = useState(false)
  const blocks = plan.blocks ?? []
  const update = (next: Plan) => savePlan(next)

  function close() {
    setConfirmDelete(false)
    onClose()
  }

  return (
    <Sheet open title={plan.name} onClose={close}>
      <label className="field">
        <span>Name</span>
        <input
          id="plan-name"
          value={plan.name}
          onChange={(e) => update({ ...plan, name: e.target.value })}
          onBlur={(e) => !e.target.value.trim() && update({ ...plan, name: 'Plan' })}
        />
      </label>

      <Segmented
        label="Sportart"
        value={plan.sport ?? 'laufen'}
        onChange={(sport) => update({ ...plan, sport })}
        options={SPORTS.map((s) => ({ value: s, label: SPORT_LABEL[s] }))}
      />

      {blocks.length === 0 && <p className="empty-text">Noch keine Abschnitte. Füge den ersten hinzu.</p>}

      <Sortable items={blocks} className="plan-exercises" label={(b) => b.label || 'Abschnitt'} onMove={(from, to) => update(moveBlockTo(plan, from, to))}>
        {(b, _i, handle) => (
          <BlockRow
            block={b}
            handle={<DragHandle {...handle} />}
            onChange={(patch) => update(updateBlock(plan, b.id, patch))}
            onRemove={() => update(removeBlock(plan, b.id))}
          />
        )}
      </Sortable>

      <button className="button secondary wide" onClick={() => update(addBlock(plan))}>
        + Abschnitt
      </button>


      <HidePlanButton plan={plan} onHidden={close} />

      {confirmDelete ? (
        <div className="confirm">
          <p>Der Plan „{plan.name}“ wird gelöscht. Deine bisherigen Einheiten bleiben erhalten.</p>
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
  )
}

function BlockRow({
  block,
  handle,
  onChange,
  onRemove,
}: {
  block: CardioBlock
  handle: ReactNode
  onChange: (patch: Partial<CardioBlock>) => void
  onRemove: () => void
}) {
  const reps = block.repeat ?? 1
  const name = block.label || 'Abschnitt'

  return (
    <section className="plan-exercise">
      <div className="plan-exercise-head">
        {handle}
        <div className="row-main">
          <span className="row-title">{name}</span>
          <span className="row-sub">{formatBlock(block)}</span>
        </div>
        <button className="icon-button small danger" aria-label={`${name} entfernen`} onClick={onRemove}>
          <Trash2 strokeWidth={2} />
        </button>
      </div>

      <div className="block-fields">
        <label className="block-field wide">
          <span className="plan-label">Name</span>
          <input id={`label-${block.id}`} className="block-text" value={block.label} onChange={(e) => onChange({ label: e.target.value })} />
        </label>

        <AmountField id={`amount-${block.id}`} label={`${name}, Menge`} title="Dauer / Strecke" amount={block.amount} onChange={(amount) => onChange({ amount })} />

        <div className="block-field">
          <span className="plan-label">Wiederholen</span>
          <div className="stepper">
            <button aria-label="Eine Wiederholung weniger" disabled={reps <= 1} onClick={() => onChange({ repeat: reps - 1 })}>
              <Minus strokeWidth={2.3} />
            </button>
            <span className="stepper-value">{reps}×</span>
            <button aria-label="Eine Wiederholung mehr" disabled={reps >= 30} onClick={() => onChange({ repeat: reps + 1 })}>
              <Plus strokeWidth={2.3} />
            </button>
          </div>
        </div>

        {reps > 1 && block.rest && (
          <>
            <label className="block-field wide">
              <span className="plan-label">Pause dazwischen</span>
              <input id={`rest-label-${block.id}`} className="block-text" value={block.restLabel ?? ''} placeholder="z. B. Gehpause" onChange={(e) => onChange({ restLabel: e.target.value })} />
            </label>
            <AmountField id={`rest-${block.id}`} label={`${name}, Pause`} title="Pausenlänge" amount={block.rest} onChange={(rest) => onChange({ rest })} />
          </>
        )}
      </div>
    </section>
  )
}

/** Zahl + Einheit (min, s, m, km). Übernimmt erst beim Verlassen des Feldes. */
function AmountField({ id, label, title, amount, onChange }: { id: string; label: string; title: string; amount: Amount; onChange: (a: Amount) => void }) {
  const unit = displayUnit(amount)
  const shown = formatNumber(amount.value / FACTOR[unit])
  const [text, setText] = useState<string | null>(null)

  return (
    <div className="block-field">
      <span className="plan-label">{title}</span>
      <div className="amount-inputs">
        <input
          id={id}
          className="rep-input"
          aria-label={label}
          inputMode="decimal"
          value={text ?? shown}
          onFocus={(e) => {
            setText(shown)
            e.currentTarget.select()
          }}
          onChange={(e) => setText(e.target.value.replace(/[^0-9,.]/g, ''))}
          onBlur={() => {
            const n = parseNumber(text ?? '')
            if (n && n > 0) onChange(toAmount(n, unit))
            setText(null)
          }}
        />
        <select
          id={`${id}-unit`}
          className="rest-select compact"
          aria-label={`${label}, Einheit`}
          value={unit}
          onChange={(e) => onChange(toAmount(amount.value / FACTOR[unit], e.target.value as Unit))}
        >
          <option value="min">min</option>
          <option value="s">s</option>
          <option value="m">m</option>
          <option value="km">km</option>
        </select>
      </div>
    </div>
  )
}
