# Travel Photography Portfolio

A React + Vite travel photography portfolio backed by Supabase (data + auth) and
Cloudinary (image hosting).

## Stack

- **React 18** + **Vite**
- **react-router-dom** for routing
- **three** for the Home page's WebGL rendering
- **lenis** for smooth (and horizontal) scrolling on the public pages
- **@supabase/supabase-js** for data and admin auth
- **Cloudinary** unsigned uploads for image hosting

## Routes

| Path            | Page          | Purpose                                            |
| --------------- | ------------- | -------------------------------------------------- |
| `/`             | Home          | Horizontal row of place strips (`Carousel`)        |
| `/photo/:slug`  | PhotoDetail   | Hero image, description, link to the gallery       |
| `/place/:slug`  | PlaceGallery  | Place name + responsive grid of all images         |
| `/admin`        | Admin         | Login, create/delete places, upload/manage images  |

The public pages share a dark, photograph-forward design, scoped to a `public`
class on `<body>` so it never touches Admin's light theme.

## Home

A dense horizontal row of narrow portrait strips (~130×440px, 24px gaps), one
per place, centred vertically in the viewport. The strips are **unlabelled** —
no names, no captions, no index counter anywhere on the page. Each place's name
reaches screen readers through its link's `aria-label` and nothing else.

Strips sit at 40% brightness at rest and come up to full on hover (or keyboard
focus). Clicking one routes to `/photo/:slug`.

### Scrolling

Lenis runs with `orientation: 'horizontal'` and `gestureOrientation: 'vertical'`,
so an ordinary downward wheel or trackpad gesture drives the row sideways. The
document itself is what overflows, and `ScrollProvider` (`src/lib/scroll.jsx`)
publishes the scroll velocity once per frame to everything that needs it.

Because the row's horizontal scrollbar takes ~15px off the bottom of the
viewport that `100vh` knows nothing about, `App` puts a `scroll-x` class on
`<body>` to clip the Y axis — otherwise the page grows a second, vertical
scrollbar with exactly 15px of travel in it. Overflow is a viewport-level
property, so it has to be set on `<body>` rather than in the page's own CSS.

### Rendering

Where WebGL is available, the photographs are painted by `WebGLStage`
(`src/components/WebGLStage.jsx`) as Three.js textured planes on a single fixed,
full-viewport canvas. The planes lay out along X, track the horizontal scroll
offset, and distort along the same axis based on scroll velocity: the plane's
centre line leads, the edges trail, and it falls slightly away from the camera —
a sheet of paper dragged through the viewport. The effect is deliberately
subtle, and the velocity it reads is smoothed so the planes settle rather than
jitter.

The DOM stays the source of truth throughout. It does the layout, the
measurement, the links and the accessible names; the canvas only paints. The
`<img>`s drop to `opacity: 0` — never `display: none` — so they stay laid out,
measurable, clickable and readable. The canvas is `pointer-events: none`, so a
click lands on the real `<a>` underneath.

### Chrome

- A wordmark, top-left, reading **ASX STILLS**, linking to `/`.
- A tick-mark ruler, top-centre: one thin hairline per place at low opacity,
  with the tick for the currently-centred strip highlighted. It tracks the
  horizontal scroll position and replaces the old index counter.

### Fallbacks

- **No WebGL** — the `<img>`s simply stay visible and the page still works. The
  rest-and-hover dimming is an equivalent CSS `brightness()` filter, which is
  why the shader dims *after* its sRGB conversion: so both paths agree.
- **Narrow screens** (≤768px) — a plain vertical stack.
- **`prefers-reduced-motion`** — also the vertical stack. It turns Lenis off,
  and without Lenis mapping the wheel across, a horizontal row would be
  unreachable by an ordinary scroll gesture.

## Setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Copy `.env.example` to `.env.local` and fill in your Supabase project URL and
   anon key (already provided for this project in `.env.local`).

3. Create the database tables by running [`supabase/schema.sql`](supabase/schema.sql)
   in the Supabase SQL editor.

4. In Supabase Auth, create an admin user (email/password) to log into `/admin`.

5. In Cloudinary, create an **unsigned** upload preset named `portfolio_uploads`
   (the cloud name `btroy1qm` is configured in `src/lib/cloudinary.js`).

6. Run the dev server:

   ```bash
   npm run dev
   ```

## Data model

- **places**: `slug`, `name`, `description`, `hero_image_url`, `sort_order`
- **images**: `place_id`, `url`, `caption`, `sort_order`

## Notes

- Strip geometry is declared once, in `src/components/Carousel.jsx`, and handed
  to CSS as custom properties, so there's one definition rather than the same
  numbers written down in two places.
- `Ruler` and `WebGLStage` both read the strips' real boxes instead of
  recomputing them from that geometry, so they stay honest through any amount of
  CSS centring and padding. Measurement happens on layout changes only; each
  frame is then arithmetic against the scroll offset.
- The DOM `<img>` and the WebGL texture request the exact same Cloudinary URL,
  so each photograph is downloaded and decoded once and served from cache the
  second time.
