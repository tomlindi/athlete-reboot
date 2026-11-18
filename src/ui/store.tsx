import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { createBackup, parseBackup } from '../core/backup'
import { newId } from '../core/ids'
import { mergeLifeDashboard, parseLifeDashboardExport, type ImportResult } from '../core/lifeDashboard'
import { workoutFromPlan } from '../core/plans'
import { createWorkout, finishWorkout } from '../core/workout'
import { measureOf } from '../core/measure'
import { finishCardio, manualCardio, startCardio, type CardioInput } from '../core/cardio'
import type { Background, Backup, Exercise, Measure, MuscleGroup, Plan, Rating, Settings, Sport, Workout } from '../core/types'
import * as db from '../storage/db'

// Zentraler Zustand der App. Jede Änderung wird sofort auf dem Gerät gespeichert,
// damit ein laufendes Training auch das Schließen der App übersteht.

interface Store {
  data: db.AppData
  active: Workout | undefined
  exerciseById: Map<string, Exercise>
  notice: string | null
  dismissNotice: () => void
  startWorkout: () => void
  startCardio: (sport: Sport) => void
  finishCardio: (input: CardioInput) => void
  addCardio: (input: CardioInput, startedAt: number) => void
  startPlan: (planId: string) => void
  savePlan: (plan: Plan) => void
  deletePlan: (id: string) => void
  importLifeDashboard: (text: string) => Promise<ImportResult>
  updateActive: (fn: (w: Workout) => Workout) => void
  finishActive: (rating: Rating) => void
  discardActive: () => void
  deleteWorkout: (id: string) => void
  toggleRestDay: (date: string) => void
  addExercise: (name: string, group: MuscleGroup, measure?: Measure) => Exercise
  setExerciseHidden: (id: string, hidden: boolean) => void
  setBackground: (bg: Background) => void
  updateSettings: (patch: Partial<Settings>) => void
  exportBackup: () => Backup
  importBackup: (text: string) => Promise<Backup>
}

const StoreContext = createContext<Store | null>(null)

