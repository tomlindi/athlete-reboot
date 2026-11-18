import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent, type ReactNode } from 'react'
import { GripVertical } from 'lucide-react'
import { dropIndex } from '../../core/order'

// Liste, deren Reihenfolge sich per Ziehen am Griff (≡) ändern lässt: Finger, Maus oder Pfeiltasten.
// Während des Ziehens rücken die anderen Zeilen zur Seite; am Rand scrollt die Liste mit.

interface Drag {
  from: number
  to: number
  dy: number
  tops: number[]
  heights: number[]
  shift: number
}

export interface HandleProps {
  label: string
  onPointerDown: (e: PointerEvent<HTMLButtonElement>) => void
  onPointerMove: (e: PointerEvent<HTMLButtonElement>) => void
  onPointerUp: (e: PointerEvent<HTMLButtonElement>) => void
  onPointerCancel: (e: PointerEvent<HTMLButtonElement>) => void
  onKeyDown: (e: KeyboardEvent<HTMLButtonElement>) => void
}

/** Griff zum Ziehen. Pfeiltasten verschieben um eine Position. */
export function DragHandle({ label, ...handlers }: HandleProps) {
  return (
    <button type="button" className="drag-handle" aria-label={`${label} verschieben`} title="Ziehen zum Verschieben" {...handlers}>
      <GripVertical strokeWidth={2} aria-hidden="true" />
    </button>
  )
}

function scrollParent(el: HTMLElement | null): HTMLElement | null {
  for (let p = el?.parentElement; p; p = p.parentElement) {
    const o = getComputedStyle(p).overflowY
    if ((o === 'auto' || o === 'scroll') && p.scrollHeight > p.clientHeight) return p
  }
  return null
}

export function Sortable<T extends { id: string }>({
  items,
  onMove,
  children,
  as: Container = 'div',
  itemAs: Item = 'div',
  className = '',
  itemClassName = '',
  label,
}: {
  items: T[]
  onMove: (from: number, to: number) => void
  children: (item: T, index: number, handle: HandleProps) => ReactNode
  as?: 'div' | 'ul'
  itemAs?: 'div' | 'li'
  className?: string
  itemClassName?: string
  /** Name eines Elements für Bildschirmleser, z. B. der Übungsname */
  label: (item: T) => string
}) {
  const refs = useRef(new Map<string, HTMLElement>())
  const [drag, setDrag] = useState<Drag | null>(null)
  const live = useRef<{ startY: number; lastY: number; scroller: HTMLElement | null; startScroll: number; raf: number } | null>(null)
  const dragRef = useRef<Drag | null>(null)
  dragRef.current = drag

  const scrollTop = (s: HTMLElement | null) => (s ? s.scrollTop : window.scrollY)

  function update(clientY: number) {
    const l = live.current
    const d = dragRef.current
    if (!l || !d) return
    l.lastY = clientY
    const dy = clientY - l.startY + (scrollTop(l.scroller) - l.startScroll)
    const to = dropIndex(d.tops, d.heights, d.from, dy)
    setDrag({ ...d, dy, to })
  }

  // Am oberen/unteren Rand mitscrollen, solange gezogen wird
  useEffect(() => {
    if (!drag || !live.current) return
    const l = live.current
    const tick = () => {
      // Ohne eigenen Scroll-Bereich zählt die Unterkante der festen Kopfleiste im Training als oberer Rand
      const head = document.querySelector('.workout-head')
      const top = l.scroller ? l.scroller.getBoundingClientRect().top : (head?.getBoundingClientRect().bottom ?? 0)
      const bottom = l.scroller ? l.scroller.getBoundingClientRect().bottom : window.innerHeight
      const edge = 72
      const speed = l.lastY < top + edge ? -10 : l.lastY > bottom - edge - 40 ? 10 : 0
      if (speed) {
        if (l.scroller) l.scroller.scrollTop += speed
        else window.scrollBy(0, speed)
        update(l.lastY)
      }
      l.raf = requestAnimationFrame(tick)
    }
    l.raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(l.raf)
    // Nur beim Start und Ende des Ziehens neu aufsetzen
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drag !== null])

  function handleFor(item: T, index: number): HandleProps {
    return {
      label: label(item),
      onPointerDown(e) {
        if (e.button !== 0) return
        e.preventDefault()
        e.currentTarget.setPointerCapture(e.pointerId)
        const els = items.map((it) => refs.current.get(it.id))
        if (els.some((x) => !x)) return
        const rects = els.map((x) => x!.getBoundingClientRect())
        const tops = rects.map((r) => r.top)
        const heights = rects.map((r) => r.height)
        const gap = rects.length > 1 ? Math.max(0, rects[1].top - rects[0].bottom) : 0
        const scroller = scrollParent(els[index]!)
        live.current = { startY: e.clientY, lastY: e.clientY, scroller, startScroll: scrollTop(scroller), raf: 0 }
        setDrag({ from: index, to: index, dy: 0, tops, heights, shift: heights[index] + gap })
      },
      onPointerMove(e) {
        if (dragRef.current) update(e.clientY)
      },
      onPointerUp() {
        const d = dragRef.current
        live.current = null
        setDrag(null)
        if (d && d.to !== d.from) onMove(d.from, d.to)
      },
      onPointerCancel() {
        live.current = null
        setDrag(null)
      },
      onKeyDown(e) {
        if (e.key === 'ArrowUp' && index > 0) {
          e.preventDefault()
          onMove(index, index - 1)
        } else if (e.key === 'ArrowDown' && index < items.length - 1) {
          e.preventDefault()
          onMove(index, index + 1)
        }
      },
    }
  }

  function styleFor(index: number): CSSProperties | undefined {
    if (!drag) return undefined
    if (index === drag.from) return { transform: `translateY(${drag.dy}px)`, transition: 'none' }
    if (drag.from < drag.to && index > drag.from && index <= drag.to) return { transform: `translateY(${-drag.shift}px)` }
    if (drag.to < drag.from && index >= drag.to && index < drag.from) return { transform: `translateY(${drag.shift}px)` }
    return undefined
  }

  return (
    <Container className={`sortable ${drag ? 'is-sorting' : ''} ${className}`}>
      {items.map((item, i) => (
        <Item
          key={item.id}
          ref={(el: HTMLElement | null) => {
            if (el) refs.current.set(item.id, el)
            else refs.current.delete(item.id)
          }}
          className={`sortable-item ${drag?.from === i ? 'dragging' : ''} ${itemClassName}`}
          style={styleFor(i)}
        >
          {children(item, i, handleFor(item, i))}
        </Item>
      ))}
    </Container>
  )
}
