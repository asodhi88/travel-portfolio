# Travel Photography Portfolio

A React + Vite travel photography portfolio backed by Supabase (data + auth) and
Cloudinary (image hosting).

## Stack

- **React 18** + **Vite**
- **react-router-dom** for routing
- **@supabase/supabase-js** for data and admin auth
- **Cloudinary** unsigned uploads for image hosting

## Routes

| Path            | Page          | Purpose                                            |
| --------------- | ------------- | -------------------------------------------------- |
| `/`             | Home          | Full-width vertical list of places (`Carousel`)    |
| `/photo/:slug`  | PhotoDetail   | Hero image, description, link to the gallery       |
| `/place/:slug`  | PlaceGallery  | Place name + responsive grid of all images         |
| `/admin`        | Admin         | Login, create/delete places, upload/manage images  |

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

- The `Carousel` component (`src/components/Carousel.jsx`) is intentionally
  isolated so it can later be replaced with a WebGL carousel without touching
  the Home page.
