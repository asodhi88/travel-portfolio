import { useEffect, useRef, useState } from 'react'
import { useScroll, useReducedMotion } from '../lib/scroll.jsx'

/* The headline decodes ARISTIDE-style: every letter cycles through noise and
   settles left to right, the second line starting just behind the first. */
const HEADLINE = ['ABOUT', 'ME']
const SCRAMBLE_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'

// The Home→About crossfade takes ~0.55s; the decode waits for it to finish so
// the letters never churn over a half-faded view.
const SCRAMBLE_START_MS = 600
const LINE_STAGGER_MS = 350
const FRAME_MS = 40
const FRAMES_PER_CHAR = 3

const randomChar = () =>
  SCRAMBLE_CHARS[Math.floor(Math.random() * SCRAMBLE_CHARS.length)]

/**
 * Top-right "About me", and the full-screen view it opens.
 *
 * Opening covers Home rather than navigating away from it: the label becomes
 * "Close", and closing puts the strip row back exactly where it was. That's why
 * this is an overlay and not a route — a route would tear down the carousel and
 * the WebGL stage and rebuild them, losing the scroll position on the way back.
 *
 * The view stays mounted and is hidden with visibility rather than being
 * unmounted, so CSS can transition it out as well as in. `open` is owned by
 * <Carousel>, which needs it too: Home's own content fades out underneath.
 *
 * @param {{ open: boolean, onOpenChange: (open: boolean) => void }} props
 */
export default function About({ open, onOpenChange }) {
  const { getLenis } = useScroll()
  const reducedMotion = useReducedMotion()

  const panelRef = useRef(null)
  const toggleRef = useRef(null)

  const [lines, setLines] = useState(HEADLINE)

  // The row is still there underneath, so freeze it — otherwise a wheel gesture
  // over the overlay would scroll it invisibly and closing would land somewhere
  // other than where it opened from.
  useEffect(() => {
    if (!open) return undefined

    const lenis = getLenis()

    // Lenis's own stylesheet puts `overflow: clip` on <html> while it's
    // stopped, which collapses the scrollable width and forces the offset to
    // zero. So remember where the row was — restoring it on the way out is the
    // whole point of overlaying Home instead of navigating away from it.
    const saved = lenis?.scroll ?? window.scrollX

    lenis?.stop()

    // preventScroll: the overlay is fixed at the viewport origin, so a plain
    // focus() would ask the browser to scroll the document to "reveal" it.
    panelRef.current?.focus({ preventScroll: true })

    const onKeyDown = (event) => {
      if (event.key !== 'Escape') return
      onOpenChange(false)
      toggleRef.current?.focus()
    }

    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)

      // start() first: it drops the class, which un-clips <html> and gives the
      // document its scrollable width back. Only then is there anywhere to
      // scroll to.
      lenis?.start()
      if (lenis) lenis.scrollTo(saved, { immediate: true, force: true })
      else window.scrollTo(saved, 0)
    }
  }, [open, getLenis, onOpenChange])

  // The decode itself. Runs fresh on every open; anyone who has asked for less
  // motion gets the settled headline with no churn at all.
  useEffect(() => {
    if (!open) return undefined

    if (reducedMotion) {
      setLines(HEADLINE)
      return undefined
    }

    setLines(HEADLINE.map(() => ''))
    const timers = []

    HEADLINE.forEach((target, index) => {
      timers.push(
        setTimeout(() => {
          let frame = 0
          const interval = setInterval(() => {
            frame += 1
            const settled = Math.floor(frame / FRAMES_PER_CHAR)

            setLines((prev) => {
              const next = [...prev]
              next[index] =
                settled >= target.length
                  ? target
                  : target
                      .split('')
                      .map((ch, i) => (i < settled ? ch : randomChar()))
                      .join('')
              return next
            })

            if (settled >= target.length) clearInterval(interval)
          }, FRAME_MS)
          timers.push(interval)
        }, SCRAMBLE_START_MS + index * LINE_STAGGER_MS)
      )
    })

    return () =>
      timers.forEach((t) => {
        clearTimeout(t)
        clearInterval(t)
      })
  }, [open, reducedMotion])

  return (
    <>
      <button
        type="button"
        className="about-toggle"
        ref={toggleRef}
        onClick={() => onOpenChange(!open)}
        aria-expanded={open}
      >
        {open ? 'Close' : 'About me'}
      </button>

      <div
        className={open ? 'about-view is-open' : 'about-view'}
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="About me"
        aria-hidden={!open}
        tabIndex={-1}
      >
        <div className="about-body">
          {/* The label carries the accessible name; the churning letters are
              noise a screen reader shouldn't try to keep up with. */}
          <h1 className="about-headline" aria-label="About me">
            {lines.map((line, i) => (
              <span key={HEADLINE[i]} aria-hidden="true">
                {line || ' '}
              </span>
            ))}
          </h1>

          <p className="about-intro">
            What started as a borrowed camera on a whim became the thing I look
            forward to most.
          </p>

          <div className="about-rest">
            <div>
              <p>
                I borrowed my friend's camera for the first time in Yellowstone,
                not knowing how any of it worked — no manual mode, no plan, just
                pointing it at things. I surprised myself: the shots came out
                better than I expected. Every trip I have taken since has been
                built around me and my camera.
              </p>
              <p>
                I shoot landscapes and nature mostly, and it's pulled me
                outdoors more than anything else ever has. Different trips,
                different lenses, the same quiet thrill of getting a few shots
                right.
              </p>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
