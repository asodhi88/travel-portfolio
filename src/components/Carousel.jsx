import { Link } from 'react-router-dom'

// Zero-pad to two digits for the index counter (01, 02, …).
const pad = (n) => String(n).padStart(2, '0')

/**
 * Full-viewport vertical sequence of places. Kept isolated so it can later be
 * swapped for a WebGL carousel without touching the Home page.
 *
 * Each place is one exactly-100vh section. The figure shrink-wraps the hero
 * image so it can be centered on both axes, while the caption hangs off its
 * bottom-left edge without affecting that centering.
 *
 * @param {{ places: Array<{ slug: string, name: string, country?: string, hero_image_url: string }> }} props
 */
export default function Carousel({ places }) {
  const total = places.length

  return (
    <div className="home">
      {places.map((place, i) => (
        <section className="place-section" key={place.slug}>
          <figure className="place-figure">
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

            <figcaption className="place-caption">
              <h2 className="place-name">
                <Link to={`/photo/${place.slug}`}>{place.name}</Link>
              </h2>
              {place.country && (
                <span className="place-country">{place.country}</span>
              )}
            </figcaption>
          </figure>

          <span className="place-index">
            {pad(i + 1)} — {pad(total)}
          </span>
        </section>
      ))}
    </div>
  )
}
