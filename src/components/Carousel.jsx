import { Link } from 'react-router-dom'

/**
 * Full-width vertical list of places. Kept isolated so it can later be
 * swapped for a WebGL carousel without touching the Home page.
 *
 * @param {{ places: Array<{ slug: string, name: string, hero_image_url: string }> }} props
 */
export default function Carousel({ places }) {
  return (
    <div className="carousel">
      {places.map((place) => (
        <Link
          key={place.slug}
          to={`/photo/${place.slug}`}
          className="carousel-item"
        >
          {place.hero_image_url && (
            <img src={place.hero_image_url} alt={place.name} loading="lazy" />
          )}
          <span className="label">{place.name}</span>
        </Link>
      ))}
    </div>
  )
}
