import { useEffect, useRef, useState } from 'react'
import { CalendarDays, Dumbbell, ListChecks, Settings, TrendingUp, type LucideIcon } from 'lucide-react'
import { HistoryTab } from './screens/HistoryTab'
import { PlansTab } from './screens/PlansTab'
import { SettingsSheet } from './screens/SettingsSheet'
import { TrainingStart } from './screens/TrainingTab'
import { WorkoutScreen } from './screens/WorkoutScreen'
import { StoreProvider, useStore } from './store'
import { playRestEnd } from './sound'
import { stopRest } from '../core/workout'

type TabId = 'training' | 'plans' | 'history' | 'progress'

const TABS: { id: TabId; label: string; Icon: LucideIcon }[] = [
  { id: 'training', label: 'Training', Icon: Dumbbell },
  { id: 'plans', label: 'Pläne', Icon: ListChecks },
  { id: 'history', label: 'Verlauf', Icon: CalendarDays },
  { id: 'progress', label: 'Fortschritt', Icon: TrendingUp },
]

const today = new Intl.DateTimeFormat('de-DE', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date())

export default function App() {
  return (
    <StoreProvider>
      <Shell />
    </StoreProvider>
  )
}

/**
 * Beendet die Pause, wenn die Zeit um ist, und spielt einmal den Ton.
 * Läuft unabhängig vom offenen Tab. War die App im Hintergrund, wird die Pause still beendet.
 */
function useRestEnd() {
  const { active, updateActive, data } = useStore()
  const endsAt = active?.rest?.endsAt
  const sound = data.settings.restSound
  const played = useRef<number | null>(null)

  useEffect(() => {
    if (!endsAt) return
    const fire = () => {
      if (played.current === endsAt) return
      played.current = endsAt
      const late = Date.now() - endsAt > 5000
      if (sound && !late && document.visibilityState === 'visible') playRestEnd()
      updateActive((w) => (w.rest?.endsAt === endsAt ? stopRest(w) : w))
    }
    const wait = endsAt - Date.now()
    if (wait <= 0) {
      fire()
      return
    }
    const id = setTimeout(fire, wait)
    const onVisible = () => {
      if (document.visibilityState === 'visible' && Date.now() >= endsAt) fire()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      clearTimeout(id)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [endsAt, sound, updateActive])
}

function Shell() {
  const { active, notice, dismissNotice } = useStore()
  useRestEnd()
  const [tab, setTab] = useState<TabId>('training')
  const [settings, setSettings] = useState(false)
  const current = TABS.find((t) => t.id === tab)!
  const showWorkout = tab === 'training' && active

  return (
    <div className="app">
      <div className="backdrop" aria-hidden="true">
        <span />
      </div>

      {notice && (
        <div className="notice glass" role="alert">
          <p>{notice}</p>
          <button className="text-button strong" onClick={dismissNotice}>
            OK
          </button>
        </div>
      )}

      {showWorkout ? (
        <WorkoutScreen workout={active} />
      ) : (
        <main className="screen">
          <header className="screen-header">
            <div>
              <p className="eyebrow">{today}</p>
              <h1 className="page-title">{current.label}</h1>
            </div>
            <button className="round-button glass" aria-label="Einstellungen" onClick={() => setSettings(true)}>
              <Settings strokeWidth={2} />
            </button>
          </header>

          {tab === 'training' && <TrainingStart onOpenHistory={() => setTab('history')} onOpenPlans={() => setTab('plans')} />}
          {tab === 'history' && <HistoryTab />}
          {tab === 'plans' && <PlansTab />}
          {tab === 'progress' && (
            <ComingSoon text="Wochenübersicht, Gesamtkraft und Bestwerte kommen in Schritt 9." />
          )}
        </main>
      )}

      <nav className="dock glass" role="tablist" aria-label="Bereiche">
        {TABS.map(({ id, label, Icon }) => (
          <button key={id} className="dock-item" role="tab" aria-selected={id === tab} onClick={() => setTab(id)}>
            <Icon strokeWidth={id === tab ? 2.3 : 2} />
            <span>{label}</span>
            {id === 'training' && active && id !== tab && <span className="dock-badge" aria-label="Training läuft" />}
          </button>
        ))}
      </nav>

      <SettingsSheet open={settings} onClose={() => setSettings(false)} />
    </div>
  )
}

function ComingSoon({ text }: { text: string }) {
  return (
    <section className="card glass">
      <h2 className="card-title">Bald verfügbar</h2>
      <p className="card-text">{text}</p>
    </section>
  )
}
