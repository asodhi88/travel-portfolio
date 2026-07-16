import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { useLocation } from 'react-router-dom'
import Lenis from 'lenis'

/**
 * easeOutExpo — near-instant response, long weighted tail. This is the curve
 * that gives the scroll its heft.
 */
const easeOutExpo = (t) => (t === 1 ? 1 : 1 - Math.pow(2, -10 * t))

const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)'

const ScrollContext = createContext(null)

export function useReducedMotion() {
  const [reduced, setReduced] = useState(
    () => window.matchMedia(REDUCED_MOTION_QUERY).matches
  )

  useEffect(() => {
    const mq = window.matchMedia(REDUCED_MOTION_QUERY)
    const onChange = (e) => setReduced(e.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  return reduced
}

/**
 * Drives smooth scrolling with Lenis and publishes the scroll velocity every
 * frame.
 *
 * Velocity is exposed two ways, both of which avoid re-rendering on every
 * frame:
 *   - `useScrollVelocityRef()` — a ref to read inside your own rAF loop
 *   - `useScrollVelocity(cb)`  — a per-frame callback
 *
 * @param {{ enabled?: boolean, children: React.ReactNode }} props
 *   `enabled` false (e.g. on Admin) leaves scrolling completely untouched.
 */
export function ScrollProvider({ children, enabled = true }) {
  const reducedMotion = useReducedMotion()
  const smooth = enabled && !reducedMotion

  const velocityRef = useRef(0)
  const lenisRef = useRef(null)
  const subscribersRef = useRef(new Set())
  const { pathname } = useLocation()

  const subscribe = useCallback((fn) => {
    subscribersRef.current.add(fn)
    return () => {
      subscribersRef.current.delete(fn)
    }
  }, [])

  useEffect(() => {
    const publish = (v) => {
      velocityRef.current = v
      for (const fn of subscribersRef.current) fn(v)
    }

    // Admin: no Lenis, no rAF loop, nothing to clean up.
    if (!enabled) {
      publish(0)
      return undefined
    }

    let rafId = 0

    if (smooth) {
      const lenis = new Lenis({
        duration: 1.2,
        easing: easeOutExpo,
        smoothWheel: true,
        syncTouch: true,
      })
      lenisRef.current = lenis

      const raf = (time) => {
        lenis.raf(time)
        publish(lenis.velocity)
        rafId = requestAnimationFrame(raf)
      }
      rafId = requestAnimationFrame(raf)

      return () => {
        cancelAnimationFrame(rafId)
        lenis.destroy()
        lenisRef.current = null
        publish(0)
      }
    }

    // prefers-reduced-motion: native scroll. Velocity is still published, in
    // the same px-per-frame units Lenis uses, so subscribers behave the same.
    let lastY = window.scrollY
    let lastTime = performance.now()

    const raf = (time) => {
      const dt = time - lastTime
      if (dt > 0) {
        const y = window.scrollY
        publish(((y - lastY) / dt) * (1000 / 60))
        lastY = y
        lastTime = time
      }
      rafId = requestAnimationFrame(raf)
    }
    rafId = requestAnimationFrame(raf)

    return () => {
      cancelAnimationFrame(rafId)
      publish(0)
    }
  }, [enabled, smooth])

  // A new route must never inherit the previous page's scroll offset.
  useEffect(() => {
    const lenis = lenisRef.current
    if (lenis) {
      lenis.resize()
      lenis.scrollTo(0, { immediate: true, force: true })
    } else {
      window.scrollTo(0, 0)
    }
    velocityRef.current = 0
  }, [pathname])

  const value = useMemo(
    () => ({
      velocityRef,
      subscribe,
      getLenis: () => lenisRef.current,
      smooth,
    }),
    [subscribe, smooth]
  )

  return <ScrollContext.Provider value={value}>{children}</ScrollContext.Provider>
}

export function useScroll() {
  const ctx = useContext(ScrollContext)
  if (!ctx) throw new Error('useScroll must be used inside <ScrollProvider>')
  return ctx
}

/**
 * Ref holding the latest scroll velocity (px/frame, signed). Read
 * `ref.current` from inside your own rAF loop — it never triggers a render.
 */
export function useScrollVelocityRef() {
  return useScroll().velocityRef
}

/**
 * Run `callback(velocity)` on every frame. The callback identity can change
 * freely without re-subscribing.
 */
export function useScrollVelocity(callback) {
  const { subscribe } = useScroll()
  const cbRef = useRef(callback)

  useEffect(() => {
    cbRef.current = callback
  }, [callback])

  useEffect(() => subscribe((v) => cbRef.current(v)), [subscribe])
}
