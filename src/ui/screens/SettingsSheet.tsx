import { useMemo, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { backupFileName, BackupError, parseBackup } from '../../core/backup'
import { LifeDashboardImportError } from '../../core/lifeDashboard'
import { formatRest, REST_OPTIONS } from '../../core/plans'
import type { Background, Backup } from '../../core/types'
import { Sheet } from '../components/Sheet'
import { saveJsonFile } from '../../storage/files'
import { useStore } from '../store'
import { ExerciseForm, groupExercises } from './ExercisePicker'

type Page = 'main' | 'exercises'

const BACKGROUNDS: { value: Background; label: string; sub: string }[] = [
  { value: 'ruhig', label: 'Ganz ruhig', sub: 'Kein Farbschimmer' },
  { value: 'blau-lila', label: 'Blau und Lila', sub: 'Passend zum Akzent' },
  { value: 'logo', label: 'Wie das Logo', sub: 'Himbeer und Lila' },
  { value: 'hauch', label: 'Blau mit Himbeer-Hauch', sub: 'Leiser Bezug zum Logo' },
]

export function SettingsSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [page, setPage] = useState<Page>('main')

  function close() {
    setPage('main')
    onClose()
  }

  return (
    <Sheet
      open={open}
      title={page === 'main' ? 'Einstellungen' : 'Übungen'}
      onClose={close}
      leading={
        page !== 'main' && (
          <button className="text-button back" onClick={() => setPage('main')}>
            <ChevronLeft strokeWidth={2} aria-hidden="true" />
            Zurück
          </button>
        )
      }
    >
      {page === 'main' ? <MainPage onExercises={() => setPage('exercises')} /> : <ExercisesPage />}
    </Sheet>
  )
}

