import { useEffect, useState } from 'react'

/**
 * Subscribe to a CSS media query.
 *
 * The initial value is read synchronously, so the first render already agrees
 * with the stylesheet and nothing has to flash to correct itself.
 *
 * @param {string} query  e.g. '(max-width: 768px)'
 * @returns {boolean}
 */
export function useMediaQuery(query) {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches)

  useEffect(() => {
    const mq = window.matchMedia(query)
    setMatches(mq.matches)

    const onChange = (e) => setMatches(e.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [query])

  return matches
}

/** Below this the home page drops its horizontal row for a vertical stack. */
export const COMPACT_QUERY = '(max-width: 768px)'
