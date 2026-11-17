import { useEffect, type ReactNode } from 'react'

// Fenster, das von unten hochfährt (iOS-Sheet), aus Glas.

export function Sheet({
  open,
  title,
  onClose,
  closeLabel = 'Fertig',
  leading,
  children,
}: {
  open: boolean
  title: string
  onClose: () => void
  closeLabel?: string
  leading?: ReactNode
  children: ReactNode
}) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    document.body.classList.add('sheet-open')
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.classList.remove('sheet-open')
    }
  }, [open, onClose])

  if (!open) return null
  return (
    <div className="sheet-layer" role="presentation">
      <div className="sheet-dim" onClick={onClose} />
      <section className="sheet glass" role="dialog" aria-modal="true" aria-label={title}>
        <header className="sheet-head">
          <div className="sheet-side">{leading}</div>
          <h2 className="sheet-title">{title}</h2>
          <div className="sheet-side end">
            <button className="text-button strong" onClick={onClose}>
              {closeLabel}
            </button>
          </div>
        </header>
        <div className="sheet-body">{children}</div>
      </section>
    </div>
  )
}
