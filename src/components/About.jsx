import { useEffect, useRef } from 'react'
import { useScroll, useReducedMotion } from '../lib/scroll.jsx'
import { useBackGesture } from '../lib/backGesture.js'
import Scramble from './Scramble.jsx'

/* The headline decodes ARISTIDE-style: every letter cycles through noise and
   settles left to right, the second line starting just behind the first. */
const HEADLINE = ['ABOUT', 'ME']

// The Home→About crossfade takes ~0.55s; the decode waits for it to finish so
// the letters never churn over a half-faded view.
const HEADLINE_START_MS = 600
const HEADLINE_STAGGER_MS = 350

// Per character, so a long line takes proportionally longer than a short one
// and the two read as one hand.
const HEADLINE_MS_PER_CHAR = 120

/* The copy decodes the same way. These match the fade delays in the stylesheet,
   so each block starts resolving exactly as it arrives. */
const BODY_START_MS = 1500
const BODY_STAGGER_MS = 350

// A fixed span rather than per-character: at this length that would take the
// better part of a minute, and the paragraphs should settle together rather
// than in order of how much they happen to say.
const BODY_DECODE_MS = 1000

const INTRO =
  'What started as a borrowed camera on a whim became the thing I look forward to most.'

const STORY = [
  "I borrowed my friend's camera for the first time in Yellowstone, not knowing how it worked or what photography is all about. I just pointed it and fired the shots. I surprised myself because the shots came out better than I expected. Every trip I have taken since has been around me and my camera.",
  'I shoot landscapes and nature mostly, and it has pulled me outdoors more than anything else ever has. Different trips, different lenses, and the same quiet thrill of getting a few shots right.',
]

/**
 * A block of copy that decodes into place, with the real text alongside it for
 * anything that isn't looking at pixels.
 *
 * The churning version is hidden from the accessibility tree and a plain copy
 * carries the meaning, so a screen reader reaching this mid-decode reads the
 * sentence rather than a second of gibberish.
 */
function DecodedText({ text, active, delayMs }) {
  return (
    <>
      <span className="sr-only">{text}</span>
      <span aria-hidden="true">
        <Scramble
          text={text}
          active={active}
          delayMs={delayMs}
          durationMs={BODY_DECODE_MS}
          // In the page's flow, so it has to keep its height while it waits —
          // an empty block would collapse and shove the paragraphs below it.
          holdLayout
        />
      </span>
    </>
  )
}

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

  // Anyone who has asked for less motion gets the text settled, with no churn
  // anywhere on the page.
  const decoding = open && !reducedMotion

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

  // A sideways flick closes it, the same gesture that backs out of a gallery.
  // Vertical is left alone so the view can still be read by scrolling down.
  useBackGesture(() => onOpenChange(false), open)

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
            {HEADLINE.map((line, i) => (
              <span key={line} aria-hidden="true">
                <Scramble
                  text={line}
                  active={decoding}
                  delayMs={HEADLINE_START_MS + i * HEADLINE_STAGGER_MS}
                  durationMs={line.length * HEADLINE_MS_PER_CHAR}
                />
              </span>
            ))}
          </h1>

          <p className="about-intro">
            <DecodedText text={INTRO} active={decoding} delayMs={BODY_START_MS} />
          </p>

          <div className="about-rest">
            <div>
              {STORY.map((paragraph, i) => (
                <p key={paragraph.slice(0, 24)}>
                  <DecodedText
                    text={paragraph}
                    active={decoding}
                    delayMs={BODY_START_MS + (i + 1) * BODY_STAGGER_MS}
                  />
                </p>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
