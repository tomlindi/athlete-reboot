import { useMemo, useState } from 'react'
import { matchesSearch } from '../../core/exercises'
import { measureOf } from '../../core/measure'
import { LEVEL_LABEL, MUSCLE_GROUPS, type Exercise, type Measure, type MuscleGroup } from '../../core/types'
import { Sheet } from '../components/Sheet'
import { useStore } from '../store'

/** Übungen nach Muskelgruppe gruppiert, gefiltert nach Suche. Innerhalb der Gruppe nach Stufe, dann nach Name. */
export function groupExercises(list: Exercise[], query: string) {
  const filtered = list.filter((e) => matchesSearch(e, query))
  return MUSCLE_GROUPS.map((g) => ({
    group: g,
    items: filtered.filter((e) => e.group === g).sort((a, b) => (a.level ?? 0) - (b.level ?? 0) || a.name.localeCompare(b.name, 'de')),
  })).filter((g) => g.items.length > 0)
}

export function ExercisePicker({
  open,
  onClose,
  onPick,
}: {
  open: boolean
  onClose: () => void
  onPick: (exerciseId: string) => void
}) {
  const { data } = useStore()
  const [query, setQuery] = useState('')
  const [creating, setCreating] = useState(false)
  const visible = useMemo(() => data.exercises.filter((e) => !e.hidden), [data.exercises])
  const groups = useMemo(() => groupExercises(visible, query), [visible, query])

  function close() {
    setQuery('')
    setCreating(false)
    onClose()
  }

  return (
    <Sheet open={open} title="Übung hinzufügen" onClose={close} closeLabel="Abbrechen">
      <input
        id="exercise-search"
        className="search"
        type="search"
        placeholder="Übung suchen"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        autoComplete="off"
      />

      {creating ? (
        <ExerciseForm
          initialName={query}
          onCancel={() => setCreating(false)}
          onCreated={(e) => {
            onPick(e.id)
            close()
          }}
        />
      ) : (
        <button className="list-action" onClick={() => setCreating(true)}>
          + Eigene Übung anlegen{query.trim() ? ` „${query.trim()}“` : ''}
        </button>
      )}

      {groups.length === 0 && !creating && <p className="empty-text">Keine Übung gefunden.</p>}

      {groups.map(({ group, items }) => (
        <section key={group} className="list-section">
          <h3 className="list-heading">{group}</h3>
          <ul className="list inner">
            {items.map((e) => (
              <li key={e.id}>
                <button
                  className="list-row"
                  onClick={() => {
                    onPick(e.id)
                    close()
                  }}
                >
                  <span>{e.name}</span>
                  {measureOf(e) === 'time' && <span className="row-meta">Sekunden</span>}
                  {measureOf(e) === 'distance' && <span className="row-meta">Meter</span>}
                  {e.level && (
                    <span className="level-chip">
                      <span className="level-bars" aria-hidden="true">
                        {[1, 2, 3].map((n) => (
                          <span key={n} className={n <= e.level! ? 'on' : ''} />
                        ))}
                      </span>
                      {LEVEL_LABEL[e.level]}
                    </span>
                  )}
                  {e.custom && <span className="row-meta">Eigene</span>}
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </Sheet>
  )
}

export function ExerciseForm({
  initialName = '',
  onCancel,
  onCreated,
}: {
  initialName?: string
  onCancel: () => void
  onCreated: (e: Exercise) => void
}) {
  const { addExercise, data } = useStore()
  const [name, setName] = useState(initialName.trim())
  const [group, setGroup] = useState<MuscleGroup>('Brust')
  const [measure, setMeasure] = useState<Measure>('reps')
  const trimmed = name.trim()
  const duplicate = data.exercises.some((e) => e.name.toLowerCase() === trimmed.toLowerCase())

  return (
    <form
      className="inline-form"
      onSubmit={(ev) => {
        ev.preventDefault()
        if (!trimmed || duplicate) return
        onCreated(addExercise(trimmed, group, measure))
      }}
    >
      <label className="field">
        <span>Name</span>
        <input id="new-exercise-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="z. B. Kabelrudern einarmig" autoFocus />
      </label>
      <label className="field">
        <span>Muskelgruppe</span>
        <select id="new-exercise-group" value={group} onChange={(e) => setGroup(e.target.value as MuscleGroup)}>
          {MUSCLE_GROUPS.map((g) => (
            <option key={g}>{g}</option>
          ))}
        </select>
      </label>
      <label className="field">
        <span>Messen in</span>
        <select id="new-exercise-measure" value={measure} onChange={(e) => setMeasure(e.target.value as Measure)}>
          <option value="reps">Wiederholungen</option>
          <option value="time">Sekunden (mit Countdown)</option>
          <option value="distance">Meter</option>
        </select>
      </label>
      {duplicate && <p className="field-error">Eine Übung mit diesem Namen gibt es schon.</p>}
      <div className="form-actions">
        <button type="button" className="button secondary" onClick={onCancel}>
          Abbrechen
        </button>
        <button type="submit" className="button primary" disabled={!trimmed || duplicate}>
          Anlegen
        </button>
      </div>
    </form>
  )
}
