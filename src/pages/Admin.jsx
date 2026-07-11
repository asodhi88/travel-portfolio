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

export default function Admin() {
  const [session, setSession] = useState(null)
  const [checking, setChecking] = useState(true)
  const [places, setPlaces] = useState([])
  const [error, setError] = useState(null)

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
    if (error) setError(error.message)
    else setPlaces(data ?? [])
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
        places.map((place) => (
          <PlaceAdmin key={place.id} place={place} onChanged={loadPlaces} />
        ))
      )}
    </div>
  )
}
