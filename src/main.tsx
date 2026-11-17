import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './ui/App'
// Ersatzschrift für Geräte ohne Apple-Schrift (z. B. Windows), wird mitgeliefert und funktioniert offline
import '@fontsource-variable/inter'
import './theme.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
