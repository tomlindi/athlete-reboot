import { useEffect, useState } from 'react'
import { Pause, Play, Plus } from 'lucide-react'
import {
  elapsedMs,
  formatPace,
  lastSport,
  pauseCardio,
  resumeCardio,
  setSport,
  SPORT_LABEL,
  SPORTS,
  type CardioInput,
} from '../../core/cardio'
import { dateKey, formatClock } from '../../core/dates'
import { parseNumber } from '../../core/workout'
import type { Sport, Workout } from '../../core/types'
import { Segmented } from '../components/Segmented'
import { Sheet } from '../components/Sheet'
import { useStore } from '../store'

const SPORT_OPTIONS = SPORTS.map((s) => ({ value: s, label: SPORT_LABEL[s] }))

/** Karte im Training-Tab: Stoppuhr starten oder Einheit nachträglich eintragen. */
export function CardioCard() {
  const { data, startCardio, active } = useStore()
  const [adding, setAdding] = useState(false)

  return (
    <section className="card glass cardio-card">
      <h2 className="card-title">Ausdauer</h2>
      <p className="card-text">Laufen, Rad oder Schwimmen: mit Stoppuhr mitlaufen lassen oder danach eintragen.</p>
      <div className="form-actions">
        <button className="button cardio small" disabled={!!active} onClick={() => startCardio(lastSport(data.workouts))}>
          <Play strokeWidth={2.4} aria-hidden="true" />
          Stoppuhr
        </button>
        <button className="button secondary small" onClick={() => setAdding(true)}>
          <Plus strokeWidth={2.4} aria-hidden="true" />
          Eintragen
        </button>
      </div>
      <CardioSheet open={adding} onClose={() => setAdding(false)} />
    </section>
  )
}

function useNow(intervalMs: number) {
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs)
    return () => clearInterval(id)
  }, [intervalMs])
  return now
}

/** Laufende Stoppuhr. Die Kopfleiste bleibt beim Scrollen oben, wie im Gym-Training. */
export function CardioScreen({ workout }: { workout: Workout }) {
  const { updateActive } = useStore()
  const [finishing, setFinishing] = useState(false)
  // Wer beim Beenden-Fenster „Zurück“ tippt, soll so weitermachen wie vorher (laufend oder pausiert)
  const [resumeOnBack, setResumeOnBack] = useState(false)
  const now = useNow(500)
  const paused = workout.cardio?.pausedAt !== undefined
  const ms = elapsedMs(workout, now)
  const sport = workout.cardio?.sport ?? 'laufen'

  return (
    <>
      <header className="workout-head glass">
        <div className="workout-head-text">
          <h1 className="workout-title">{SPORT_LABEL[sport]}</h1>
          <p className="workout-clock">{paused ? 'Pausiert' : 'Läuft'}</p>
        </div>
        <button
          className="button primary small"
          onClick={() => {
            setResumeOnBack(!paused)
            updateActive((w) => pauseCardio(w))
            setFinishing(true)
          }}
        >
          Beenden
        </button>
      </header>

      <main className="screen workout-body">
        <Segmented label="Sportart" value={sport} onChange={(s) => updateActive((w) => setSport(w, s))} options={SPORT_OPTIONS} />
        <section className="card glass cardio-stopwatch">
          <p className={`cardio-time ${paused ? 'paused' : ''}`} role="timer" aria-live="off">
            {formatClock(ms)}
          </p>
          <button
            className={`button wide ${paused ? 'cardio' : 'secondary'}`}
            onClick={() => updateActive((w) => (paused ? resumeCardio(w) : pauseCardio(w)))}
          >
            {paused ? <Play strokeWidth={2.4} aria-hidden="true" /> : <Pause strokeWidth={2.4} aria-hidden="true" />}
            {paused ? 'Weiter' : 'Pause'}
          </button>
        </section>
        <p className="hint">Die Stoppuhr läuft weiter, auch wenn du die App schließt. Strecke, Anstrengung und Puls trägst du beim Beenden ein.</p>
      </main>

      <CardioSheet
        open={finishing}
        finishing={{ sport, durationSec: Math.round(ms / 1000) }}
        onClose={() => {
          if (resumeOnBack) updateActive((w) => resumeCardio(w))
          setFinishing(false)
        }}
        onDone={() => setFinishing(false)}
      />
    </>
  )
}

/**
 * Fenster zum Eintragen. Ohne `finishing` wird eine neue Einheit nachträglich gespeichert,
 * mit `finishing` wird die laufende Stoppuhr beendet (Dauer schon eingetragen, kein Datum).
 */
