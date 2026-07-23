import { useEffect, useRef } from 'react'
import { useReducedMotion } from '../lib/scroll.jsx'

/* The field's resting geometry and how hard the cursor pushes it. Gap and radius
   are the design's own numbers; the physics constants below are ported straight
   from the design doc so the motion reads the same. */
const DOT_GAP = 32
const REPEL_RADIUS = 150

/**
 * The interactive dot field behind the home page: a grid of faint dots that flee
 * the cursor and drift back, each brightening as it's displaced.
 *
 * One fixed, full-viewport canvas painted in a rAF loop. It's decoration, so
 * it's `aria-hidden` and `pointer-events: none` — the cursor is tracked at the
 * window level, which means the dots still scatter under the photo tiles even
 * though the canvas never receives the events itself.
 *
 * prefers-reduced-motion gets the grid drawn once, static, with no loop and no
 * cursor tracking.
 */
export default function DotField() {
  const canvasRef = useRef(null)
  const reducedMotion = useReducedMotion()

  useEffect(() => {
    const cv = canvasRef.current
    if (!cv) return undefined
    const ctx = cv.getContext('2d')

    const gap = DOT_GAP
    const R = REPEL_RADIUS
    const mouse = { x: -9999, y: -9999 }
    let dots = []

    // Rebuild the grid to the canvas's real pixel size, capping the device
    // ratio at 2 so a 3× phone doesn't quadruple the dot count for no visible
    // gain.
    const build = () => {
      const r = cv.getBoundingClientRect()
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      cv.width = r.width * dpr
      cv.height = r.height * dpr
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      dots = []
      for (let y = gap / 2; y < r.height; y += gap)
        for (let x = gap / 2; x < r.width; x += gap)
          dots.push({ ox: x, oy: y, x, y, vx: 0, vy: 0 })
    }

    build()

    // Reduced motion: one static frame, redrawn only if the viewport resizes.
    if (reducedMotion) {
      const paint = () => {
        ctx.clearRect(0, 0, cv.clientWidth, cv.clientHeight)
        ctx.fillStyle = 'rgba(155,155,155,0.14)'
        for (const d of dots) {
          ctx.beginPath()
          ctx.arc(d.ox, d.oy, 1, 0, Math.PI * 2)
          ctx.fill()
        }
      }
      const onResize = () => {
        build()
        paint()
      }
      paint()
      window.addEventListener('resize', onResize)
      return () => window.removeEventListener('resize', onResize)
    }

    // The canvas fills the viewport, so its rect origin is (0,0) and clientX/Y
    // map straight onto grid space.
    const onMove = (e) => {
      mouse.x = e.clientX
      mouse.y = e.clientY
    }
    const onLeave = () => {
      mouse.x = -9999
      mouse.y = -9999
    }

    window.addEventListener('mousemove', onMove)
    window.addEventListener('blur', onLeave)
    document.addEventListener('mouseleave', onLeave)
    window.addEventListener('resize', build)

    let raf = 0
    const step = () => {
      const w = cv.clientWidth
      const h = cv.clientHeight
      ctx.clearRect(0, 0, w, h)
      for (const d of dots) {
        const dx = d.x - mouse.x
        const dy = d.y - mouse.y
        const dist = Math.hypot(dx, dy)
        // Push away from the cursor, falling off with the square of distance.
        if (dist < R && dist > 0.01) {
          const f = 1 - dist / R
          d.vx += (dx / dist) * f * f * 5.5
          d.vy += (dy / dist) * f * f * 5.5
        }
        // Spring back to rest, with damping so it settles instead of ringing.
        d.vx += (d.ox - d.x) * 0.075
        d.vy += (d.oy - d.y) * 0.075
        d.vx *= 0.84
        d.vy *= 0.84
        d.x += d.vx
        d.y += d.vy
        // The further a dot has been shoved, the brighter and larger it reads.
        const disp = Math.hypot(d.x - d.ox, d.y - d.oy)
        const alpha = 0.14 + Math.min(disp / 45, 0.62)
        const rad = 1 + Math.min(disp / 34, 2.1)
        ctx.beginPath()
        ctx.fillStyle = 'rgba(155,155,155,' + alpha + ')'
        ctx.arc(d.x, d.y, rad, 0, Math.PI * 2)
        ctx.fill()
      }
      raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('blur', onLeave)
      document.removeEventListener('mouseleave', onLeave)
      window.removeEventListener('resize', build)
    }
  }, [reducedMotion])

  return <canvas ref={canvasRef} className="stills-dots" aria-hidden="true" />
}
