import { useState } from 'react'
import { Link } from 'react-router-dom'
import DotField from './DotField.jsx'
import About from './About.jsx'
import SiteLinks from './SiteLinks.jsx'
import Colophon from './Colophon.jsx'
import Scramble from './Scramble.jsx'
import { cloudinaryImageUrl } from '../lib/cloudinary.js'
import { useReducedMotion } from '../lib/scroll.jsx'

/* A tile grows to a little under half the row when hovered, so this is the width
   its photograph needs to stay sharp even at that size. */
const TILE_WIDTH = 1200

/* The wordmark decodes on load exactly the way the About headline does — the
   same per-character cadence, with the two words settling just behind one
   another. */
const TITLE_START_MS = 250
const TITLE_STAGGER_MS = 300
const TITLE_MS_PER_CHAR = 120

/**
 * The home page (design variant 1A · FIELD): a dark, single-screen board.
 *
 * A dot field fills the viewport and scatters from the cursor; a compact row of
 * photo tiles floats over it, each expanding on hover to reveal the place it's
 * of. The four corners are the site's persistent chrome — the wordmark, the
 * About overlay, the credit line and the contact links — reused unchanged from
 * the rest of the public pages, since the design's header and footer already sit
 * exactly where that chrome lives.
 *
 * Nothing here scrolls: the layout is sized to the viewport, so the whole board
 * reads at once. Tapping a tile opens that place's gallery.
 *
 * @param {{ places: Array<{ slug: string, name: string, hero_image_url: string }> }} props
 */
export default function StillsHome({ places }) {
  const reducedMotion = useReducedMotion()

  // Owned here rather than inside <About>, because the field has to react to it:
  // the header, tiles and dots all fade out underneath the open view.
  const [aboutOpen, setAboutOpen] = useState(false)

  // Decode the wordmark once, as the page first mounts. Anyone who has asked for
  // less motion gets it settled from the start, with no churn. Read at mount and
  // left alone — the reveal is a one-time load moment.
  const [titleDecoding] = useState(!reducedMotion)

  // The wordmark's "issue" number is the size of the collection — an honest
  // count that reads as an editorial flourish rather than a fixed label.
  const issue = String(places.length).padStart(2, '0')

  return (
    <div className={aboutOpen ? 'stills about-open' : 'stills'}>
      <DotField />

      <header className="stills-header">
        {/* The link carries the accessible name; the churning letters are noise a
            screen reader shouldn't try to keep up with. */}
        <Link to="/" className="stills-brand" aria-label="ASX Stills — home">
          <span className="stills-mark" aria-hidden="true">
            <span className="stills-mark-asx">
              <Scramble
                text="ASX"
                active={titleDecoding}
                delayMs={TITLE_START_MS}
                durationMs={3 * TITLE_MS_PER_CHAR}
                holdLayout
              />
            </span>
            <span className="stills-mark-stills">
              <Scramble
                text="STILLS"
                active={titleDecoding}
                delayMs={TITLE_START_MS + TITLE_STAGGER_MS}
                durationMs={6 * TITLE_MS_PER_CHAR}
                holdLayout
              />
            </span>
            <span className="stills-mark-no">N°{issue}</span>
          </span>
        </Link>

        {/* A barcode-like flourish, purely decorative. */}
        <span className="stills-ticks" aria-hidden="true">
          <i />
          <i />
          <i className="is-tall" />
          <i />
          <i />
        </span>
      </header>

      <div className="stills-row">
        {places.map((place) => (
          <Link
            key={place.slug}
            to={`/place/${place.slug}`}
            className="stills-tile"
            aria-label={place.name}
          >
            {place.hero_image_url && (
              <img
                className="stills-tile-img"
                src={cloudinaryImageUrl(place.hero_image_url, TILE_WIDTH)}
                // The link already carries the name; an alt here would only make
                // every tile announce itself twice.
                alt=""
                crossOrigin="anonymous"
              />
            )}
            <span className="stills-tile-scrim" aria-hidden="true" />
            <span className="stills-tile-cap" aria-hidden="true">
              {place.name}
            </span>
          </Link>
        ))}
      </div>

      <About open={aboutOpen} onOpenChange={setAboutOpen} />

      <Colophon />

      <SiteLinks />
    </div>
  )
}