export function useStore(): Store {
  const s = useContext(StoreContext)
  if (!s) throw new Error('useStore außerhalb von StoreProvider')
  return s
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<db.AppData | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  // Die Referenz ist die aktuelle Wahrheit, auch wenn mehrere Änderungen vor dem nächsten Rendern kommen.
  const ref = useRef<db.AppData | null>(null)

  useEffect(() => {
    db.loadAll()
      .then((d) => {
        ref.current = d
        setData(d)
        db.requestPersistence()
      })
      .catch(() => setLoadError('Deine Daten konnten nicht geladen werden. Schließe die App und öffne sie erneut.'))
  }, [])

  // Hintergrund-Variante am <html>-Element setzen
  useEffect(() => {
    if (data) document.documentElement.dataset.bg = data.settings.background
  }, [data?.settings.background])

  const apply = useCallback((next: db.AppData) => {
    ref.current = next
    setData(next)
  }, [])

  const report = useCallback(() => {
    setNotice('Speichern hat nicht geklappt. Deine letzte Änderung ist eventuell verloren. Prüfe, ob auf dem iPhone genug Speicher frei ist.')
  }, [])

  const putWorkout = useCallback(
    (w: Workout) => {
      const d = ref.current!
      const exists = d.workouts.some((x) => x.id === w.id)
      apply({ ...d, workouts: exists ? d.workouts.map((x) => (x.id === w.id ? w : x)) : [...d.workouts, w] })
      db.saveWorkout(w).catch(report)
    },
    [apply, report],
  )

  const store = useMemo<Store | null>(() => {
    if (!data) return null
    const active = data.workouts.find((w) => w.endedAt === undefined)
    const exerciseById = new Map(data.exercises.map((e) => [e.id, e]))
    const current = () => ref.current!
    const currentActive = () => current().workouts.find((w) => w.endedAt === undefined)

    return {
      data,
      active,
      exerciseById,
      notice,
      dismissNotice: () => setNotice(null),

      startWorkout() {
        if (currentActive()) return
        putWorkout(createWorkout())
      },

      startCardio(sport) {
        if (currentActive()) return
        putWorkout(startCardio(sport))
      },

      finishCardio(input) {
        const a = currentActive()
        if (a?.type === 'cardio') putWorkout(finishCardio(a, input))
      },

      addCardio(input, startedAt) {
        putWorkout(manualCardio(input, startedAt))
      },

      startPlan(planId) {
        if (currentActive()) return
        const plan = current().plans.find((p) => p.id === planId)
        if (plan) putWorkout(workoutFromPlan(plan, current().workouts, Date.now(), (id) => measureOf(exerciseById.get(id))))
      },

      savePlan(plan) {
        const d = current()
        const exists = d.plans.some((x) => x.id === plan.id)
        apply({ ...d, plans: exists ? d.plans.map((x) => (x.id === plan.id ? plan : x)) : [...d.plans, plan] })
        db.savePlan(plan).catch(report)
      },

      deletePlan(id) {
        const d = current()
        apply({ ...d, plans: d.plans.filter((x) => x.id !== id) })
        db.deletePlan(id).catch(report)
      },

      async importLifeDashboard(text) {
        const d = current()
        const result = mergeLifeDashboard(parseLifeDashboardExport(text), d)
        await db.putMany(result)
        apply({ ...d, exercises: result.exercises, plans: result.plans, workouts: result.workouts })
        return result
      },

      updateActive(fn) {
        const a = currentActive()
        if (a) putWorkout(fn(a))
      },

      finishActive(rating) {
        const a = currentActive()
        if (a) putWorkout(finishWorkout(a, rating))
      },

      discardActive() {
        const a = currentActive()
        if (!a) return
        const d = current()
        apply({ ...d, workouts: d.workouts.filter((w) => w.id !== a.id) })
        db.deleteWorkout(a.id).catch(report)
      },

      deleteWorkout(id) {
        const d = current()
        apply({ ...d, workouts: d.workouts.filter((w) => w.id !== id) })
        db.deleteWorkout(id).catch(report)
      },

      toggleRestDay(date) {
        const d = current()
        const isRest = d.restDays.some((r) => r.date === date)
        apply({ ...d, restDays: isRest ? d.restDays.filter((r) => r.date !== date) : [...d.restDays, { date }] })
        db.setRestDay(date, !isRest).catch(report)
      },

      addExercise(name, group, measure = 'reps') {
        const e: Exercise = { id: `eigen-${newId()}`, name: name.trim(), group, custom: true, ...(measure === 'time' ? { measure } : {}) }
        const d = current()
        apply({ ...d, exercises: [...d.exercises, e] })
        db.saveExercise(e).catch(report)
        return e
      },

      setExerciseHidden(id, hidden) {
        const d = current()
        const e = d.exercises.find((x) => x.id === id)
        if (!e) return
        const next = { ...e, hidden }
        apply({ ...d, exercises: d.exercises.map((x) => (x.id === id ? next : x)) })
        db.saveExercise(next).catch(report)
      },

      updateSettings(patch) {
        const d = current()
        const settings = { ...d.settings, ...patch }
        apply({ ...d, settings })
        db.saveSettings(settings).catch(report)
      },

      setBackground(background) {
        const d = current()
        const settings = { ...d.settings, background }
        apply({ ...d, settings })
        db.saveSettings(settings).catch(report)
      },

      exportBackup() {
        const d = current()
        return createBackup(d)
      },

      async importBackup(text) {
        const backup = parseBackup(text)
        await db.replaceAll(backup)
        apply(await db.loadAll())
        return backup
      },
    }
  }, [data, notice, apply, putWorkout, report])

  if (loadError) return <p className="load-error">{loadError}</p>
  if (!store) return null
  return <StoreContext.Provider value={store}>{children}</StoreContext.Provider>
}
