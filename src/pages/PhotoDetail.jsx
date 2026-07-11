import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase.js'

export default function PhotoDetail() {
  const { slug } = useParams()
  const [place, setPlace] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let active = true
    setLoading(true)

    async function load() {
      const { data, error } = await supabase
        .from('places')
        .select('slug, name, description, hero_image_url')
        .eq('slug', slug)
        .single()

      if (!active) return
      if (error) {
        setError(error.message)
      } else {
        setPlace(data)
      }
      setLoading(false)
    }

    load()
    return () => {
      active = false
    }
  }, [slug])

  if (loading) return <div className="container muted">Loading…</div>
  if (error) return <div className="container error">{error}</div>
  if (!place) return <div className="container muted">Not found.</div>

  return (
    <article className="photo-detail">
      {place.hero_image_url && (
        <img className="hero" src={place.hero_image_url} alt={place.name} />
      )}
      <div className="container">
        <Link to="/" className="back-link">
          ← Back
        </Link>
        <h1>{place.name}</h1>
        {place.description && (
          <p className="description">{place.description}</p>
        )}
        <Link to={`/place/${place.slug}`} className="explore-link">
          Explore →
        </Link>
      </div>
    </article>
  )
}
