import { useRef, useState } from 'react'
import { ClipboardCopy, Download } from 'lucide-react'
import { claudeInstructions, parsePlanImport, PlanImportError, type ImportPreview } from '../../core/planImport'
import { SPORT_LABEL } from '../../core/cardio'
import { Sheet } from '../components/Sheet'
import { useStore } from '../store'

/** Knopf im Pläne-Tab, öffnet das Import-Fenster. */
export function PlanImportButton() {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button className="text-button wide" onClick={() => setOpen(true)}>
        <Download strokeWidth={2} aria-hidden="true" /> Pläne importieren (z. B. von Claude)
      </button>
      <PlanImportSheet open={open} onClose={() => setOpen(false)} />
    </>
  )
}

/**
 * Pläne und Programme aus Text oder Datei übernehmen. Erst Vorschau, dann Import.
 * Nichts Bestehendes wird überschrieben.
 */
function PlanImportSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { data, importPlans } = useStore()
  const [text, setText] = useState('')
  const [preview, setPreview] = useState<ImportPreview | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [done, setDone] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  function close() {
    setText('')
    setPreview(null)
    setError(null)
    setCopied(false)
    setDone(null)
    onClose()
  }

  function check(t: string) {
    setDone(null)
    try {
      setPreview(parsePlanImport(t, data))
      setError(null)
    } catch (e) {
      setPreview(null)
      setError(e instanceof PlanImportError ? e.message : 'Der Plan konnte nicht gelesen werden.')
    }
  }

  async function copyInstructions() {
    try {
      await navigator.clipboard.writeText(claudeInstructions(data.exercises))
      setCopied(true)
    } catch {
      setError('Kopieren hat nicht geklappt. Erlaube den Zugriff auf die Zwischenablage oder versuche es noch einmal.')
    }
  }

  return (
    <Sheet open={open} title="Pläne importieren" onClose={close} closeLabel={done ? 'Fertig' : 'Abbrechen'}>
      {done ? (
        <section className="card glass">
          <h2 className="card-title">Importiert</h2>
          <p className="card-text">{done}</p>
        </section>
      ) : (
        <>
          <section className="import-steps">
            <p className="card-text">
              <strong>1.</strong> Anleitung kopieren und Claude in den Chat geben, zusammen mit deinem Wunsch, z. B. „8 Wochen Dunken, 3 Tage pro Woche“.
            </p>
            <button className="button secondary wide" onClick={copyInstructions}>
              <ClipboardCopy strokeWidth={2} aria-hidden="true" />
              {copied ? 'Anleitung kopiert' : 'Anleitung für Claude kopieren'}
            </button>
            <p className="card-text">
              <strong>2.</strong> Claudes Antwort hier einfügen oder als .json-Datei wählen.
            </p>
          </section>

          <label className="field">
            <span>Plan als Text</span>
            <textarea
              id="import-text"
              className="import-text"
              value={text}
              placeholder='{ "plans": [ … ], "programs": [ … ] }'
              onChange={(e) => {
                setText(e.target.value)
                setPreview(null)
                setError(null)
              }}
            />
          </label>

          <div className="form-actions">
            <button className="button secondary" onClick={() => fileRef.current?.click()}>
              Datei wählen
            </button>
            <button className="button primary" disabled={!text.trim()} onClick={() => check(text)}>
              Prüfen
            </button>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json,text/plain"
            hidden
            onChange={async (e) => {
              const f = e.target.files?.[0]
              e.target.value = ''
              if (!f) return
              const t = await f.text()
              setText(t)
              check(t)
            }}
          />

          {error && <p className="field-error">{error}</p>}

          {preview && (
            <>
              <section className="list-section">
                <h3 className="list-heading">Das kommt dazu</h3>
                <ul className="list inner">
                  {preview.plans.map((p) => (
                    <li key={p.id} className="list-row static two-line">
                      <span className={`rating-dot ${p.kind === 'cardio' ? 'cardio' : 'gym'}`} aria-hidden="true" />
                      <span className="row-main">
                        <span className="row-title">{p.name}</span>
                        <span className="row-sub">
                          {p.kind === 'cardio'
                            ? `Ausdauer · ${SPORT_LABEL[p.sport ?? 'laufen']} · ${p.blocks?.length ?? 0} Abschnitte`
                            : `Gym · ${p.exercises.length} Übungen`}
                        </span>
                      </span>
                    </li>
                  ))}
                  {preview.programs.map((p) => (
                    <li key={p.id} className="list-row static two-line">
                      <span className="rating-dot" aria-hidden="true" />
                      <span className="row-main">
                        <span className="row-title">{p.name}</span>
                        <span className="row-sub">
                          Programm · {p.weeks} Wochen · {p.days.length} Trainingstage
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
              {preview.newExercises.length > 0 && (
                <p className="hint">Neue eigene Übungen: {preview.newExercises.map((e) => e.name).join(', ')}.</p>
              )}
              {preview.warnings.length > 0 && (
                <ul className="import-warnings">
                  {preview.warnings.map((w, i) => (
                    <li key={i}>{w}</li>
                  ))}
                </ul>
              )}
              <button
                className="button primary wide"
                onClick={() => {
                  importPlans(preview)
                  const parts = [
                    preview.plans.length ? `${preview.plans.length} ${preview.plans.length === 1 ? 'Plan' : 'Pläne'}` : '',
                    preview.programs.length ? `${preview.programs.length} ${preview.programs.length === 1 ? 'Programm' : 'Programme'}` : '',
                  ].filter(Boolean)
                  setDone(`${parts.join(' und ')} hinzugefügt. Du findest sie im Pläne-Tab unter Gym, Ausdauer und Programme.`)
                  setPreview(null)
                  setText('')
                }}
              >
                Importieren
              </button>
            </>
          )}
        </>
      )}
    </Sheet>
  )
}
