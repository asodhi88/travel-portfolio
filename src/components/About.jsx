import { useEffect, useRef, useState } from 'react'
import { useScroll } from '../lib/scroll.jsx'

/**
 * Top-right "About me", and the full-screen view it opens.
 *
 * Opening covers Home rather than navigating away from it: the label becomes
 * "Close", and closing puts the strip row back exactly where it was. That's why
 * this is an overlay and not a route — a route would tear down the carousel and
 * the WebGL stage and rebuild them, losing the scroll position on the way back.
 */
export default function About() {
  const [open, setOpen] = useState(false)
  const { getLenis } = useScroll()

  const panelRef = useRef(null)
  const toggleRef = useRef(null)

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
      setOpen(false)
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
  }, [open, getLenis])

  return (
    <>
      <button
        type="button"
        className="about-toggle"
        ref={toggleRef}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        {open ? 'Close' : 'About me'}
      </button>

      {open && (
        <div
          className="about-view"
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          aria-label="About me"
          tabIndex={-1}
        >
          {/* Placeholder — real copy lands in the next pass. */}
          <div className="about-body">
            <h1 className="about-title">About me</h1>
          </div>
        </div>
      )}
    </>
  )
}
