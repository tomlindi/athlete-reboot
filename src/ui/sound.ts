// Kurzer Ton am Ende der Pause, ohne Audiodatei.
// iOS erlaubt Ton erst nach einer Berührung. Deshalb wird der Ton beim Abhaken eines Satzes „freigeschaltet“.

let ctx: AudioContext | null = null

function context(): AudioContext | null {
  try {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Ctor) return null
    ctx ??= new Ctor()
    return ctx
  } catch {
    return null
  }
}

/** Bei jeder Berührung aufrufen, die eine Pause startet. */
export function unlockSound() {
  const c = context()
  if (c && c.state === 'suspended') c.resume().catch(() => {})
}

/** Zwei kurze, helle Töne. */
export function playRestEnd() {
  const c = context()
  if (!c) return
  const t0 = c.currentTime
  for (const [offset, freq] of [
    [0, 880],
    [0.18, 1175],
  ] as const) {
    const osc = c.createOscillator()
    const gain = c.createGain()
    osc.type = 'sine'
    osc.frequency.value = freq
    gain.gain.setValueAtTime(0.0001, t0 + offset)
    gain.gain.exponentialRampToValueAtTime(0.25, t0 + offset + 0.02)
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + offset + 0.16)
    osc.connect(gain).connect(c.destination)
    osc.start(t0 + offset)
    osc.stop(t0 + offset + 0.18)
  }
  // Vibration gibt es auf dem iPhone im Browser nicht, auf anderen Geräten schon
  navigator.vibrate?.(200)
}
