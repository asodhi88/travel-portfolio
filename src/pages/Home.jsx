import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase.js'
import Carousel from '../components/Carousel.jsx'

export default function Home() {
  const [places, setPlaces] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let active = true

    async function load() {
      // Just what the strips and the ruler need. The row carries no text, so
      // the description never crosses the wire.
      // sort_order is what Admin's reorder arrows write, so the row reads in
      // whatever order was set there. created_at only breaks ties, in case a
      // visitor arrives before Admin has renumbered a duplicated value —
      // without it the strips could shuffle between visits.
      const { data, error } = await supabase
        .from('places')
        .select('slug, name, hero_image_url')
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: true })

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
  }, [])

  if (loading) return <div className="container muted">Loading…</div>
  if (error) return <div className="container error">{error}</div>
  if (places.length === 0)
    return <div className="container muted">No places yet.</div>

  return <Carousel places={places} />
}
