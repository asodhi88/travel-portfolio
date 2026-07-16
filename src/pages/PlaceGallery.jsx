import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase.js'
import { cloudinaryImageUrl } from '../lib/cloudinary.js'
import Ruler from '../components/Ruler.jsx'

// The grid's cells top out around 400 CSS px, so this covers them on a retina
// screen with room to spare. The uploads themselves are full-resolution — 2560px
// wide and up — and serving those raw would cost megabytes a photograph to
// display a few hundred pixels.
const GALLERY_WIDTH = 1200

// Px a sideways gesture has to cover before it counts as "go back". High enough
// that the horizontal wobble riding along with an ordinary vertical scroll
// never trips it.
const SWIPE_THRESHOLD = 90

// A pause this long ends the gesture: the distance so far starts over, so two
// unrelated nudges can't add up into a navigation.
const SWIPE_IDLE_MS = 250

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

  // Scrolling sideways goes back, mirroring the gesture that moved the row
  // sideways on the way in. Lenis only ever consumes the vertical axis, so the
  // horizontal one is free for this.
  useEffect(() => {
    let travelled = 0
    let lastAt = 0

    const onWheel = (event) => {
      // A deliberate sideways gesture, not the sideways drift that rides along
      // with a vertical one.
      if (Math.abs(event.deltaX) <= Math.abs(event.deltaY)) return

      const now = performance.now()
      if (now - lastAt > SWIPE_IDLE_MS) travelled = 0
      lastAt = now

      travelled += event.deltaX
      if (Math.abs(travelled) < SWIPE_THRESHOLD) return

      travelled = 0
      navigate('/')
    }

    window.addEventListener('wheel', onWheel, { passive: true })
    return () => window.removeEventListener('wheel', onWheel)
  }, [navigate])

  if (loading) return <div className="container muted">Loading…</div>
  if (error) return <div className="container error">{error}</div>

  const index = places.findIndex((p) => p.slug === slug)
  if (index === -1) return <div className="container muted">Not found.</div>
  const place = places[index]

  return (
    <div className="place-gallery">
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
    </div>
  )
}
