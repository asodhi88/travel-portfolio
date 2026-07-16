import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase.js'
import Ruler from '../components/Ruler.jsx'

// Px a sideways gesture has to cover before it counts as "go back". High enough
// that the horizontal wobble riding along with an ordinary vertical scroll
// never trips it.
const SWIPE_THRESHOLD = 90

// A pause this long ends the gesture: the distance so far starts over, so two
// unrelated nudges can't add up into a navigation.
const SWIPE_IDLE_MS = 250

export default function PhotoDetail() {
  const { slug } = useParams()
  const navigate = useNavigate()
  const [places, setPlaces] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // The whole ordered list, not just this one place: the ruler needs to know
  // how many places there are and where this one sits among them, and it's the
  // same single request either way.
  useEffect(() => {
    let active = true
    setLoading(true)

    async function load() {
      const { data, error } = await supabase
        .from('places')
        .select('slug, name, description, hero_image_url')
        .order('sort_order', { ascending: true })

      if (!active) return
      if (error) {
        setError(error.message)
      } else {
        setPlaces(data ?? [])
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
    <article className="photo-detail">
      <Link to="/" className="photo-back">
        ← Back
      </Link>

      <Ruler count={places.length} active={index} />

      {place.hero_image_url && (
        <img className="photo-hero" src={place.hero_image_url} alt={place.name} />
      )}

      <div className="photo-body">
        {place.description && (
          <p className="photo-description">{place.description}</p>
        )}
        <Link to={`/place/${place.slug}`} className="explore-link">
          Explore
        </Link>
      </div>
    </article>
  )
}