function CardioSheet({
  open,
  finishing,
  onClose,
  onDone,
}: {
  open: boolean
  finishing?: { sport: Sport; durationSec: number }
  onClose: () => void
  onDone?: () => void
}) {
  const { addCardio, finishCardio, discardActive, data } = useStore()
  const [sport, setSportState] = useState<Sport>('laufen')
  const [date, setDate] = useState(dateKey(new Date()))
  const [min, setMin] = useState('')
  const [sec, setSec] = useState('')
  const [dist, setDist] = useState('')
  const [rpe, setRpe] = useState<number | null>(null)
  const [hr, setHr] = useState('')
  const [confirmDiscard, setConfirmDiscard] = useState(false)

  // Beim Öffnen vorbelegen: Stoppuhr-Werte oder zuletzt genutzte Sportart
  useEffect(() => {
    if (!open) return
    setSportState(finishing?.sport ?? lastSport(data.workouts))
    setDate(dateKey(new Date()))
    setMin(finishing ? String(Math.floor(finishing.durationSec / 60)) : '')
    setSec(finishing ? String(finishing.durationSec % 60) : '')
    setDist('')
    setRpe(null)
    setHr('')
    setConfirmDiscard(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const swim = sport === 'schwimmen'
  const durationSec = (parseNumber(min) ?? 0) * 60 + (parseNumber(sec) ?? 0)
  const distNum = parseNumber(dist)
  const distanceM = distNum ? (swim ? distNum : distNum * 1000) : undefined
  const pace = formatPace(sport, durationSec, distanceM)
  const canSave = durationSec > 0

  function save() {
    if (!canSave) return
    const input: CardioInput = { sport, durationSec, distanceM, rpe: rpe ?? undefined, avgHr: parseNumber(hr) ?? undefined }
    if (finishing) {
      finishCardio(input)
      onDone?.()
    } else {
      // Gewählter Tag mit der aktuellen Uhrzeit, minus Dauer: so endet die Einheit „jetzt“ bzw. am gewählten Tag
      const [y, m, d] = date.split('-').map(Number)
      const t = new Date()
      const start = new Date(y, m - 1, d, t.getHours(), t.getMinutes()).getTime() - durationSec * 1000
      addCardio(input, start)
      onClose()
    }
  }

  return (
    <Sheet open={open} title={finishing ? 'Einheit beenden' : 'Ausdauer eintragen'} onClose={onClose} closeLabel={finishing ? 'Zurück' : 'Abbrechen'}>
      <Segmented label="Sportart" value={sport} onChange={setSportState} options={SPORT_OPTIONS} />

      {!finishing && (
        <label className="field">
          <span>Datum</span>
          <input id="cardio-date" type="date" value={date} max={dateKey(new Date())} onChange={(e) => setDate(e.target.value)} />
        </label>
      )}

      <div className="field">
        <span>Dauer</span>
        <div className="cardio-inputs">
          <input id="cardio-min" aria-label="Dauer, Minuten" inputMode="numeric" value={min} onChange={(e) => setMin(e.target.value.replace(/[^0-9]/g, ''))} />
          <span className="unit">min</span>
          <input id="cardio-sec" aria-label="Dauer, Sekunden" inputMode="numeric" value={sec} onChange={(e) => setSec(e.target.value.replace(/[^0-9]/g, '').slice(0, 2))} />
          <span className="unit">s</span>
        </div>
      </div>

      <div className="field">
        <span>Distanz (optional)</span>
        <div className="cardio-inputs">
          <input
            id="cardio-dist"
            aria-label={swim ? 'Distanz in Metern' : 'Distanz in Kilometern'}
            inputMode={swim ? 'numeric' : 'decimal'}
            value={dist}
            onChange={(e) => setDist(e.target.value.replace(swim ? /[^0-9]/g : /[^0-9,.]/g, ''))}
          />
          <span className="unit">{swim ? 'm' : 'km'}</span>
          {pace && <span className="cardio-pace">{pace}</span>}
        </div>
      </div>

      <div className="field">
        <span>Anstrengung (optional)</span>
        <div className="rpe-row" role="radiogroup" aria-label="Anstrengung von 1 bis 10">
          {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
            <button key={n} role="radio" aria-checked={rpe === n} className={`rpe ${rpe === n ? 'on' : ''}`} onClick={() => setRpe(rpe === n ? null : n)}>
              {n}
            </button>
          ))}
        </div>
        <p className="hint">1 = ganz locker, 10 = maximal</p>
      </div>

      <div className="field">
        <span>Puls Ø (optional)</span>
        <div className="cardio-inputs">
          <input id="cardio-hr" aria-label="Durchschnittspuls" inputMode="numeric" value={hr} onChange={(e) => setHr(e.target.value.replace(/[^0-9]/g, '').slice(0, 3))} />
          <span className="unit">bpm</span>
        </div>
      </div>

      <button className="button primary wide" disabled={!canSave} onClick={save}>
        Speichern
      </button>

      {finishing &&
        (confirmDiscard ? (
          <div className="confirm">
            <p>Die ganze Einheit wird gelöscht. Das lässt sich nicht rückgängig machen.</p>
            <div className="form-actions">
              <button className="button secondary" onClick={() => setConfirmDiscard(false)}>
                Behalten
              </button>
              <button
                className="button destructive"
                onClick={() => {
                  discardActive()
                  onDone?.()
                }}
              >
                Verwerfen
              </button>
            </div>
          </div>
        ) : (
          <button className="text-button danger wide" onClick={() => setConfirmDiscard(true)}>
            Einheit verwerfen
          </button>
        ))}
    </Sheet>
  )
}
