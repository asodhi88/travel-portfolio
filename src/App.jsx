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
import { ScrollProvider } from './lib/scroll.jsx'

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

  // The public design uses its own dark token system, scoped to a body class
  // so it never touches the Admin page's styling.
  useLayoutEffect(() => {
    document.body.classList.toggle('public', !isAdmin)
  }, [isAdmin])

  return (
    // Smooth scrolling is a public-pages concern; Admin keeps native scroll.
    // The home board is sized to the viewport and doesn't scroll; the gallery
    // scrolls vertically, which is Lenis's default orientation.
    <ScrollProvider enabled={!isAdmin}>
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
