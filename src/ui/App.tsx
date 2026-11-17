import { useState } from 'react'
import { CalendarDays, Dumbbell, ListChecks, Settings, TrendingUp, type LucideIcon } from 'lucide-react'

type TabId = 'training' | 'plans' | 'history' | 'progress'

type Tab = {
  id: TabId
  label: string
  Icon: LucideIcon
  // Vorläufiger Hinweis, bis der Bildschirm gebaut ist
  comingIn: string
}

const TABS: Tab[] = [
  { id: 'training', label: 'Training', Icon: Dumbbell, comingIn: 'Kommt in Schritt 6: Training starten und Sätze eintragen.' },
  { id: 'plans', label: 'Pläne', Icon: ListChecks, comingIn: 'Kommt in Schritt 7: eigene Trainingspläne.' },
  { id: 'history', label: 'Verlauf', Icon: CalendarDays, comingIn: 'Kommt in Schritt 6: Liste und Kalender deiner Trainings.' },
  { id: 'progress', label: 'Fortschritt', Icon: TrendingUp, comingIn: 'Kommt in Schritt 9: Wochenübersicht, Gesamtkraft und Bestwerte.' },
]

const today = new Intl.DateTimeFormat('de-DE', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date())

export default function App() {
  const [active, setActive] = useState<TabId>('training')
  const tab = TABS.find((t) => t.id === active)!

  return (
    <div className="app">
      <div className="backdrop" aria-hidden="true">
        <span />
      </div>

      <main className="screen">
        <header className="screen-header">
          <div>
            <p className="eyebrow">{today}</p>
            <h1 className="page-title">{tab.label}</h1>
          </div>
          <button className="round-button glass" aria-label="Einstellungen">
            <Settings strokeWidth={2} />
          </button>
        </header>

        <section className="card glass">
          <h2 className="card-title">Bald verfügbar</h2>
          <p className="card-text">{tab.comingIn}</p>
        </section>
      </main>

      <nav className="dock glass" role="tablist" aria-label="Bereiche">
        {TABS.map(({ id, label, Icon }) => (
          <button
            key={id}
            className="dock-item"
            role="tab"
            aria-selected={id === active}
            onClick={() => setActive(id)}
          >
            <Icon strokeWidth={id === active ? 2.3 : 2} />
            <span>{label}</span>
          </button>
        ))}
      </nav>
    </div>
  )
}