function MainPage({ onExercises }: { onExercises: () => void }) {
  const { data, setBackground, updateSettings } = useStore()
  const visibleCount = data.exercises.filter((e) => !e.hidden).length

  return (
    <>
      <section className="list-section">
        <h3 className="list-heading">Hintergrund</h3>
        <ul className="list inner" role="radiogroup" aria-label="Hintergrund">
          {BACKGROUNDS.map((b) => (
            <li key={b.value}>
              <button
                className="list-row two-line"
                role="radio"
                aria-checked={data.settings.background === b.value}
                onClick={() => setBackground(b.value)}
              >
                <span className={`bg-swatch ${b.value}`} aria-hidden="true" />
                <span className="row-main">
                  <span className="row-title">{b.label}</span>
                  <span className="row-sub">{b.sub}</span>
                </span>
                {data.settings.background === b.value && <span className="row-check" aria-hidden="true" />}
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section className="list-section">
        <h3 className="list-heading">Training</h3>
        <ul className="list inner">
          <li className="list-row static">
            <label className="row-main" htmlFor="default-rest">
              Standard-Pause
              <span className="row-sub">Für Übungen ohne Plan-Vorgabe</span>
            </label>
            <select
              id="default-rest"
              className="rest-select compact"
              value={data.settings.defaultRestSec}
              onChange={(e) => updateSettings({ defaultRestSec: Number(e.target.value) })}
            >
              {REST_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {formatRest(s)}
                </option>
              ))}
            </select>
          </li>
          <li className="list-row static">
            <label className="row-main" htmlFor="rest-sound">
              Ton am Pausenende
              <span className="row-sub">Nur solange die App geöffnet ist</span>
            </label>
            <span className="switch">
              <input
                type="checkbox"
                id="rest-sound"
                checked={data.settings.restSound}
                onChange={(e) => updateSettings({ restSound: e.target.checked })}
              />
              <span className="switch-track" aria-hidden="true" />
            </span>
          </li>
          <li>
            <button className="list-row" onClick={onExercises}>
              <span className="row-main">Übungen</span>
              <span className="row-meta">{visibleCount} aktiv</span>
              <ChevronRight className="chevron" strokeWidth={2} aria-hidden="true" />
            </button>
          </li>
        </ul>
      </section>

      <LifeDashboardSection />

      <BackupSection />

      <p className="hint center">Athlete Reboot · Version {__APP_VERSION__.replace(/\.0$/, '')}</p>
    </>
  )
}

function ExercisesPage() {
  const { data, setExerciseHidden } = useStore()
  const [query, setQuery] = useState('')
  const [creating, setCreating] = useState(false)
  const groups = useMemo(() => groupExercises(data.exercises, query), [data.exercises, query])

  return (
    <>
      <input
        id="settings-exercise-search"
        className="search"
        type="search"
        placeholder="Übung suchen"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        autoComplete="off"
      />
      {creating ? (
        <ExerciseForm initialName={query} onCancel={() => setCreating(false)} onCreated={() => setCreating(false)} />
      ) : (
        <button className="list-action" onClick={() => setCreating(true)}>
          + Eigene Übung anlegen
        </button>
      )}
      <p className="hint">Ausgeblendete Übungen erscheinen nicht mehr in der Auswahl. Dein Verlauf bleibt erhalten.</p>

      {groups.map(({ group, items }) => (
        <section key={group} className="list-section">
          <h3 className="list-heading">{group}</h3>
          <ul className="list inner">
            {items.map((e) => (
              <li key={e.id} className="list-row static">
                <span className={`row-main ${e.hidden ? 'muted' : ''}`}>
                  {e.name}
                  {e.custom && <span className="row-meta inline">Eigene</span>}
                </span>
                <label className="switch">
                  <input
                    type="checkbox"
                    id={`ex-visible-${e.id}`}
                    checked={!e.hidden}
                    onChange={(ev) => setExerciseHidden(e.id, !ev.target.checked)}
                    aria-label={`${e.name} in der Auswahl zeigen`}
                  />
                  <span className="switch-track" aria-hidden="true" />
                </label>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </>
  )
}

function LifeDashboardSection() {
  const { importLifeDashboard } = useStore()
  const fileInput = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null)

  async function onFile(file: File | undefined) {
    setMessage(null)
    if (!file) return
    setBusy(true)
    try {
      const r = await importLifeDashboard(await file.text())
      const n = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`
      const parts = [
        n(r.newWorkouts, 'Training', 'Trainings'),
        n(r.newPlans, 'neuer Plan', 'neue Pläne'),
        r.newExercises ? n(r.newExercises, 'neue Übung', 'neue Übungen') : '',
      ].filter(Boolean)
      const extra = [
        r.skippedWorkouts ? `${n(r.skippedWorkouts, 'Training war', 'Trainings waren')} schon da.` : '',
        r.skippedWarmups ? `${n(r.skippedWarmups, 'Aufwärmsatz wurde', 'Aufwärmsätze wurden')} weggelassen.` : '',
      ].filter(Boolean)
      setMessage({ kind: 'ok', text: `Übernommen: ${parts.join(', ')}. ${extra.join(' ')}`.trim() })
    } catch (err) {
      setMessage({
        kind: 'error',
        text: err instanceof LifeDashboardImportError ? err.message : 'Der Import hat nicht geklappt. Deine bisherigen Daten sind unverändert.',
      })
    } finally {
      setBusy(false)
      if (fileInput.current) fileInput.current.value = ''
    }
  }

  return (
    <section className="list-section">
      <h3 className="list-heading">Aus Life Dashboard übernehmen</h3>
      <p className="hint">
        Im Life Dashboard unter Fitness → Gym die „JSON-Datei“ exportieren und hier auswählen. Pläne und Trainings kommen dazu, nichts wird gelöscht. Doppelte Trainings werden übersprungen.
      </p>
      <ul className="list inner">
        <li>
          <button className="list-row" disabled={busy} onClick={() => fileInput.current?.click()}>
            <span className="row-main accent">{busy ? 'Wird übernommen …' : 'Gym-Export auswählen'}</span>
          </button>
        </li>
      </ul>
      <input
        ref={fileInput}
        id="lifedashboard-file"
        type="file"
        accept="application/json,.json"
        hidden
        onChange={(e) => onFile(e.target.files?.[0])}
      />
      {message && <p className={message.kind === 'ok' ? 'ok-text' : 'field-error'}>{message.text}</p>}
    </section>
  )
}

function BackupSection() {
  const { data, exportBackup, importBackup } = useStore()
  const fileInput = useRef<HTMLInputElement>(null)
  const [pending, setPending] = useState<{ text: string; backup: Backup } | null>(null)
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null)
  const finishedCount = data.workouts.filter((w) => w.endedAt !== undefined).length

  async function doExport() {
    setMessage(null)
    const result = await saveJsonFile(backupFileName(), exportBackup())
    if (result === 'downloaded') setMessage({ kind: 'ok', text: 'Backup wurde heruntergeladen.' })
    if (result === 'shared') setMessage({ kind: 'ok', text: 'Backup wurde gespeichert.' })
  }

  async function onFile(file: File | undefined) {
    setMessage(null)
    if (!file) return
    try {
      const text = await file.text()
      setPending({ text, backup: parseBackup(text) })
    } catch (err) {
      setMessage({ kind: 'error', text: err instanceof BackupError ? err.message : 'Die Datei konnte nicht gelesen werden.' })
    } finally {
      if (fileInput.current) fileInput.current.value = ''
    }
  }

  async function confirmImport() {
    if (!pending) return
    try {
      const b = await importBackup(pending.text)
      setMessage({ kind: 'ok', text: `Backup wiederhergestellt: ${b.workouts.length} Trainings.` })
    } catch (err) {
      setMessage({ kind: 'error', text: err instanceof BackupError ? err.message : 'Wiederherstellen hat nicht geklappt. Deine bisherigen Daten sind unverändert.' })
    }
    setPending(null)
  }

  return (
    <section className="list-section">
      <h3 className="list-heading">Backup</h3>
      <p className="hint">Deine Daten liegen nur auf diesem Gerät. Sichere regelmäßig ein Backup, zum Beispiel in der Dateien-App.</p>
      <ul className="list inner">
        <li>
          <button className="list-row" onClick={doExport}>
            <span className="row-main accent">Backup exportieren</span>
            <span className="row-meta">{finishedCount} Trainings</span>
          </button>
        </li>
        <li>
          <button className="list-row" onClick={() => fileInput.current?.click()}>
            <span className="row-main accent">Backup importieren</span>
          </button>
        </li>
      </ul>
      <input
        ref={fileInput}
        id="backup-file"
        type="file"
        accept="application/json,.json"
        hidden
        onChange={(e) => onFile(e.target.files?.[0])}
      />

      {pending && (
        <div className="confirm">
          <p>
            Das Backup vom {pending.backup.exportedAt ? new Date(pending.backup.exportedAt).toLocaleDateString('de-DE') : 'unbekannten Datum'} enthält{' '}
            {pending.backup.workouts.length} Trainings. Es ersetzt alle Daten auf diesem Gerät.
          </p>
          <div className="form-actions">
            <button className="button secondary" onClick={() => setPending(null)}>
              Abbrechen
            </button>
            <button className="button destructive" onClick={confirmImport}>
              Ersetzen
            </button>
          </div>
        </div>
      )}

      {message && <p className={message.kind === 'ok' ? 'ok-text' : 'field-error'}>{message.text}</p>}
    </section>
  )
}
