import { Routes, Route, Link } from 'react-router-dom'
import Home from './pages/Home.jsx'
import PhotoDetail from './pages/PhotoDetail.jsx'
import PlaceGallery from './pages/PlaceGallery.jsx'
import Admin from './pages/Admin.jsx'

export default function App() {
  return (
    <div className="app">
      <header className="site-header">
        <Link to="/" className="site-title">
          Travel Portfolio
        </Link>
      </header>

      <main>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/photo/:slug" element={<PhotoDetail />} />
          <Route path="/place/:slug" element={<PlaceGallery />} />
          <Route path="/admin" element={<Admin />} />
        </Routes>
      </main>
    </div>
  )
}
