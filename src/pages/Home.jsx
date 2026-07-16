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
      // select('*') so an optional `country` column is picked up if present,
      // without breaking when it isn't.
      const { data, error } = await supabase
        .from('places')
        .select('*')
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
  }, [])

  if (loading) return <div className="container muted">Loading…</div>
  if (error) return <div className="container error">{error}</div>
  if (places.length === 0)
    return <div className="container muted">No places yet.</div>

  return <Carousel places={places} />
}
