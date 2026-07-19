import { useEffect, useRef } from 'react'

// Px a sideways gesture has to cover before it counts as "go back". High enough
// that the horizontal wobble riding along with an ordinary vertical scroll
// never trips it.
const SWIPE_THRESHOLD = 90

// A pause this long ends the gesture: the distance so far starts over, so two
// unrelated nudges can't add up into a navigation.
const SWIPE_IDLE_MS = 250

/**
 * Run `onTrigger` when the user scrolls sideways, in either direction.
 *
 * This mirrors the gesture that moved the strip row sideways on the way in, so
 * the same flick that got you here gets you back. Lenis only ever consumes the
 * vertical axis, which leaves the horizontal one free — and where the About
 * view has stopped Lenis entirely, both axes are free but only this one is
 * listened to, so the view can still be read by scrolling down.
 *
 * @param {() => void} onTrigger  called once per completed gesture
 * @param {boolean} enabled       false detaches the listener entirely
 */
export function useBackGesture(onTrigger, enabled = true) {
  // Kept in a ref so a caller can pass an inline arrow without re-binding the
  // listener (and resetting the gesture) on every render.
  const handlerRef = useRef(onTrigger)
  handlerRef.current = onTrigger

  useEffect(() => {
    if (!enabled) return undefined

    let travelled = 0
    let lastAt = 0

    const onWheel = (event) => {
      // A deliberate sideways gesture, not the sideways drift that rides along
      // with a vertical one.
      if (Math.abs(event.deltaX) <= Math.abs(event.deltaY)) return

      const now = performance.now()
      if (now - lastAt > SWIPE_IDLE_MS) travelled = 0
      lastAt = now

      travelled += event.deltaX
      if (Math.abs(travelled) < SWIPE_THRESHOLD) return

      travelled = 0
      handlerRef.current()
    }

    window.addEventListener('wheel', onWheel, { passive: true })
    return () => window.removeEventListener('wheel', onWheel)
  }, [enabled])
}
