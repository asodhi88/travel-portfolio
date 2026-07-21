import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import WebGLStage from './WebGLStage.jsx'
import { ScrollRuler } from './Ruler.jsx'
import SiteLinks from './SiteLinks.jsx'
import About from './About.jsx'
import Colophon from './Colophon.jsx'
import { cloudinaryImageUrl } from '../lib/cloudinary.js'
import { isWebGLAvailable } from '../lib/webgl.js'
import { useScroll } from '../lib/scroll.jsx'

/* Strip geometry. Declared here and handed to CSS as custom properties, so the
   stylesheet and the ruler's arithmetic can't drift apart. */
const STRIP_WIDTH = 130
const STRIP_HEIGHT = 440
const STRIP_GAP = 24

/* …and on a phone, where the row becomes a vertical stack of short, wide
   slabs instead. Only the CSS reads these — the WebGL layer measures whatever
   boxes the DOM ends up with. */
const SLAB_HEIGHT = 180
const SLAB_GAP = 16

// Matches TEXTURE_WIDTH in WebGLStage: one URL, one download, two consumers.
//
// A strip is far taller than it is wide, so a landscape photograph is scaled to
// fill the 440px height and cropped hard on both sides — a 3:2 frame ends up
// ~660 CSS px wide, or ~1320 device px on a retina screen. 1600 covers that
// without the crop ever going soft.
const HERO_WIDTH = 1600

/**
 * The home page: a dense horizontal row of narrow portrait strips, one per
 * place, scrolled sideways by an ordinary vertical wheel gesture.
 *
 * The markup below is the whole layout: it sizes and centres every strip and
 * carries the links and the accessible names. When WebGL is available the
 * photographs are painted instead by <WebGLStage> onto a single fixed canvas,
 * and these <img>s are dropped to opacity 0 — still laid out, still measurable,
 * still clickable, still read by screen readers. Without WebGL they simply stay
 * visible and the page still works.
 *
 * Strips are unlabelled by design: the place name reaches screen readers
 * through the link's aria-label and nothing else.
 *
 * @param {{ places: Array<{ slug: string, name: string, hero_image_url: string }> }} props
 */
export default function Carousel({ places }) {
  // Probed once, before first paint, so the class is right on the first frame
  // and the images never flash.
  const [webgl] = useState(isWebGLAvailable)

  const { horizontal } = useScroll()

  // Owned here rather than inside <About>, because Home's own content has to
  // react to it: everything except the toggle fades out underneath the view.
  const [aboutOpen, setAboutOpen] = useState(false)

  const stripRefs = useRef(new Map())

  // Which strip the pointer is over, as a ref rather than state: the WebGL
  // frame loop reads it every frame and a hover must not cost a render.
  const hoveredRef = useRef(null)

  const setStripRef = (slug) => (el) => {
    if (el) stripRefs.current.set(slug, el)
    else stripRefs.current.delete(slug)
  }

  const hover = (slug) => () => {
    hoveredRef.current = slug
  }

  const unhover = () => {
    hoveredRef.current = null
  }

  const className = [
    'home',
    webgl && 'webgl-active',
    !horizontal && 'is-stacked',
    aboutOpen && 'about-open',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div
      className={className}
      style={{
        '--strip-w': `${STRIP_WIDTH}px`,
        '--strip-h': `${STRIP_HEIGHT}px`,
        '--strip-gap': `${STRIP_GAP}px`,
        '--slab-h': `${SLAB_HEIGHT}px`,
        '--slab-gap': `${SLAB_GAP}px`,
      }}
    >
      <Link to="/" className="wordmark">
        ASX STILLS
      </Link>

      <ScrollRuler places={places} stripRefs={stripRefs} />

      <About open={aboutOpen} onOpenChange={setAboutOpen} />

      <SiteLinks />

      <Colophon />

      <div className="strip-row">
        {places.map((place) => (
          <Link
            key={place.slug}
            to={`/place/${place.slug}`}
            className="strip"
            aria-label={place.name}
            ref={setStripRef(place.slug)}
            onPointerEnter={hover(place.slug)}
            onPointerLeave={unhover}
            // Keyboard focus lights a strip the same way the pointer does.
            onFocus={hover(place.slug)}
            onBlur={unhover}
          >
            {place.hero_image_url && (
              <img
                className="strip-image"
                src={cloudinaryImageUrl(place.hero_image_url, HERO_WIDTH)}
                // The link already carries the name; an alt here would only
                // make every strip announce itself twice.
                alt=""
                // Same URL and same CORS mode as the texture request, so the
                // two share one cache entry.
                crossOrigin="anonymous"
              />
            )}
          </Link>
        ))}
      </div>

      {webgl && (
        <WebGLStage
          places={places}
          stripRefs={stripRefs}
          hoveredRef={hoveredRef}
        />
      )}
    </div>
  )
}
