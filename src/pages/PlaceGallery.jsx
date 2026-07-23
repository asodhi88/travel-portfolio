import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase.js'
import { cloudinaryImageUrl } from '../lib/cloudinary.js'
import { useBackGesture } from '../lib/backGesture.js'
import Ruler from '../components/Ruler.jsx'
import Colophon from '../components/Colophon.jsx'
import DotField from '../components/DotField.jsx'

// The grid's cells top out around 400 CSS px, so this covers them on a retina
// screen with room to spare. The uploads themselves are full-resolution — 2560px
// wide and up — and serving those raw would cost megabytes a photograph to
// display a few hundred pixels.
const GALLERY_WIDTH = 1200

/**
 * A place, and every photograph uploaded for it.
 *
 * This is the only page behind Home: clicking a strip lands here directly. The
 * hero is just whichever of these images is flagged as such in Admin, so it
 * needs no separate billing — it's already in the grid.
 */
export default function PlaceGallery() {
  const { slug } = useParams()
  const navigate = useNavigate()
  const [places, setPlaces] = useState([])
  const [images, setImages] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let active = true
    setLoading(true)

    async function load() {
      // The whole ordered list, not just this place: the ruler needs to know
      // how many places there are and where this one sits among them.
      const { data: placeData, error: placeErr } = await supabase
        .from('places')
        .select('id, slug, name, description')
        .order('sort_order', { ascending: true })

      if (!active) return
      if (placeErr) {
        setError(placeErr.message)
        setLoading(false)
        return
      }
      setPlaces(placeData ?? [])

      const current = (placeData ?? []).find((p) => p.slug === slug)
      if (!current) {
        setLoading(false)
        return
      }

      const { data: imageData, error: imageErr } = await supabase
        .from('images')
        .select('id, url, caption, sort_order')
        .eq('place_id', current.id)
        .order('sort_order', { ascending: true })

      if (!active) return
      if (imageErr) {
        setError(imageErr.message)
      } else {
        setImages(imageData ?? [])
      }
      setLoading(false)
    }

    load()
    return () => {
      active = false
    }
  }, [slug])

  useBackGesture(() => navigate('/'))

  if (loading) return <div className="container muted">Loading…</div>
  if (error) return <div className="container error">{error}</div>

  const index = places.findIndex((p) => p.slug === slug)
  if (index === -1) return <div className="container muted">Not found.</div>
  const place = places[index]

  return (
    <div className="place-gallery">
      <DotField />

      <Link to="/" className="page-back">
        ← Back
      </Link>

      <Ruler count={places.length} active={index} />

      <header className="gallery-header">
        <h1 className="gallery-title">{place.name}</h1>
        {place.description && (
          <p className="gallery-description">{place.description}</p>
        )}
      </header>

      {images.length === 0 ? (
        <p className="muted">No images yet.</p>
      ) : (
        <div className="gallery-grid">
          {images.map((img) => (
            <figure key={img.id}>
              <img
                src={cloudinaryImageUrl(img.url, GALLERY_WIDTH)}
                alt={img.caption || place.name}
                loading="lazy"
              />
              {img.caption && <figcaption>{img.caption}</figcaption>}
            </figure>
          ))}
        </div>
      )}

      {/* Last in the flow rather than fixed: this page scrolls, and a pinned
          credit line would sit on top of the photographs the whole way down. */}
      <Colophon />
    </div>
  )
}
