import { Link } from 'react-router-dom'

// Zero-pad to two digits for the index counter (01, 02, …).
const pad = (n) => String(n).padStart(2, '0')

/**
 * Full-viewport vertical sequence of places. Kept isolated so it can later be
 * swapped for a WebGL carousel without touching the Home page.
 *
 * Each place is one 100vh section: a centered hero image, the place name in the
 * negative space below-left, the country beneath it, and an index counter
 * pinned to the bottom-left of the viewport.
 *
 * @param {{ places: Array<{ slug: string, name: string, country?: string, hero_image_url: string }> }} props
 */
export default function Carousel({ places }) {
  const total = places.length

  return (
    <div className="home">
      {places.map((place, i) => (
        <section className="place-section" key={place.slug}>
          <Link
            to={`/photo/${place.slug}`}
            className="place-hero-link"
            aria-label={place.name}
          >
            {place.hero_image_url && (
              <img
                className="place-hero"
                src={place.hero_image_url}
                alt={place.name}
                loading="lazy"
              />
            )}
          </Link>

          <div className="place-caption">
            <h2 className="place-name">
              <Link to={`/photo/${place.slug}`}>{place.name}</Link>
            </h2>
            {place.country && (
              <span className="place-country">{place.country}</span>
            )}
          </div>

          <span className="place-index">
            {pad(i + 1)} — {pad(total)}
          </span>
        </section>
      ))}
    </div>
  )
}
