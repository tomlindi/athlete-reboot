import { useState, type ComponentType } from 'react'
import { GearIcon, HistoryIcon, PlansIcon, ProgressIcon, TrainingIcon } from './icons'

type TabId = 'training' | 'plans' | 'history' | 'progress'

type Tab = {
  id: TabId
  label: string
  Icon: ComponentType<{ className?: string }>
  // Vorläufiger Hinweis, bis der Bildschirm gebaut ist
  comingIn: string
}

const TABS: Tab[] = [
  { id: 'training', label: 'Training', Icon: TrainingIcon, comingIn: 'Kommt in Schritt 6: Training starten und Sätze eintragen.' },
  { id: 'plans', label: 'Pläne', Icon: PlansIcon, comingIn: 'Kommt in Schritt 7: eigene Trainingspläne.' },
  { id: 'history', label: 'Verlauf', Icon: HistoryIcon, comingIn: 'Kommt in Schritt 6: Liste und Kalender deiner Trainings.' },
  { id: 'progress', label: 'Fortschritt', Icon: ProgressIcon, comingIn: 'Kommt in Schritt 9: Wochenübersicht, Gesamtkraft und Bestwerte.' },
]

export default function App() {
  const [active, setActive] = useState<TabId>('training')
  const tab = TABS.find((t) => t.id === active)!

  return (
    <div className="app">
      <main className="screen">
        <header className="screen-header">
          <h1 className="large-title">{tab.label}</h1>
          <button className="icon-button" aria-label="Einstellungen">
            <GearIcon />
          </button>
        </header>

        <section className="card">
          <p className="placeholder" style={{ margin: 0 }}>
            {tab.comingIn}
          </p>
        </section>
      </main>

      <nav className="tab-bar" role="tablist">
        {TABS.map(({ id, label, Icon }) => (
          <button
            key={id}
            className="tab"
            role="tab"
            aria-selected={id === active}
            onClick={() => setActive(id)}
          >
            <Icon />
            <span>{label}</span>
          </button>
        ))}
      </nav>
    </div>
  )
}
