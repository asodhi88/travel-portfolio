import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase.js'
import PlaceAdmin from '../components/PlaceAdmin.jsx'

// Convert a name into a URL-friendly slug.
function slugify(text) {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function LoginForm({ onError }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setBusy(true)
    onError(null)
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })
    if (error) onError(error.message)
    setBusy(false)
  }

  return (
    <form onSubmit={handleSubmit} className="card" style={{ maxWidth: 360 }}>
      <h3>Admin login</h3>
      <div className="field">
        <label htmlFor="email">Email</label>
        <input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
      </div>
      <div className="field">
        <label htmlFor="password">Password</label>
        <input
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
      </div>
      <button type="submit" disabled={busy}>
        {busy ? 'Signing in…' : 'Sign in'}
      </button>
    </form>
  )
}

function CreatePlaceForm({ onCreated, onError }) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [busy, setBusy] = useState(false)

  const slug = slugify(name)

  async function handleSubmit(e) {
    e.preventDefault()
    if (!slug) {
      onError('Name must contain at least one letter or number.')
      return
    }
    setBusy(true)
    onError(null)

    // Place new items at the end.
    const { data: last } = await supabase
      .from('places')
      .select('sort_order')
      .order('sort_order', { ascending: false })
      .limit(1)
    const nextSort = (last?.[0]?.sort_order ?? 0) + 1

    const { error } = await supabase.from('places').insert({
      name,
      slug,
      description,
      sort_order: nextSort,
    })

    setBusy(false)
    if (error) {
      onError(error.message)
    } else {
      setName('')
      setDescription('')
      onCreated()
    }
  }

  return (
    <form onSubmit={handleSubmit} className="card">
      <h3>New place</h3>
      <div className="field">
        <label htmlFor="place-name">Name</label>
        <input
          id="place-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
      </div>
      <div className="field">
        <label>Slug (auto)</label>
        <input type="text" value={slug} readOnly className="muted" />
      </div>
      <div className="field">
        <label htmlFor="place-desc">Description</label>
        <textarea
          id="place-desc"
          rows={3}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </div>
      <button type="submit" disabled={busy}>
        {busy ? 'Creating…' : 'Create place'}
      </button>
    </form>
  )
}

/**
 * Write a new `sort_order` to each row that needs one.
 *
 * Supabase has no bulk "different value per row" update, and an upsert would
 * have to carry every not-null column to avoid wiping them. The list is a
 * handful of places, so one small request per changed row is the honest way to
 * do it.
 */
/**
 * Whether the list's `sort_order` values leave its order ambiguous.
 *
 * Only two things do: a missing value, which sorts to the end regardless of
 * where the place belongs, and a duplicated one, which sorts against its twin
 * arbitrarily and so can shuffle between loads. Gaps and a 1-based start are
 * both fine — swapping two places trades whatever values they hold, and doesn't
 * care what those numbers are. Renumbering a list that's merely 1-based would
 * rewrite every row to fix nothing.
 */
function needsRenumbering(rows) {
  const orders = rows.map((place) => place.sort_order)
  return (
    orders.some((order) => typeof order !== 'number') ||
    new Set(orders).size !== orders.length
  )
}

function writeOrder(rows) {
  return Promise.all(
    rows.map(({ id, sort_order }) =>
      supabase.from('places').update({ sort_order }).eq('id', id)
    )
  )
}

export default function Admin() {
  const [session, setSession] = useState(null)
  const [checking, setChecking] = useState(true)
  const [places, setPlaces] = useState([])
  const [error, setError] = useState(null)
  const [reordering, setReordering] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setChecking(false)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s)
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  async function loadPlaces() {
    const { data, error } = await supabase
      .from('places')
      .select('id, slug, name, description, hero_image_url, sort_order')
      .order('sort_order', { ascending: true })
      // Without a tiebreaker, rows sharing a sort_order come back in whatever
      // order Postgres feels like — which is what makes a duplicated value
      // shuffle the list between loads.
      .order('created_at', { ascending: true })

    if (error) {
      setError(error.message)
      return
    }

    const rows = data ?? []

    if (!needsRenumbering(rows)) {
      setPlaces(rows)
      return
    }

    // Renumber the whole list to 0,1,2… in the order it just came back in.
    const renumbered = rows.map((place, i) => ({ ...place, sort_order: i }))
    const drifted = renumbered.filter((place, i) => rows[i].sort_order !== i)

    const failed = (await writeOrder(drifted)).find((r) => r.error)
    if (failed) {
      // The renumbering didn't stick, so show what the server actually has
      // rather than a tidy list that only exists in this tab.
      setError(failed.error.message)
      setPlaces(rows)
      return
    }

    setPlaces(renumbered)
  }

  /**
   * Swap a place with the neighbour above (-1) or below (+1) it, persisting
   * both rows before the list re-renders in the new order.
   */
  async function movePlace(index, direction) {
    const target = index + direction
    if (target < 0 || target >= places.length) return

    setReordering(true)
    setError(null)

    const moving = places[index]
    const neighbour = places[target]

    const failed = (
      await writeOrder([
        { id: moving.id, sort_order: neighbour.sort_order },
        { id: neighbour.id, sort_order: moving.sort_order },
      ])
    ).find((r) => r.error)

    if (failed) {
      setError(failed.error.message)
      // One half of the swap may have landed, so re-read rather than guess.
      await loadPlaces()
      setReordering(false)
      return
    }

    // The two rows trade both their values and their slots, so the list stays
    // sorted by sort_order without another round trip.
    const next = [...places]
    next[index] = { ...neighbour, sort_order: moving.sort_order }
    next[target] = { ...moving, sort_order: neighbour.sort_order }
    setPlaces(next)
    setReordering(false)
  }

  useEffect(() => {
    if (session) loadPlaces()
  }, [session])

  if (checking) return <div className="container muted">Loading…</div>

  if (!session) {
    return (
      <div className="container admin">
        {error && <p className="error">{error}</p>}
        <LoginForm onError={setError} />
      </div>
    )
  }

  return (
    <div className="container admin">
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <h1>Admin</h1>
        <div className="row">
          <span className="muted" style={{ fontSize: '0.85rem' }}>
            {session.user.email}
          </span>
          <button className="secondary" onClick={() => supabase.auth.signOut()}>
            Sign out
          </button>
        </div>
      </div>

      {error && <p className="error">{error}</p>}

      <CreatePlaceForm onCreated={loadPlaces} onError={setError} />

      <h2>Places</h2>
      {places.length === 0 ? (
        <p className="muted">No places yet.</p>
      ) : (
        places.map((place, i) => (
          <PlaceAdmin
            key={place.id}
            place={place}
            index={i}
            total={places.length}
            reordering={reordering}
            onMove={movePlace}
            onChanged={loadPlaces}
          />
        ))
      )}
    </div>
  )
}
