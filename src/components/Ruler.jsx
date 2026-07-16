import { useEffect, useRef, useState } from 'react'
import { useScroll } from '../lib/scroll.jsx'

/**
 * One hairline per place, centred at the top of the viewport, with the tick for
 * the currently-centred strip lit.
 *
 * It reads the strips' real boxes rather than recomputing them from the layout
 * constants, so it stays honest through any amount of CSS centring, padding and
 * wrapping. Measurement happens on layout changes only; each frame is then a
 * scan over a handful of numbers.
 *
 * @param {{
 *   places: Array<{ slug: string }>,
 *   stripRefs: React.MutableRefObject<Map<string, HTMLElement>>
 * }} props
 */
export default function Ruler({ places, stripRefs }) {
  const { subscribe, getScroll, horizontal } = useScroll()
  const [active, setActive] = useState(0)

  // Centre of each strip along the scroll axis, in document space, in `places`
  // order.
  const centresRef = useRef([])

  useEffect(() => {
    const measure = () => {
      const scroll = getScroll()

      centresRef.current = places.map((place) => {
        const el = stripRefs.current.get(place.slug)
        if (!el) return Number.POSITIVE_INFINITY

        const box = el.getBoundingClientRect()
        return horizontal
          ? box.left + scroll + box.width / 2
          : box.top + scroll + box.height / 2
      })
    }

    const frame = () => {
      const centres = centresRef.current
      if (centres.length === 0) return

      const viewportCentre =
        getScroll() +
        (horizontal ? window.innerWidth : window.innerHeight) / 2

      let nearest = 0
      let best = Infinity
      for (let i = 0; i < centres.length; i += 1) {
        const distance = Math.abs(centres[i] - viewportCentre)
        if (distance < best) {
          best = distance
          nearest = i
        }
      }

      // Only ever a render when the lit tick moves, not every frame.
      setActive((current) => (current === nearest ? current : nearest))
    }

    measure()

    const observer = new ResizeObserver(measure)
    for (const place of places) {
      const el = stripRefs.current.get(place.slug)
      if (el) observer.observe(el)
    }

    window.addEventListener('resize', measure)
    const unsubscribe = subscribe(frame)

    return () => {
      unsubscribe()
      observer.disconnect()
      window.removeEventListener('resize', measure)
    }
  }, [places, stripRefs, subscribe, getScroll, horizontal])

  return (
    <div className="ruler" aria-hidden="true">
      {places.map((place, i) => (
        <span
          key={place.slug}
          className={i === active ? 'ruler-tick is-active' : 'ruler-tick'}
        />
      ))}
    </div>
  )
}
