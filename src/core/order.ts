// Reihenfolge ändern, z. B. nach dem Ziehen einer Zeile. Reine Funktionen.

/** Verschiebt das Element an Position `from` nach `to`. Ungültige Positionen ändern nichts. */
export function moveItem<T>(list: readonly T[], from: number, to: number): T[] {
  if (from === to || from < 0 || to < 0 || from >= list.length || to >= list.length) return [...list]
  const out = [...list]
  const [item] = out.splice(from, 1)
  out.splice(to, 0, item)
  return out
}

/**
 * Zielposition beim Ziehen: Die Mitte des gezogenen Elements wird mit den Mitten der anderen verglichen.
 * `tops`/`heights` sind die Positionen vor dem Ziehen, `dy` die bisherige Verschiebung.
 */
export function dropIndex(tops: number[], heights: number[], from: number, dy: number): number {
  const center = tops[from] + heights[from] / 2 + dy
  let to = from
  for (let i = 0; i < tops.length; i++) {
    if (i === from) continue
    const mid = tops[i] + heights[i] / 2
    if (i < from && center < mid) to = Math.min(to, i)
    if (i > from && center > mid) to = Math.max(to, i)
  }
  return to
}
