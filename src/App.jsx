import { useLayoutEffect } from 'react'
import { Routes, Route, Link, useLocation } from 'react-router-dom'
import Home from './pages/Home.jsx'
import PhotoDetail from './pages/PhotoDetail.jsx'
import PlaceGallery from './pages/PlaceGallery.jsx'
import Admin from './pages/Admin.jsx'
import { ScrollProvider, useReducedMotion } from './lib/scroll.jsx'
import { useMediaQuery, COMPACT_QUERY } from './lib/media.js'

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
            <Route path="/photo/:slug" element={<PhotoDetail />} />
            <Route path="/place/:slug" element={<PlaceGallery />} />
            <Route path="/admin" element={<Admin />} />
          </Routes>
        </main>
      </div>
    </ScrollProvider>
  )
}
