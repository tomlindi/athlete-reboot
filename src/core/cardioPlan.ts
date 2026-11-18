import { elapsedMs, SPORT_LABEL } from './cardio'
import { newId } from './ids'
import { formatNumber } from './workout'
import type { Amount, CardioBlock, Phase, Plan, Sport, Workout } from './types'

// Ausdauer-Pläne: Abschnitte anlegen, beim Start in einzelne Phasen auflösen und
// während des Laufs durch die Phasen führen. Reine Funktionen.

export const isCardioPlan = (p: Plan) => p.kind === 'cardio'

export function createCardioPlan(name: string, sport: Sport, order = 0): Plan {
  return {
    id: newId(),
    name: name.trim(),
    kind: 'cardio',
    sport,
    order,
    exercises: [],
    blocks: [
      { id: newId(), label: 'Aufwärmen', amount: { unit: 'time', value: 600 } },
      { id: newId(), label: 'Schnell', amount: { unit: 'time', value: 60 }, repeat: 6, rest: { unit: 'time', value: 90 }, restLabel: 'Locker' },
      { id: newId(), label: 'Auslaufen', amount: { unit: 'time', value: 300 } },
    ],
  }
}

export function newBlock(): CardioBlock {
  return { id: newId(), label: 'Locker', amount: { unit: 'time', value: 600 } }
}

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, Math.round(n) || lo))

/** Hält Werte in sinnvollen Grenzen: 5 s bis 5 h, 10 m bis 100 km, 1–30 Wiederholungen. */
export function normalizeAmount(a: Amount): Amount {
  return a.unit === 'time' ? { unit: 'time', value: clamp(a.value, 5, 5 * 3600) } : { unit: 'distance', value: clamp(a.value, 10, 100_000) }
}

export function normalizeBlock(b: CardioBlock): CardioBlock {
  const repeat = clamp(b.repeat ?? 1, 1, 30)
  const out: CardioBlock = { id: b.id, label: b.label, amount: normalizeAmount(b.amount) }
  if (repeat > 1) {
    out.repeat = repeat
    out.rest = normalizeAmount(b.rest ?? { unit: 'time', value: 60 })
    out.restLabel = b.restLabel ?? 'Pause'
  }
  return out
}

export function updateBlock(plan: Plan, id: string, patch: Partial<CardioBlock>): Plan {
  return { ...plan, blocks: (plan.blocks ?? []).map((b) => (b.id === id ? normalizeBlock({ ...b, ...patch }) : b)) }
}

export function addBlock(plan: Plan, block: CardioBlock = newBlock()): Plan {
  return { ...plan, blocks: [...(plan.blocks ?? []), block] }
}

export function removeBlock(plan: Plan, id: string): Plan {
  return { ...plan, blocks: (plan.blocks ?? []).filter((b) => b.id !== id) }
}

export function moveBlock(plan: Plan, id: string, delta: -1 | 1): Plan {
  const list = [...(plan.blocks ?? [])]
  const i = list.findIndex((b) => b.id === id)
  const j = i + delta
  if (i < 0 || j < 0 || j >= list.length) return plan
  ;[list[i], list[j]] = [list[j], list[i]]
  return { ...plan, blocks: list }
}

/** Löst Wiederholungen auf: 6 × (Belastung + Pause), ohne Pause nach der letzten Belastung. */
export function expandBlocks(blocks: CardioBlock[]): Phase[] {
  const out: Phase[] = []
  for (const b of blocks) {
    const reps = b.repeat ?? 1
    if (reps <= 1) {
      out.push({ label: b.label, amount: b.amount, rest: false })
      continue
    }
    for (let i = 1; i <= reps; i++) {
      out.push({ label: b.label, amount: b.amount, rest: false, rep: i, reps })
      if (i < reps && b.rest) out.push({ label: b.restLabel ?? 'Pause', amount: b.rest, rest: true, rep: i, reps })
    }
  }
  return out
}

/** Startet einen Plan-Lauf: Stoppuhr mit Kopie der Phasen. */
export function startCardioPlan(plan: Plan, now = Date.now()): Workout {
  const sport = plan.sport ?? 'laufen'
  return {
    id: newId(),
    type: 'cardio',
    title: plan.name,
    startedAt: now,
    exercises: [],
    planId: plan.id,
    cardio: { sport, pausedMs: 0, phases: expandBlocks(plan.blocks ?? []), phaseIndex: 0, phaseStartMs: 0 },
  }
}

