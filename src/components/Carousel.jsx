import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import WebGLStage from './WebGLStage.jsx'
import { cloudinaryImageUrl } from '../lib/cloudinary.js'
import { isWebGLAvailable } from '../lib/webgl.js'

// Zero-pad to two digits for the index counter (01, 02, …).
const pad = (n) => String(n).padStart(2, '0')

// Matches TEXTURE_WIDTH in WebGLStage: one URL, one download, two consumers.
const HERO_WIDTH = 1600

/**
 * Full-viewport vertical sequence of places.
 *
 * The markup below is the whole layout: it sizes and centres every hero, and
 * carries the links and the alt text. When WebGL is available the photographs
 * are painted instead by <WebGLStage> onto a single fixed canvas, and these
 * <img>s are dropped to opacity 0 — still laid out, still measurable, still
 * clickable, still read by screen readers. Without WebGL they simply stay
 * visible and the page is exactly what it was before.
 *
 * @param {{ places: Array<{ slug: string, name: string, country?: string, hero_image_url: string }> }} props
 */
export default function Carousel({ places }) {
  const total = places.length

  // Probed once, before first paint, so the class is right on the first frame
  // and the images never flash.
  const [webgl] = useState(isWebGLAvailable)

  const imgRefs = useRef(new Map())

  const setImgRef = (slug) => (el) => {
    if (el) imgRefs.current.set(slug, el)
    else imgRefs.current.delete(slug)
  }

  return (
    <div className={webgl ? 'home webgl-active' : 'home'}>
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
                  ref={setImgRef(place.slug)}
                  src={cloudinaryImageUrl(place.hero_image_url, HERO_WIDTH)}
                  alt={place.name}
                  // Same URL and same CORS mode as the texture request, so the
                  // two share one cache entry.
                  crossOrigin="anonymous"
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

      {webgl && <WebGLStage places={places} imgRefs={imgRefs} />}
    </div>
  )
}
