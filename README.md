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
| `/place/:slug`  | PlaceGallery  | Place name + every image uploaded for it           |
| `/photo/:slug`  | —             | Redirects to `/place/:slug` (retired page)         |
| `/admin`        | Admin         | Login, create/rename/delete places, upload images  |

There are two public pages, not three: a strip on Home links straight to that
place's gallery. An intermediate per-photo page used to sit between them, but it
only ever showed the hero image again and a link onwards, so it was removed. Its
URL still resolves — old links redirect to the gallery rather than dead-ending.

The public pages share a dark, photograph-forward design, scoped to a `public`
class on `<body>` so it never touches Admin's light theme.

## Home

A dense horizontal row of narrow portrait strips (~130×440px, 24px gaps), one
per place, centred vertically in the viewport. The strips are **unlabelled** —
no names, no captions, no index counter anywhere on the page. Each place's name
reaches screen readers through its link's `aria-label` and nothing else.

Strips sit in greyscale at rest and turn to their real colour on hover (or
keyboard focus). Clicking one opens that place's gallery at `/place/:slug` —
plainly, with no transition animation.

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

- A wordmark, top-left, reading **ASX STILLS**, linking to `/`. It's a size up
  from the rest of the chrome, being the site's name rather than a control.
- A tick-mark ruler, top-centre: one thin hairline per place at low opacity,
  with the tick for the currently-centred strip highlighted. It tracks the
  horizontal scroll position and replaces the old index counter.
- **About me**, top-right. It opens a full-screen view over Home and becomes
  **Close**, which dismisses it (see [About](#about)).
- **Contact me** and **Instagram**, bottom-right. Instagram opens the profile in
  a new tab; Contact me opens a small message box (see [Contact](#contact)).

### Fallbacks

- **No WebGL** — the `<img>`s simply stay visible and the page still works. The
  rest-and-hover treatment is an equivalent CSS `grayscale()` filter, which is
  why the shader desaturates *after* its sRGB conversion, using the same
  weights that filter uses: so both paths agree rather than merely resemble
  each other.
- **Narrow screens** (≤768px) — a plain vertical stack.
- **`prefers-reduced-motion`** — also the vertical stack. It turns Lenis off,
  and without Lenis mapping the wheel across, a horizontal row would be
  unreachable by an ordinary scroll gesture.

## PlaceGallery

The page behind Home, and the only one: it opens with the place's name, followed
by every photograph uploaded for that place in a responsive grid. The hero is
simply whichever of those images is flagged as such in Admin, so it needs no
separate billing — it's already in the grid. A description shows under the name
when the place has one.

Images are requested through the same Cloudinary transform the strips use. The
uploads are full-resolution (2560px wide and up) and the grid's cells top out
around 400px, so serving them raw would cost megabytes a photograph to display a
few hundred pixels.

It carries the same numberless ruler as Home, top-centre, with the tick for this
place lit — which is why the page fetches the whole ordered list of places rather
than just this one: it needs to know how many there are and where this one sits
among them.

Getting back out works two ways: a **← Back** link in the top-left corner, in the
spot the Home wordmark occupies, and a **sideways scroll** in either direction,
mirroring the gesture that moved the row sideways on the way in. Lenis only ever
consumes the vertical axis, which leaves the horizontal one free for this. The
gesture has to clear a threshold, and only counts when it's more sideways than
vertical, so the drift that rides along with an ordinary vertical scroll can't
trip it.

## About

**About me**, top-right on Home, opens a full-screen view and turns into
**Close**. Escape closes it too, and returns focus to the control that opened it.

It's an overlay rather than a route: Home stays mounted underneath, so the strip
row comes back exactly where it was instead of the carousel and WebGL stage
being torn down and rebuilt at position zero. "Close" rather than "Back" is the
label for the same reason — it dismisses something, it doesn't navigate.

While it's open, Lenis is stopped so the row can't scroll invisibly behind it.
That needs care: Lenis's stylesheet puts `overflow: clip` on `<html>` whenever
it's stopped, which collapses the document's scrollable width and forces the
offset to zero. The scroll position is therefore saved before stopping and
restored after starting, or closing would always land back at the beginning of
the row.

The view's content is a placeholder for now.

## Contact

The **Email** link on Home opens a small box — name, email, message — rather
than a `mailto:`, so the owner's address never appears in the page and can't be
scraped off it. The message is posted to `/api/contact`, a Vercel serverless
function that reads the address from an environment variable and sends the mail
through [Resend](https://resend.com). The visitor's own address goes in
`reply_to`, so replying from the inbox reaches them directly.

**This needs configuring or nothing is delivered.** Set both in the Vercel
project's Environment Variables (never in a committed file):

| Variable         | Purpose                                  |
| ---------------- | ---------------------------------------- |
| `RESEND_API_KEY` | Resend API key                           |
| `CONTACT_EMAIL`  | where messages should be delivered       |

Until they're set, the endpoint logs the message and returns
`{ delivered: false }`. The box reports that honestly — it tells the visitor the
message didn't reach anyone and points them at Instagram instead, rather than
thanking them for a message that only ever hit a server log.

Note that `vercel.json` deliberately excludes `/api` from the SPA catch-all
rewrite. Without that, `/api/contact` would be rewritten to `index.html` and the
function would never run.

`/api` routes only exist on Vercel, so the box can't send from `npm run dev` —
it will report a failure locally.

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

A place's `name` can be edited from Admin; its `slug` is set once, when the place
is created, and deliberately doesn't follow a rename — the slug is the place's
URL, and rewriting it would break every existing link to that place.

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
