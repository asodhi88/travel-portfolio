import { useLayoutEffect } from 'react'
import { Routes, Route, Link, useLocation } from 'react-router-dom'
import Home from './pages/Home.jsx'
import PhotoDetail from './pages/PhotoDetail.jsx'
import PlaceGallery from './pages/PlaceGallery.jsx'
import Admin from './pages/Admin.jsx'
import { ScrollProvider } from './lib/scroll.jsx'

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
            <Route path="/photo/:slug" element={<PhotoDetail />} />
            <Route path="/place/:slug" element={<PlaceGallery />} />
            <Route path="/admin" element={<Admin />} />
          </Routes>
        </main>
      </div>
    </ScrollProvider>
  )
}