export function currentPhase(w: Workout): Phase | undefined {
  const c = w.cardio
  return c?.phases?.[c.phaseIndex ?? 0]
}

/** Bewegungszeit im aktuellen Abschnitt in ms. */
export function phaseElapsedMs(w: Workout, now = Date.now()): number {
  return Math.max(0, elapsedMs(w, now) - (w.cardio?.phaseStartMs ?? 0))
}

/** Zum nächsten Abschnitt („Weiter“). `atMs` = Bewegungszeit, zu der der neue Abschnitt beginnt. */
export function nextPhase(w: Workout, now = Date.now(), atMs = elapsedMs(w, now)): Workout {
  const c = w.cardio
  if (!c?.phases || (c.phaseIndex ?? 0) >= c.phases.length) return w
  return { ...w, cardio: { ...c, phaseIndex: (c.phaseIndex ?? 0) + 1, phaseStartMs: atMs } }
}

/**
 * Schaltet abgelaufene Zeit-Abschnitte automatisch weiter, auch mehrere auf einmal
 * (z. B. nach dem Öffnen der App). Strecken-Abschnitte warten auf „Weiter“.
 * Gibt das neue Training und die Zahl der Wechsel zurück.
 */
export function advanceTimedPhases(w: Workout, now = Date.now()): { workout: Workout; changes: number } {
  let next = w
  let changes = 0
  for (;;) {
    const c = next.cardio
    const p = currentPhase(next)
    if (!c || !p || p.amount.unit !== 'time') break
    const end = (c.phaseStartMs ?? 0) + p.amount.value * 1000
    if (elapsedMs(next, now) < end) break
    next = nextPhase(next, now, end)
    changes++
  }
  return { workout: next, changes }
}

/** Plan-Lauf: alle Abschnitte geschafft. */
export const planDone = (w: Workout) => !!w.cardio?.phases && (w.cardio.phaseIndex ?? 0) >= w.cardio.phases.length

/** Strecke aller abgeschlossenen Strecken-Abschnitte in Metern, als Vorschlag beim Beenden. */
export function completedDistanceM(w: Workout): number {
  const c = w.cardio
  if (!c?.phases) return 0
  return c.phases.slice(0, c.phaseIndex ?? 0).reduce((m, p) => m + (p.amount.unit === 'distance' ? p.amount.value : 0), 0)
}

const clock = (sec: number) => {
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  const s = Math.round(sec % 60)
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${m}:${String(s).padStart(2, '0')}`
}

/** „10:00“, „400 m“ oder „5 km“ */
export function formatAmount(a: Amount): string {
  if (a.unit === 'time') return clock(a.value)
  return a.value >= 1000 && a.value % 100 === 0 ? `${formatNumber(a.value / 1000)} km` : `${formatNumber(a.value)} m`
}

/** Kurzbeschreibung eines Abschnitts, z. B. „6 × 400 m Schnell · 1:30 Locker“. */
export function formatBlock(b: CardioBlock): string {
  const main = `${b.repeat && b.repeat > 1 ? `${b.repeat} × ` : ''}${formatAmount(b.amount)} ${b.label}`
  return b.repeat && b.repeat > 1 && b.rest ? `${main} · ${formatAmount(b.rest)} ${b.restLabel ?? 'Pause'}` : main
}

/** Zeile in der Planliste, z. B. „Laufen · 3 Abschnitte · ca. 33 min + 2,4 km“. */
export function cardioPlanSummary(plan: Plan): string {
  const phases = expandBlocks(plan.blocks ?? [])
  const sec = phases.reduce((n, p) => n + (p.amount.unit === 'time' ? p.amount.value : 0), 0)
  const m = phases.reduce((n, p) => n + (p.amount.unit === 'distance' ? p.amount.value : 0), 0)
  const n = plan.blocks?.length ?? 0
  const parts = [SPORT_LABEL[plan.sport ?? 'laufen'], `${n} ${n === 1 ? 'Abschnitt' : 'Abschnitte'}`]
  const time = sec >= 60 ? `ca. ${Math.round(sec / 60)} min` : sec > 0 ? `${sec} s` : ''
  const amount = [time, m > 0 ? formatAmount({ unit: 'distance', value: m }) : ''].filter(Boolean).join(' + ')
  if (amount) parts.push(amount)
  return parts.join(' · ')
}
