import { useLayoutEffect } from 'react'
import {
  Routes,
  Route,
  Link,
  Navigate,
  useLocation,
  useParams,
} from 'react-router-dom'
import Home from './pages/Home.jsx'
import PlaceGallery from './pages/PlaceGallery.jsx'
import Admin from './pages/Admin.jsx'
import { ScrollProvider, useReducedMotion } from './lib/scroll.jsx'
import { useMediaQuery, COMPACT_QUERY } from './lib/media.js'

/**
 * The per-photo page was folded into the gallery, so anything still pointing at
 * a /photo/:slug link — a bookmark, an old share — lands on that place instead
 * of a blank screen.
 *
 * `replace` keeps the retired URL out of history: without it, going Back from
 * the gallery would hit this redirect and bounce straight forward again.
 */
function PhotoRedirect() {
  const { slug } = useParams()
  return <Navigate to={`/place/${slug}`} replace />
}

export default function App() {
  const location = useLocation()
  const isAdmin = location.pathname.startsWith('/admin')

  const compact = useMediaQuery(COMPACT_QUERY)
  const reducedMotion = useReducedMotion()

  // Only the home page scrolls sideways, and only where the sideways gesture
  // actually exists: narrow screens get the vertical stack, and so does
  // prefers-reduced-motion, which turns Lenis off — without Lenis mapping the
  // wheel across, a horizontal row would be unreachable by an ordinary scroll.
  const horizontal = location.pathname === '/' && !compact && !reducedMotion

  // The public design uses its own dark token system, scoped to a body class
  // so it never touches the Admin page's styling.
  useLayoutEffect(() => {
    document.body.classList.toggle('public', !isAdmin)
  }, [isAdmin])

  // Overflow is a viewport-level property — it has to be set on <body> to reach
  // the document scroller, which is why this can't live in the page's own CSS.
  useLayoutEffect(() => {
    document.body.classList.toggle('scroll-x', horizontal)
  }, [horizontal])

  return (
    // Smooth scrolling is a public-pages concern; Admin keeps native scroll.
    <ScrollProvider enabled={!isAdmin} horizontal={horizontal}>
      <div className="app">
        {/* Header (and site title) only exist on Admin — the public pages are
            intentionally chrome-free. */}
        {isAdmin && (
          <header className="site-header">
            <Link to="/" className="site-title">
              Travel Portfolio
            </Link>
          </header>
        )}

        <main>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/place/:slug" element={<PlaceGallery />} />
            <Route path="/photo/:slug" element={<PhotoRedirect />} />
            <Route path="/admin" element={<Admin />} />
          </Routes>
        </main>
      </div>
    </ScrollProvider>
  )
}
