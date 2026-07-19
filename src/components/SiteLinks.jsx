import { useEffect, useRef, useState } from 'react'

const INSTAGRAM_URL = 'https://www.instagram.com/asxstills/'

const MAX_MESSAGE_LENGTH = 500

/**
 * Bottom-right chrome: an email link that opens a small message box, and a link
 * out to Instagram.
 *
 * The owner's address is never in the page. The message goes to a serverless
 * function that holds it in an environment variable and sends the mail — so the
 * address can't be scraped off the site.
 */
export default function SiteLinks() {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  // idle | sending | done | undelivered | error
  const [status, setStatus] = useState('idle')

  const panelRef = useRef(null)
  const firstFieldRef = useRef(null)
  const toggleRef = useRef(null)

  function close() {
    setOpen(false)
    setStatus('idle')
    setName('')
    setEmail('')
    setMessage('')
  }

  // Opening moves focus into the box; Escape closes it and hands focus back to
  // the control that opened it, so the box can't be a keyboard trap.
  useEffect(() => {
    if (!open) return undefined

    firstFieldRef.current?.focus()

    const onKeyDown = (event) => {
      if (event.key !== 'Escape') return
      close()
      toggleRef.current?.focus()
    }

    const onPointerDown = (event) => {
      if (panelRef.current?.contains(event.target)) return
      if (toggleRef.current?.contains(event.target)) return
      close()
    }

    document.addEventListener('keydown', onKeyDown)
    document.addEventListener('pointerdown', onPointerDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.removeEventListener('pointerdown', onPointerDown)
    }
  }, [open])

  const canSend = message.trim().length > 0 && status !== 'sending'

  async function submit(event) {
    event.preventDefault()
    if (!canSend) return

    setStatus('sending')
    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          message: message.trim(),
        }),
      })
      if (!res.ok) throw new Error('send failed')

      // The endpoint accepts the message even when mail isn't configured, and
      // says so. Never report that as sent — it only reached a server log.
      const body = await res.json().catch(() => ({}))
      setStatus(body.delivered === false ? 'undelivered' : 'done')
    } catch {
      setStatus('error')
    }
  }

  return (
    <>
      <div className="site-links">
        <button
          type="button"
          ref={toggleRef}
          onClick={() => (open ? close() : setOpen(true))}
          aria-expanded={open}
        >
          Email
        </button>
        <a
          href={INSTAGRAM_URL}
          target="_blank"
          // noreferrer alongside noopener: the tab this opens gets no window
          // handle back to the site, and no referrer header.
          rel="noopener noreferrer"
        >
          Instagram
        </a>
      </div>

      {open && (
        <div className="contact-panel" ref={panelRef} role="dialog" aria-label="Send a message">
          {status === 'done' || status === 'undelivered' ? (
            <>
              <p className="contact-note">
                {status === 'done' ? (
                  'Thank you — your message has been sent.'
                ) : (
                  <>
                    Email isn’t set up yet, so that didn’t reach anyone. Please{' '}
                    <a
                      className="contact-inline-link"
                      href={INSTAGRAM_URL}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      get in touch on Instagram
                    </a>{' '}
                    instead.
                  </>
                )}
              </p>
              <div className="contact-actions">
                <button type="button" onClick={close}>
                  Close
                </button>
              </div>
            </>
          ) : (
            <form onSubmit={submit}>
              <h2>Send a message</h2>

              <label className="contact-field">
                <span>Name</span>
                <input
                  type="text"
                  ref={firstFieldRef}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </label>

              <label className="contact-field">
                <span>Email</span>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </label>

              <label className="contact-field">
                <span>Message</span>
                <textarea
                  rows={4}
                  value={message}
                  onChange={(e) =>
                    setMessage(e.target.value.slice(0, MAX_MESSAGE_LENGTH))
                  }
                  maxLength={MAX_MESSAGE_LENGTH}
                />
                <span className="contact-count">
                  {message.length}/{MAX_MESSAGE_LENGTH}
                </span>
              </label>

              {status === 'error' && (
                <p className="contact-note">
                  Something went wrong sending that. Please try again.
                </p>
              )}

              <div className="contact-actions">
                <button type="submit" disabled={!canSend}>
                  {status === 'sending' ? 'Sending…' : 'Send'}
                </button>
                <button type="button" onClick={close}>
                  Cancel
                </button>
              </div>
            </form>
          )}
        </div>
      )}
    </>
  )
}
