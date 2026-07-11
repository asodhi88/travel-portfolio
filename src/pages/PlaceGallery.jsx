import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase.js'

export default function PlaceGallery() {
  const { slug } = useParams()
  const [place, setPlace] = useState(null)
  const [images, setImages] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let active = true
    setLoading(true)

    async function load() {
      const { data: placeData, error: placeErr } = await supabase
        .from('places')
        .select('id, slug, name')
        .eq('slug', slug)
        .single()

      if (!active) return
      if (placeErr) {
        setError(placeErr.message)
        setLoading(false)
        return
      }
      setPlace(placeData)

      const { data: imageData, error: imageErr } = await supabase
        .from('images')
        .select('id, url, caption, sort_order')
        .eq('place_id', placeData.id)
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

  if (loading) return <div className="container muted">Loading…</div>
  if (error) return <div className="container error">{error}</div>
  if (!place) return <div className="container muted">Not found.</div>

  return (
    <div className="container">
      <Link to={`/photo/${place.slug}`} className="back-link">
        ← Back to {place.name}
      </Link>
      <h1>{place.name}</h1>

      {images.length === 0 ? (
        <p className="muted">No images yet.</p>
      ) : (
        <div className="gallery-grid">
          {images.map((img) => (
            <figure key={img.id}>
              <img src={img.url} alt={img.caption || place.name} loading="lazy" />
              {img.caption && <figcaption>{img.caption}</figcaption>}
            </figure>
          ))}
        </div>
      )}
    </div>
  )
}
