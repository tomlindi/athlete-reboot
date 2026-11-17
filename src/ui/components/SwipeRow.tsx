import { useRef, useState, type ReactNode, type PointerEvent } from 'react'

// Zeile mit Wischgesten wie in iOS:
//   nach rechts wischen = Aktion links (bei uns: Muskelversagen)
//   nach links wischen  = roter Löschen-Knopf erscheint

const RIGHT_TRIGGER = 72
const DELETE_WIDTH = 84

export function SwipeRow({
  children,
  className = '',
  onSwipeRight,
  swipeRightLabel,
  onDelete,
}: {
  children: ReactNode
  className?: string
  onSwipeRight: () => void
  swipeRightLabel: string
  onDelete: () => void
}) {
  const [offset, setOffset] = useState(0)
  const [open, setOpen] = useState(false)
  const start = useRef<{ x: number; y: number; base: number; active: boolean | null } | null>(null)
  // Nach einer Wischbewegung feuert der Browser noch einen Klick. Den schlucken wir,
  // sonst schließt sich die Zeile sofort wieder oder der Haken springt um.
  const justSwiped = useRef(false)

  // Beginnt die Geste auf einem Eingabefeld, würde der Browser Text markieren statt zu wischen.
  // Deshalb fokussieren wir das Feld erst beim Loslassen, und nur wenn nicht gewischt wurde.
  const pendingFocus = useRef<HTMLInputElement | null>(null)

  function onPointerDown(e: PointerEvent) {
    if (e.pointerType === 'mouse' && e.button !== 0) return
    justSwiped.current = false
    pendingFocus.current = null
    const target = e.target as HTMLElement
    if (target instanceof HTMLInputElement && document.activeElement !== target) {
      e.preventDefault()
      pendingFocus.current = target
    }
    start.current = { x: e.clientX, y: e.clientY, base: open ? -DELETE_WIDTH : 0, active: null }
  }

  function onPointerMove(e: PointerEvent) {
    const s = start.current
    if (!s) return
    const dx = e.clientX - s.x
    const dy = e.clientY - s.y
    if (s.active === null) {
      if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return
      // Nur waagerechte Bewegungen sind Wischen, senkrechte bleiben Scrollen
      s.active = Math.abs(dx) > Math.abs(dy)
      if (s.active) (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    }
    if (!s.active) return
    const next = Math.max(-DELETE_WIDTH * 1.4, Math.min(RIGHT_TRIGGER * 1.4, s.base + dx))
    setOffset(next)
  }

  function onPointerUp() {
    const s = start.current
    start.current = null
    const focusTarget = pendingFocus.current
    pendingFocus.current = null
    if (!s?.active) {
      if (focusTarget && !open) focusTarget.focus()
      return
    }
    justSwiped.current = true
    if (offset >= RIGHT_TRIGGER) {
      onSwipeRight()
      setOpen(false)
    } else if (offset <= -DELETE_WIDTH / 2) {
      setOpen(true)
      setOffset(-DELETE_WIDTH)
      return
    } else {
      setOpen(false)
    }
    setOffset(0)
  }

  const shown = start.current?.active ? offset : open ? -DELETE_WIDTH : 0

  return (
    <div className={`swipe ${shown !== 0 ? 'moving' : ''} ${className}`}>
      <div className="swipe-under left" aria-hidden={shown <= 0} style={{ opacity: shown > 0 ? Math.min(1, shown / RIGHT_TRIGGER) : 0 }}>
        {swipeRightLabel}
      </div>
      <button
        className="swipe-under right"
        tabIndex={open ? 0 : -1}
        aria-hidden={!open}
        style={{ opacity: shown < 0 ? 1 : 0 }}
        onClick={() => {
          setOpen(false)
          onDelete()
        }}
      >
        Löschen
      </button>
      <div
        className="swipe-content"
        style={{ transform: `translateX(${shown}px)`, transition: start.current?.active ? 'none' : undefined }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onClickCapture={(e) => {
          if (justSwiped.current) {
            justSwiped.current = false
            e.stopPropagation()
            e.preventDefault()
            return
          }
          // Tippen auf eine offene Zeile schließt sie, statt etwas auszulösen
          if (open) {
            e.stopPropagation()
            e.preventDefault()
            setOpen(false)
          }
        }}
      >
        {children}
      </div>
    </div>
  )
}
