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
- **Resend** for delivering contact messages, called from a Vercel serverless
  function rather than the browser (see [Contact](#contact))

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
keyboard focus), and grow to 1.1× on the Y axis at the same time. The growth is
height only: the width never moves, so a strip reaches over its neighbours
instead of shoving them along the row, and nothing reflows. Both halves of the
hover are lerped per frame on the plane itself rather than transitioned in CSS,
since the visible strip is the canvas and not the `<img>`.

Clicking one opens that place's gallery at `/place/:slug` — plainly, with no
transition animation.

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
- **Designed and built by Aman**, bottom-left — on every public page. It's fixed
  on Home, but sits at the end of the content on the gallery, which scrolls and
  would otherwise have a credit line pinned over its photographs.

The bottom two and the About toggle are the page's persistent frame: they stay
put while the About view opens and closes underneath them, so only the content
inside the frame changes.

### Fallbacks

- **No WebGL** — the `<img>`s simply stay visible and the page still works. The
  rest-and-hover treatment is an equivalent CSS `grayscale()` filter, which is
  why the shader desaturates *after* its sRGB conversion, using the same
  weights that filter uses: so both paths agree rather than merely resemble
  each other.
- **Narrow screens** (≤768px) — see [Home on a phone](#home-on-a-phone).
- **`prefers-reduced-motion`** — also the vertical stack. It turns Lenis off,
  and without Lenis mapping the wheel across, a horizontal row would be
  unreachable by an ordinary scroll gesture. The hover's vertical growth is
  skipped as well; the colour change still carries the hover on its own.

## Home on a phone

At ≤768px the row turns ninety degrees: the strips become short, wide slabs
(~120px tall, 16px apart, full-bleed apart from the page gutter) stacked down
the page and scrolled vertically. A tall narrow strip wastes a phone's width;
a slab uses all of it and still fits several on screen.

They're the same Three.js planes, laid out along Y and tracked against the
vertical scroll. The bend follows the scroll axis without any special-casing —
the shader already picks its axis from `uHorizontal`, which is off here — and
the cover-crop reads whatever box the DOM ends up with, so the photographs
re-crop to the wider frame on their own.

Touch has no hover, so nothing waits for a pointer: the slab nearest the middle
of the viewport is the one in colour, and it hands over as the page scrolls.
The hover-only vertical growth is skipped entirely — a slab that swelled every
time it drifted past the middle would just be noise.

That branch keys off the `(max-width: 768px)` media query rather than the
scroll axis. Both look the same from inside the render loop, but a wide screen
with `prefers-reduced-motion` also stacks its strips, and it still has a
pointer — so it keeps hovering, and keeps the portrait sizing, while a phone
gets the slabs.

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
gesture lives in `useBackGesture` (`src/lib/backGesture.js`), shared with the
About view: it has to clear a threshold, and only counts when it's more sideways
than vertical, so the drift that rides along with an ordinary vertical scroll
can't trip it.

## About

**About me**, top-right on Home, opens a full-screen view and turns into
**Close**. Escape closes it too, and returns focus to the control that opened
it, as does a sideways scroll — the same `useBackGesture` flick that backs out
of a gallery (`src/lib/backGesture.js`). Only the horizontal axis is watched, so
the view can still be read by scrolling down.

It's an overlay rather than a route: Home stays mounted underneath, so the strip
row comes back exactly where it was instead of the carousel and WebGL stage
being torn down and rebuilt at position zero. "Close" rather than "Back" is the
label for the same reason — it dismisses something, it doesn't navigate.

The two states hand over rather than cutting: Home's content fades out over
0.25s, then the view fades in over 0.3s after a matching delay, leaving a brief
empty beat between them — and exactly reversed on the way back. The canvas is
part of that fade, not just the strip row: where WebGL is painting, the
photographs are on the canvas and fading the DOM row alone would leave them
hanging there. The toggle is excluded, since it has to survive as "Close".

The view is kept mounted and hidden rather than unmounted, so it can transition
out as well as in. Its `pointer-events` are switched without a transition, so a
closed (transparent) overlay can never sit there swallowing clicks on Home.

While it's open, Lenis is stopped so the row can't scroll invisibly behind it.
That needs care: Lenis's stylesheet puts `overflow: clip` on `<html>` whenever
it's stopped, which collapses the document's scrollable width and forces the
offset to zero. The scroll position is therefore saved before stopping and
restored after starting, or closing would always land back at the beginning of
the row.

The content itself is a giant two-line headline — ABOUT / ME, set in Anton, the
one place that font exists on the site — that decodes into place once the
crossfade hands over: every letter cycles through noise and settles left to
right, the second line starting just behind the first. The story paragraphs
hold back until the headline has settled, then fade in top to bottom. Headline
and story share one left edge — the same gutter the wordmark and back link sit
on — and the two type sizes are held close enough to read as one system rather
than a poster with a caption. The decode replays on every open, runs off timers
the close tears down, and under `prefers-reduced-motion` is skipped entirely:
the headline renders settled and the paragraphs appear without delay. The
churning letters are `aria-hidden`; the heading's accessible name is a plain
"About me".

## Contact

**Contact me**, bottom-right on Home, opens a small box — name, email, message —
rather than being a `mailto:`, so the owner's address never appears in the page
and can't be scraped off it. The message is posted to `/api/contact`, a Vercel serverless
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

`places` also carries a `country` column. Nothing renders it any more — it fed
the old per-strip captions, which went when the strips became unlabelled — but
it's left in the schema rather than dropped, since dropping a column throws away
whatever is in it.

A place's `name` can be edited from Admin; its `slug` is set once, when the place
is created, and deliberately doesn't follow a rename — the slug is the place's
URL, and rewriting it would break every existing link to that place.

`sort_order` is the running order of the home carousel. Admin lists places in
that order and gives each one up/down arrows, which swap its value with its
neighbour's and persist both rows before the list re-renders. Home reads the
same column, so what's arranged in Admin is what visitors scroll through.

Admin renumbers the column to a clean 0,1,2… run when — and only when — the
order is genuinely ambiguous: a `null`, which sorts to the end wherever the
place belongs, or a duplicate, which sorts against its twin arbitrarily and can
shuffle between loads. Gaps and a 1-based start are left alone, since a swap
trades whatever two values it's given and doesn't care what they are;
renumbering those would rewrite every row to fix nothing. Both queries also sort
by `created_at` as a tiebreaker, so a duplicate can't reshuffle the page before
Admin has had a chance to clean it up.

## Notes

- Strip geometry is declared once, in `src/components/Carousel.jsx`, and handed
  to CSS as custom properties, so there's one definition rather than the same
  numbers written down in two places.
- `ScrollRuler` and `WebGLStage` both read the strips' real boxes instead of
  recomputing them from that geometry, so they stay honest through any amount of
  CSS centring and padding. Measurement happens on layout changes only; each
  frame is then arithmetic against the scroll offset. (`Ruler.jsx` exports two
  components: `Ruler` is presentational — a count and an index — and the gallery
  uses it directly; `ScrollRuler` is the wrapper that does the measuring and
  owns the tracking state, so Home's carousel never re-renders on scroll.)
- The DOM `<img>` and the WebGL texture request the exact same Cloudinary URL,
  so each photograph is downloaded and decoded once and served from cache the
  second time.
