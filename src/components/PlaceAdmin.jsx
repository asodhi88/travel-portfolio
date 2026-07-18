import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase.js'
import { uploadToCloudinary } from '../lib/cloudinary.js'

/**
 * Admin controls for a single place: rename, image uploader (drag-drop + file
 * picker), per-image caption / set-as-hero / delete, and delete-place.
 *
 * @param {{ place: object, onChanged: () => void }} props
 */
export default function PlaceAdmin({ place, onChanged }) {
  const [images, setImages] = useState([])
  const [uploads, setUploads] = useState([]) // { name, progress, error }
  const [dragging, setDragging] = useState(false)
  const [error, setError] = useState(null)
  const [name, setName] = useState(place.name)
  const [savingName, setSavingName] = useState(false)
  const fileInputRef = useRef(null)

  // Follow the row when it changes underneath us — a reload after some other
  // edit, or a rename that saved — without stranding whatever is half-typed in
  // the field.
  useEffect(() => {
    setName(place.name)
  }, [place.name])

  async function loadImages() {
    const { data, error } = await supabase
      .from('images')
      .select('id, url, caption, sort_order')
      .eq('place_id', place.id)
      .order('sort_order', { ascending: true })

    if (error) setError(error.message)
    else setImages(data ?? [])
  }

  useEffect(() => {
    loadImages()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [place.id])

  async function handleFiles(fileList) {
    const files = Array.from(fileList)
    if (files.length === 0) return
    setError(null)

    // Seed the progress list.
    const startIndex = uploads.length
    setUploads((prev) => [
      ...prev,
      ...files.map((f) => ({ name: f.name, progress: 0, error: null })),
    ])

    // Determine the next sort_order to append after existing images.
    let nextSort =
      images.reduce((max, img) => Math.max(max, img.sort_order ?? 0), 0) + 1

    for (let i = 0; i < files.length; i++) {
      const uploadIndex = startIndex + i
      const file = files[i]
      try {
        const url = await uploadToCloudinary(file, (percent) => {
          setUploads((prev) => {
            const next = [...prev]
            if (next[uploadIndex]) next[uploadIndex].progress = percent
            return next
          })
        })

        const { error: insertErr } = await supabase.from('images').insert({
          place_id: place.id,
          url,
          caption: '',
          sort_order: nextSort++,
        })
        if (insertErr) throw new Error(insertErr.message)
      } catch (err) {
        setUploads((prev) => {
          const next = [...prev]
          if (next[uploadIndex]) next[uploadIndex].error = err.message
          return next
        })
      }
    }

    await loadImages()
    // Clear finished uploads after a short delay so progress is visible.
    setTimeout(() => setUploads([]), 1500)
  }

  function onDrop(e) {
    e.preventDefault()
    setDragging(false)
    handleFiles(e.dataTransfer.files)
  }

  async function setAsHero(img) {
    const { error } = await supabase
      .from('places')
      .update({ hero_image_url: img.url })
      .eq('id', place.id)
    if (error) setError(error.message)
    else onChanged()
  }

  async function saveCaption(img, caption) {
    const { error } = await supabase
      .from('images')
      .update({ caption })
      .eq('id', img.id)
    if (error) setError(error.message)
  }

  async function deleteImage(img) {
    if (!confirm('Delete this image?')) return
    const { error } = await supabase.from('images').delete().eq('id', img.id)
    if (error) setError(error.message)
    else {
      await loadImages()
      // If this was the hero image, the place row still points at a dead URL;
      // refresh the parent so it can reflect any change.
      if (place.hero_image_url === img.url) onChanged()
    }
  }

  const trimmedName = name.trim()
  const nameChanged = trimmedName !== place.name && trimmedName.length > 0

  async function saveName(e) {
    e.preventDefault()
    if (!nameChanged) return

    setSavingName(true)
    setError(null)

    // Only the name moves. The slug is the place's URL, and rewriting it here
    // would quietly break every existing link to this place — including the
    // ones already out in the world.
    const { error } = await supabase
      .from('places')
      .update({ name: trimmedName })
      .eq('id', place.id)

    setSavingName(false)
    if (error) setError(error.message)
    else onChanged()
  }

  async function deletePlace() {
    if (!confirm(`Delete place "${place.name}" and all its images?`)) return
    // Remove child images first in case there is no cascade configured.
    await supabase.from('images').delete().eq('place_id', place.id)
    const { error } = await supabase.from('places').delete().eq('id', place.id)
    if (error) setError(error.message)
    else onChanged()
  }

  return (
    <div className="card">
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <form className="place-rename" onSubmit={saveName}>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            aria-label="Place name"
          />
          <button type="submit" disabled={!nameChanged || savingName}>
            {savingName ? 'Saving…' : 'Save'}
          </button>
        </form>
        <button className="danger" onClick={deletePlace}>
          Delete place
        </button>
      </div>

      {/* The slug is the URL and deliberately doesn't follow a rename, so it's
          shown plainly rather than looking like something that just changed. */}
      <div className="muted" style={{ fontSize: '0.85rem', marginBottom: '0.75rem' }}>
        /place/{place.slug}
      </div>

      {error && <p className="error">{error}</p>}

      {/* Uploader */}
      <div
        className={`dropzone${dragging ? ' dragging' : ''}`}
        onClick={() => fileInputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
      >
        Drag &amp; drop images here, or click to choose files
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={(e) => {
            handleFiles(e.target.files)
            e.target.value = ''
          }}
        />
      </div>

      {uploads.length > 0 && (
        <ul className="upload-list">
          {uploads.map((u, i) => (
            <li key={i}>
              <span style={{ minWidth: '8rem' }} className="muted">
                {u.name}
              </span>
              <span className="progress">
                <span style={{ width: `${u.progress}%` }} />
              </span>
              {u.error ? (
                <span className="error">{u.error}</span>
              ) : (
                <span className="muted">{u.progress}%</span>
              )}
            </li>
          ))}
        </ul>
      )}

      {/* Existing images */}
      {images.length > 0 && (
        <div className="admin-image-grid">
          {images.map((img) => {
            const isHero = place.hero_image_url === img.url
            return (
              <div
                key={img.id}
                className={`admin-image${isHero ? ' is-hero' : ''}`}
              >
                <img src={img.url} alt={img.caption || place.name} />
                <div className="body">
                  {isHero && <span className="hero-badge">Hero</span>}
                  <input
                    type="text"
                    placeholder="Caption"
                    defaultValue={img.caption || ''}
                    onBlur={(e) => saveCaption(img, e.target.value)}
                  />
                  <div className="row">
                    <button
                      className="secondary"
                      disabled={isHero}
                      onClick={() => setAsHero(img)}
                    >
                      Set as hero
                    </button>
                    <button className="danger" onClick={() => deleteImage(img)}>
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
