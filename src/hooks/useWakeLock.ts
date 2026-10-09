import { useEffect } from 'react'

/** Mantiene la pantalla encendida (cocinando, entrenando…). */
export function useWakeLock() {
  useEffect(() => {
    let lock: { release: () => Promise<void> } | null = null
    const nav = navigator as Navigator & {
      wakeLock?: {
        request: (t: 'screen') => Promise<{ release: () => Promise<void> }>
      }
    }
    const get = () => {
      if (document.visibilityState === 'visible')
        nav.wakeLock
          ?.request('screen')
          .then((l) => (lock = l))
          .catch(() => {})
    }
    get()
    document.addEventListener('visibilitychange', get)
    return () => {
      document.removeEventListener('visibilitychange', get)
      lock?.release().catch(() => {})
    }
  }, [])
}

/** Tres pitidos (temporizadores y descansos). */
export function beep() {
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    const ctx = new Ctx()
    ;[0, 0.35, 0.7].forEach((t) => {
      const o = ctx.createOscillator()
      const g = ctx.createGain()
      o.frequency.value = 880
      g.gain.setValueAtTime(0.25, ctx.currentTime + t)
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + t + 0.3)
      o.connect(g).connect(ctx.destination)
      o.start(ctx.currentTime + t)
      o.stop(ctx.currentTime + t + 0.3)
    })
  } catch {
    /* sin sonido */
  }
}
